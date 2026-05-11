-- Fix runtime errors in analytics functions discovered after workspace isolation migration
-- Errors:
--   1. get_driver_utilization: EXTRACT(EPOCH FROM integer) fails — date-date returns integer, not interval
--   2. get_route_efficiency: column v.deleted_at does not exist on vehicles table
--   3. get_vehicle_payload_utilization: column v.deleted_at does not exist on vehicles table
--   4. get_low_stock_alerts: db.facility_ids not in GROUP BY clause

-- ===========================================================================
-- 1. Fix analytics.get_driver_utilization
--    date - date returns INTEGER (days), not INTERVAL → divide by 7.0 directly
-- ===========================================================================

CREATE OR REPLACE FUNCTION analytics.get_driver_utilization(
  p_workspace_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  driver_id UUID,
  driver_name TEXT,
  total_deliveries BIGINT,
  avg_deliveries_per_week NUMERIC,
  total_items_delivered BIGINT,
  total_distance_km NUMERIC,
  avg_items_per_delivery NUMERIC,
  utilization_status TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH date_range AS (
    SELECT
      COALESCE(p_start_date, CURRENT_DATE - 30) AS start_date,
      COALESCE(p_end_date, CURRENT_DATE) AS end_date
  ),
  driver_stats AS (
    SELECT
      d.id AS driver_id,
      d.name AS driver_name,
      COUNT(db.id) AS total_dels,
      SUM(db.total_quantity) AS total_items,
      SUM(db.total_distance) AS total_dist,
      -- date - date = integer (days); divide by 7.0 to get weeks
      ((SELECT end_date FROM date_range) - (SELECT start_date FROM date_range)) / 7.0 AS weeks
    FROM public.drivers d
    LEFT JOIN public.delivery_batches db ON d.id = db.driver_id
      AND db.workspace_id = p_workspace_id
      AND db.status = 'completed'
      AND (p_start_date IS NULL OR db.actual_end_time::DATE >= p_start_date)
      AND (p_end_date IS NULL OR db.actual_end_time::DATE <= p_end_date)
    WHERE d.workspace_id = p_workspace_id
    GROUP BY d.id, d.name
  )
  SELECT
    ds.driver_id,
    ds.driver_name,
    ds.total_dels::BIGINT,
    ROUND(ds.total_dels / NULLIF(ds.weeks, 0), 2),
    ds.total_items::BIGINT,
    ds.total_dist::NUMERIC,
    ROUND(ds.total_items / NULLIF(ds.total_dels, 0), 2),
    CASE
      WHEN ds.total_dels / NULLIF(ds.weeks, 0) >= 10 THEN 'High'
      WHEN ds.total_dels / NULLIF(ds.weeks, 0) >= 5  THEN 'Medium'
      WHEN ds.total_dels / NULLIF(ds.weeks, 0) >= 2  THEN 'Low'
      ELSE 'Underutilized'
    END::TEXT
  FROM driver_stats ds
  ORDER BY ds.total_dels DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_driver_utilization(
  workspace_id UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  driver_id UUID, driver_name TEXT, total_deliveries BIGINT,
  avg_deliveries_per_week NUMERIC, total_items_delivered BIGINT,
  total_distance_km NUMERIC, avg_items_per_delivery NUMERIC, utilization_status TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_driver_utilization(workspace_id, start_date, end_date);
END;
$$;

-- ===========================================================================
-- 2. Fix analytics.get_route_efficiency
--    Remove v.deleted_at reference — vehicles table has no deleted_at column
-- ===========================================================================

CREATE OR REPLACE FUNCTION analytics.get_route_efficiency(
  p_workspace_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  batch_id UUID,
  batch_name TEXT,
  vehicle_plate TEXT,
  estimated_distance_km DECIMAL,
  actual_distance_km DECIMAL,
  distance_variance_pct NUMERIC,
  estimated_duration_min INTEGER,
  actual_duration_min NUMERIC,
  duration_variance_pct NUMERIC,
  efficiency_rating TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH route_comparison AS (
    SELECT
      db.id AS batch_id,
      db.name AS batch_name,
      v.plate_number AS vehicle_plate,
      db.total_distance AS actual_dist,
      COALESCE(db.estimated_distance_km, db.total_distance) AS estimated_dist,
      db.estimated_duration AS estimated_dur,
      EXTRACT(EPOCH FROM (db.actual_end_time - db.actual_start_time)) / 60.0 AS actual_dur_min
    FROM public.delivery_batches db
    JOIN public.vehicles v ON db.vehicle_id = v.id
    WHERE db.workspace_id = p_workspace_id
      AND db.status = 'completed'
      AND db.actual_start_time IS NOT NULL
      AND db.actual_end_time IS NOT NULL
      AND db.estimated_duration IS NOT NULL
      AND (p_start_date IS NULL OR db.actual_end_time::DATE >= p_start_date)
      AND (p_end_date IS NULL OR db.actual_end_time::DATE <= p_end_date)
    -- v.deleted_at removed: vehicles table has no deleted_at column
  )
  SELECT
    rc.batch_id,
    rc.batch_name,
    rc.vehicle_plate,
    rc.estimated_dist::DECIMAL,
    rc.actual_dist::DECIMAL,
    ROUND(((rc.actual_dist - rc.estimated_dist) / NULLIF(rc.estimated_dist, 0))::NUMERIC * 100, 2),
    rc.estimated_dur::INTEGER,
    ROUND(rc.actual_dur_min::NUMERIC, 2),
    ROUND(((rc.actual_dur_min - rc.estimated_dur) / NULLIF(rc.estimated_dur::NUMERIC, 0)) * 100, 2),
    CASE
      WHEN ABS((rc.actual_dur_min - rc.estimated_dur) / NULLIF(rc.estimated_dur::NUMERIC, 0)) <= 0.10 THEN 'Excellent'
      WHEN ABS((rc.actual_dur_min - rc.estimated_dur) / NULLIF(rc.estimated_dur::NUMERIC, 0)) <= 0.25 THEN 'Good'
      WHEN ABS((rc.actual_dur_min - rc.estimated_dur) / NULLIF(rc.estimated_dur::NUMERIC, 0)) <= 0.50 THEN 'Fair'
      ELSE 'Poor'
    END::TEXT
  FROM route_comparison rc
  ORDER BY ABS(ROUND(((rc.actual_dur_min - rc.estimated_dur) / NULLIF(rc.estimated_dur, 0)) * 100, 2)) DESC NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_route_efficiency(
  workspace_id UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  batch_id UUID, batch_name TEXT, vehicle_plate TEXT,
  estimated_distance_km DECIMAL, actual_distance_km DECIMAL, distance_variance_pct NUMERIC,
  estimated_duration_min INTEGER, actual_duration_min NUMERIC,
  duration_variance_pct NUMERIC, efficiency_rating TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_route_efficiency(workspace_id, start_date, end_date);
END;
$$;

-- ===========================================================================
-- 3. Fix analytics.get_vehicle_payload_utilization
--    Remove v.deleted_at reference — vehicles table has no deleted_at column
-- ===========================================================================

CREATE OR REPLACE FUNCTION analytics.get_vehicle_payload_utilization(
  p_workspace_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_vehicle_id UUID DEFAULT NULL
)
RETURNS TABLE (
  vehicle_id UUID,
  plate_number TEXT,
  vehicle_type TEXT,
  vehicle_capacity_kg DECIMAL,
  max_weight_kg INTEGER,
  total_deliveries BIGINT,
  total_items_delivered BIGINT,
  total_weight_kg NUMERIC,
  avg_payload_utilization_pct NUMERIC,
  avg_weight_utilization_pct NUMERIC,
  max_payload_utilization_pct NUMERIC,
  max_weight_utilization_pct NUMERIC,
  underutilized_deliveries BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH delivery_utilization AS (
    SELECT
      db.vehicle_id,
      v.plate_number,
      v.type::TEXT as vehicle_type,
      v.capacity as vehicle_capacity_kg,
      v.max_weight as max_weight_kg,
      db.total_quantity,
      db.total_weight,
      CASE
        WHEN v.capacity > 0 THEN ROUND((db.total_quantity::NUMERIC / v.capacity) * 100, 2)
        ELSE 0
      END as payload_util_pct,
      CASE
        WHEN v.max_weight > 0 AND db.total_weight IS NOT NULL THEN
          ROUND((db.total_weight::NUMERIC / v.max_weight) * 100, 2)
        ELSE NULL
      END as weight_util_pct
    FROM public.delivery_batches db
    JOIN public.vehicles v ON db.vehicle_id = v.id
    WHERE db.workspace_id = p_workspace_id
      AND db.status = 'completed'
      AND (p_start_date IS NULL OR db.actual_end_time::DATE >= p_start_date)
      AND (p_end_date IS NULL OR db.actual_end_time::DATE <= p_end_date)
      AND (p_vehicle_id IS NULL OR db.vehicle_id = p_vehicle_id)
    -- v.deleted_at removed: vehicles table has no deleted_at column
  )
  SELECT
    du.vehicle_id,
    du.plate_number,
    du.vehicle_type,
    du.vehicle_capacity_kg,
    du.max_weight_kg,
    COUNT(*)::BIGINT,
    SUM(du.total_quantity)::BIGINT,
    SUM(du.total_weight)::NUMERIC,
    ROUND(AVG(du.payload_util_pct), 2),
    ROUND(AVG(du.weight_util_pct), 2),
    ROUND(MAX(du.payload_util_pct), 2),
    ROUND(MAX(du.weight_util_pct), 2),
    COUNT(*) FILTER (WHERE du.payload_util_pct < 70)::BIGINT
  FROM delivery_utilization du
  GROUP BY du.vehicle_id, du.plate_number, du.vehicle_type, du.vehicle_capacity_kg, du.max_weight_kg
  ORDER BY avg_payload_utilization_pct DESC NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_vehicle_payload_utilization(
  workspace_id UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  p_vehicle_id UUID DEFAULT NULL
)
RETURNS TABLE (
  vehicle_id UUID, plate_number TEXT, vehicle_type TEXT,
  vehicle_capacity_kg DECIMAL, max_weight_kg INTEGER,
  total_deliveries BIGINT, total_items_delivered BIGINT, total_weight_kg NUMERIC,
  avg_payload_utilization_pct NUMERIC, avg_weight_utilization_pct NUMERIC,
  max_payload_utilization_pct NUMERIC, max_weight_utilization_pct NUMERIC,
  underutilized_deliveries BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_vehicle_payload_utilization(workspace_id, start_date, end_date, p_vehicle_id);
END;
$$;

-- ===========================================================================
-- 4. Fix analytics.get_low_stock_alerts
--    batch_consumption CTE: use LATERAL unnest to avoid GROUP BY conflict
-- ===========================================================================

CREATE OR REPLACE FUNCTION analytics.get_low_stock_alerts(
  p_threshold_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  facility_id UUID,
  facility_name TEXT,
  zone TEXT,
  product_name TEXT,
  current_quantity INTEGER,
  days_supply_remaining NUMERIC,
  last_delivery_date DATE
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_quantity_threshold INTEGER := 10;
BEGIN
  RETURN QUERY
  WITH facility_delivery_history AS (
    SELECT
      fd.facility_id,
      MAX(fd.delivery_date::DATE) as last_delivery
    FROM facility_deliveries fd
    WHERE fd.status = 'delivered'
    GROUP BY fd.facility_id
  ),
  batch_consumption AS (
    -- Use LATERAL unnest to avoid facility_ids GROUP BY conflict
    SELECT
      fac.fac_id,
      db.medication_type as prod_name,
      SUM(db.total_quantity::NUMERIC / NULLIF(array_length(db.facility_ids, 1), 0)) as per_facility_qty,
      COUNT(DISTINCT db.scheduled_date) as delivery_days
    FROM public.delivery_batches db
    CROSS JOIN LATERAL unnest(db.facility_ids) AS fac(fac_id)
    WHERE db.scheduled_date >= CURRENT_DATE - INTERVAL '90 days'
      AND db.status = 'completed'
      AND db.facility_ids IS NOT NULL
      AND array_length(db.facility_ids, 1) > 0
    GROUP BY fac.fac_id, db.medication_type
  ),
  daily_avg AS (
    SELECT
      bc.fac_id,
      bc.prod_name,
      CASE
        WHEN bc.delivery_days > 0 THEN bc.per_facility_qty / GREATEST(bc.delivery_days, 1)
        ELSE 0
      END as avg_daily
    FROM batch_consumption bc
  )
  SELECT
    f.id::UUID,
    f.name::TEXT,
    f.service_zone::TEXT,
    fs.product_name::TEXT,
    fs.quantity::INTEGER,
    CASE
      WHEN da.avg_daily > 0 THEN ROUND((fs.quantity::NUMERIC / da.avg_daily), 1)
      ELSE NULL
    END as days_remaining,
    fdh.last_delivery::DATE
  FROM facility_stock fs
  JOIN facilities f ON fs.facility_id = f.id
  LEFT JOIN daily_avg da ON fs.facility_id = da.fac_id AND fs.product_name = da.prod_name
  LEFT JOIN facility_delivery_history fdh ON fs.facility_id = fdh.facility_id
  WHERE fs.quantity > 0
    AND (
      fs.quantity < v_quantity_threshold
      OR (da.avg_daily > 0 AND (fs.quantity::NUMERIC / da.avg_daily) < p_threshold_days)
    )
  ORDER BY
    CASE
      WHEN da.avg_daily > 0 THEN (fs.quantity::NUMERIC / da.avg_daily)
      ELSE fs.quantity::NUMERIC
    END ASC,
    f.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_low_stock_alerts(
  p_threshold_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  facility_id UUID,
  facility_name TEXT,
  zone TEXT,
  product_name TEXT,
  current_quantity INTEGER,
  days_supply_remaining NUMERIC,
  last_delivery_date DATE
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_low_stock_alerts(p_threshold_days);
END;
$$;

-- ===========================================================================
-- Grants
-- ===========================================================================

GRANT EXECUTE ON FUNCTION analytics.get_driver_utilization(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION analytics.get_route_efficiency(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION analytics.get_vehicle_payload_utilization(UUID, DATE, DATE, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION analytics.get_low_stock_alerts(INTEGER) TO authenticated, anon;

GRANT EXECUTE ON FUNCTION public.get_driver_utilization(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_route_efficiency(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_vehicle_payload_utilization(UUID, DATE, DATE, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_low_stock_alerts(INTEGER) TO authenticated, anon;

-- Fix analytics functions broken by workspace isolation migration
-- Issues:
--   1. get_cost_kpis: FULL OUTER JOIN with non-equi condition not supported
--   2. get_program_performance/get_cost_by_program: referenced db.programme (doesn't exist)
--   3. get_route_efficiency: referenced db.estimated_distance (doesn't exist, column is estimated_distance_km)
--      and used EXTRACT(EPOCH FROM estimated_duration) on an INTEGER
--   4. get_facility_coverage/get_driver_utilization: return schema changed, breaking TypeScript types

-- DROP functions with changed return types so CREATE OR REPLACE can succeed
DROP FUNCTION IF EXISTS analytics.get_program_performance(UUID, DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.get_program_performance(UUID, DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_driver_utilization(UUID, DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.get_driver_utilization(UUID, DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_route_efficiency(UUID, DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.get_route_efficiency(UUID, DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_facility_coverage(UUID, DATE, DATE, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_facility_coverage(UUID, DATE, DATE, TEXT) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_cost_by_program(UUID, DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.get_cost_by_program(UUID, DATE, DATE) CASCADE;

-- ===========================================================================
-- 1. Fix analytics.get_cost_kpis (FULL OUTER JOIN → separate CTEs)
-- ===========================================================================

CREATE OR REPLACE FUNCTION analytics.get_cost_kpis(
  p_workspace_id UUID
)
RETURNS TABLE (
  total_system_cost NUMERIC,
  total_maintenance_cost NUMERIC,
  total_fuel_cost NUMERIC,
  avg_cost_per_item NUMERIC,
  avg_cost_per_km NUMERIC,
  active_vehicles BIGINT,
  active_drivers BIGINT,
  total_items_delivered BIGINT
) AS $$
DECLARE
  v_fuel_price NUMERIC;
BEGIN
  SELECT COALESCE(value_numeric, 1.50) INTO v_fuel_price
  FROM public.system_settings WHERE key = 'fuel_price_per_liter' AND workspace_id IS NULL LIMIT 1;

  RETURN QUERY
  WITH
  fuel_costs AS (
    SELECT COALESCE(SUM(vt.fuel_consumed * v_fuel_price), 0) AS total_fuel
    FROM public.vehicle_trips vt
    JOIN public.delivery_batches db ON db.id = vt.batch_id
    WHERE db.workspace_id = p_workspace_id
      AND vt.fuel_consumed IS NOT NULL
  ),
  maint_costs AS (
    SELECT COALESCE(SUM(vm.cost), 0) AS total_maint
    FROM public.vehicle_maintenance vm
    JOIN public.vehicles v ON v.id = vm.vehicle_id
    WHERE v.workspace_id = p_workspace_id
  ),
  batch_totals AS (
    SELECT
      COALESCE(SUM(db.total_quantity), 0) AS total_qty,
      COALESCE(SUM(db.total_distance), 0) AS total_dist
    FROM public.delivery_batches db
    WHERE db.workspace_id = p_workspace_id AND db.status = 'completed'
  ),
  vehicle_count AS (
    SELECT COUNT(*)::BIGINT AS cnt FROM public.vehicles WHERE workspace_id = p_workspace_id
  ),
  driver_count AS (
    SELECT COUNT(*)::BIGINT AS cnt FROM public.drivers WHERE workspace_id = p_workspace_id
  )
  SELECT
    ROUND(fc.total_fuel + mc.total_maint, 2),
    ROUND(mc.total_maint, 2),
    ROUND(fc.total_fuel, 2),
    CASE WHEN bt.total_qty > 0 THEN ROUND((fc.total_fuel + mc.total_maint) / bt.total_qty, 2) ELSE 0 END,
    CASE WHEN bt.total_dist > 0 THEN ROUND(fc.total_fuel / bt.total_dist, 2) ELSE 0 END,
    vc.cnt,
    dc.cnt,
    bt.total_qty::BIGINT
  FROM fuel_costs fc, maint_costs mc, batch_totals bt, vehicle_count vc, driver_count dc;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.get_cost_kpis(workspace_id UUID)
RETURNS TABLE (
  total_system_cost NUMERIC, total_maintenance_cost NUMERIC, total_fuel_cost NUMERIC,
  avg_cost_per_item NUMERIC, avg_cost_per_km NUMERIC,
  active_vehicles BIGINT, active_drivers BIGINT, total_items_delivered BIGINT
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_cost_kpis(workspace_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ===========================================================================
-- 2. Fix analytics.get_program_performance
--    Original logic: join facilities via CROSS JOIN LATERAL unnest(facility_ids)
--    to get f.programme — NOT db.programme (which doesn't exist on delivery_batches)
-- ===========================================================================

CREATE OR REPLACE FUNCTION analytics.get_program_performance(
  p_workspace_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  programme TEXT,
  total_deliveries BIGINT,
  total_facilities_served BIGINT,
  total_items_delivered BIGINT,
  avg_items_per_delivery NUMERIC,
  on_time_deliveries BIGINT,
  on_time_rate_pct NUMERIC,
  total_distance_km NUMERIC,
  avg_distance_per_delivery_km NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH program_deliveries AS (
    SELECT
      f.programme,
      db.id AS batch_id,
      db.total_quantity,
      db.total_distance,
      CASE
        WHEN db.actual_end_time <= (db.scheduled_date + db.scheduled_time)::TIMESTAMPTZ
        THEN 1 ELSE 0
      END AS is_on_time,
      facility_id
    FROM public.delivery_batches db
    CROSS JOIN LATERAL unnest(db.facility_ids) AS facility_id
    JOIN public.facilities f ON f.id = facility_id
    WHERE db.workspace_id = p_workspace_id
      AND db.status = 'completed'
      AND f.programme IS NOT NULL
      AND f.deleted_at IS NULL
      AND (p_start_date IS NULL OR db.actual_end_time::DATE >= p_start_date)
      AND (p_end_date IS NULL OR db.actual_end_time::DATE <= p_end_date)
  )
  SELECT
    pd.programme::TEXT,
    COUNT(DISTINCT pd.batch_id)::BIGINT,
    COUNT(DISTINCT pd.facility_id)::BIGINT,
    SUM(pd.total_quantity)::BIGINT,
    ROUND(AVG(pd.total_quantity), 2),
    SUM(pd.is_on_time)::BIGINT,
    ROUND((SUM(pd.is_on_time)::NUMERIC / NULLIF(COUNT(DISTINCT pd.batch_id), 0)) * 100, 2),
    SUM(pd.total_distance)::NUMERIC,
    ROUND(AVG(pd.total_distance), 2)
  FROM program_deliveries pd
  GROUP BY pd.programme
  ORDER BY COUNT(DISTINCT pd.batch_id) DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_program_performance(
  workspace_id UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  programme TEXT, total_deliveries BIGINT, total_facilities_served BIGINT,
  total_items_delivered BIGINT, avg_items_per_delivery NUMERIC,
  on_time_deliveries BIGINT, on_time_rate_pct NUMERIC,
  total_distance_km NUMERIC, avg_distance_per_delivery_km NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_program_performance(workspace_id, start_date, end_date);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ===========================================================================
-- 3. Fix analytics.get_driver_utilization
--    Restore original return schema matching TypeScript DriverUtilization type
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
      EXTRACT(EPOCH FROM ((SELECT end_date FROM date_range) - (SELECT start_date FROM date_range))) / 604800.0 AS weeks
    FROM public.drivers d
    LEFT JOIN public.delivery_batches db ON d.id = db.driver_id
      AND db.workspace_id = p_workspace_id
      AND db.status = 'completed'
      AND (p_start_date IS NULL OR db.actual_end_time::DATE >= p_start_date)
      AND (p_end_date IS NULL OR db.actual_end_time::DATE <= p_end_date)
    WHERE d.workspace_id = p_workspace_id
      AND d.deleted_at IS NULL
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
      WHEN ds.total_dels / NULLIF(ds.weeks, 0) >= 5 THEN 'Medium'
      WHEN ds.total_dels / NULLIF(ds.weeks, 0) >= 2 THEN 'Low'
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
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_driver_utilization(workspace_id, start_date, end_date);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ===========================================================================
-- 4. Fix analytics.get_route_efficiency
--    - db.estimated_distance doesn't exist; column is estimated_distance_km
--    - EXTRACT(EPOCH FROM estimated_duration) fails because estimated_duration is INTEGER (minutes)
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
      AND v.deleted_at IS NULL
  )
  SELECT
    rc.batch_id,
    rc.batch_name,
    rc.vehicle_plate,
    rc.estimated_dist::DECIMAL,
    rc.actual_dist::DECIMAL,
    ROUND(((rc.actual_dist - rc.estimated_dist) / NULLIF(rc.estimated_dist, 0)) * 100, 2),
    rc.estimated_dur::INTEGER,
    ROUND(rc.actual_dur_min, 2),
    ROUND(((rc.actual_dur_min - rc.estimated_dur) / NULLIF(rc.estimated_dur, 0)) * 100, 2),
    CASE
      WHEN ABS((rc.actual_dur_min - rc.estimated_dur) / NULLIF(rc.estimated_dur, 0)) <= 0.10 THEN 'Excellent'
      WHEN ABS((rc.actual_dur_min - rc.estimated_dur) / NULLIF(rc.estimated_dur, 0)) <= 0.25 THEN 'Good'
      WHEN ABS((rc.actual_dur_min - rc.estimated_dur) / NULLIF(rc.estimated_dur, 0)) <= 0.50 THEN 'Fair'
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
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_route_efficiency(workspace_id, start_date, end_date);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ===========================================================================
-- 5. Fix analytics.get_facility_coverage
--    Restore original return schema (aggregate stats + per-programme rows)
--    matching TypeScript FacilityCoverage type
-- ===========================================================================

CREATE OR REPLACE FUNCTION analytics.get_facility_coverage(
  p_workspace_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_programme TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_facilities BIGINT,
  facilities_served BIGINT,
  facilities_not_served BIGINT,
  coverage_pct NUMERIC,
  programme TEXT,
  program_total_facilities BIGINT,
  program_facilities_served BIGINT,
  program_coverage_pct NUMERIC,
  unserved_facility_names TEXT[]
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH facilities_in_scope AS (
    SELECT f.id, f.name, f.programme
    FROM public.facilities f
    WHERE f.deleted_at IS NULL
      AND (p_programme IS NULL OR f.programme = p_programme)
  ),
  served_facilities AS (
    SELECT DISTINCT unnest(db.facility_ids) AS facility_id
    FROM public.delivery_batches db
    WHERE db.workspace_id = p_workspace_id
      AND db.status = 'completed'
      AND (p_start_date IS NULL OR db.actual_end_time::DATE >= p_start_date)
      AND (p_end_date IS NULL OR db.actual_end_time::DATE <= p_end_date)
  ),
  overall_stats AS (
    SELECT
      COUNT(f.id)::BIGINT AS total_fac,
      COUNT(sf.facility_id)::BIGINT AS served_fac,
      (COUNT(f.id) - COUNT(sf.facility_id))::BIGINT AS not_served_fac,
      ROUND((COUNT(sf.facility_id)::NUMERIC / NULLIF(COUNT(f.id), 0)) * 100, 2) AS cov_pct
    FROM facilities_in_scope f
    LEFT JOIN served_facilities sf ON f.id = sf.facility_id
  ),
  program_stats AS (
    SELECT
      f.programme,
      COUNT(f.id)::BIGINT AS prog_total,
      COUNT(sf.facility_id)::BIGINT AS prog_served,
      ROUND((COUNT(sf.facility_id)::NUMERIC / NULLIF(COUNT(f.id), 0)) * 100, 2) AS prog_cov_pct
    FROM facilities_in_scope f
    LEFT JOIN served_facilities sf ON f.id = sf.facility_id
    WHERE f.programme IS NOT NULL
    GROUP BY f.programme
  ),
  unserved_list AS (
    SELECT ARRAY_AGG(f.name ORDER BY f.name) AS unserved_names
    FROM facilities_in_scope f
    LEFT JOIN served_facilities sf ON f.id = sf.facility_id
    WHERE sf.facility_id IS NULL
  )
  SELECT
    os.total_fac,
    os.served_fac,
    os.not_served_fac,
    os.cov_pct,
    ps.programme::TEXT,
    ps.prog_total,
    ps.prog_served,
    ps.prog_cov_pct,
    ul.unserved_names
  FROM overall_stats os
  CROSS JOIN program_stats ps
  CROSS JOIN unserved_list ul
  ORDER BY ps.prog_total DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_facility_coverage(
  workspace_id UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  p_programme TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_facilities BIGINT, facilities_served BIGINT, facilities_not_served BIGINT,
  coverage_pct NUMERIC, programme TEXT, program_total_facilities BIGINT,
  program_facilities_served BIGINT, program_coverage_pct NUMERIC,
  unserved_facility_names TEXT[]
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_facility_coverage(workspace_id, start_date, end_date, p_programme);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ===========================================================================
-- 6. Fix analytics.get_cost_by_program
--    Use f.programme from facilities (original approach), restore return schema
-- ===========================================================================

CREATE OR REPLACE FUNCTION analytics.get_cost_by_program(
  p_workspace_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  programme TEXT,
  total_deliveries BIGINT,
  total_fuel_cost NUMERIC,
  total_maintenance_cost NUMERIC,
  total_cost NUMERIC,
  cost_per_delivery NUMERIC,
  cost_per_item NUMERIC,
  cost_per_km NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_fuel_price NUMERIC;
BEGIN
  SELECT COALESCE(value_numeric, 1.50) INTO v_fuel_price
  FROM public.system_settings WHERE key = 'fuel_price_per_liter' AND workspace_id IS NULL LIMIT 1;

  RETURN QUERY
  WITH program_deliveries AS (
    SELECT
      f.programme,
      db.id AS batch_id,
      db.total_quantity,
      db.total_distance,
      vt.id AS trip_id,
      vt.fuel_consumed
    FROM public.delivery_batches db
    CROSS JOIN LATERAL unnest(db.facility_ids) AS facility_id
    JOIN public.facilities f ON f.id = facility_id
    LEFT JOIN public.vehicle_trips vt ON vt.batch_id = db.id
    WHERE db.workspace_id = p_workspace_id
      AND db.status = 'completed'
      AND f.programme IS NOT NULL
      AND f.deleted_at IS NULL
      AND (p_start_date IS NULL OR db.actual_end_time::DATE >= p_start_date)
      AND (p_end_date IS NULL OR db.actual_end_time::DATE <= p_end_date)
  ),
  program_stats AS (
    SELECT
      pd.programme,
      COUNT(DISTINCT pd.batch_id) AS total_dels,
      SUM(DISTINCT pd.total_quantity) AS total_qty,
      SUM(DISTINCT pd.total_distance) AS total_dist,
      COALESCE(SUM(DISTINCT pd.fuel_consumed) * v_fuel_price, 0) AS fuel_cost
    FROM program_deliveries pd
    GROUP BY pd.programme
  )
  SELECT
    ps.programme::TEXT,
    ps.total_dels::BIGINT,
    ROUND(ps.fuel_cost, 2),
    0::NUMERIC AS total_maintenance_cost,
    ROUND(ps.fuel_cost, 2) AS total_cost,
    ROUND(ps.fuel_cost / NULLIF(ps.total_dels, 0), 2),
    ROUND(ps.fuel_cost / NULLIF(ps.total_qty, 0), 2),
    ROUND(ps.fuel_cost / NULLIF(ps.total_dist, 0), 2)
  FROM program_stats ps
  ORDER BY ps.fuel_cost DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_cost_by_program(
  workspace_id UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  programme TEXT, total_deliveries BIGINT,
  total_fuel_cost NUMERIC, total_maintenance_cost NUMERIC, total_cost NUMERIC,
  cost_per_delivery NUMERIC, cost_per_item NUMERIC, cost_per_km NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_cost_by_program(workspace_id, start_date, end_date);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ===========================================================================
-- 7. Grants for updated functions
-- ===========================================================================

GRANT EXECUTE ON FUNCTION analytics.get_cost_kpis(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION analytics.get_program_performance(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION analytics.get_driver_utilization(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION analytics.get_route_efficiency(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION analytics.get_facility_coverage(UUID, DATE, DATE, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION analytics.get_cost_by_program(UUID, DATE, DATE) TO authenticated, anon;

GRANT EXECUTE ON FUNCTION public.get_cost_kpis(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_program_performance(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_driver_utilization(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_route_efficiency(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_facility_coverage(UUID, DATE, DATE, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_cost_by_program(UUID, DATE, DATE) TO authenticated, anon;

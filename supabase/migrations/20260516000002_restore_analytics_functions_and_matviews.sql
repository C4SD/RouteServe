-- Restore analytics schema functions and materialized views.
--
-- Background:
--   Migration 20260516000001_ensure_analytics_schema_for_vehicle_deletion.sql
--   ran `DROP MATERIALIZED VIEW ... CASCADE` on analytics.{vehicle_utilization,
--   delivery_performance, driver_efficiency, cost_analysis} and replaced them
--   with regular stub views that lack workspace_id and most aggregate columns.
--   The CASCADE drop also wiped any analytics.* functions originally created
--   by 20260510000001_analytics_workspace_isolation.sql.
--
--   Result: the public wrapper public.get_dashboard_summary(UUID, DATE, DATE)
--   still exists, but its body calls analytics.get_dashboard_summary(...),
--   which no longer exists. Fleetops dashboard fails with:
--     "function analytics.get_dashboard_summary(uuid, date, date) does not exist"
--
-- This migration restores the materialized views and analytics-schema
-- functions to the state defined by 20260510000001. It is idempotent.

CREATE SCHEMA IF NOT EXISTS analytics;
GRANT USAGE ON SCHEMA analytics TO authenticated, anon;

-- ============================================================================
-- 1. DROP STUB VIEWS / OLD OBJECTS (idempotent)
-- ============================================================================
DROP VIEW IF EXISTS analytics.vehicle_utilization CASCADE;
DROP VIEW IF EXISTS analytics.delivery_performance CASCADE;
DROP VIEW IF EXISTS analytics.driver_efficiency CASCADE;
DROP VIEW IF EXISTS analytics.cost_analysis CASCADE;
DROP MATERIALIZED VIEW IF EXISTS analytics.vehicle_utilization CASCADE;
DROP MATERIALIZED VIEW IF EXISTS analytics.delivery_performance CASCADE;
DROP MATERIALIZED VIEW IF EXISTS analytics.driver_efficiency CASCADE;
DROP MATERIALIZED VIEW IF EXISTS analytics.cost_analysis CASCADE;

-- Drop any pre-existing function signatures we'll recreate so types/columns can change.
DROP FUNCTION IF EXISTS analytics.get_delivery_kpis(UUID, DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_top_vehicles_by_ontime(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_driver_kpis(UUID) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_top_drivers(UUID, TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_vehicle_kpis(UUID) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_vehicles_needing_maintenance(UUID) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_cost_kpis(UUID) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_vehicle_costs(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_driver_costs(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_dashboard_summary(UUID, DATE, DATE) CASCADE;

-- ============================================================================
-- 2. RECREATE MATERIALIZED VIEWS (with workspace_id)
-- ============================================================================

CREATE MATERIALIZED VIEW analytics.delivery_performance AS
SELECT
  db.workspace_id,
  db.id as batch_id,
  db.scheduled_date,
  (db.scheduled_date::timestamp + db.scheduled_time) as scheduled_datetime,
  db.actual_end_time as completed_date,
  db.status::text,
  v.id as vehicle_id,
  v.plate_number as vehicle_number,
  v.type::text as vehicle_type,
  d.id as driver_id,
  d.name as driver_name,
  COALESCE(array_length(db.facility_ids, 1), 0) as facilities_count,
  db.total_quantity as items_count,
  db.total_quantity as total_quantity,
  CASE
    WHEN db.actual_end_time IS NOT NULL AND db.actual_start_time IS NOT NULL
    THEN EXTRACT(EPOCH FROM (db.actual_end_time - db.actual_start_time)) / 3600
    ELSE NULL
  END as completion_time_hours,
  CASE
    WHEN db.actual_end_time IS NOT NULL
    THEN db.actual_end_time <= (db.scheduled_date::timestamp + db.scheduled_time)
    ELSE NULL
  END as on_time,
  CASE WHEN db.status = 'completed' THEN db.total_quantity ELSE 0 END as completed_items,
  CASE WHEN db.status = 'cancelled' THEN db.total_quantity ELSE 0 END as failed_items,
  db.total_distance,
  db.estimated_duration,
  db.priority::text,
  db.created_at,
  db.updated_at
FROM public.delivery_batches db
LEFT JOIN public.vehicles v ON db.vehicle_id = v.id
LEFT JOIN public.drivers d ON db.driver_id = d.id;

CREATE UNIQUE INDEX idx_delivery_perf_batch_id_unique ON analytics.delivery_performance(batch_id);
CREATE INDEX idx_delivery_perf_workspace ON analytics.delivery_performance(workspace_id);
CREATE INDEX idx_delivery_perf_scheduled ON analytics.delivery_performance(scheduled_date DESC);
CREATE INDEX idx_delivery_perf_status ON analytics.delivery_performance(status);

CREATE MATERIALIZED VIEW analytics.driver_efficiency AS
SELECT
  d.workspace_id,
  d.id as driver_id,
  d.name as driver_name,
  d.phone,
  d.license_type::text,
  'available'::text as driver_status,
  d.performance_score,
  d.total_deliveries,
  d.on_time_percentage,
  d.shift_start,
  d.shift_end,
  d.max_hours,
  COUNT(DISTINCT db.id) FILTER (WHERE db.status = 'completed') as completed_batches,
  COUNT(DISTINCT db.id) FILTER (WHERE db.status = 'cancelled') as cancelled_batches,
  COUNT(DISTINCT db.id) as total_batches,
  COUNT(DISTINCT db.id) FILTER (
    WHERE db.status = 'completed'
    AND db.actual_end_time IS NOT NULL
    AND db.actual_end_time <= (db.scheduled_date::timestamp + db.scheduled_time)
  ) as on_time_batches,
  COUNT(DISTINCT db.id) FILTER (
    WHERE db.status = 'completed'
    AND db.actual_end_time IS NOT NULL
    AND db.actual_end_time > (db.scheduled_date::timestamp + db.scheduled_time)
  ) as late_batches,
  ROUND(
    CASE
      WHEN COUNT(DISTINCT db.id) FILTER (WHERE db.status = 'completed' AND db.actual_end_time IS NOT NULL) > 0
      THEN (
        COUNT(DISTINCT db.id) FILTER (
          WHERE db.status = 'completed'
          AND db.actual_end_time IS NOT NULL
          AND db.actual_end_time <= (db.scheduled_date::timestamp + db.scheduled_time)
        )::NUMERIC /
        COUNT(DISTINCT db.id) FILTER (WHERE db.status = 'completed' AND db.actual_end_time IS NOT NULL)::NUMERIC
      ) * 100
      ELSE d.on_time_percentage
    END,
    2
  ) as on_time_rate,
  ROUND(
    AVG(EXTRACT(EPOCH FROM (db.actual_end_time - db.actual_start_time)) / 3600)
      FILTER (WHERE db.actual_end_time IS NOT NULL AND db.actual_start_time IS NOT NULL),
    2
  ) as avg_completion_time_hours,
  SUM(db.total_quantity) FILTER (WHERE db.status = 'completed') as total_items_delivered,
  SUM(db.total_distance) FILTER (WHERE db.status = 'completed') as total_distance_km,
  COUNT(DISTINCT vt.id) as total_trips,
  ROUND(SUM(vt.fuel_consumed), 2) as total_fuel_consumed_liters,
  ROUND(
    CASE
      WHEN SUM(vt.fuel_consumed) > 0
      THEN SUM(db.total_distance) FILTER (WHERE db.status = 'completed') / SUM(vt.fuel_consumed)
      ELSE NULL
    END,
    2
  ) as fuel_efficiency_km_per_liter,
  ROUND(AVG(vt.fuel_consumed) FILTER (WHERE vt.fuel_consumed IS NOT NULL), 2) as avg_fuel_per_trip_liters,
  COUNT(DISTINCT n.id) FILTER (
    WHERE n.type = 'urgent'
    AND n.related_entity_type = 'driver'
  ) as total_incidents,
  MAX(db.actual_end_time) as last_delivery_date,
  MAX(vt.end_time) as last_trip_date,
  d.created_at as driver_created_at,
  d.updated_at as driver_updated_at,
  NOW() as metrics_calculated_at
FROM public.drivers d
LEFT JOIN public.delivery_batches db ON db.driver_id = d.id
LEFT JOIN public.vehicle_trips vt ON vt.driver_id = d.id
LEFT JOIN public.notifications n ON n.related_entity_id = d.id AND n.related_entity_type = 'driver'
GROUP BY
  d.workspace_id, d.id, d.name, d.phone, d.license_type,
  d.performance_score, d.total_deliveries, d.on_time_percentage,
  d.shift_start, d.shift_end, d.max_hours,
  d.created_at, d.updated_at;

CREATE UNIQUE INDEX idx_driver_efficiency_driver_id_unique ON analytics.driver_efficiency(driver_id);
CREATE INDEX idx_driver_efficiency_workspace ON analytics.driver_efficiency(workspace_id);

CREATE MATERIALIZED VIEW analytics.vehicle_utilization AS
SELECT
  v.workspace_id,
  v.id as vehicle_id,
  v.type::text as vehicle_type,
  v.model,
  v.plate_number,
  v.status::text as vehicle_status,
  v.fuel_type::text,
  v.capacity,
  v.max_weight,
  v.avg_speed,
  v.fuel_efficiency as rated_fuel_efficiency,
  v.current_driver_id,
  d.name as current_driver_name,
  COUNT(DISTINCT db.id) as total_batches_assigned,
  COUNT(DISTINCT db.id) FILTER (WHERE db.status = 'completed') as completed_batches,
  COUNT(DISTINCT db.id) FILTER (WHERE db.status = 'in-progress') as active_batches,
  COUNT(DISTINCT db.id) FILTER (WHERE db.status = 'cancelled') as cancelled_batches,
  ROUND(
    CASE
      WHEN COUNT(DISTINCT db.id) > 0
      THEN (COUNT(DISTINCT db.id) FILTER (WHERE db.status = 'completed')::NUMERIC / COUNT(DISTINCT db.id)::NUMERIC) * 100
      ELSE 0
    END,
    2
  ) as utilization_rate,
  SUM(db.total_distance) FILTER (WHERE db.status = 'completed') as total_distance_km,
  SUM(db.total_quantity) FILTER (WHERE db.status = 'completed') as total_items_delivered,
  ROUND(AVG(db.total_distance) FILTER (WHERE db.status = 'completed'), 2) as avg_distance_per_batch_km,
  ROUND(AVG(db.total_quantity) FILTER (WHERE db.status = 'completed'), 2) as avg_items_per_batch,
  COUNT(DISTINCT vt.id) as total_trips,
  ROUND(SUM(vt.fuel_consumed), 2) as total_fuel_consumed_liters,
  ROUND(
    CASE
      WHEN SUM(vt.fuel_consumed) > 0
      THEN SUM(db.total_distance) FILTER (WHERE db.status = 'completed') / SUM(vt.fuel_consumed)
      ELSE NULL
    END,
    2
  ) as actual_fuel_efficiency_km_per_liter,
  ROUND(
    CASE
      WHEN SUM(vt.fuel_consumed) > 0 AND v.fuel_efficiency > 0
      THEN (
        (SUM(db.total_distance) FILTER (WHERE db.status = 'completed') / SUM(vt.fuel_consumed)) - v.fuel_efficiency
      ) / v.fuel_efficiency * 100
      ELSE NULL
    END,
    2
  ) as fuel_efficiency_variance_percent,
  MIN(vt.start_odometer) FILTER (WHERE vt.start_odometer IS NOT NULL) as first_odometer_reading,
  MAX(vt.end_odometer) FILTER (WHERE vt.end_odometer IS NOT NULL) as last_odometer_reading,
  COALESCE(
    MAX(vt.end_odometer) FILTER (WHERE vt.end_odometer IS NOT NULL) -
    MIN(vt.start_odometer) FILTER (WHERE vt.start_odometer IS NOT NULL),
    0
  ) as total_odometer_distance_km,
  COUNT(DISTINCT vm.id) as total_maintenance_events,
  COUNT(DISTINCT vm.id) FILTER (WHERE vm.maintenance_type = 'routine') as routine_maintenance_count,
  COUNT(DISTINCT vm.id) FILTER (WHERE vm.maintenance_type = 'repair') as repair_count,
  COUNT(DISTINCT vm.id) FILTER (WHERE vm.maintenance_type = 'emergency') as emergency_maintenance_count,
  ROUND(COALESCE(SUM(vm.cost), 0), 2) as total_maintenance_cost,
  ROUND(AVG(vm.cost) FILTER (WHERE vm.cost IS NOT NULL), 2) as avg_maintenance_cost,
  COUNT(DISTINCT vm.id) FILTER (WHERE vm.status = 'scheduled') as scheduled_maintenance_count,
  COUNT(DISTINCT vm.id) FILTER (WHERE vm.status = 'in-progress') as maintenance_in_progress_count,
  CASE
    WHEN v.status = 'maintenance' THEN true
    WHEN COUNT(DISTINCT vm.id) FILTER (WHERE vm.status = 'in-progress') > 0 THEN true
    ELSE false
  END as currently_in_maintenance,
  ROUND(
    CASE
      WHEN SUM(db.total_distance) FILTER (WHERE db.status = 'completed') > 0
      THEN COALESCE(SUM(vm.cost), 0) / SUM(db.total_distance) FILTER (WHERE db.status = 'completed')
      ELSE NULL
    END,
    2
  ) as maintenance_cost_per_km,
  MAX(db.actual_end_time) as last_batch_completion,
  MAX(vt.end_time) as last_trip_date,
  MAX(vm.scheduled_date) as next_maintenance_date,
  v.created_at as vehicle_created_at,
  v.updated_at as vehicle_updated_at,
  NOW() as metrics_calculated_at
FROM public.vehicles v
LEFT JOIN public.drivers d ON v.current_driver_id = d.id
LEFT JOIN public.delivery_batches db ON db.vehicle_id = v.id
LEFT JOIN public.vehicle_trips vt ON vt.vehicle_id = v.id
LEFT JOIN public.vehicle_maintenance vm ON vm.vehicle_id = v.id
GROUP BY
  v.workspace_id, v.id, v.type, v.model, v.plate_number, v.status, v.fuel_type,
  v.capacity, v.max_weight, v.avg_speed, v.fuel_efficiency,
  v.current_driver_id, d.name, v.created_at, v.updated_at;

CREATE UNIQUE INDEX idx_vehicle_utilization_vehicle_id_unique ON analytics.vehicle_utilization(vehicle_id);
CREATE INDEX idx_vehicle_utilization_workspace ON analytics.vehicle_utilization(workspace_id);

-- ============================================================================
-- 3. RECREATE ANALYTICS FUNCTIONS (workspace-isolated)
-- ============================================================================

CREATE FUNCTION analytics.get_delivery_kpis(
  p_workspace_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  total_batches BIGINT,
  completed_batches BIGINT,
  on_time_batches BIGINT,
  late_batches BIGINT,
  on_time_rate NUMERIC,
  avg_completion_time_hours NUMERIC,
  total_items_delivered BIGINT,
  total_distance_km NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE dp.status = 'completed')::BIGINT,
    COUNT(*) FILTER (WHERE dp.on_time = true)::BIGINT,
    COUNT(*) FILTER (WHERE dp.on_time = false)::BIGINT,
    ROUND(
      (COUNT(*) FILTER (WHERE dp.on_time = true)::NUMERIC /
       NULLIF(COUNT(*) FILTER (WHERE dp.status = 'completed'), 0)::NUMERIC) * 100,
      2
    ),
    ROUND(AVG(dp.completion_time_hours) FILTER (WHERE dp.completion_time_hours IS NOT NULL), 2),
    COALESCE(SUM(dp.items_count), 0)::BIGINT,
    COALESCE(SUM(dp.total_distance), 0)
  FROM analytics.delivery_performance dp
  WHERE dp.workspace_id = p_workspace_id
    AND (p_start_date IS NULL OR dp.scheduled_date >= p_start_date)
    AND (p_end_date IS NULL OR dp.scheduled_date <= p_end_date);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE FUNCTION analytics.get_top_vehicles_by_ontime(
  p_workspace_id UUID,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  vehicle_id UUID,
  vehicle_number TEXT,
  vehicle_type TEXT,
  on_time_batches BIGINT,
  total_batches BIGINT,
  on_time_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dp.vehicle_id,
    dp.vehicle_number,
    dp.vehicle_type,
    COUNT(*) FILTER (WHERE dp.on_time = true)::BIGINT,
    COUNT(*)::BIGINT,
    ROUND(
      (COUNT(*) FILTER (WHERE dp.on_time = true)::NUMERIC /
       NULLIF(COUNT(*), 0)::NUMERIC) * 100,
      2
    )
  FROM analytics.delivery_performance dp
  WHERE dp.workspace_id = p_workspace_id
    AND dp.vehicle_id IS NOT NULL
    AND dp.status = 'completed'
  GROUP BY dp.vehicle_id, dp.vehicle_number, dp.vehicle_type
  ORDER BY 6 DESC NULLS LAST
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE FUNCTION analytics.get_driver_kpis(p_workspace_id UUID)
RETURNS TABLE (
  total_drivers BIGINT,
  active_drivers BIGINT,
  avg_on_time_rate NUMERIC,
  avg_fuel_efficiency NUMERIC,
  total_incidents BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE de.total_batches > 0)::BIGINT,
    ROUND(AVG(de.on_time_rate) FILTER (WHERE de.on_time_rate IS NOT NULL), 2),
    ROUND(AVG(de.fuel_efficiency_km_per_liter) FILTER (WHERE de.fuel_efficiency_km_per_liter IS NOT NULL), 2),
    COALESCE(SUM(de.total_incidents), 0)::BIGINT
  FROM analytics.driver_efficiency de
  WHERE de.workspace_id = p_workspace_id;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE FUNCTION analytics.get_top_drivers(
  p_workspace_id UUID,
  metric TEXT DEFAULT 'on_time_rate',
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  driver_id UUID,
  driver_name TEXT,
  on_time_rate NUMERIC,
  completed_batches BIGINT,
  total_items_delivered BIGINT,
  fuel_efficiency_km_per_liter NUMERIC,
  total_incidents BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.driver_id,
    de.driver_name,
    de.on_time_rate,
    de.completed_batches::BIGINT,
    COALESCE(de.total_items_delivered, 0)::BIGINT,
    de.fuel_efficiency_km_per_liter,
    de.total_incidents::BIGINT
  FROM analytics.driver_efficiency de
  WHERE de.workspace_id = p_workspace_id
    AND de.total_batches > 0
  ORDER BY
    CASE metric
      WHEN 'on_time_rate' THEN de.on_time_rate
      WHEN 'fuel_efficiency' THEN de.fuel_efficiency_km_per_liter
      WHEN 'deliveries' THEN de.completed_batches::NUMERIC
      ELSE de.on_time_rate
    END DESC NULLS LAST
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE FUNCTION analytics.get_vehicle_kpis(p_workspace_id UUID)
RETURNS TABLE (
  total_vehicles BIGINT,
  active_vehicles BIGINT,
  in_maintenance BIGINT,
  avg_utilization_rate NUMERIC,
  avg_fuel_efficiency NUMERIC,
  total_maintenance_cost NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE vu.total_batches_assigned > 0)::BIGINT,
    COUNT(*) FILTER (WHERE vu.currently_in_maintenance = true)::BIGINT,
    ROUND(AVG(vu.utilization_rate) FILTER (WHERE vu.utilization_rate IS NOT NULL), 2),
    ROUND(AVG(vu.actual_fuel_efficiency_km_per_liter) FILTER (WHERE vu.actual_fuel_efficiency_km_per_liter IS NOT NULL), 2),
    COALESCE(SUM(vu.total_maintenance_cost), 0)::NUMERIC
  FROM analytics.vehicle_utilization vu
  WHERE vu.workspace_id = p_workspace_id;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE FUNCTION analytics.get_vehicles_needing_maintenance(p_workspace_id UUID)
RETURNS TABLE (
  vehicle_id UUID,
  plate_number TEXT,
  vehicle_type TEXT,
  total_distance_km NUMERIC,
  last_maintenance_date DATE,
  maintenance_in_progress BIGINT,
  total_maintenance_cost NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vu.vehicle_id,
    vu.plate_number,
    vu.vehicle_type,
    COALESCE(vu.total_distance_km, 0)::NUMERIC,
    vu.next_maintenance_date,
    vu.maintenance_in_progress_count::BIGINT,
    COALESCE(vu.total_maintenance_cost, 0)::NUMERIC
  FROM analytics.vehicle_utilization vu
  WHERE vu.workspace_id = p_workspace_id
    AND vu.currently_in_maintenance = false
    AND (
      vu.total_distance_km > 10000
      OR vu.next_maintenance_date <= CURRENT_DATE + INTERVAL '7 days'
    )
  ORDER BY vu.total_distance_km DESC;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE FUNCTION analytics.get_cost_kpis(p_workspace_id UUID)
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
  v_op_cost_km NUMERIC;
BEGIN
  SELECT COALESCE(value_numeric, 1.50) INTO v_fuel_price
  FROM public.system_settings WHERE key = 'fuel_price_per_liter' AND workspace_id IS NULL LIMIT 1;

  SELECT COALESCE(value_numeric, 0.50) INTO v_op_cost_km
  FROM public.system_settings WHERE key = 'operational_cost_per_km' AND workspace_id IS NULL LIMIT 1;

  RETURN QUERY
  WITH fuel_costs AS (
    SELECT
      vt.vehicle_id,
      vt.driver_id,
      COALESCE(vt.fuel_consumed * v_fuel_price, 0) as fuel_cost
    FROM public.vehicle_trips vt
    JOIN public.delivery_batches db ON db.id = vt.batch_id
    WHERE db.workspace_id = p_workspace_id
      AND vt.fuel_consumed IS NOT NULL
  ),
  vehicle_maint AS (
    SELECT vm.vehicle_id, COALESCE(SUM(vm.cost), 0) as maintenance_cost
    FROM public.vehicle_maintenance vm
    JOIN public.vehicles v ON v.id = vm.vehicle_id
    WHERE v.workspace_id = p_workspace_id
    GROUP BY vm.vehicle_id
  ),
  batch_ops AS (
    SELECT
      db.vehicle_id,
      db.driver_id,
      COALESCE(db.total_distance * v_op_cost_km, 0) as operational_cost,
      db.total_quantity,
      db.total_distance
    FROM public.delivery_batches db
    WHERE db.workspace_id = p_workspace_id AND db.status = 'completed'
  )
  SELECT
    COALESCE(SUM(DISTINCT fc.fuel_cost), 0) + COALESCE(SUM(DISTINCT vm.maintenance_cost), 0),
    COALESCE(SUM(DISTINCT vm.maintenance_cost), 0),
    COALESCE(SUM(DISTINCT fc.fuel_cost), 0),
    CASE
      WHEN COALESCE(SUM(bo.total_quantity), 0) > 0
      THEN ROUND(
        (COALESCE(SUM(DISTINCT fc.fuel_cost), 0) + COALESCE(SUM(DISTINCT vm.maintenance_cost), 0)) /
        NULLIF(SUM(bo.total_quantity), 0),
        2
      )
      ELSE 0
    END,
    CASE
      WHEN COALESCE(SUM(bo.total_distance), 0) > 0
      THEN ROUND(
        COALESCE(SUM(DISTINCT fc.fuel_cost), 0) /
        NULLIF(SUM(bo.total_distance), 0),
        2
      )
      ELSE 0
    END,
    COUNT(DISTINCT v.id) FILTER (WHERE v.workspace_id = p_workspace_id)::BIGINT,
    COUNT(DISTINCT d.id) FILTER (WHERE d.workspace_id = p_workspace_id)::BIGINT,
    COALESCE(SUM(bo.total_quantity), 0)::BIGINT
  FROM public.vehicles v
  FULL OUTER JOIN fuel_costs fc ON fc.vehicle_id = v.id
  FULL OUTER JOIN vehicle_maint vm ON vm.vehicle_id = v.id
  FULL OUTER JOIN batch_ops bo ON bo.vehicle_id = v.id
  FULL OUTER JOIN public.drivers d ON d.workspace_id = p_workspace_id
  WHERE v.workspace_id = p_workspace_id OR d.workspace_id = p_workspace_id;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE FUNCTION analytics.get_vehicle_costs(
  p_workspace_id UUID,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  vehicle_id UUID,
  total_cost NUMERIC,
  maintenance_cost NUMERIC,
  fuel_cost NUMERIC,
  fuel_consumed_liters NUMERIC,
  maintenance_events BIGINT
) AS $$
DECLARE
  v_fuel_price NUMERIC;
BEGIN
  SELECT COALESCE(value_numeric, 1.50) INTO v_fuel_price
  FROM public.system_settings WHERE key = 'fuel_price_per_liter' AND workspace_id IS NULL LIMIT 1;

  RETURN QUERY
  SELECT
    v.id,
    ROUND(COALESCE(SUM(vm.cost), 0) + COALESCE(SUM(vt.fuel_consumed * v_fuel_price), 0), 2),
    ROUND(COALESCE(SUM(vm.cost), 0), 2),
    ROUND(COALESCE(SUM(vt.fuel_consumed * v_fuel_price), 0), 2),
    ROUND(COALESCE(SUM(vt.fuel_consumed), 0), 2),
    COUNT(DISTINCT vm.id)::BIGINT
  FROM public.vehicles v
  LEFT JOIN public.vehicle_maintenance vm ON vm.vehicle_id = v.id
  LEFT JOIN public.vehicle_trips vt ON vt.vehicle_id = v.id AND vt.fuel_consumed IS NOT NULL
  WHERE v.workspace_id = p_workspace_id
  GROUP BY v.id
  ORDER BY 2 DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE FUNCTION analytics.get_driver_costs(
  p_workspace_id UUID,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  driver_id UUID,
  total_cost NUMERIC,
  fuel_cost NUMERIC,
  operational_cost NUMERIC,
  items_delivered BIGINT,
  distance_covered NUMERIC,
  cost_per_item NUMERIC
) AS $$
DECLARE
  v_fuel_price NUMERIC;
  v_op_cost_km NUMERIC;
BEGIN
  SELECT COALESCE(value_numeric, 1.50) INTO v_fuel_price
  FROM public.system_settings WHERE key = 'fuel_price_per_liter' AND workspace_id IS NULL LIMIT 1;

  SELECT COALESCE(value_numeric, 0.50) INTO v_op_cost_km
  FROM public.system_settings WHERE key = 'operational_cost_per_km' AND workspace_id IS NULL LIMIT 1;

  RETURN QUERY
  SELECT
    d.id,
    ROUND(
      COALESCE(SUM(vt.fuel_consumed * v_fuel_price), 0) +
      COALESCE(SUM(db.total_distance * v_op_cost_km) FILTER (WHERE db.status = 'completed'), 0),
      2
    ),
    ROUND(COALESCE(SUM(vt.fuel_consumed * v_fuel_price), 0), 2),
    ROUND(COALESCE(SUM(db.total_distance * v_op_cost_km) FILTER (WHERE db.status = 'completed'), 0), 2),
    COALESCE(SUM(db.total_quantity) FILTER (WHERE db.status = 'completed'), 0)::BIGINT,
    COALESCE(SUM(db.total_distance) FILTER (WHERE db.status = 'completed'), 0),
    ROUND(
      CASE
        WHEN COALESCE(SUM(db.total_quantity) FILTER (WHERE db.status = 'completed'), 0) > 0
        THEN (
          COALESCE(SUM(vt.fuel_consumed * v_fuel_price), 0) +
          COALESCE(SUM(db.total_distance * v_op_cost_km) FILTER (WHERE db.status = 'completed'), 0)
        ) / NULLIF(SUM(db.total_quantity) FILTER (WHERE db.status = 'completed'), 0)
        ELSE 0
      END,
      2
    )
  FROM public.drivers d
  LEFT JOIN public.vehicle_trips vt ON vt.driver_id = d.id AND vt.fuel_consumed IS NOT NULL
  LEFT JOIN public.delivery_batches db ON db.driver_id = d.id AND db.workspace_id = p_workspace_id
  WHERE d.workspace_id = p_workspace_id
  GROUP BY d.id
  ORDER BY 2 DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE FUNCTION analytics.get_dashboard_summary(
  p_workspace_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  total_deliveries BIGINT,
  on_time_rate NUMERIC,
  avg_completion_hours NUMERIC,
  total_items BIGINT,
  active_vehicles BIGINT,
  vehicle_utilization_rate NUMERIC,
  vehicles_in_maintenance BIGINT,
  active_drivers BIGINT,
  driver_on_time_rate NUMERIC,
  total_incidents BIGINT,
  total_cost NUMERIC,
  cost_per_item NUMERIC,
  cost_per_km NUMERIC
) AS $$
DECLARE
  v_total_deliveries BIGINT;
  v_on_time_rate NUMERIC;
  v_avg_completion_hours NUMERIC;
  v_total_items BIGINT;
  v_active_vehicles BIGINT;
  v_vehicle_utilization_rate NUMERIC;
  v_vehicles_in_maintenance BIGINT;
  v_active_drivers BIGINT;
  v_driver_on_time_rate NUMERIC;
  v_total_incidents BIGINT;
  v_total_cost NUMERIC;
  v_cost_per_item NUMERIC;
  v_cost_per_km NUMERIC;
BEGIN
  SELECT d.completed_batches, d.on_time_rate, d.avg_completion_time_hours, d.total_items_delivered
  INTO v_total_deliveries, v_on_time_rate, v_avg_completion_hours, v_total_items
  FROM analytics.get_delivery_kpis(p_workspace_id, p_start_date, p_end_date) d;

  SELECT v.active_vehicles, v.avg_utilization_rate, v.in_maintenance
  INTO v_active_vehicles, v_vehicle_utilization_rate, v_vehicles_in_maintenance
  FROM analytics.get_vehicle_kpis(p_workspace_id) v;

  SELECT dr.active_drivers, dr.avg_on_time_rate, dr.total_incidents
  INTO v_active_drivers, v_driver_on_time_rate, v_total_incidents
  FROM analytics.get_driver_kpis(p_workspace_id) dr;

  SELECT c.total_system_cost, c.avg_cost_per_item, c.avg_cost_per_km
  INTO v_total_cost, v_cost_per_item, v_cost_per_km
  FROM analytics.get_cost_kpis(p_workspace_id) c;

  RETURN QUERY SELECT
    v_total_deliveries, v_on_time_rate, v_avg_completion_hours, v_total_items,
    v_active_vehicles, v_vehicle_utilization_rate, v_vehicles_in_maintenance,
    v_active_drivers, v_driver_on_time_rate, v_total_incidents,
    v_total_cost, v_cost_per_item, v_cost_per_km;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 4. RECREATE PUBLIC WRAPPERS (idempotent, matches 20260510000001 signatures)
-- ============================================================================
-- The public wrappers may already exist from 20260510000001 if it succeeded.
-- CREATE OR REPLACE keeps them aligned with the analytics signatures above.

CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
  workspace_id UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  total_deliveries BIGINT, on_time_rate NUMERIC, avg_completion_hours NUMERIC,
  total_items BIGINT, active_vehicles BIGINT, vehicle_utilization_rate NUMERIC,
  vehicles_in_maintenance BIGINT, active_drivers BIGINT, driver_on_time_rate NUMERIC,
  total_incidents BIGINT, total_cost NUMERIC, cost_per_item NUMERIC, cost_per_km NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_dashboard_summary(workspace_id, start_date, end_date);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- 5. GRANTS
-- ============================================================================
GRANT SELECT ON analytics.delivery_performance TO authenticated, anon;
GRANT SELECT ON analytics.driver_efficiency   TO authenticated, anon;
GRANT SELECT ON analytics.vehicle_utilization TO authenticated, anon;

GRANT EXECUTE ON FUNCTION analytics.get_delivery_kpis(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION analytics.get_top_vehicles_by_ontime(UUID, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION analytics.get_driver_kpis(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION analytics.get_top_drivers(UUID, TEXT, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION analytics.get_vehicle_kpis(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION analytics.get_vehicles_needing_maintenance(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION analytics.get_cost_kpis(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION analytics.get_vehicle_costs(UUID, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION analytics.get_driver_costs(UUID, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION analytics.get_dashboard_summary(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(UUID, DATE, DATE) TO authenticated, anon;

-- ============================================================================
-- 6. INITIAL POPULATE
-- ============================================================================
REFRESH MATERIALIZED VIEW analytics.delivery_performance;
REFRESH MATERIALIZED VIEW analytics.driver_efficiency;
REFRESH MATERIALIZED VIEW analytics.vehicle_utilization;

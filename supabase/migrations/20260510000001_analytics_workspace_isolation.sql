-- Migration: Add workspace isolation to analytics functions and materialized views
-- Fixes: Data leak where users could see analytics from other workspaces
-- Date: 2026-05-10

-- ===========================================================================
-- STEP 1: Drop existing public wrapper functions
-- ===========================================================================
DROP FUNCTION IF EXISTS public.get_delivery_kpis(DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.get_driver_kpis() CASCADE;
DROP FUNCTION IF EXISTS public.get_vehicle_kpis() CASCADE;
DROP FUNCTION IF EXISTS public.get_cost_kpis() CASCADE;
DROP FUNCTION IF EXISTS public.get_dashboard_summary(DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.get_top_vehicles_by_ontime(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_top_drivers(TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_vehicles_needing_maintenance() CASCADE;
DROP FUNCTION IF EXISTS public.get_vehicle_costs(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_driver_costs(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_vehicle_payload_utilization(DATE, DATE, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_program_performance(DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.get_driver_utilization(DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.get_route_efficiency(DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.get_facility_coverage(DATE, DATE, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_cost_by_program(DATE, DATE) CASCADE;

-- ===========================================================================
-- STEP 2: Drop existing analytics schema functions
-- ===========================================================================
DROP FUNCTION IF EXISTS analytics.get_delivery_kpis(DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_driver_kpis() CASCADE;
DROP FUNCTION IF EXISTS analytics.get_vehicle_kpis() CASCADE;
DROP FUNCTION IF EXISTS analytics.get_cost_kpis() CASCADE;
DROP FUNCTION IF EXISTS analytics.get_dashboard_summary(DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_top_vehicles_by_ontime(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_top_drivers(TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_vehicles_needing_maintenance() CASCADE;
DROP FUNCTION IF EXISTS analytics.get_vehicle_costs(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_driver_costs(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_vehicle_payload_utilization(DATE, DATE, UUID) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_program_performance(DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_driver_utilization(DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_route_efficiency(DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_facility_coverage(DATE, DATE, TEXT) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_cost_by_program(DATE, DATE) CASCADE;

-- ===========================================================================
-- STEP 3: Drop and recreate materialized views with workspace_id
-- ===========================================================================

-- 3.1 delivery_performance
DROP MATERIALIZED VIEW IF EXISTS analytics.delivery_performance CASCADE;

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
CREATE INDEX idx_delivery_perf_vehicle ON analytics.delivery_performance(vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX idx_delivery_perf_driver ON analytics.delivery_performance(driver_id) WHERE driver_id IS NOT NULL;
CREATE INDEX idx_delivery_perf_on_time ON analytics.delivery_performance(on_time) WHERE on_time IS NOT NULL;
CREATE INDEX idx_delivery_perf_workspace_status ON analytics.delivery_performance(workspace_id, status);

-- 3.2 driver_efficiency
DROP MATERIALIZED VIEW IF EXISTS analytics.driver_efficiency CASCADE;

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
    AVG(
      EXTRACT(EPOCH FROM (db.actual_end_time - db.actual_start_time)) / 3600
    ) FILTER (
      WHERE db.actual_end_time IS NOT NULL
      AND db.actual_start_time IS NOT NULL
    ),
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
  ROUND(
    AVG(vt.fuel_consumed) FILTER (WHERE vt.fuel_consumed IS NOT NULL),
    2
  ) as avg_fuel_per_trip_liters,
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
CREATE INDEX idx_driver_efficiency_status ON analytics.driver_efficiency(driver_status);
CREATE INDEX idx_driver_efficiency_on_time_rate ON analytics.driver_efficiency(on_time_rate DESC) WHERE on_time_rate IS NOT NULL;
CREATE INDEX idx_driver_efficiency_performance ON analytics.driver_efficiency(performance_score DESC) WHERE performance_score IS NOT NULL;
CREATE INDEX idx_driver_efficiency_total_batches ON analytics.driver_efficiency(total_batches DESC);
CREATE INDEX idx_driver_efficiency_workspace_ontime ON analytics.driver_efficiency(workspace_id, on_time_rate DESC);

-- 3.3 vehicle_utilization
DROP MATERIALIZED VIEW IF EXISTS analytics.vehicle_utilization CASCADE;

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
CREATE INDEX idx_vehicle_utilization_status ON analytics.vehicle_utilization(vehicle_status);
CREATE INDEX idx_vehicle_utilization_type ON analytics.vehicle_utilization(vehicle_type);
CREATE INDEX idx_vehicle_utilization_rate ON analytics.vehicle_utilization(utilization_rate DESC) WHERE utilization_rate IS NOT NULL;
CREATE INDEX idx_vehicle_utilization_workspace_status ON analytics.vehicle_utilization(workspace_id, vehicle_status);

-- 3.4 cost_analysis: drop (functions will query base tables directly)
DROP MATERIALIZED VIEW IF EXISTS analytics.cost_analysis CASCADE;

-- ===========================================================================
-- STEP 4: Recreate analytics schema functions with workspace isolation
-- ===========================================================================

-- 4.1 get_delivery_kpis
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
    COUNT(*)::BIGINT as total_batches,
    COUNT(*) FILTER (WHERE dp.status = 'completed')::BIGINT as completed_batches,
    COUNT(*) FILTER (WHERE dp.on_time = true)::BIGINT as on_time_batches,
    COUNT(*) FILTER (WHERE dp.on_time = false)::BIGINT as late_batches,
    ROUND(
      (COUNT(*) FILTER (WHERE dp.on_time = true)::NUMERIC /
       NULLIF(COUNT(*) FILTER (WHERE dp.status = 'completed'), 0)::NUMERIC) * 100,
      2
    ) as on_time_rate,
    ROUND(AVG(dp.completion_time_hours) FILTER (WHERE dp.completion_time_hours IS NOT NULL), 2) as avg_completion_time_hours,
    COALESCE(SUM(dp.items_count), 0)::BIGINT as total_items_delivered,
    COALESCE(SUM(dp.total_distance), 0) as total_distance_km
  FROM analytics.delivery_performance dp
  WHERE dp.workspace_id = p_workspace_id
    AND (p_start_date IS NULL OR dp.scheduled_date >= p_start_date)
    AND (p_end_date IS NULL OR dp.scheduled_date <= p_end_date);
END;
$$ LANGUAGE plpgsql STABLE;

-- 4.2 get_top_vehicles_by_ontime
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

-- 4.3 get_driver_kpis
CREATE FUNCTION analytics.get_driver_kpis(
  p_workspace_id UUID
)
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
    COUNT(*)::BIGINT as total_drivers,
    COUNT(*) FILTER (WHERE de.total_batches > 0)::BIGINT as active_drivers,
    ROUND(AVG(de.on_time_rate) FILTER (WHERE de.on_time_rate IS NOT NULL), 2) as avg_on_time_rate,
    ROUND(AVG(de.fuel_efficiency_km_per_liter) FILTER (WHERE de.fuel_efficiency_km_per_liter IS NOT NULL), 2) as avg_fuel_efficiency,
    COALESCE(SUM(de.total_incidents), 0)::BIGINT as total_incidents
  FROM analytics.driver_efficiency de
  WHERE de.workspace_id = p_workspace_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4.4 get_top_drivers
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

-- 4.5 get_vehicle_kpis
CREATE FUNCTION analytics.get_vehicle_kpis(
  p_workspace_id UUID
)
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
    COUNT(*)::BIGINT as total_vehicles,
    COUNT(*) FILTER (WHERE vu.total_batches_assigned > 0)::BIGINT as active_vehicles,
    COUNT(*) FILTER (WHERE vu.currently_in_maintenance = true)::BIGINT as in_maintenance,
    ROUND(AVG(vu.utilization_rate) FILTER (WHERE vu.utilization_rate IS NOT NULL), 2) as avg_utilization_rate,
    ROUND(AVG(vu.actual_fuel_efficiency_km_per_liter) FILTER (WHERE vu.actual_fuel_efficiency_km_per_liter IS NOT NULL), 2) as avg_fuel_efficiency,
    COALESCE(SUM(vu.total_maintenance_cost), 0)::NUMERIC as total_maintenance_cost
  FROM analytics.vehicle_utilization vu
  WHERE vu.workspace_id = p_workspace_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4.6 get_vehicles_needing_maintenance
CREATE FUNCTION analytics.get_vehicles_needing_maintenance(
  p_workspace_id UUID
)
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

-- 4.7 get_cost_kpis (queries base tables directly — cost_analysis view dropped)
CREATE FUNCTION analytics.get_cost_kpis(
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
    COALESCE(SUM(DISTINCT fc.fuel_cost), 0) + COALESCE(SUM(DISTINCT vm.maintenance_cost), 0) as total_system_cost,
    COALESCE(SUM(DISTINCT vm.maintenance_cost), 0) as total_maintenance_cost,
    COALESCE(SUM(DISTINCT fc.fuel_cost), 0) as total_fuel_cost,
    CASE
      WHEN COALESCE(SUM(bo.total_quantity), 0) > 0
      THEN ROUND(
        (COALESCE(SUM(DISTINCT fc.fuel_cost), 0) + COALESCE(SUM(DISTINCT vm.maintenance_cost), 0)) /
        NULLIF(SUM(bo.total_quantity), 0),
        2
      )
      ELSE 0
    END as avg_cost_per_item,
    CASE
      WHEN COALESCE(SUM(bo.total_distance), 0) > 0
      THEN ROUND(
        COALESCE(SUM(DISTINCT fc.fuel_cost), 0) /
        NULLIF(SUM(bo.total_distance), 0),
        2
      )
      ELSE 0
    END as avg_cost_per_km,
    COUNT(DISTINCT v.id) FILTER (WHERE v.workspace_id = p_workspace_id)::BIGINT as active_vehicles,
    COUNT(DISTINCT d.id) FILTER (WHERE d.workspace_id = p_workspace_id)::BIGINT as active_drivers,
    COALESCE(SUM(bo.total_quantity), 0)::BIGINT as total_items_delivered
  FROM public.vehicles v
  FULL OUTER JOIN fuel_costs fc ON fc.vehicle_id = v.id
  FULL OUTER JOIN vehicle_maint vm ON vm.vehicle_id = v.id
  FULL OUTER JOIN batch_ops bo ON bo.vehicle_id = v.id
  FULL OUTER JOIN public.drivers d ON d.workspace_id = p_workspace_id
  WHERE v.workspace_id = p_workspace_id OR d.workspace_id = p_workspace_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4.8 get_vehicle_costs (queries base tables directly)
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
    v.id as vehicle_id,
    ROUND(COALESCE(SUM(vm.cost), 0) + COALESCE(SUM(vt.fuel_consumed * v_fuel_price), 0), 2) as total_cost,
    ROUND(COALESCE(SUM(vm.cost), 0), 2) as maintenance_cost,
    ROUND(COALESCE(SUM(vt.fuel_consumed * v_fuel_price), 0), 2) as fuel_cost,
    ROUND(COALESCE(SUM(vt.fuel_consumed), 0), 2) as fuel_consumed_liters,
    COUNT(DISTINCT vm.id)::BIGINT as maintenance_events
  FROM public.vehicles v
  LEFT JOIN public.vehicle_maintenance vm ON vm.vehicle_id = v.id
  LEFT JOIN public.vehicle_trips vt ON vt.vehicle_id = v.id AND vt.fuel_consumed IS NOT NULL
  WHERE v.workspace_id = p_workspace_id
  GROUP BY v.id
  ORDER BY total_cost DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4.9 get_driver_costs (queries base tables directly)
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
    d.id as driver_id,
    ROUND(
      COALESCE(SUM(vt.fuel_consumed * v_fuel_price), 0) +
      COALESCE(SUM(db.total_distance * v_op_cost_km) FILTER (WHERE db.status = 'completed'), 0),
      2
    ) as total_cost,
    ROUND(COALESCE(SUM(vt.fuel_consumed * v_fuel_price), 0), 2) as fuel_cost,
    ROUND(COALESCE(SUM(db.total_distance * v_op_cost_km) FILTER (WHERE db.status = 'completed'), 0), 2) as operational_cost,
    COALESCE(SUM(db.total_quantity) FILTER (WHERE db.status = 'completed'), 0)::BIGINT as items_delivered,
    COALESCE(SUM(db.total_distance) FILTER (WHERE db.status = 'completed'), 0) as distance_covered,
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
    ) as cost_per_item
  FROM public.drivers d
  LEFT JOIN public.vehicle_trips vt ON vt.driver_id = d.id AND vt.fuel_consumed IS NOT NULL
  LEFT JOIN public.delivery_batches db ON db.driver_id = d.id AND db.workspace_id = p_workspace_id
  WHERE d.workspace_id = p_workspace_id
  GROUP BY d.id
  ORDER BY total_cost DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4.10 get_dashboard_summary
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

-- ===========================================================================
-- STEP 5: Resource utilization functions with workspace isolation
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
      AND v.deleted_at IS NULL
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

CREATE OR REPLACE FUNCTION analytics.get_driver_utilization(
  p_workspace_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  driver_id UUID,
  driver_name TEXT,
  total_deliveries BIGINT,
  deliveries_per_week NUMERIC,
  utilization_status TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id as driver_id,
    d.name as driver_name,
    COUNT(DISTINCT db.id)::BIGINT as total_deliveries,
    ROUND(
      COUNT(DISTINCT db.id)::NUMERIC /
      NULLIF(
        EXTRACT(WEEK FROM COALESCE(p_end_date, CURRENT_DATE)) -
        EXTRACT(WEEK FROM COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days')) + 1,
        0
      ),
      2
    ) as deliveries_per_week,
    CASE
      WHEN COUNT(DISTINCT db.id) = 0 THEN 'inactive'
      WHEN COUNT(DISTINCT db.id) < 3 THEN 'underutilized'
      WHEN COUNT(DISTINCT db.id) > 10 THEN 'overutilized'
      ELSE 'optimal'
    END as utilization_status
  FROM public.drivers d
  LEFT JOIN public.delivery_batches db ON db.driver_id = d.id
    AND db.workspace_id = p_workspace_id
    AND db.status = 'completed'
    AND (p_start_date IS NULL OR db.scheduled_date >= p_start_date)
    AND (p_end_date IS NULL OR db.scheduled_date <= p_end_date)
  WHERE d.workspace_id = p_workspace_id
  GROUP BY d.id, d.name
  ORDER BY total_deliveries DESC;
END;
$$;

CREATE OR REPLACE FUNCTION analytics.get_route_efficiency(
  p_workspace_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  batch_id UUID,
  scheduled_date DATE,
  estimated_distance_km NUMERIC,
  actual_distance_km NUMERIC,
  distance_variance_pct NUMERIC,
  estimated_duration_hours NUMERIC,
  actual_duration_hours NUMERIC,
  duration_variance_pct NUMERIC,
  efficiency_rating TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    db.id as batch_id,
    db.scheduled_date,
    db.estimated_distance as estimated_distance_km,
    db.total_distance as actual_distance_km,
    CASE
      WHEN db.estimated_distance > 0 AND db.total_distance IS NOT NULL THEN
        ROUND(((db.total_distance - db.estimated_distance) / db.estimated_distance) * 100, 2)
      ELSE NULL
    END as distance_variance_pct,
    CASE
      WHEN db.estimated_duration IS NOT NULL THEN
        ROUND(EXTRACT(EPOCH FROM db.estimated_duration) / 3600, 2)
      ELSE NULL
    END as estimated_duration_hours,
    CASE
      WHEN db.actual_start_time IS NOT NULL AND db.actual_end_time IS NOT NULL THEN
        ROUND(EXTRACT(EPOCH FROM (db.actual_end_time - db.actual_start_time)) / 3600, 2)
      ELSE NULL
    END as actual_duration_hours,
    CASE
      WHEN db.estimated_duration IS NOT NULL AND db.actual_start_time IS NOT NULL AND db.actual_end_time IS NOT NULL THEN
        CASE
          WHEN EXTRACT(EPOCH FROM (db.actual_end_time - db.actual_start_time)) <=
               EXTRACT(EPOCH FROM db.estimated_duration) * 1.1 THEN 'excellent'
          WHEN EXTRACT(EPOCH FROM (db.actual_end_time - db.actual_start_time)) <=
               EXTRACT(EPOCH FROM db.estimated_duration) * 1.25 THEN 'good'
          ELSE 'poor'
        END
      ELSE 'unknown'
    END as efficiency_rating
  FROM public.delivery_batches db
  WHERE db.workspace_id = p_workspace_id
    AND db.status = 'completed'
    AND (p_start_date IS NULL OR db.scheduled_date >= p_start_date)
    AND (p_end_date IS NULL OR db.scheduled_date <= p_end_date)
  ORDER BY db.scheduled_date DESC;
END;
$$;

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
  on_time_rate NUMERIC,
  avg_completion_hours NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(db.programme::TEXT, 'unspecified') as programme,
    COUNT(*)::BIGINT as total_deliveries,
    COUNT(DISTINCT unnested_facility)::BIGINT as total_facilities_served,
    COALESCE(SUM(db.total_quantity), 0)::BIGINT as total_items_delivered,
    ROUND(AVG(db.total_quantity), 2) as avg_items_per_delivery,
    ROUND(
      COUNT(*) FILTER (
        WHERE db.actual_end_time IS NOT NULL
        AND db.actual_end_time <= (db.scheduled_date::timestamp + db.scheduled_time)
      )::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE db.actual_end_time IS NOT NULL), 0) * 100,
      2
    ) as on_time_rate,
    ROUND(
      AVG(
        EXTRACT(EPOCH FROM (db.actual_end_time - db.actual_start_time)) / 3600
      ) FILTER (WHERE db.actual_end_time IS NOT NULL AND db.actual_start_time IS NOT NULL),
      2
    ) as avg_completion_hours
  FROM public.delivery_batches db
  LEFT JOIN LATERAL unnest(db.facility_ids) as unnested_facility ON true
  WHERE db.workspace_id = p_workspace_id
    AND db.status = 'completed'
    AND (p_start_date IS NULL OR db.scheduled_date >= p_start_date)
    AND (p_end_date IS NULL OR db.scheduled_date <= p_end_date)
  GROUP BY programme
  ORDER BY total_deliveries DESC;
END;
$$;

CREATE OR REPLACE FUNCTION analytics.get_facility_coverage(
  p_workspace_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_programme TEXT DEFAULT NULL
)
RETURNS TABLE (
  facility_id UUID,
  facility_name TEXT,
  total_deliveries BIGINT,
  total_items_received BIGINT,
  last_delivery_date DATE,
  avg_delivery_frequency_days NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id as facility_id,
    f.name as facility_name,
    COUNT(DISTINCT db.id)::BIGINT as total_deliveries,
    COALESCE(SUM(db.total_quantity), 0)::BIGINT as total_items_received,
    MAX(db.scheduled_date) as last_delivery_date,
    CASE
      WHEN COUNT(DISTINCT db.id) > 1 THEN
        ROUND(
          EXTRACT(EPOCH FROM (MAX(db.scheduled_date::timestamp) - MIN(db.scheduled_date::timestamp))) /
          86400 / NULLIF(COUNT(DISTINCT db.id) - 1, 0),
          1
        )
      ELSE NULL
    END as avg_delivery_frequency_days
  FROM public.facilities f
  LEFT JOIN public.delivery_batches db ON
    f.id = ANY(db.facility_ids)
    AND db.workspace_id = p_workspace_id
    AND db.status = 'completed'
    AND (p_start_date IS NULL OR db.scheduled_date >= p_start_date)
    AND (p_end_date IS NULL OR db.scheduled_date <= p_end_date)
    AND (p_programme IS NULL OR db.programme::TEXT = p_programme)
  WHERE f.workspace_id = p_workspace_id
  GROUP BY f.id, f.name
  ORDER BY total_deliveries DESC;
END;
$$;

CREATE OR REPLACE FUNCTION analytics.get_cost_by_program(
  p_workspace_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  programme TEXT,
  total_batches BIGINT,
  total_items BIGINT,
  total_distance_km NUMERIC,
  total_fuel_cost NUMERIC,
  total_operational_cost NUMERIC,
  total_cost NUMERIC,
  cost_per_item NUMERIC,
  cost_per_km NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
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
    COALESCE(db.programme::TEXT, 'unspecified') as programme,
    COUNT(*)::BIGINT as total_batches,
    COALESCE(SUM(db.total_quantity), 0)::BIGINT as total_items,
    COALESCE(SUM(db.total_distance), 0) as total_distance_km,
    ROUND(COALESCE(SUM(vt.fuel_consumed * v_fuel_price), 0), 2) as total_fuel_cost,
    ROUND(COALESCE(SUM(db.total_distance * v_op_cost_km), 0), 2) as total_operational_cost,
    ROUND(
      COALESCE(SUM(vt.fuel_consumed * v_fuel_price), 0) +
      COALESCE(SUM(db.total_distance * v_op_cost_km), 0),
      2
    ) as total_cost,
    ROUND(
      CASE
        WHEN SUM(db.total_quantity) > 0 THEN
          (COALESCE(SUM(vt.fuel_consumed * v_fuel_price), 0) + COALESCE(SUM(db.total_distance * v_op_cost_km), 0)) /
          NULLIF(SUM(db.total_quantity), 0)
        ELSE 0
      END,
      2
    ) as cost_per_item,
    ROUND(
      CASE
        WHEN SUM(db.total_distance) > 0 THEN
          COALESCE(SUM(vt.fuel_consumed * v_fuel_price), 0) / NULLIF(SUM(db.total_distance), 0)
        ELSE 0
      END,
      2
    ) as cost_per_km
  FROM public.delivery_batches db
  LEFT JOIN public.vehicle_trips vt ON vt.batch_id = db.id AND vt.fuel_consumed IS NOT NULL
  WHERE db.workspace_id = p_workspace_id
    AND db.status = 'completed'
    AND (p_start_date IS NULL OR db.scheduled_date >= p_start_date)
    AND (p_end_date IS NULL OR db.scheduled_date <= p_end_date)
  GROUP BY programme
  ORDER BY total_cost DESC;
END;
$$;

-- ===========================================================================
-- STEP 6: Public wrapper functions with workspace_id parameter
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.get_delivery_kpis(
  workspace_id UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  total_batches BIGINT, completed_batches BIGINT, on_time_batches BIGINT,
  late_batches BIGINT, on_time_rate NUMERIC, avg_completion_time_hours NUMERIC,
  total_items_delivered BIGINT, total_distance_km NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_delivery_kpis(workspace_id, start_date, end_date);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_top_vehicles_by_ontime(
  workspace_id UUID,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  vehicle_id UUID, vehicle_number TEXT, vehicle_type TEXT,
  on_time_batches BIGINT, total_batches BIGINT, on_time_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_top_vehicles_by_ontime(workspace_id, limit_count);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_driver_kpis(workspace_id UUID)
RETURNS TABLE (
  total_drivers BIGINT, active_drivers BIGINT, avg_on_time_rate NUMERIC,
  avg_fuel_efficiency NUMERIC, total_incidents BIGINT
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_driver_kpis(workspace_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_top_drivers(
  workspace_id UUID,
  metric TEXT DEFAULT 'on_time_rate',
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  driver_id UUID, driver_name TEXT, on_time_rate NUMERIC,
  completed_batches BIGINT, total_items_delivered BIGINT,
  fuel_efficiency_km_per_liter NUMERIC, total_incidents BIGINT
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_top_drivers(workspace_id, metric, limit_count);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_vehicle_kpis(workspace_id UUID)
RETURNS TABLE (
  total_vehicles BIGINT, active_vehicles BIGINT, in_maintenance BIGINT,
  avg_utilization_rate NUMERIC, avg_fuel_efficiency NUMERIC, total_maintenance_cost NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_vehicle_kpis(workspace_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_vehicles_needing_maintenance(workspace_id UUID)
RETURNS TABLE (
  vehicle_id UUID, plate_number TEXT, vehicle_type TEXT,
  total_distance_km NUMERIC, last_maintenance_date DATE,
  maintenance_in_progress BIGINT, total_maintenance_cost NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_vehicles_needing_maintenance(workspace_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

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

CREATE OR REPLACE FUNCTION public.get_vehicle_costs(
  workspace_id UUID,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  vehicle_id UUID, total_cost NUMERIC, maintenance_cost NUMERIC,
  fuel_cost NUMERIC, fuel_consumed_liters NUMERIC, maintenance_events BIGINT
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_vehicle_costs(workspace_id, limit_count);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_driver_costs(
  workspace_id UUID,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  driver_id UUID, total_cost NUMERIC, fuel_cost NUMERIC,
  operational_cost NUMERIC, items_delivered BIGINT,
  distance_covered NUMERIC, cost_per_item NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_driver_costs(workspace_id, limit_count);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

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
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_vehicle_payload_utilization(workspace_id, start_date, end_date, p_vehicle_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_driver_utilization(
  workspace_id UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  driver_id UUID, driver_name TEXT, total_deliveries BIGINT,
  deliveries_per_week NUMERIC, utilization_status TEXT
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_driver_utilization(workspace_id, start_date, end_date);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_route_efficiency(
  workspace_id UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  batch_id UUID, scheduled_date DATE, estimated_distance_km NUMERIC,
  actual_distance_km NUMERIC, distance_variance_pct NUMERIC,
  estimated_duration_hours NUMERIC, actual_duration_hours NUMERIC,
  duration_variance_pct NUMERIC, efficiency_rating TEXT
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_route_efficiency(workspace_id, start_date, end_date);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_program_performance(
  workspace_id UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  programme TEXT, total_deliveries BIGINT, total_facilities_served BIGINT,
  total_items_delivered BIGINT, avg_items_per_delivery NUMERIC,
  on_time_rate NUMERIC, avg_completion_hours NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_program_performance(workspace_id, start_date, end_date);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_facility_coverage(
  workspace_id UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  programme TEXT DEFAULT NULL
)
RETURNS TABLE (
  facility_id UUID, facility_name TEXT, total_deliveries BIGINT,
  total_items_received BIGINT, last_delivery_date DATE,
  avg_delivery_frequency_days NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_facility_coverage(workspace_id, start_date, end_date, programme);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_cost_by_program(
  workspace_id UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  programme TEXT, total_batches BIGINT, total_items BIGINT,
  total_distance_km NUMERIC, total_fuel_cost NUMERIC,
  total_operational_cost NUMERIC, total_cost NUMERIC,
  cost_per_item NUMERIC, cost_per_km NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_cost_by_program(workspace_id, start_date, end_date);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ===========================================================================
-- STEP 7: Grant permissions
-- ===========================================================================

GRANT SELECT ON analytics.delivery_performance TO authenticated, anon;
GRANT SELECT ON analytics.driver_efficiency TO authenticated, anon;
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
GRANT EXECUTE ON FUNCTION analytics.get_vehicle_payload_utilization(UUID, DATE, DATE, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION analytics.get_driver_utilization(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION analytics.get_route_efficiency(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION analytics.get_program_performance(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION analytics.get_facility_coverage(UUID, DATE, DATE, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION analytics.get_cost_by_program(UUID, DATE, DATE) TO authenticated, anon;

GRANT EXECUTE ON FUNCTION public.get_delivery_kpis(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_top_vehicles_by_ontime(UUID, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_driver_kpis(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_top_drivers(UUID, TEXT, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_vehicle_kpis(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_vehicles_needing_maintenance(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_cost_kpis(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_vehicle_costs(UUID, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_driver_costs(UUID, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_vehicle_payload_utilization(UUID, DATE, DATE, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_driver_utilization(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_route_efficiency(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_program_performance(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_facility_coverage(UUID, DATE, DATE, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_cost_by_program(UUID, DATE, DATE) TO authenticated, anon;

-- ===========================================================================
-- STEP 8: Refresh materialized views
-- ===========================================================================

REFRESH MATERIALIZED VIEW analytics.delivery_performance;
REFRESH MATERIALIZED VIEW analytics.driver_efficiency;
REFRESH MATERIALIZED VIEW analytics.vehicle_utilization;

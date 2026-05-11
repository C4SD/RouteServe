-- Migration: Add membership checks to all public analytics wrappers
-- Also: Fix vehicle_trips cross-workspace joins in driver_efficiency
--       and vehicle_utilization materialized views

-- ===========================================================================
-- STEP 1: Add membership checks to existing public analytics wrapper functions
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
  IF NOT is_workspace_member_v2(workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;
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
  IF NOT is_workspace_member_v2(workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;
  RETURN QUERY SELECT * FROM analytics.get_top_vehicles_by_ontime(workspace_id, limit_count);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_driver_kpis(workspace_id UUID)
RETURNS TABLE (
  total_drivers BIGINT, active_drivers BIGINT, avg_on_time_rate NUMERIC,
  avg_fuel_efficiency NUMERIC, total_incidents BIGINT
) AS $$
BEGIN
  IF NOT is_workspace_member_v2(workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;
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
  IF NOT is_workspace_member_v2(workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;
  RETURN QUERY SELECT * FROM analytics.get_top_drivers(workspace_id, metric, limit_count);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_vehicle_kpis(workspace_id UUID)
RETURNS TABLE (
  total_vehicles BIGINT, active_vehicles BIGINT, in_maintenance BIGINT,
  avg_utilization_rate NUMERIC, avg_fuel_efficiency NUMERIC, total_maintenance_cost NUMERIC
) AS $$
BEGIN
  IF NOT is_workspace_member_v2(workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;
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
  IF NOT is_workspace_member_v2(workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;
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
  IF NOT is_workspace_member_v2(workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;
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
  IF NOT is_workspace_member_v2(workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;
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
  IF NOT is_workspace_member_v2(workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;
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
  IF NOT is_workspace_member_v2(workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;
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
  IF NOT is_workspace_member_v2(workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;
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
  IF NOT is_workspace_member_v2(workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;
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
  IF NOT is_workspace_member_v2(workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;
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
  IF NOT is_workspace_member_v2(workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;
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
  IF NOT is_workspace_member_v2(workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;
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
  IF NOT is_workspace_member_v2(workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;
  RETURN QUERY SELECT * FROM analytics.get_cost_by_program(workspace_id, start_date, end_date);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ===========================================================================
-- STEP 2: Fix vehicle_trips cross-workspace join in driver_efficiency view
-- ===========================================================================

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
LEFT JOIN public.delivery_batches db ON db.driver_id = d.id AND db.workspace_id = d.workspace_id
LEFT JOIN public.vehicle_trips vt ON vt.driver_id = d.id
  AND EXISTS (
    SELECT 1 FROM public.delivery_batches db2
    WHERE db2.id = vt.batch_id AND db2.workspace_id = d.workspace_id
  )
LEFT JOIN public.notifications n ON n.related_entity_id::TEXT = d.id::TEXT
  AND n.related_entity_type = 'driver'
  AND (n.workspace_id IS NULL OR n.workspace_id = d.workspace_id)
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

-- ===========================================================================
-- STEP 3: Fix vehicle_trips cross-workspace join in vehicle_utilization view
-- ===========================================================================

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
LEFT JOIN public.delivery_batches db ON db.vehicle_id = v.id AND db.workspace_id = v.workspace_id
LEFT JOIN public.vehicle_trips vt ON vt.vehicle_id = v.id
  AND EXISTS (
    SELECT 1 FROM public.delivery_batches db2
    WHERE db2.id = vt.batch_id AND db2.workspace_id = v.workspace_id
  )
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

-- ===========================================================================
-- STEP 4: Refresh materialized views
-- ===========================================================================

REFRESH MATERIALIZED VIEW analytics.delivery_performance;
REFRESH MATERIALIZED VIEW analytics.driver_efficiency;
REFRESH MATERIALIZED VIEW analytics.vehicle_utilization;

-- ===========================================================================
-- STEP 5: Re-grant permissions on updated views (authenticated only)
-- ===========================================================================

GRANT SELECT ON analytics.driver_efficiency TO authenticated;
GRANT SELECT ON analytics.vehicle_utilization TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_delivery_kpis(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_vehicles_by_ontime(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_driver_kpis(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_drivers(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vehicle_kpis(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vehicles_needing_maintenance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cost_kpis(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vehicle_costs(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_driver_costs(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vehicle_payload_utilization(UUID, DATE, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_driver_utilization(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_route_efficiency(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_program_performance(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_facility_coverage(UUID, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cost_by_program(UUID, DATE, DATE) TO authenticated;

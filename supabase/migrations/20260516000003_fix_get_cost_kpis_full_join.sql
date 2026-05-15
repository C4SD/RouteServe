-- Fix: analytics.get_cost_kpis used a FULL OUTER JOIN with a non-equi/non-mergejoinable
-- condition (`FULL OUTER JOIN public.drivers d ON d.workspace_id = p_workspace_id`),
-- which Postgres rejects with:
--   "FULL JOIN is only supported with merge-joinable or hash-joinable join conditions"
--
-- This migration rewrites the function to compute aggregates separately and
-- combine them, avoiding the bad join. Same return signature.

DROP FUNCTION IF EXISTS analytics.get_cost_kpis(UUID) CASCADE;

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
  v_total_fuel_cost NUMERIC;
  v_total_maintenance_cost NUMERIC;
  v_total_quantity NUMERIC;
  v_total_distance NUMERIC;
  v_active_vehicles BIGINT;
  v_active_drivers BIGINT;
BEGIN
  SELECT COALESCE(value_numeric, 1.50) INTO v_fuel_price
  FROM public.system_settings WHERE key = 'fuel_price_per_liter' AND workspace_id IS NULL LIMIT 1;

  SELECT COALESCE(value_numeric, 0.50) INTO v_op_cost_km
  FROM public.system_settings WHERE key = 'operational_cost_per_km' AND workspace_id IS NULL LIMIT 1;

  -- Total fuel cost: sum of fuel consumed on trips for this workspace's batches.
  SELECT COALESCE(SUM(vt.fuel_consumed * v_fuel_price), 0)
    INTO v_total_fuel_cost
  FROM public.vehicle_trips vt
  JOIN public.delivery_batches db ON db.id = vt.batch_id
  WHERE db.workspace_id = p_workspace_id
    AND vt.fuel_consumed IS NOT NULL;

  -- Total maintenance cost: maintenance entries on this workspace's vehicles.
  SELECT COALESCE(SUM(vm.cost), 0)
    INTO v_total_maintenance_cost
  FROM public.vehicle_maintenance vm
  JOIN public.vehicles v ON v.id = vm.vehicle_id
  WHERE v.workspace_id = p_workspace_id;

  -- Completed batch totals for this workspace.
  SELECT
    COALESCE(SUM(db.total_quantity), 0),
    COALESCE(SUM(db.total_distance), 0)
  INTO v_total_quantity, v_total_distance
  FROM public.delivery_batches db
  WHERE db.workspace_id = p_workspace_id
    AND db.status = 'completed';

  -- Active vehicle / driver counts (workspace-scoped).
  SELECT COUNT(*)::BIGINT INTO v_active_vehicles
  FROM public.vehicles WHERE workspace_id = p_workspace_id;

  SELECT COUNT(*)::BIGINT INTO v_active_drivers
  FROM public.drivers WHERE workspace_id = p_workspace_id;

  RETURN QUERY SELECT
    (v_total_fuel_cost + v_total_maintenance_cost)::NUMERIC AS total_system_cost,
    v_total_maintenance_cost AS total_maintenance_cost,
    v_total_fuel_cost AS total_fuel_cost,
    CASE
      WHEN v_total_quantity > 0
      THEN ROUND((v_total_fuel_cost + v_total_maintenance_cost) / NULLIF(v_total_quantity, 0), 2)
      ELSE 0
    END AS avg_cost_per_item,
    CASE
      WHEN v_total_distance > 0
      THEN ROUND(v_total_fuel_cost / NULLIF(v_total_distance, 0), 2)
      ELSE 0
    END AS avg_cost_per_km,
    v_active_vehicles,
    v_active_drivers,
    v_total_quantity::BIGINT AS total_items_delivered;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION analytics.get_cost_kpis(UUID) TO authenticated, anon;

-- Re-create dependent function dropped via CASCADE above (analytics.get_dashboard_summary).
CREATE OR REPLACE FUNCTION analytics.get_dashboard_summary(
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

GRANT EXECUTE ON FUNCTION analytics.get_dashboard_summary(UUID, DATE, DATE) TO authenticated, anon;

-- Re-create the public wrapper too (CASCADE may have removed it).
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

GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(UUID, DATE, DATE) TO authenticated, anon;

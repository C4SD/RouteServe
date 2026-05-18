-- Revoke unnecessary anon grants from the analytics schema.
-- The analytics schema is not in the PostgREST-exposed schemas, but the
-- grants were added for internal SECURITY INVOKER access and are not needed
-- by unauthenticated callers. The public.* wrapper functions (which do have
-- is_workspace_member_v2 checks) are the correct entry point for analytics.

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA analytics FROM anon;

-- Use DO blocks to tolerate views that were dropped in prior migrations
DO $$ BEGIN REVOKE SELECT ON analytics.delivery_performance FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON analytics.driver_efficiency     FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON analytics.vehicle_utilization   FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON analytics.cost_analysis         FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $$;

REVOKE USAGE ON SCHEMA analytics FROM anon;

-- Also revoke anon from the public-schema analytics wrappers — these require
-- auth.uid() for the membership check anyway and should not be callable
-- by unauthenticated clients. DO blocks tolerate functions that were dropped
-- or recreated with different signatures in prior migrations.
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_delivery_kpis(UUID, DATE, DATE)              FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_driver_kpis(UUID)                             FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_top_drivers(UUID, TEXT, INTEGER)              FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_vehicle_kpis(UUID)                            FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_vehicles_needing_maintenance(UUID)            FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_top_vehicles_by_ontime(UUID, INTEGER)         FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_cost_kpis(UUID)                               FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_vehicle_costs(UUID, INTEGER)                  FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_driver_costs(UUID, INTEGER)                   FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_dashboard_summary(UUID, DATE, DATE)           FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_vehicle_payload_utilization(UUID, DATE, DATE, UUID) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_driver_utilization(UUID, DATE, DATE)          FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_route_efficiency(UUID, DATE, DATE)            FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_low_stock_alerts(INTEGER)                     FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;

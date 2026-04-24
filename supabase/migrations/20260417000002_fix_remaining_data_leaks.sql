-- ============================================================================
-- Fix Remaining Cross-Workspace Data Leaks
-- ============================================================================
-- 1. user_roles open SELECT — any authenticated user can see every role
--    assignment across all workspaces.
--    Fix: create a SECURITY DEFINER helper to check workspace co-membership,
--    then restrict SELECT to own rows + coworkers in shared workspaces.
--
-- 2. get_map_data_in_view has no workspace_id filter.
--    Fix: add _workspace_id parameter, filter every sub-query by it.
-- ============================================================================

-- ============================================================
-- 1. USER_ROLES — scope SELECT to own rows + workspace coworkers
-- ============================================================

-- Helper: returns TRUE if p_user_id shares any active workspace with caller.
-- SECURITY DEFINER so it bypasses workspace_members RLS (no recursion).
CREATE OR REPLACE FUNCTION public.shares_workspace_with_caller(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm_caller
    JOIN public.workspace_members wm_target
      ON wm_caller.workspace_id = wm_target.workspace_id
    WHERE wm_caller.user_id  = auth.uid()
      AND wm_target.user_id  = p_user_id
      AND wm_caller.status   = 'active'
      AND wm_target.status   = 'active'
  );
$$;

-- Replace the open policies
DROP POLICY IF EXISTS "open_select" ON public.user_roles;
DROP POLICY IF EXISTS "open_modify" ON public.user_roles;

-- SELECT: own roles, or roles of any user who shares a workspace with the caller
CREATE POLICY "user_roles_select"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR shares_workspace_with_caller(user_id)
  );

-- ALL (INSERT/UPDATE/DELETE): users can only touch their own role rows
-- (actual privileged assignment goes through RPCs — assign_user_role / remove_user_role)
CREATE POLICY "user_roles_own_modify"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 2. get_map_data_in_view — add workspace_id parameter
-- ============================================================

DROP FUNCTION IF EXISTS public.get_map_data_in_view(float, float, float, float, int);

CREATE OR REPLACE FUNCTION public.get_map_data_in_view(
  min_lat      float,
  min_lon      float,
  max_lat      float,
  max_lon      float,
  zoom_level   int,
  _workspace_id UUID
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  bbox              geometry;
  facilities_json   json;
  warehouses_json   json;
  vehicles_json     json;
  drivers_json      json;
  zones_json        json;
  batches_json      json;
  result            json;
BEGIN
  bbox := ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326);

  -- Facilities within bbox, scoped to workspace
  SELECT json_agg(f) INTO facilities_json
  FROM (
    SELECT id, name, address, lat, lng, type
    FROM facilities
    WHERE workspace_id = _workspace_id
      AND ST_Contains(bbox, ST_SetSRID(ST_MakePoint(lng, lat), 4326))
  ) AS f;

  -- Warehouses within bbox, scoped to workspace
  SELECT json_agg(w) INTO warehouses_json
  FROM (
    SELECT id, name, address, lat, lng, type
    FROM warehouses
    WHERE workspace_id = _workspace_id
      AND ST_Contains(bbox, ST_SetSRID(ST_MakePoint(lng, lat), 4326))
  ) AS w;

  -- Vehicles (via their current facility location), scoped to workspace
  SELECT json_agg(v) INTO vehicles_json
  FROM (
    SELECT
      v.id,
      v.model,
      v.plate_number,
      v.status,
      v.current_driver_id,
      fac.lat,
      fac.lng
    FROM vehicles v
    JOIN facilities fac ON v.current_location_id = fac.id
    WHERE v.workspace_id = _workspace_id
      AND ST_Contains(bbox, ST_SetSRID(ST_MakePoint(fac.lng, fac.lat), 4326))
  ) AS v;

  -- Drivers for visible workspace vehicles
  SELECT json_agg(d) INTO drivers_json
  FROM (
    SELECT p.id, p.full_name, p.phone_number
    FROM profiles p
    JOIN vehicles v   ON p.id = v.current_driver_id
    JOIN facilities fac ON v.current_location_id = fac.id
    WHERE v.workspace_id = _workspace_id
      AND ST_Contains(bbox, ST_SetSRID(ST_MakePoint(fac.lng, fac.lat), 4326))
  ) AS d;

  -- Zones whose region centre is within bbox, scoped to workspace
  SELECT json_agg(z) INTO zones_json
  FROM (
    SELECT id, name, code, region_center
    FROM zones
    WHERE workspace_id = _workspace_id
      AND ST_Contains(
            bbox,
            ST_SetSRID(
              ST_MakePoint(
                (region_center->>'lng')::float,
                (region_center->>'lat')::float
              ), 4326)
          )
  ) AS z;

  -- Batches with optimised routes, scoped to workspace
  SELECT json_agg(b) INTO batches_json
  FROM (
    SELECT id, name, status, priority, optimized_route, warehouse_id, driver_id, vehicle_id
    FROM delivery_batches
    WHERE workspace_id = _workspace_id
      AND optimized_route IS NOT NULL
      AND json_array_length(optimized_route) > 0
  ) AS b;

  SELECT json_build_object(
    'facilities', COALESCE(facilities_json, '[]'::json),
    'warehouses', COALESCE(warehouses_json, '[]'::json),
    'vehicles',   COALESCE(vehicles_json,   '[]'::json),
    'drivers',    COALESCE(drivers_json,    '[]'::json),
    'zones',      COALESCE(zones_json,      '[]'::json),
    'batches',    COALESCE(batches_json,    '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_map_data_in_view(float, float, float, float, int, UUID) TO authenticated;

COMMENT ON FUNCTION public.get_map_data_in_view IS
  'Returns map entities within a bounding box, scoped to a single workspace. Requires _workspace_id.';

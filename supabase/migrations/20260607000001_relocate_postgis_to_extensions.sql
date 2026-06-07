-- ============================================================================
-- Migration: Relocate PostGIS from public → extensions schema
-- Fixes Supabase lint rule 0013 (rls_disabled_in_public) for spatial_ref_sys,
-- geometry_columns, and geography_columns.
--
-- Fully idempotent: safe to re-run if a previous attempt partially committed.
-- Each phase checks current DB state before acting.
-- ============================================================================


-- ============================================================================
-- PHASE 1 — Backup spatial data as WKT
-- Uses DO + EXECUTE so the query is not parsed at statement level — avoids
-- "column does not exist" errors when a previous run already dropped the
-- columns via Phase 2.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='countries' AND column_name='bounds'
  ) THEN
    EXECUTE $q$
      CREATE TABLE IF NOT EXISTS _backup_countries_bounds AS
        SELECT id, ST_AsText(bounds) AS bounds_wkt
        FROM   public.countries WHERE bounds IS NOT NULL
    $q$;
  ELSE
    CREATE TABLE IF NOT EXISTS _backup_countries_bounds (id uuid, bounds_wkt text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='admin_units' AND column_name='geometry'
  ) THEN
    EXECUTE $q$
      CREATE TABLE IF NOT EXISTS _backup_admin_units_spatial AS
        SELECT id,
          ST_AsText(geometry)      AS geometry_wkt,
          ST_AsText(center_point)  AS center_point_wkt,
          ST_AsText(bounds)        AS bounds_wkt
        FROM public.admin_units
        WHERE geometry IS NOT NULL OR center_point IS NOT NULL OR bounds IS NOT NULL
    $q$;
  ELSE
    CREATE TABLE IF NOT EXISTS _backup_admin_units_spatial (
      id uuid, geometry_wkt text, center_point_wkt text, bounds_wkt text
    );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='zone_configurations' AND column_name='boundary'
  ) THEN
    EXECUTE $q$
      CREATE TABLE IF NOT EXISTS _backup_zone_configs_spatial AS
        SELECT id, ST_AsText(boundary) AS boundary_wkt
        FROM   public.zone_configurations WHERE boundary IS NOT NULL
    $q$;
  ELSE
    CREATE TABLE IF NOT EXISTS _backup_zone_configs_spatial (id uuid, boundary_wkt text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='route_sketches' AND column_name='route_geometry'
  ) THEN
    EXECUTE $q$
      CREATE TABLE IF NOT EXISTS _backup_route_sketches_spatial AS
        SELECT id, ST_AsText(route_geometry) AS route_geometry_wkt
        FROM   public.route_sketches WHERE route_geometry IS NOT NULL
    $q$;
  ELSE
    CREATE TABLE IF NOT EXISTS _backup_route_sketches_spatial (id uuid, route_geometry_wkt text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='map_action_audit' AND column_name='action_location'
  ) THEN
    EXECUTE $q$
      CREATE TABLE IF NOT EXISTS _backup_map_action_audit_spatial AS
        SELECT id, ST_AsText(action_location) AS action_location_wkt
        FROM   public.map_action_audit WHERE action_location IS NOT NULL
    $q$;
  ELSE
    CREATE TABLE IF NOT EXISTS _backup_map_action_audit_spatial (id uuid, action_location_wkt text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='driver_events' AND column_name='location'
  ) THEN
    EXECUTE $q$
      CREATE TABLE IF NOT EXISTS _backup_driver_events_spatial AS
        SELECT id, ST_AsText(location) AS location_wkt
        FROM   public.driver_events WHERE location IS NOT NULL
    $q$;
  ELSE
    CREATE TABLE IF NOT EXISTS _backup_driver_events_spatial (id uuid, location_wkt text);
  END IF;
END $$;

COMMIT;


-- ============================================================================
-- PHASE 2 — Drop PostGIS from public schema
-- Skipped automatically if PostGIS has already been relocated to extensions
-- (i.e. a previous partial run already committed this phase).
-- ============================================================================

BEGIN;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'postgis' AND n.nspname = 'public'
  ) THEN
    DROP EXTENSION postgis CASCADE;
  END IF;
END $$;
COMMIT;


-- ============================================================================
-- PHASE 3 — Reinstall PostGIS in extensions schema
-- IF NOT EXISTS makes this a no-op on re-runs.
-- spatial_ref_sys, geometry_columns, geography_columns now live in extensions,
-- invisible to PostgREST → lint rule 0013 cleared.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;


-- ============================================================================
-- PHASES 4–10 — Restore, recreate, verify
-- Single transaction: rolls back cleanly if Phase 9 verification fails.
-- Backup tables are outside this transaction and survive any rollback.
-- ============================================================================

BEGIN;

-- geometry / geography types live in extensions after the move above.
-- SET LOCAL scopes this search_path override to this transaction only.
SET LOCAL search_path TO public, extensions;

-- --------------------------------------------------------------------------
-- PHASE 4 — Re-add spatial columns
-- NOT NULL columns added as nullable; constraint restored in Phase 6.
-- --------------------------------------------------------------------------

ALTER TABLE public.countries
  ADD COLUMN IF NOT EXISTS bounds geometry(Polygon, 4326);

ALTER TABLE public.admin_units
  ADD COLUMN IF NOT EXISTS geometry      geometry(MultiPolygon, 4326),
  ADD COLUMN IF NOT EXISTS center_point  geometry(Point, 4326),
  ADD COLUMN IF NOT EXISTS bounds        geometry(Polygon, 4326);

-- boundary / route_geometry were NOT NULL — add as nullable, restored in Phase 6
ALTER TABLE public.zone_configurations
  ADD COLUMN IF NOT EXISTS boundary geometry(Polygon, 4326),
  ADD COLUMN IF NOT EXISTS centroid  geometry(Point, 4326);

ALTER TABLE public.route_sketches
  ADD COLUMN IF NOT EXISTS route_geometry geometry(LineString, 4326);

ALTER TABLE public.map_action_audit
  ADD COLUMN IF NOT EXISTS action_location geometry(Point, 4326);

ALTER TABLE public.driver_events
  ADD COLUMN IF NOT EXISTS location geography(Point, 4326);

-- --------------------------------------------------------------------------
-- PHASE 8 (EARLY) — Recreate calculate_zone_centroid trigger
-- Recreated before Phase 5 so centroid is auto-calculated when boundary
-- is restored via UPDATE.
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION calculate_zone_centroid()
RETURNS TRIGGER AS $$
BEGIN
  NEW.centroid = ST_Centroid(NEW.boundary);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calculate_zone_centroid_trigger ON public.zone_configurations;
CREATE TRIGGER calculate_zone_centroid_trigger
  BEFORE INSERT OR UPDATE OF boundary ON public.zone_configurations
  FOR EACH ROW
  EXECUTE FUNCTION calculate_zone_centroid();

-- --------------------------------------------------------------------------
-- PHASE 5 — Restore data from WKT backup tables
-- UPDATE affects 0 rows when backup tables are empty (fresh deployment).
-- --------------------------------------------------------------------------

UPDATE public.countries c
SET    bounds = ST_GeomFromText(b.bounds_wkt, 4326)
FROM   _backup_countries_bounds b
WHERE  c.id = b.id;

UPDATE public.admin_units au
SET
  geometry      = CASE WHEN b.geometry_wkt     IS NOT NULL THEN ST_GeomFromText(b.geometry_wkt,     4326) END,
  center_point  = CASE WHEN b.center_point_wkt IS NOT NULL THEN ST_GeomFromText(b.center_point_wkt, 4326) END,
  bounds        = CASE WHEN b.bounds_wkt       IS NOT NULL THEN ST_GeomFromText(b.bounds_wkt,       4326) END
FROM _backup_admin_units_spatial b
WHERE au.id = b.id;

-- Trigger fires on UPDATE OF boundary → centroid auto-calculated
UPDATE public.zone_configurations zc
SET    boundary = ST_GeomFromText(b.boundary_wkt, 4326)
FROM   _backup_zone_configs_spatial b
WHERE  zc.id = b.id;

UPDATE public.route_sketches rs
SET    route_geometry = ST_GeomFromText(b.route_geometry_wkt, 4326)
FROM   _backup_route_sketches_spatial b
WHERE  rs.id = b.id;

UPDATE public.map_action_audit ma
SET    action_location = ST_GeomFromText(b.action_location_wkt, 4326)
FROM   _backup_map_action_audit_spatial b
WHERE  ma.id = b.id;

UPDATE public.driver_events de
SET    location = ST_SetSRID(ST_GeomFromText(b.location_wkt), 4326)::geography
FROM   _backup_driver_events_spatial b
WHERE  de.id = b.id;

-- --------------------------------------------------------------------------
-- PHASE 6 — Restore NOT NULL constraints
-- --------------------------------------------------------------------------

ALTER TABLE public.zone_configurations ALTER COLUMN boundary SET NOT NULL;
ALTER TABLE public.route_sketches      ALTER COLUMN route_geometry SET NOT NULL;

-- --------------------------------------------------------------------------
-- PHASE 7 — Recreate spatial indexes
-- 7 column-based GIST indexes + 1 functional GIST index = 8 total
-- --------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_countries_bounds
  ON public.countries USING GIST(bounds);

CREATE INDEX IF NOT EXISTS idx_admin_units_geometry
  ON public.admin_units USING GIST(geometry);

CREATE INDEX IF NOT EXISTS idx_admin_units_center_point
  ON public.admin_units USING GIST(center_point);

CREATE INDEX IF NOT EXISTS idx_admin_units_bounds
  ON public.admin_units USING GIST(bounds);

CREATE INDEX IF NOT EXISTS idx_zone_configurations_boundary
  ON public.zone_configurations USING GIST(boundary);

CREATE INDEX IF NOT EXISTS idx_zone_configurations_centroid
  ON public.zone_configurations USING GIST(centroid);

CREATE INDEX IF NOT EXISTS idx_route_sketches_geometry
  ON public.route_sketches USING GIST(route_geometry);

-- Functional index — reconstructs geometry on-the-fly from (lng, lat) columns
CREATE INDEX IF NOT EXISTS idx_gps_events_location
  ON public.driver_gps_events USING GIST (
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)
  );

-- --------------------------------------------------------------------------
-- PHASE 8 (REMAINDER) — Recreate remaining dropped functions
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION find_admin_unit_by_point(
  p_lat         NUMERIC,
  p_lng         NUMERIC,
  p_admin_level INTEGER DEFAULT NULL,
  p_country_id  UUID    DEFAULT NULL
)
RETURNS TABLE (
  id           UUID,
  name         TEXT,
  admin_level  INTEGER,
  country_id   UUID
) AS $$
  SELECT
    au.id,
    au.name,
    au.admin_level,
    au.country_id
  FROM public.admin_units au
  WHERE
    ST_Contains(au.geometry, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326))
    AND au.is_active = true
    AND (p_admin_level IS NULL OR au.admin_level = p_admin_level)
    AND (p_country_id  IS NULL OR au.country_id  = p_country_id)
  ORDER BY au.admin_level ASC
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION find_admin_unit_by_point IS
  'Find admin unit containing a geographic point (reverse geocoding)';

CREATE OR REPLACE FUNCTION get_active_zones(p_workspace_id UUID)
RETURNS TABLE (
  id           UUID,
  name         TEXT,
  boundary     geometry,
  centroid     geometry,
  version      INTEGER,
  activated_at TIMESTAMPTZ,
  zone_type    TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    zc.id,
    zc.name,
    zc.boundary,
    zc.centroid,
    zc.version,
    zc.activated_at,
    zc.zone_type
  FROM public.zone_configurations zc
  WHERE zc.workspace_id = p_workspace_id
    AND zc.active = true
  ORDER BY zc.priority DESC, zc.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_active_zones(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_map_data_in_view(
  min_lat       float,
  min_lon       float,
  max_lat       float,
  max_lon       float,
  zoom_level    int,
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

  SELECT json_agg(f) INTO facilities_json
  FROM (
    SELECT id, name, address, lat, lng, type
    FROM public.facilities
    WHERE workspace_id = _workspace_id
      AND ST_Contains(bbox, ST_SetSRID(ST_MakePoint(lng, lat), 4326))
  ) AS f;

  SELECT json_agg(w) INTO warehouses_json
  FROM (
    SELECT id, name, address, lat, lng, type
    FROM public.warehouses
    WHERE workspace_id = _workspace_id
      AND ST_Contains(bbox, ST_SetSRID(ST_MakePoint(lng, lat), 4326))
  ) AS w;

  SELECT json_agg(v) INTO vehicles_json
  FROM (
    SELECT
      v.id, v.model, v.plate_number, v.status, v.current_driver_id,
      fac.lat, fac.lng
    FROM public.vehicles v
    JOIN public.facilities fac ON v.current_location_id = fac.id
    WHERE v.workspace_id = _workspace_id
      AND ST_Contains(bbox, ST_SetSRID(ST_MakePoint(fac.lng, fac.lat), 4326))
  ) AS v;

  SELECT json_agg(d) INTO drivers_json
  FROM (
    SELECT p.id, p.full_name, p.phone_number
    FROM public.profiles    p
    JOIN public.vehicles    v   ON p.id = v.current_driver_id
    JOIN public.facilities  fac ON v.current_location_id = fac.id
    WHERE v.workspace_id = _workspace_id
      AND ST_Contains(bbox, ST_SetSRID(ST_MakePoint(fac.lng, fac.lat), 4326))
  ) AS d;

  SELECT json_agg(z) INTO zones_json
  FROM (
    SELECT id, name, code, region_center
    FROM public.zones
    WHERE workspace_id = _workspace_id
      AND ST_Contains(
            bbox,
            ST_SetSRID(
              ST_MakePoint(
                (region_center->>'lng')::float,
                (region_center->>'lat')::float
              ), 4326))
  ) AS z;

  SELECT json_agg(b) INTO batches_json
  FROM (
    SELECT id, name, status, priority, optimized_route, warehouse_id, driver_id, vehicle_id
    FROM public.delivery_batches
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

-- --------------------------------------------------------------------------
-- PHASE 9 — Verify restored row counts match backup counts
-- Raises an exception (rolling back) if any count mismatches.
-- --------------------------------------------------------------------------

DO $$
DECLARE
  v_backup   bigint;
  v_restored bigint;
BEGIN
  SELECT COUNT(*) INTO v_backup   FROM _backup_countries_bounds;
  SELECT COUNT(*) INTO v_restored FROM public.countries WHERE bounds IS NOT NULL;
  IF v_backup <> v_restored THEN
    RAISE EXCEPTION 'countries.bounds mismatch: backed up %, restored %', v_backup, v_restored;
  END IF;

  SELECT COUNT(*) INTO v_backup   FROM _backup_admin_units_spatial WHERE geometry_wkt IS NOT NULL;
  SELECT COUNT(*) INTO v_restored FROM public.admin_units WHERE geometry IS NOT NULL;
  IF v_backup <> v_restored THEN
    RAISE EXCEPTION 'admin_units.geometry mismatch: backed up %, restored %', v_backup, v_restored;
  END IF;

  SELECT COUNT(*) INTO v_backup   FROM _backup_admin_units_spatial WHERE center_point_wkt IS NOT NULL;
  SELECT COUNT(*) INTO v_restored FROM public.admin_units WHERE center_point IS NOT NULL;
  IF v_backup <> v_restored THEN
    RAISE EXCEPTION 'admin_units.center_point mismatch: backed up %, restored %', v_backup, v_restored;
  END IF;

  SELECT COUNT(*) INTO v_backup   FROM _backup_admin_units_spatial WHERE bounds_wkt IS NOT NULL;
  SELECT COUNT(*) INTO v_restored FROM public.admin_units WHERE bounds IS NOT NULL;
  IF v_backup <> v_restored THEN
    RAISE EXCEPTION 'admin_units.bounds mismatch: backed up %, restored %', v_backup, v_restored;
  END IF;

  SELECT COUNT(*) INTO v_backup   FROM _backup_zone_configs_spatial;
  SELECT COUNT(*) INTO v_restored FROM public.zone_configurations WHERE boundary IS NOT NULL;
  IF v_backup <> v_restored THEN
    RAISE EXCEPTION 'zone_configurations.boundary mismatch: backed up %, restored %', v_backup, v_restored;
  END IF;

  SELECT COUNT(*) INTO v_backup   FROM _backup_route_sketches_spatial;
  SELECT COUNT(*) INTO v_restored FROM public.route_sketches WHERE route_geometry IS NOT NULL;
  IF v_backup <> v_restored THEN
    RAISE EXCEPTION 'route_sketches.route_geometry mismatch: backed up %, restored %', v_backup, v_restored;
  END IF;

  SELECT COUNT(*) INTO v_backup   FROM _backup_map_action_audit_spatial;
  SELECT COUNT(*) INTO v_restored FROM public.map_action_audit WHERE action_location IS NOT NULL;
  IF v_backup <> v_restored THEN
    RAISE EXCEPTION 'map_action_audit.action_location mismatch: backed up %, restored %', v_backup, v_restored;
  END IF;

  SELECT COUNT(*) INTO v_backup   FROM _backup_driver_events_spatial;
  SELECT COUNT(*) INTO v_restored FROM public.driver_events WHERE location IS NOT NULL;
  IF v_backup <> v_restored THEN
    RAISE EXCEPTION 'driver_events.location mismatch: backed up %, restored %', v_backup, v_restored;
  END IF;

  RAISE NOTICE 'Phase 9: all row count checks passed';
END $$;

-- --------------------------------------------------------------------------
-- PHASE 10 — Drop backup tables
-- --------------------------------------------------------------------------

DROP TABLE IF EXISTS _backup_countries_bounds;
DROP TABLE IF EXISTS _backup_admin_units_spatial;
DROP TABLE IF EXISTS _backup_zone_configs_spatial;
DROP TABLE IF EXISTS _backup_route_sketches_spatial;
DROP TABLE IF EXISTS _backup_map_action_audit_spatial;
DROP TABLE IF EXISTS _backup_driver_events_spatial;

COMMIT;

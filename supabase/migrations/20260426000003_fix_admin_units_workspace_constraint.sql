-- Fix admin_units RLS violation during OSM import.
--
-- Root cause: the unique constraint was only on (osm_id, country_id), without
-- workspace_id. If workspace A had already imported states for a country, a
-- workspace B import would conflict on those rows and try to UPDATE them — but
-- RLS blocks workspace B from touching workspace A's rows, causing:
--   "new row violates row-level security policy (USING expression)"
--
-- Fix: include workspace_id in the constraint so each workspace owns its own
-- copy of OSM boundaries with no cross-workspace conflicts. Global seed rows
-- (workspace_id IS NULL) are unaffected because PostgreSQL treats NULLs as
-- distinct in UNIQUE constraints.

ALTER TABLE public.admin_units
  DROP CONSTRAINT IF EXISTS admin_units_osm_id_country_id_unique;

ALTER TABLE public.admin_units
  ADD CONSTRAINT admin_units_osm_id_country_id_workspace_id_unique
  UNIQUE (osm_id, country_id, workspace_id);

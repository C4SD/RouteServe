-- Fix function_search_path_mutable for the 4 PostGIS functions recreated in
-- 20260607000001_relocate_postgis_to_extensions.sql (Phase 8).
--
-- These functions call PostGIS operators by unqualified name (ST_Centroid,
-- ST_Contains, ST_MakeEnvelope, etc.), so they need 'extensions' in their
-- pinned search_path — not the empty string used by 20260516000005.

BEGIN;

ALTER FUNCTION public.calculate_zone_centroid()
  SET search_path = 'public, extensions';

ALTER FUNCTION public.find_admin_unit_by_point(numeric, numeric, integer, uuid)
  SET search_path = 'public, extensions';

ALTER FUNCTION public.get_active_zones(uuid)
  SET search_path = 'public, extensions';

ALTER FUNCTION public.get_map_data_in_view(double precision, double precision, double precision, double precision, integer, uuid)
  SET search_path = 'public, extensions';

COMMIT;

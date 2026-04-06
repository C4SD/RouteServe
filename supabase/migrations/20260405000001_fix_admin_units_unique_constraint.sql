-- Fix admin_units upsert: partial unique index (WHERE osm_id IS NOT NULL) cannot
-- be used by Supabase's ON CONFLICT clause without specifying the predicate.
-- Replace with a proper UNIQUE CONSTRAINT so ON CONFLICT (osm_id, country_id)
-- works correctly. NULLs in osm_id are still allowed (NULL != NULL in constraints).

-- Drop the partial index created in 20260404000001
DROP INDEX IF EXISTS public.admin_units_osm_id_country_id_key;

-- Add a proper unique constraint (creates a non-partial unique index internally)
ALTER TABLE public.admin_units
  DROP CONSTRAINT IF EXISTS admin_units_osm_id_country_id_unique;

ALTER TABLE public.admin_units
  ADD CONSTRAINT admin_units_osm_id_country_id_unique
  UNIQUE (osm_id, country_id);

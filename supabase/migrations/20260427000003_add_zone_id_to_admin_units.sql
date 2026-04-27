-- Add zone_id FK to admin_units (idempotent).
--
-- Migration 20260310000002 defined this column but was never applied to the
-- remote DB (confirmed by Supabase generated types omitting zone_id from the
-- admin_units Row shape). This migration re-applies it safely.

ALTER TABLE public.admin_units
  ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_admin_units_zone_id ON public.admin_units(zone_id);

-- Migrate any existing zone assignments from the legacy lgas table (if it
-- still exists) so data is not lost on re-apply.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'lgas'
  ) THEN
    UPDATE public.admin_units au
    SET zone_id = l.zone_id
    FROM public.lgas l
    WHERE au.admin_level = 6
      AND LOWER(au.name) = LOWER(l.name)
      AND au.zone_id IS NULL
      AND l.zone_id IS NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.admin_units.zone_id IS
  'Optional reference to operational zone (for LGAs at admin_level=6)';

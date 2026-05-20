-- ============================================================================
-- FIX: Recreate missing sync_vehicle_tiers_from_config function
-- ============================================================================
-- The function sync_vehicle_tiers_from_config(uuid, jsonb) is called by the
-- auto_sync_vehicle_tiers() AFTER INSERT/UPDATE trigger on vehicles. It is
-- absent from the live DB, causing 42883 (undefined_function) on every vehicle
-- creation or update. Root cause: migration 20251214131002 used DROP + CREATE
-- (not CREATE OR REPLACE), so if it failed after the DROP the function was lost.
--
-- This migration also adds SECURITY DEFINER so the function can write to
-- vehicle_tiers regardless of the calling user's role (RLS on vehicle_tiers
-- was tightened in 20260326000005 to admins only).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_vehicle_tiers_from_config(
  p_vehicle_id uuid,
  p_tier_config  JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  tier       JSONB;
  tier_array JSONB;
BEGIN
  DELETE FROM public.vehicle_tiers WHERE vehicle_id = p_vehicle_id;

  IF p_tier_config IS NULL THEN
    RETURN;
  END IF;

  -- Support both {tiers: [...]} object format and direct [...] array format
  IF jsonb_typeof(p_tier_config) = 'object' AND p_tier_config ? 'tiers' THEN
    tier_array := p_tier_config->'tiers';
    IF jsonb_typeof(tier_array) != 'array' THEN
      RETURN;
    END IF;
  ELSIF jsonb_typeof(p_tier_config) = 'array' THEN
    tier_array := p_tier_config;
  ELSE
    RETURN;
  END IF;

  IF jsonb_array_length(tier_array) = 0 THEN
    RETURN;
  END IF;

  FOR tier IN SELECT * FROM jsonb_array_elements(tier_array)
  LOOP
    INSERT INTO public.vehicle_tiers (
      vehicle_id,
      tier_name,
      tier_order,
      max_weight_kg,
      max_volume_m3
    ) VALUES (
      p_vehicle_id,
      tier->>'tier_name',
      (tier->>'tier_order')::INT,
      (tier->>'max_weight_kg')::NUMERIC,
      (tier->>'max_volume_m3')::NUMERIC
    );
  END LOOP;
END;
$$;

-- Recreate the trigger function with SECURITY DEFINER + fixed search_path
CREATE OR REPLACE FUNCTION public.auto_sync_vehicle_tiers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.tiered_config IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND (OLD.tiered_config IS DISTINCT FROM NEW.tiered_config))
  THEN
    PERFORM public.sync_vehicle_tiers_from_config(NEW.id, NEW.tiered_config);
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists on the canonical vehicles table
DROP TRIGGER IF EXISTS trigger_auto_sync_vehicle_tiers ON public.vehicles;
CREATE TRIGGER trigger_auto_sync_vehicle_tiers
  AFTER INSERT OR UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_vehicle_tiers();

-- Keep trigger on vlms_vehicles if the table still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vlms_vehicles'
  ) THEN
    DROP TRIGGER IF EXISTS trigger_auto_sync_vehicle_tiers ON public.vlms_vehicles;
    CREATE TRIGGER trigger_auto_sync_vehicle_tiers
      AFTER INSERT OR UPDATE ON public.vlms_vehicles
      FOR EACH ROW
      EXECUTE FUNCTION public.auto_sync_vehicle_tiers();
  END IF;
END $$;

COMMENT ON FUNCTION public.sync_vehicle_tiers_from_config(uuid, jsonb) IS
  'Sync vehicle_tiers rows from tiered_config JSONB. Handles {tiers:[]} and [] formats. '
  'SECURITY DEFINER: bypasses vehicle_tiers RLS so the trigger works for all roles. Updated 2026-05-20.';

COMMENT ON FUNCTION public.auto_sync_vehicle_tiers() IS
  'AFTER INSERT/UPDATE trigger on vehicles/vlms_vehicles. Calls sync_vehicle_tiers_from_config '
  'when tiered_config is set or changed. Updated 2026-05-20.';

-- ============================================================================
-- FIX: Vehicle Audit Trigger — Profile FK Fault Tolerance
-- ============================================================================
-- The set_vehicle_audit_fields() trigger sets NEW.created_by := auth.uid(),
-- but vehicles.created_by has a FK → profiles(id). If a user exists in
-- auth.users but not in profiles (e.g. created before handle_new_user was
-- deployed, or if the trigger failed silently), the INSERT fails with 23503.
--
-- Fix: check whether auth.uid() is in profiles before assigning. If not,
-- leave created_by/updated_by as NULL (allowed — columns are nullable).
-- Also adds SET search_path to satisfy Supabase SECURITY DEFINER linter rule.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_vehicle_audit_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();

  IF TG_OP = 'INSERT' THEN
    IF v_uid IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid) THEN
      NEW.created_by := v_uid;
      NEW.updated_by := v_uid;
    END IF;
    -- If no profile exists for this user, leave created_by/updated_by as NULL.
    -- The FK is nullable (ON DELETE SET NULL), so this is safe.
  ELSIF TG_OP = 'UPDATE' THEN
    IF v_uid IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid) THEN
      NEW.updated_by := v_uid;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure profiles rows exist for all current auth users who are missing them.
-- This backfills any users created before handle_new_user was deployed.
INSERT INTO public.profiles (id)
SELECT u.id
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

COMMENT ON FUNCTION public.set_vehicle_audit_fields() IS
  'BEFORE INSERT/UPDATE trigger on vehicles. Sets created_by/updated_by to '
  'auth.uid() only when a matching profiles row exists, avoiding FK violations '
  'for users without a profile entry. Updated 2026-05-20.';

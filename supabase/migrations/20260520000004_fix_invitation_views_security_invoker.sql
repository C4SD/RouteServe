-- Fix: Restore SECURITY INVOKER on invitation views and enable RLS on spatial_ref_sys
--
-- Issue 1 (invitation views):
--   20260517000005 recreated all_invitations_view and pending_invitations_view
--   with security_invoker = false to fix a broken column (pre_assigned_role was
--   dropped). In doing so it re-introduced SECURITY DEFINER. The RBAC v2-aware
--   RLS policies were already fixed in 20260517000001, so SECURITY INVOKER is
--   safe and correct — workspace admins/owners can read their own invitations.
--
-- Issue 2 (spatial_ref_sys):
--   20260516000004 revoked anon/authenticated access but the Supabase linter
--   checks for RLS enabled, not just revoked grants. Attempt ENABLE ROW LEVEL
--   SECURITY inside a DO block so the migration does not fail if the PostGIS
--   extension owner prevents the ALTER.

BEGIN;

-- ── Invitation views: SECURITY DEFINER → SECURITY INVOKER ──────────────────
-- RLS on user_invitations (20260517000001) correctly gates reads to workspace
-- admins/owners via both role_id (RBAC v2) and legacy text role column.
ALTER VIEW IF EXISTS public.all_invitations_view     SET (security_invoker = true);
ALTER VIEW IF EXISTS public.pending_invitations_view  SET (security_invoker = true);

-- ── spatial_ref_sys: enable RLS to satisfy the Supabase linter ─────────────
-- Access was already revoked for anon and authenticated in 20260516000004.
-- Enabling RLS here additionally satisfies the PostgREST RLS linter check.
-- The permissive SELECT policy is a no-op for those two roles (REVOKE wins),
-- but keeps the table readable by service_role and postgres for PostGIS ops.
DO $$
BEGIN
  ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'spatial_ref_sys'
       AND policyname = 'spatial_ref_sys_allow_read'
  ) THEN
    CREATE POLICY spatial_ref_sys_allow_read
      ON public.spatial_ref_sys FOR SELECT USING (true);
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    -- Ownership by the PostGIS extension prevents ALTER; the REVOKE in
    -- 20260516000004 remains the active mitigation.
    NULL;
END;
$$;

COMMIT;

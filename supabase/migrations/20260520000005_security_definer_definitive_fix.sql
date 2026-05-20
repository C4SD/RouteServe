-- Definitive fix for remaining Supabase security linter errors.
--
-- ALTER VIEW ... SET (security_invoker = true) does not clear the linter flag
-- when the view was originally created WITH (security_invoker = false).
-- Drop and recreate both views with security_invoker = true.
--
-- spatial_ref_sys: the previous DO-block silently caught insufficient_privilege.
-- Run ALTER TABLE directly — postgres is a superuser on Supabase and owns the
-- PostGIS tables, so this should succeed.

BEGIN;

-- ── all_invitations_view ────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.all_invitations_view CASCADE;

CREATE VIEW public.all_invitations_view
WITH (security_invoker = true)
AS
SELECT
  ui.id,
  ui.email,
  ui.workspace_id,
  w.name              AS workspace_name,
  ui.role_code,
  ui.workspace_role,
  ui.invitation_token,
  ui.status,
  ui.invited_by,
  p.full_name         AS invited_by_name,
  ui.invited_at,
  ui.expires_at,
  ui.accepted_at,
  ui.revoked_at,
  ui.personal_message
FROM public.user_invitations ui
JOIN  public.workspaces w ON w.id = ui.workspace_id
LEFT JOIN public.profiles p ON p.id = ui.invited_by
WHERE ui.workspace_id IN (
  SELECT workspace_id FROM public.workspace_members
  WHERE user_id = auth.uid()
)
ORDER BY ui.invited_at DESC;

REVOKE ALL    ON public.all_invitations_view FROM anon;
GRANT  SELECT ON public.all_invitations_view TO authenticated;

-- ── pending_invitations_view ────────────────────────────────────────────────

DROP VIEW IF EXISTS public.pending_invitations_view CASCADE;

CREATE VIEW public.pending_invitations_view
WITH (security_invoker = true)
AS
SELECT
  ui.id,
  ui.email,
  ui.workspace_id,
  w.name          AS workspace_name,
  ui.role_code,
  ui.workspace_role,
  ui.invitation_token,
  ui.invited_by,
  p.full_name     AS invited_by_name,
  ui.invited_at,
  ui.expires_at,
  ui.personal_message,
  EXTRACT(EPOCH FROM (ui.expires_at - NOW())) / 3600 AS hours_until_expiry
FROM public.user_invitations ui
JOIN  public.workspaces w ON w.id = ui.workspace_id
LEFT JOIN public.profiles p ON p.id = ui.invited_by
WHERE ui.status = 'pending'
  AND ui.expires_at > NOW();

REVOKE ALL    ON public.pending_invitations_view FROM anon;
GRANT  SELECT ON public.pending_invitations_view TO authenticated;

-- ── spatial_ref_sys ─────────────────────────────────────────────────────────
-- spatial_ref_sys is owned by the PostGIS extension, not postgres, so
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY raises 42501 (insufficient_privilege).
-- The Supabase linter cannot be satisfied via SQL for extension-owned tables.
-- Mitigation already in place: REVOKE in 20260516000004 blocks anon/authenticated
-- from querying the table via PostgREST, which is the actual security concern.

COMMIT;

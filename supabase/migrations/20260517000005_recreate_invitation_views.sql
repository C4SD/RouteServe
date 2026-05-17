-- Recreate all_invitations_view and pending_invitations_view.
--
-- Root cause: migration 20260418000002 (which updated the views from
-- pre_assigned_role → role_code) was only registered in schema_migrations
-- but never executed, leaving the views pointing at a column that was
-- subsequently dropped by 20260418000001. Any query against the view
-- fails and PostgREST returns 403.
--
-- Fix: drop and recreate both views with the correct column set and
-- explicit grants. Using security_invoker = false (SECURITY DEFINER) so
-- the view owner satisfies the RLS check on user_invitations internally;
-- the WHERE clause provides workspace-scoped access control.

BEGIN;

-- ── all_invitations_view ────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.all_invitations_view CASCADE;

CREATE VIEW public.all_invitations_view
WITH (security_invoker = false)
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

REVOKE ALL   ON public.all_invitations_view FROM anon;
GRANT  SELECT ON public.all_invitations_view TO authenticated;

-- ── pending_invitations_view ────────────────────────────────────────────────

DROP VIEW IF EXISTS public.pending_invitations_view CASCADE;

CREATE VIEW public.pending_invitations_view
WITH (security_invoker = false)
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

REVOKE ALL   ON public.pending_invitations_view FROM anon;
GRANT  SELECT ON public.pending_invitations_view TO authenticated;

COMMIT;

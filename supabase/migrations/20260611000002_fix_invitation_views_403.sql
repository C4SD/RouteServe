-- ============================================================================
-- Fix 403 Forbidden on invitation views
-- ----------------------------------------------------------------------------
-- PostgREST returns 403 because the views were last recreated with
-- security_invoker = true (20260520000005). With security_invoker the view
-- runs as the calling role (authenticated), which must pass RLS on the
-- underlying user_invitations table. The RLS SELECT policies require admin
-- status checked via a subquery on workspace_members + roles — PostgREST
-- blocks access before even executing the query.
--
-- Fix: recreate both views with security_invoker = false (SECURITY DEFINER).
-- The view owner (postgres) bypasses RLS, and the WHERE clause provides
-- workspace-scoped access control. This matches the pattern that worked in
-- 20260517000005 before the security_invoker change broke it.
--
-- Also sends NOTIFY pgrst to reload the PostgREST schema cache.
-- ============================================================================

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
  SELECT wm.workspace_id
  FROM public.workspace_members wm
  LEFT JOIN public.roles r ON r.id = wm.role_id
  WHERE wm.user_id = auth.uid()
    AND (r.code IN ('owner', 'admin') OR wm.role IN ('owner', 'admin'))
)
ORDER BY ui.invited_at DESC;

REVOKE ALL    ON public.all_invitations_view FROM anon;
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
  AND ui.expires_at > NOW()
  AND ui.workspace_id IN (
    SELECT wm.workspace_id
    FROM public.workspace_members wm
    LEFT JOIN public.roles r ON r.id = wm.role_id
    WHERE wm.user_id = auth.uid()
      AND (r.code IN ('owner', 'admin') OR wm.role IN ('owner', 'admin'))
  );

REVOKE ALL    ON public.pending_invitations_view FROM anon;
GRANT  SELECT ON public.pending_invitations_view TO authenticated;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;

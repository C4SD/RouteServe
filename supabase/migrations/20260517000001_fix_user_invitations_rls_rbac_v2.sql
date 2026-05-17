-- ============================================================================
-- Fix RLS on public.user_invitations for RBAC v2
-- ----------------------------------------------------------------------------
-- The legacy policies on user_invitations gate access by the deprecated text
-- column workspace_members.role IN ('owner', 'admin'). After RBAC v2
-- (20260324000002), workspace admin status is determined by role_id ->
-- roles.code = 'admin' (or legacy 'owner' for org creators), and the text
-- `role` column is mapped to values like 'member' for ops_manager, etc.
--
-- Combined with 20260516000004, which switched all_invitations_view and
-- pending_invitations_view to security_invoker = true, RBAC v2 admins now see
-- 0 rows in /settings/members "Invitations" because the SELECT policy on the
-- underlying table no longer matches them.
--
-- This migration replaces the SELECT/INSERT/UPDATE policies with role_id-based
-- equivalents that fall back to the legacy text column for backward
-- compatibility (so org owners with role='owner' still pass).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- SELECT: workspace owners/admins can view all invitations for their workspace
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Workspace admins can view workspace invitations"
  ON public.user_invitations;

CREATE POLICY "Workspace admins can view workspace invitations"
  ON public.user_invitations FOR SELECT
  USING (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM public.workspace_members wm
      LEFT JOIN public.roles r ON r.id = wm.role_id
      WHERE wm.user_id = auth.uid()
        AND (
          r.code IN ('owner', 'admin')
          OR wm.role IN ('owner', 'admin')  -- legacy fallback
        )
    )
  );

-- ---------------------------------------------------------------------------
-- INSERT: workspace owners/admins can create invitations
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Workspace admins can create invitations"
  ON public.user_invitations;

CREATE POLICY "Workspace admins can create invitations"
  ON public.user_invitations FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM public.workspace_members wm
      LEFT JOIN public.roles r ON r.id = wm.role_id
      WHERE wm.user_id = auth.uid()
        AND (
          r.code IN ('owner', 'admin')
          OR wm.role IN ('owner', 'admin')
        )
    )
  );

-- ---------------------------------------------------------------------------
-- UPDATE: workspace owners/admins can update (revoke/resend) invitations
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Workspace admins can update invitations"
  ON public.user_invitations;

CREATE POLICY "Workspace admins can update invitations"
  ON public.user_invitations FOR UPDATE
  USING (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM public.workspace_members wm
      LEFT JOIN public.roles r ON r.id = wm.role_id
      WHERE wm.user_id = auth.uid()
        AND (
          r.code IN ('owner', 'admin')
          OR wm.role IN ('owner', 'admin')
        )
    )
  );

COMMIT;

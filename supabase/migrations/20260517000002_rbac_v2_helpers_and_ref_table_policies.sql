-- ============================================================================
-- RBAC v2 sanitation: helper functions + reference/requisition policy fixes
-- ----------------------------------------------------------------------------
-- Addresses audit items A5 + A6 from docs/audit/RBAC_V2_SANITATION.md.
--
-- Background
-- ----------
-- 20260326000005_tighten_reference_table_rls.sql defined is_admin() as
-- "user is owner/admin of any workspace" (workspace-admin semantics) and gated
-- vehicle_tiers/facility_types/levels_of_care policies on it.
--
-- 20260516000006_fix_is_admin_search_path.sql later redefined is_admin() as
-- "user has user_roles.role_id -> roles.code IN ('admin','super_admin')"
-- (system-admin semantics) to fix a 42883 runtime bug. The replacement broke
-- the original intent: workspace owners created via create_workspace get no
-- row in user_roles (only create_organization_with_admin writes user_roles),
-- so they were silently denied access to reference tables and requisitions.
--
-- Resolution
-- ----------
-- 1. Reinstate is_admin() with workspace-admin semantics (active member of any
--    workspace with role_id -> roles.code IN ('owner','admin')). Use explicit
--    search_path = public, pg_temp so qualifies for the IMMUTABLE check that
--    Supabase linter requires.
-- 2. Add is_workspace_admin(p_workspace_id UUID) for callers that need a
--    workspace-scoped check.
-- 3. Add is_workspace_member_role(p_workspace_id, VARIADIC p_codes) for fine
--    grained role checks (e.g. ops_manager+admin for requisitions).
-- 4. Rewrite requisitions/requisition_items policies to drop references to
--    has_role('warehouse_officer') (phantom role under RBAC v2) and use the
--    new helpers.
--
-- Note on has_role(): kept untouched. After 20260516000006 it queries
-- public.user_roles via role_id, which is system-scoped. That semantic is
-- still correct for system-admin gates; we only fix is_admin() here.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. is_admin(): workspace-admin via role_id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.roles r ON r.id = wm.role_id
    WHERE wm.user_id = auth.uid()
      AND wm.status = 'active'
      AND r.code IN ('owner', 'admin')
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Returns TRUE if the current user is an active workspace owner/admin in any '
  'workspace. Use is_workspace_admin(workspace_id) for scoped checks. '
  'Updated 2026-05-17: reverted to workspace-admin semantics — every consumer '
  '(reference tables, requisitions) expected workspace scope, not system-admin.';

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. is_workspace_admin(workspace_id): scoped owner/admin check
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.roles r ON r.id = wm.role_id
    WHERE wm.user_id = auth.uid()
      AND wm.workspace_id = p_workspace_id
      AND wm.status = 'active'
      AND r.code IN ('owner', 'admin')
  );
$$;

COMMENT ON FUNCTION public.is_workspace_admin(UUID) IS
  'Returns TRUE when the current user is an active owner/admin of the given '
  'workspace via workspace_members.role_id -> roles.code IN (owner, admin).';

GRANT EXECUTE ON FUNCTION public.is_workspace_admin(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. has_workspace_role(workspace_id, codes[]): scoped multi-code check
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_workspace_role(
  p_workspace_id UUID,
  p_codes TEXT[]
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.roles r ON r.id = wm.role_id
    WHERE wm.user_id = auth.uid()
      AND wm.workspace_id = p_workspace_id
      AND wm.status = 'active'
      AND r.code = ANY(p_codes)
  );
$$;

COMMENT ON FUNCTION public.has_workspace_role(UUID, TEXT[]) IS
  'Returns TRUE when the current user is an active member of the given '
  'workspace AND their role code is in the supplied set.';

GRANT EXECUTE ON FUNCTION public.has_workspace_role(UUID, TEXT[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. requisition_items: drop phantom warehouse_officer, scope to workspace
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and warehouse officers can manage requisition items"
  ON public.requisition_items;

CREATE POLICY "Workspace admins and ops can manage requisition items"
  ON public.requisition_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.requisitions req
      WHERE req.id = requisition_items.requisition_id
        AND public.has_workspace_role(req.workspace_id, ARRAY['owner','admin','ops_manager'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.requisitions req
      WHERE req.id = requisition_items.requisition_id
        AND public.has_workspace_role(req.workspace_id, ARRAY['owner','admin','ops_manager'])
    )
  );

-- ---------------------------------------------------------------------------
-- 5. requisitions: drop phantom warehouse_officer, scope to workspace
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update their own requisitions" ON public.requisitions;
DROP POLICY IF EXISTS "Admins and warehouse officers can manage requisitions in their workspace"
  ON public.requisitions;

CREATE POLICY "Users can update their own requisitions"
  ON public.requisitions FOR UPDATE TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.has_workspace_role(workspace_id, ARRAY['owner','admin','ops_manager'])
  );

CREATE POLICY "Workspace admins and ops can manage requisitions"
  ON public.requisitions FOR ALL TO authenticated
  USING (
    public.has_workspace_role(workspace_id, ARRAY['owner','admin','ops_manager'])
  )
  WITH CHECK (
    public.has_workspace_role(workspace_id, ARRAY['owner','admin','ops_manager'])
  );

COMMIT;

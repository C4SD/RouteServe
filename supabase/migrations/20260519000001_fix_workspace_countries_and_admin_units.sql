-- ============================================================================
-- Fix workspace_countries RLS + admin_units unique index
-- ============================================================================
-- Addresses three known gaps identified in the RBAC v2 sanitation audit:
--
-- 1. workspace_countries / workspace_states INSERT|DELETE policies still check
--    wm.role TEXT IN ('owner','admin') (B1 in RBAC_V2_SANITATION.md).
--    Replace with has_workspace_role(workspace_id, ARRAY['owner','admin'])
--    added in 20260517000002, which uses role_id → roles.code.
--
-- 2. workspace_countries has no UPDATE policy, so setPrimaryCountryMutation
--    (UPDATE is_primary) is silently denied by RLS default-deny.
--
-- 3. admin_units still carries the old partial unique INDEX
--    `admin_units_osm_id_country_id_key` ON (osm_id, country_id) created by
--    20260404000001. Migration 20260426000003 tried to drop constraint
--    `admin_units_osm_id_country_id_unique` (wrong name) so the index was
--    never removed. This causes upserts for a second workspace importing the
--    same country to hit the 2-column conflict and fail with 23505.
--
-- 4. admin_units write policy uses wm.role TEXT IN ('owner','admin').
--    Upgrade to has_workspace_role for consistency.
-- ============================================================================

BEGIN;

-- ============================================================
-- 1. workspace_countries — replace old TEXT-col RLS policies
-- ============================================================

DROP POLICY IF EXISTS "workspace_countries_insert_policy" ON public.workspace_countries;
DROP POLICY IF EXISTS "workspace_countries_update_policy" ON public.workspace_countries;
DROP POLICY IF EXISTS "workspace_countries_delete_policy" ON public.workspace_countries;

-- INSERT: workspace owner/admin (role_id check)
CREATE POLICY "workspace_countries_insert_policy"
  ON public.workspace_countries FOR INSERT TO authenticated
  WITH CHECK (
    public.has_workspace_role(workspace_id, ARRAY['owner', 'admin'])
  );

-- UPDATE: workspace owner/admin can change is_primary
CREATE POLICY "workspace_countries_update_policy"
  ON public.workspace_countries FOR UPDATE TO authenticated
  USING (
    public.has_workspace_role(workspace_id, ARRAY['owner', 'admin'])
  )
  WITH CHECK (
    public.has_workspace_role(workspace_id, ARRAY['owner', 'admin'])
  );

-- DELETE: workspace owner/admin
CREATE POLICY "workspace_countries_delete_policy"
  ON public.workspace_countries FOR DELETE TO authenticated
  USING (
    public.has_workspace_role(workspace_id, ARRAY['owner', 'admin'])
  );

-- ============================================================
-- 2. workspace_states — replace old TEXT-col RLS policies
-- ============================================================

DROP POLICY IF EXISTS "workspace_states_insert_policy" ON public.workspace_states;
DROP POLICY IF EXISTS "workspace_states_delete_policy" ON public.workspace_states;

CREATE POLICY "workspace_states_insert_policy"
  ON public.workspace_states FOR INSERT TO authenticated
  WITH CHECK (
    public.has_workspace_role(workspace_id, ARRAY['owner', 'admin'])
  );

CREATE POLICY "workspace_states_delete_policy"
  ON public.workspace_states FOR DELETE TO authenticated
  USING (
    public.has_workspace_role(workspace_id, ARRAY['owner', 'admin'])
  );

-- ============================================================
-- 3. admin_units — drop stale 2-column unique index
-- ============================================================
-- The 3-column constraint (osm_id, country_id, workspace_id) from
-- 20260426000003 is the correct per-workspace boundary constraint.
-- The old 2-column index (different name, so DROP CONSTRAINT in that
-- migration didn't remove it) blocked a second workspace from importing
-- the same country's boundaries. Drop it.

DROP INDEX IF EXISTS public.admin_units_osm_id_country_id_key;

-- ============================================================
-- 4. admin_units — update write policy to role_id check
-- ============================================================

DROP POLICY IF EXISTS "Workspace admins can manage admin units" ON public.admin_units;

CREATE POLICY "Workspace admins can manage admin units"
  ON public.admin_units FOR ALL TO authenticated
  USING (
    -- system_admin path (for superuser tooling)
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.code = 'system_admin'
    )
    OR
    -- workspace owner/admin via role_id; only applies to workspace-owned rows
    (
      workspace_id IS NOT NULL
      AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.code = 'system_admin'
    )
    OR
    (
      workspace_id IS NOT NULL
      AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin'])
    )
  );

COMMIT;

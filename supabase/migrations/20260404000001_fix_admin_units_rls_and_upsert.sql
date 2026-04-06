-- Fix admin_units RLS: the existing write policy checked raw_user_meta_data
-- which is never set in this app. Replace with user_roles table check.
-- Also add a unique constraint on (osm_id, country_id) to enable upsert.

-- Drop the broken policy (may already be gone)
DROP POLICY IF EXISTS "Only admins can modify admin units" ON public.admin_units;

-- Drop the overly-restrictive read policy
DROP POLICY IF EXISTS "Admin units are viewable by everyone" ON public.admin_units;

-- Drop new policies if they exist (idempotent re-run safety)
DROP POLICY IF EXISTS "Workspace members can read admin units" ON public.admin_units;
DROP POLICY IF EXISTS "Workspace admins can manage admin units" ON public.admin_units;

-- New read policy: workspace members can read their workspace's units
-- plus any shared (workspace_id IS NULL) units
CREATE POLICY "Workspace members can read admin units"
  ON public.admin_units FOR SELECT
  USING (
    workspace_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = admin_units.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

-- New write policy: system_admin OR workspace owner/admin can insert/update/delete
CREATE POLICY "Workspace admins can manage admin units"
  ON public.admin_units FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.code = 'system_admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = admin_units.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- Add unique constraint on (osm_id, country_id) to support efficient upserts.
-- osm_id is nullable so we guard with WHERE osm_id IS NOT NULL.
CREATE UNIQUE INDEX IF NOT EXISTS admin_units_osm_id_country_id_key
  ON public.admin_units (osm_id, country_id)
  WHERE osm_id IS NOT NULL;

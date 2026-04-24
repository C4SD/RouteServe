-- Migration: Relax workspace_settings INSERT/UPDATE policies
-- Previously restricted to system_admin only; the settings route is already
-- guarded by workspace.manage permission so RLS only needs to scope by membership.

DROP POLICY IF EXISTS "Admins can insert workspace settings" ON public.workspace_settings;
DROP POLICY IF EXISTS "Admins can update workspace settings" ON public.workspace_settings;

CREATE POLICY "Workspace members can insert their workspace settings"
  ON public.workspace_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can update their workspace settings"
  ON public.workspace_settings FOR UPDATE
  TO authenticated
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  );

-- Add DELETE RLS policy to user_invitations
-- The useDeleteInvitations hook performs DELETE on this table but no DELETE
-- policy existed — RLS deny-by-default was silently blocking all deletes.
-- Policy mirrors the SELECT/INSERT/UPDATE policies from 20260517000001.

CREATE POLICY "Workspace admins can delete invitations"
  ON public.user_invitations FOR DELETE
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

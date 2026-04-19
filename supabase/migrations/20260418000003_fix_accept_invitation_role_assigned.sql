-- Fix accept_invitation: set user_status = 'role_assigned' after joining workspace.
-- Previously the RPC never advanced the user's status from 'registered', causing
-- ProfileCompletionPage to fail with "registered -> active" transition rejection.

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_user_id    UUID := auth.uid();
  v_role_id    UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to accept invitation';
  END IF;

  SELECT * INTO v_invitation
  FROM public.user_invitations
  WHERE invitation_token = p_token
    AND status = 'pending'
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation token';
  END IF;

  -- Verify email matches
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = v_user_id AND email != v_invitation.email
  ) THEN
    RAISE EXCEPTION 'Invitation was sent to a different email address';
  END IF;

  -- Lookup role_id for this role_code
  SELECT id INTO v_role_id FROM public.roles WHERE code = v_invitation.role_code LIMIT 1;

  -- Mark invitation accepted
  UPDATE public.user_invitations
  SET status = 'accepted', accepted_at = NOW(), accepted_by = v_user_id, updated_at = NOW()
  WHERE id = v_invitation.id;

  -- Add user to workspace
  INSERT INTO public.workspace_members (workspace_id, user_id, role, role_id, status)
  VALUES (
    v_invitation.workspace_id,
    v_user_id,
    CASE v_invitation.role_code WHEN 'admin' THEN 'admin' WHEN 'viewer' THEN 'viewer' ELSE 'member' END,
    v_role_id,
    'active'
  )
  ON CONFLICT (workspace_id, user_id) DO UPDATE
  SET role_id = EXCLUDED.role_id,
      role    = EXCLUDED.role,
      status  = 'active',
      updated_at = NOW();

  -- Advance user status from 'registered' → 'role_assigned' so that
  -- ProfileCompletionPage can then transition to 'active'.
  UPDATE public.profiles
  SET user_status = 'role_assigned',
      role_assigned_at = COALESCE(role_assigned_at, NOW())
  WHERE id = v_user_id
    AND user_status = 'registered';

  RETURN jsonb_build_object(
    'success', true,
    'workspace_id', v_invitation.workspace_id,
    'workspace_name', (SELECT name FROM public.workspaces WHERE id = v_invitation.workspace_id),
    'role_code', v_invitation.role_code,
    'workspace_role', v_invitation.workspace_role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(UUID) TO authenticated;

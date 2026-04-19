-- ============================================================================
-- Fix user_invitations for RBAC v2
-- Replaces the dropped app_role column with role_code TEXT
-- Updates invite_user, accept_invitation, get_invitation_by_token RPCs
-- ============================================================================

-- 1. Ensure role_code column exists (pre_assigned_role was dropped via CASCADE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_invitations'
      AND column_name = 'role_code'
  ) THEN
    ALTER TABLE public.user_invitations ADD COLUMN role_code TEXT NOT NULL DEFAULT 'viewer';
  END IF;

  -- Drop pre_assigned_role if it somehow still exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_invitations'
      AND column_name = 'pre_assigned_role'
  ) THEN
    ALTER TABLE public.user_invitations DROP COLUMN pre_assigned_role;
  END IF;
END $$;

-- 2. Recreate invite_user RPC using role_code
CREATE OR REPLACE FUNCTION public.invite_user(
  p_email TEXT,
  p_workspace_id UUID,
  p_role_code TEXT DEFAULT 'viewer',
  p_workspace_role TEXT DEFAULT 'member',
  p_personal_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_invitation_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Validate caller is workspace admin/owner
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    JOIN public.roles r ON r.id = wm.role_id
    WHERE wm.user_id = v_user_id
      AND wm.workspace_id = p_workspace_id
      AND r.code IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: workspace admin role required';
  END IF;

  -- Validate role_code exists
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE code = p_role_code) THEN
    RAISE EXCEPTION 'Invalid role_code: %', p_role_code;
  END IF;

  INSERT INTO public.user_invitations (
    email,
    workspace_id,
    role_code,
    workspace_role,
    invited_by,
    personal_message
  ) VALUES (
    lower(trim(p_email)),
    p_workspace_id,
    p_role_code,
    p_workspace_role,
    v_user_id,
    p_personal_message
  )
  ON CONFLICT (email, workspace_id) WHERE status = 'pending'
  DO UPDATE SET
    role_code = EXCLUDED.role_code,
    workspace_role = EXCLUDED.workspace_role,
    personal_message = EXCLUDED.personal_message,
    expires_at = NOW() + INTERVAL '7 days',
    updated_at = NOW()
  RETURNING id INTO v_invitation_id;

  RETURN v_invitation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_user(TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated;

-- 3. Update accept_invitation RPC
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

-- 4. Update get_invitation_by_token RPC
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id',               ui.id,
    'email',            ui.email,
    'workspace_id',     ui.workspace_id,
    'workspace_name',   w.name,
    'role_code',        ui.role_code,
    'workspace_role',   ui.workspace_role,
    'invited_by_name',  p.full_name,
    'invited_at',       ui.invited_at,
    'expires_at',       ui.expires_at,
    'personal_message', ui.personal_message,
    'is_valid',         (ui.status = 'pending' AND ui.expires_at > NOW())
  ) INTO v_result
  FROM public.user_invitations ui
  JOIN public.workspaces w ON w.id = ui.workspace_id
  LEFT JOIN public.profiles p ON p.id = ui.invited_by
  WHERE ui.invitation_token = p_token;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('is_valid', FALSE, 'error', 'Invitation not found');
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(UUID) TO authenticated, anon;

-- 5. Recreate pending_invitations_view with role_code
CREATE OR REPLACE VIEW public.pending_invitations_view AS
SELECT
  ui.id,
  ui.email,
  ui.workspace_id,
  w.name AS workspace_name,
  ui.role_code,
  ui.workspace_role,
  ui.invitation_token,
  ui.invited_by,
  p.full_name AS invited_by_name,
  ui.invited_at,
  ui.expires_at,
  ui.personal_message,
  EXTRACT(EPOCH FROM (ui.expires_at - NOW())) / 3600 AS hours_until_expiry
FROM public.user_invitations ui
JOIN public.workspaces w ON w.id = ui.workspace_id
LEFT JOIN public.profiles p ON p.id = ui.invited_by
WHERE ui.status = 'pending'
  AND ui.expires_at > NOW();

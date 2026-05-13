-- Fix invite_user: refresh invited_at and issue a new token on conflict so that
-- re-inviting someone who already has a pending invitation resets the sent date
-- and invalidates the old link.

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

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    JOIN public.roles r ON r.id = wm.role_id
    WHERE wm.user_id = v_user_id
      AND wm.workspace_id = p_workspace_id
      AND r.code IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: workspace admin role required';
  END IF;

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
    role_code        = EXCLUDED.role_code,
    workspace_role   = EXCLUDED.workspace_role,
    personal_message = EXCLUDED.personal_message,
    invited_by       = EXCLUDED.invited_by,
    invitation_token = gen_random_uuid(),
    invited_at       = NOW(),
    expires_at       = NOW() + INTERVAL '7 days',
    updated_at       = NOW()
  RETURNING id INTO v_invitation_id;

  RETURN v_invitation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_user(TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated;

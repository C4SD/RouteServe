-- ============================================================================
-- Fix invite_user RPC
-- ----------------------------------------------------------------------------
-- Two bugs fixed:
--
-- 1. Admin check used INNER JOIN on roles, so workspace owners/admins whose
--    role_id was never backfilled (pre-RBAC-v2) hit "Access denied" even though
--    their workspace_members.role column is correctly set to 'owner'/'admin'.
--    Fix: LEFT JOIN + OR fallback to legacy role column, matching the RLS policy.
--
-- 2. After the RPC the frontend did a separate SELECT to retrieve invitation_token.
--    That SELECT is subject to RLS and can silently return null (no rows), causing
--    the edge function to never be called — no email is sent, but the DB record
--    exists. Fix: return JSONB { id, invitation_token } from the RPC itself
--    (SECURITY DEFINER bypasses RLS so the token is always readable).
-- ============================================================================

-- Must drop before recreating because the return type changes (UUID → JSONB).
DROP FUNCTION IF EXISTS public.invite_user(TEXT, UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.invite_user(
  p_email            TEXT,
  p_workspace_id     UUID,
  p_role_code        TEXT    DEFAULT 'viewer',
  p_workspace_role   TEXT    DEFAULT 'member',
  p_personal_message TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id         UUID := auth.uid();
  v_invitation_id   UUID;
  v_invitation_token UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Use LEFT JOIN + legacy-role fallback so pre-RBAC-v2 workspace owners
  -- (role_id IS NULL, role = 'owner') are not locked out.
  IF NOT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    LEFT JOIN public.roles r ON r.id = wm.role_id
    WHERE wm.user_id      = v_user_id
      AND wm.workspace_id = p_workspace_id
      AND (r.code IN ('owner', 'admin') OR wm.role IN ('owner', 'admin'))
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
  RETURNING id, invitation_token INTO v_invitation_id, v_invitation_token;

  RETURN jsonb_build_object(
    'id',               v_invitation_id,
    'invitation_token', v_invitation_token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_user(TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated;
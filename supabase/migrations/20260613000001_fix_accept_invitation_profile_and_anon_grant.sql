-- ============================================================================
-- Fix: accept_invitation FK violation & get_invitation_by_token 401
-- ============================================================================
-- Bug 1: accept_invitation inserts auth.uid() into workspace_members.user_id,
--   which has a FK to profiles.id (not auth.users). If the user's profile row
--   doesn't exist (trigger failure, OAuth edge case, delayed replication), the
--   INSERT fails with "violates foreign key constraint workspace_members_user_id_fkey".
--   Fix: ensure the profile row exists (upsert) before the workspace_members INSERT.
--
-- Bug 2: get_invitation_by_token returns 401 for unauthenticated users when
--   the client sends a stale/expired JWT. Re-grant to anon for safety, but the
--   real fix is also client-side (clear stale session before calling).
-- ============================================================================

BEGIN;

-- 1. Recreate accept_invitation with profile-existence guard
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_user_id    UUID := auth.uid();
  v_user_email TEXT;
  v_role_id    UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to accept invitation';
  END IF;

  -- Fetch user email from auth.users (SECURITY DEFINER can access auth schema)
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  -- Fetch and validate the invitation
  SELECT * INTO v_invitation
  FROM public.user_invitations
  WHERE invitation_token = p_token
    AND status = 'pending'
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation token';
  END IF;

  -- Verify email matches
  IF v_user_email IS DISTINCT FROM v_invitation.email THEN
    RAISE EXCEPTION 'Invitation was sent to a different email address';
  END IF;

  -- ── Guard: ensure the profiles row exists ──────────────────────────
  -- The handle_new_user() trigger should have created it on signup, but
  -- edge cases (OAuth, trigger failure, delayed replication) can leave
  -- auth.users without a matching profiles row. The workspace_members FK
  -- references profiles.id, so we must guarantee the row exists first.
  INSERT INTO public.profiles (id, full_name, phone)
  SELECT
    au.id,
    au.raw_user_meta_data ->> 'full_name',
    au.raw_user_meta_data ->> 'phone'
  FROM auth.users au
  WHERE au.id = v_user_id
  ON CONFLICT (id) DO NOTHING;

  -- Lookup role_id for this role_code
  SELECT id INTO v_role_id FROM public.roles WHERE code = v_invitation.role_code LIMIT 1;

  -- Mark invitation accepted
  UPDATE public.user_invitations
  SET status      = 'accepted',
      accepted_at = NOW(),
      accepted_by = v_user_id,
      updated_at  = NOW()
  WHERE id = v_invitation.id;

  -- Add user to workspace
  INSERT INTO public.workspace_members (workspace_id, user_id, role, role_id, status)
  VALUES (
    v_invitation.workspace_id,
    v_user_id,
    CASE v_invitation.role_code
      WHEN 'admin'  THEN 'admin'
      WHEN 'viewer' THEN 'viewer'
      ELSE 'member'
    END,
    v_role_id,
    'active'
  )
  ON CONFLICT (workspace_id, user_id) DO UPDATE
  SET role_id    = EXCLUDED.role_id,
      role       = EXCLUDED.role,
      status     = 'active',
      updated_at = NOW();

  -- Advance user status from 'registered' → 'role_assigned'
  UPDATE public.profiles
  SET user_status     = 'role_assigned',
      role_assigned_at = COALESCE(role_assigned_at, NOW())
  WHERE id = v_user_id
    AND user_status = 'registered';

  -- For driver role: also create the mod4_driver_links entry
  IF v_invitation.role_code = 'driver' THEN
    INSERT INTO public.mod4_driver_links (user_id, status, link_method, linked_by)
    VALUES (v_user_id, 'active', 'email_invitation', v_invitation.invited_by)
    ON CONFLICT (user_id) DO UPDATE
    SET status      = 'active',
        link_method = 'email_invitation',
        updated_at  = NOW()
    WHERE mod4_driver_links.status != 'active';
  END IF;

  RETURN jsonb_build_object(
    'success',        true,
    'workspace_id',   v_invitation.workspace_id,
    'workspace_name', (SELECT name FROM public.workspaces WHERE id = v_invitation.workspace_id),
    'role_code',      v_invitation.role_code,
    'workspace_role', v_invitation.workspace_role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(UUID) TO authenticated;

-- 2. Re-grant get_invitation_by_token to anon (belt-and-suspenders)
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(UUID) TO anon, authenticated;

COMMIT;

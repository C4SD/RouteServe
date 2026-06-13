-- ============================================================================
-- Auto-confirm email for users who sign up from an invitation
-- ============================================================================
-- Problem: Supabase Auth requires email confirmation before signInWithPassword
-- works. Users who sign up from an invitation link can't sign in because their
-- email isn't confirmed yet, even though the invitation already validates it.
--
-- Solution: A SECURITY DEFINER RPC that confirms the user's email if they have
-- a valid pending invitation. Called by the frontend right after signUp().
-- ============================================================================

CREATE OR REPLACE FUNCTION public.confirm_invited_email(p_token UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_user_id    UUID;
BEGIN
  -- Validate the invitation token
  SELECT email INTO v_invitation
  FROM public.user_invitations
  WHERE invitation_token = p_token
    AND status = 'pending'
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Find the auth.users record for this email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_invitation.email
    AND email_confirmed_at IS NULL;

  IF v_user_id IS NULL THEN
    -- Already confirmed or user doesn't exist — nothing to do
    RETURN TRUE;
  END IF;

  -- Confirm the email — safe because the invitation system already validated it
  UPDATE auth.users
  SET email_confirmed_at = NOW(),
      updated_at = NOW()
  WHERE id = v_user_id;

  -- Also ensure the profile exists (same guard as accept_invitation)
  INSERT INTO public.profiles (id, full_name, phone)
  SELECT
    au.id,
    au.raw_user_meta_data ->> 'full_name',
    au.raw_user_meta_data ->> 'phone'
  FROM auth.users au
  WHERE au.id = v_user_id
  ON CONFLICT (id) DO NOTHING;

  RETURN TRUE;
END;
$$;

-- Callable by anon (user just signed up, may not have a valid session yet)
GRANT EXECUTE ON FUNCTION public.confirm_invited_email(UUID) TO anon, authenticated;

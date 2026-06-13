-- ============================================================================
-- One-time fix: confirm emails for users who signed up from invitations
-- but couldn't sign in because email_confirmed_at was NULL
-- ============================================================================

UPDATE auth.users au
SET email_confirmed_at = NOW(),
    updated_at = NOW()
WHERE au.email_confirmed_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.user_invitations ui
    WHERE ui.email = au.email
      AND ui.status IN ('pending', 'accepted')
  );

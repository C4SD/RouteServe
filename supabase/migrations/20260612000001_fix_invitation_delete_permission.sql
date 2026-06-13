-- Fix: "permission denied for table users" when deleting invitations
-- ----------------------------------------------------------------------------
-- Root cause: the original SELECT policy "Users can view invitations to their
-- email" (from 20260121000003) contains a subquery against auth.users:
--
--   email = (SELECT email FROM auth.users WHERE id = auth.uid())
--
-- The `authenticated` role cannot SELECT from auth.users. PostgreSQL evaluates
-- ALL permissive RLS policies (combining with OR), so even though the
-- workspace-admin SELECT policy is sufficient for admin users, the auth.users
-- subquery still executes and throws a hard "permission denied" error. This
-- blocks DELETE operations because PostgREST requires row visibility (SELECT
-- policies) in addition to the DELETE policy.
--
-- Fix: replace the auth.users subquery with auth.jwt() ->> 'email', which
-- reads the email claim directly from the JWT without any table access.
-- ----------------------------------------------------------------------------

BEGIN;

DROP POLICY IF EXISTS "Users can view invitations to their email"
  ON public.user_invitations;

CREATE POLICY "Users can view invitations to their email"
  ON public.user_invitations FOR SELECT
  USING (
    email = (auth.jwt() ->> 'email')
  );

COMMIT;

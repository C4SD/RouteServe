-- Fix 403 on all_invitations_view and pending_invitations_view.
-- The original migrations that created these views and added GRANT SELECT
-- were registered in schema_migrations without actually being executed,
-- so authenticated users have no SELECT permission on either view.
-- Also grants SELECT on the underlying table for security_invoker=true views.

GRANT SELECT ON public.all_invitations_view     TO authenticated;
GRANT SELECT ON public.pending_invitations_view TO authenticated;
GRANT SELECT ON public.user_invitations         TO authenticated;

REVOKE ALL   ON public.all_invitations_view     FROM anon;
REVOKE ALL   ON public.pending_invitations_view FROM anon;

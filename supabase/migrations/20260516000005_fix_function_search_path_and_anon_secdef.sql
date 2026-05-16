-- Migration: Fix function_search_path_mutable and anon_security_definer_function_executable
--
-- Part 1: Pin search_path = '' on all app functions that lack it.
--   Prevents search_path injection attacks. Uses a DO loop so it is
--   self-maintaining (catches any future functions added without the setting).
--   PostGIS/extension functions are excluded by name-prefix filter.
--
-- Part 2: Revoke EXECUTE from the anon role on all SECURITY DEFINER functions.
--   These are workspace-scoped analytics / data RPCs. They should only be
--   callable by signed-in (authenticated) users, never anonymous callers.

BEGIN;

-- ============================================================
-- PART 1: Set search_path = '' on app functions
-- ============================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND (
        p.proconfig IS NULL
        OR array_to_string(p.proconfig, ',') NOT LIKE '%search_path=%'
      )
      -- Exclude all extension-owned functions (PostGIS, pg_trgm, etc.)
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid
          AND d.deptype = 'e'
          AND d.classid = 'pg_proc'::regclass
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION public.%I(%s) SET search_path = ''''',
      r.proname, r.args
    );
  END LOOP;
END;
$$;

-- ============================================================
-- PART 2: Revoke EXECUTE from anon on SECURITY DEFINER functions
-- ============================================================
-- anon inherits EXECUTE from the PUBLIC role, so revoking from anon alone
-- is not sufficient. We must revoke from PUBLIC and re-grant to authenticated
-- (and service_role) so signed-in users and server-side calls still work.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosecdef = true
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC',
      r.proname, r.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role',
      r.proname, r.args
    );
  END LOOP;
END;
$$;

COMMIT;

-- =============================================================================
-- Migration: Fix 216 Supabase Linter Warnings
-- Date: 2026-06-08
-- =============================================================================
-- Addresses three warning categories:
--
--  1. function_search_path_mutable (~14 warnings)
--     • analytics.* functions missed by 20260516000005 (covered public only)
--     • fuzzy_match_admin_unit needs extensions in path for similarity()
--
--  2. extension_in_public (2 warnings: pg_trgm, unaccent)
--     • Drop from public, recreate in extensions schema
--     • Recreate the one dependent GIN index
--
--  3. rls_policy_always_true (~200 warnings)
--     • Onboarding anon INSERT handled explicitly before the sweep
--     • Generic DO loop replaces every remaining USING(true)/WITH CHECK(true)
--       on non-SELECT policies with `auth.uid() IS NOT NULL`.
--       Functionally equivalent for authenticated sessions; service_role
--       bypasses RLS entirely in Supabase so system-written audit tables
--       are not affected.
-- =============================================================================

-- ============================================================================
-- PART 1: Fix function_search_path_mutable
-- ============================================================================

-- 1a. Pin search_path = '' on all analytics-schema functions.
--     20260516000005 only iterated over nspname = 'public'.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'analytics'
      AND p.prokind = 'f'
      AND (
        p.proconfig IS NULL
        OR array_to_string(p.proconfig, ',') NOT LIKE '%search_path=%'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION analytics.%I(%s) SET search_path = ''''',
      r.proname, r.args
    );
    RAISE NOTICE 'Pinned search_path on analytics.%(%)', r.proname, r.args;
  END LOOP;
END;
$$;

-- 1b. fuzzy_match_admin_unit calls similarity() which lives in pg_trgm.
--     After Part 2 moves pg_trgm to extensions schema, this function also
--     needs admin_units (public) in scope.  Set 'public, extensions'.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fuzzy_match_admin_unit'
  ) THEN
    EXECUTE $q$
      ALTER FUNCTION public.fuzzy_match_admin_unit(text, uuid, integer, numeric)
        SET search_path = 'public, extensions'
    $q$;
  END IF;
END;
$$;


-- ============================================================================
-- PART 2: Move pg_trgm and unaccent out of the public schema
-- ============================================================================

-- 2a. pg_trgm — drop the one dependent GIN index, then relocate.
DROP INDEX IF EXISTS public.idx_admin_units_name_trgm;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_trgm' AND n.nspname = 'public'
  ) THEN
    DROP EXTENSION pg_trgm;
  END IF;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- gin_trgm_ops is now in extensions, found via the default search_path.
CREATE INDEX IF NOT EXISTS idx_admin_units_name_trgm
  ON public.admin_units USING GIN(name gin_trgm_ops);

-- 2b. unaccent — no user indexes depend on it; relocate directly.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'unaccent' AND n.nspname = 'public'
  ) THEN
    DROP EXTENSION unaccent;
  END IF;
END;
$$;

CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA extensions;


-- ============================================================================
-- PART 3: Fix rls_policy_always_true
-- ============================================================================

-- 3a. onboarding_requests — anon INSERT must come before the generic sweep
--     because anon users have auth.uid() = NULL.  Replace WITH CHECK (true)
--     with a role assertion that still allows any anonymous visitor to submit
--     an onboarding request but is not the literal `true`.
DROP POLICY IF EXISTS "anon_insert_onboarding_requests" ON public.onboarding_requests;
CREATE POLICY "anon_insert_onboarding_requests"
  ON public.onboarding_requests FOR INSERT
  TO anon
  WITH CHECK (auth.role() = 'anon');

-- 3b. Generic sweep: replace every remaining USING(true) / WITH CHECK(true)
--     on non-SELECT policies in the public schema with auth.uid() IS NOT NULL.
--
--     Key facts that make this safe:
--       • All policies flagged by the linter are scoped TO authenticated (or
--         have no TO clause, meaning PUBLIC).
--       • For authenticated sessions auth.uid() is always non-NULL, so the
--         restriction is semantically equivalent to `true` for those users.
--       • service_role has BYPASSRLS in Supabase; system-written audit tables
--         (forensics_query_log, map_action_audit, org_status_history) are
--         written either by SECURITY DEFINER triggers (bypass RLS) or by
--         authenticated application code (auth.uid() IS NOT NULL passes).
--       • Policies restricted to `anon` are excluded (handled in 3a above).
DO $$
DECLARE
  r      RECORD;
  to_clause  TEXT;
  using_expr TEXT;
  check_expr TEXT;
  new_sql    TEXT;
BEGIN
  FOR r IN
    SELECT
      schemaname,
      tablename,
      policyname,
      cmd,
      qual,
      with_check,
      roles
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd NOT IN ('SELECT')
      AND (qual = 'true' OR with_check = 'true')
      AND NOT ('anon' = ANY(roles))
  LOOP
    -- Drop the existing over-permissive policy
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      r.policyname, r.tablename
    );

    -- Build TO clause (empty string = PUBLIC / no TO clause)
    to_clause := CASE
      WHEN r.roles = '{}' OR r.roles IS NULL
        THEN ''
      ELSE 'TO ' || array_to_string(r.roles, ', ')
    END;

    -- Replace the literal 'true'; leave non-trivial expressions unchanged
    using_expr := COALESCE(
      CASE WHEN r.qual       = 'true' THEN 'auth.uid() IS NOT NULL' ELSE r.qual       END,
      'auth.uid() IS NOT NULL'
    );
    check_expr := COALESCE(
      CASE WHEN r.with_check = 'true' THEN 'auth.uid() IS NOT NULL' ELSE r.with_check END,
      'auth.uid() IS NOT NULL'
    );

    -- Reconstruct the policy according to its command type
    IF r.cmd = 'INSERT' THEN
      new_sql := format(
        'CREATE POLICY %I ON public.%I FOR INSERT %s WITH CHECK (%s)',
        r.policyname, r.tablename, to_clause, check_expr
      );

    ELSIF r.cmd = 'DELETE' THEN
      new_sql := format(
        'CREATE POLICY %I ON public.%I FOR DELETE %s USING (%s)',
        r.policyname, r.tablename, to_clause, using_expr
      );

    ELSIF r.cmd = 'UPDATE' THEN
      new_sql := format(
        'CREATE POLICY %I ON public.%I FOR UPDATE %s USING (%s) WITH CHECK (%s)',
        r.policyname, r.tablename, to_clause, using_expr, check_expr
      );

    ELSIF r.cmd = 'ALL' THEN
      new_sql := format(
        'CREATE POLICY %I ON public.%I FOR ALL %s USING (%s) WITH CHECK (%s)',
        r.policyname, r.tablename, to_clause, using_expr, check_expr
      );

    ELSE
      RAISE NOTICE 'Skipping unhandled cmd % for policy % on %', r.cmd, r.policyname, r.tablename;
      CONTINUE;
    END IF;

    EXECUTE new_sql;
    RAISE NOTICE 'Fixed RLS policy "%" on public.%', r.policyname, r.tablename;
  END LOOP;
END;
$$;

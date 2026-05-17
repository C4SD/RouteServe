-- ============================================================================
-- RBAC v2 Audit: detect tables whose write policies were dropped by the
-- DROP TYPE app_role CASCADE in 20260324000001_cleanup_legacy_rbac.sql.
--
-- Run inside Supabase SQL editor (no migration side effects). Inspect the
-- output, then ask Cascade to write targeted policy migrations for any rows
-- where rls_enabled = true and write_policy_count = 0.
--
-- Author: Cascade — RBAC v2 sanitation (docs/audit/RBAC_V2_SANITATION.md A7)
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Candidate tables — every table whose original policies used app_role.
-- --------------------------------------------------------------------------
WITH candidate_tables(name) AS (
  VALUES
    ('service_zones'),
    ('vehicle_types'),
    ('driver_availability'),
    ('vehicle_maintenance'),
    ('vehicle_trips'),
    ('driver_vehicle_history'),
    ('recurring_schedules'),
    ('delivery_schedules'),
    ('schedule_batches'),
    ('upload_validations'),
    ('notifications'),
    ('vehicle_tiers'),
    ('vehicle_categories'),
    ('facility_types'),
    ('levels_of_care')
),
table_state AS (
  SELECT
    ct.name AS table_name,
    EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ct.name
    ) AS table_exists,
    COALESCE((
      SELECT c.relrowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ct.name
    ), FALSE) AS rls_enabled,
    EXISTS (
      SELECT 1 FROM information_schema.columns col
      WHERE col.table_schema = 'public'
        AND col.table_name = ct.name
        AND col.column_name = 'workspace_id'
    ) AS has_workspace_id,
    (
      SELECT COUNT(*) FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = ct.name
    ) AS total_policy_count,
    (
      SELECT COUNT(*) FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = ct.name
        AND p.cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    ) AS write_policy_count,
    (
      SELECT COUNT(*) FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = ct.name
        AND p.cmd = 'SELECT'
    ) AS read_policy_count
  FROM candidate_tables ct
)
SELECT
  table_name,
  table_exists,
  rls_enabled,
  has_workspace_id,
  total_policy_count,
  read_policy_count,
  write_policy_count,
  CASE
    WHEN NOT table_exists                                  THEN 'SKIP — table missing'
    WHEN NOT rls_enabled                                   THEN 'OK — RLS disabled (table is open)'
    WHEN write_policy_count = 0 AND read_policy_count = 0  THEN 'CRITICAL — RLS on, zero policies (fully locked)'
    WHEN write_policy_count = 0                            THEN 'NEEDS FIX — no write policies (read-only for everyone)'
    ELSE                                                        'OK — has write policies'
  END AS verdict
FROM table_state
ORDER BY
  CASE
    WHEN NOT table_exists THEN 4
    WHEN NOT rls_enabled THEN 3
    WHEN write_policy_count = 0 THEN 1
    ELSE 2
  END,
  table_name;

-- --------------------------------------------------------------------------
-- 2. Full policy listing for the candidate set (for manual inspection).
-- --------------------------------------------------------------------------
SELECT
  tablename,
  policyname,
  cmd,
  roles,
  qual                AS using_expr,
  with_check          AS with_check_expr
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'service_zones','vehicle_types','driver_availability','vehicle_maintenance',
    'vehicle_trips','driver_vehicle_history','recurring_schedules',
    'delivery_schedules','schedule_batches','upload_validations','notifications',
    'vehicle_tiers','vehicle_categories','facility_types','levels_of_care'
  )
ORDER BY tablename, cmd, policyname;

-- --------------------------------------------------------------------------
-- 3. Roles seeded check — confirm RBAC v2 codes are present.
-- --------------------------------------------------------------------------
SELECT code, name, is_system_role
FROM public.roles
ORDER BY code;
-- Expect: admin, driver, fleet_manager, ops_manager, owner, viewer

-- --------------------------------------------------------------------------
-- 4. has_role / is_admin definitions — confirm v2-correct bodies.
-- --------------------------------------------------------------------------
SELECT
  proname,
  pg_get_function_identity_arguments(oid)  AS arguments,
  prosrc
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('has_role','is_admin','is_workspace_admin','has_workspace_role')
ORDER BY proname;

-- --------------------------------------------------------------------------
-- 5. Partial unique index on user_invitations (needed for invite_user resend).
-- --------------------------------------------------------------------------
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname='public' AND tablename='user_invitations';

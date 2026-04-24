-- ============================================================================
-- Fix Cross-Workspace Data Leaks
-- ============================================================================
-- Two confirmed leaks:
--
-- 1. get_program_metrics() is SECURITY DEFINER with no workspace_id filter
--    → Any authenticated user receives aggregate metrics from ALL workspaces.
--    Fix: add _workspace_id parameter, filter all queries, remove SECURITY DEFINER
--    (tables already have workspace-scoped RLS; SECURITY DEFINER is unnecessary).
--
-- 2. audit_logs has USING(true) open_select policy (from suspend_rbac migration)
--    → Any authenticated user can read all audit log rows from all organizations,
--    including previous_state / new_state JSON blobs with full record snapshots.
--    Fix: scope SELECT to rows where organization_id matches a workspace the
--    caller belongs to.
-- ============================================================================

-- ============================================================
-- 1. FIX get_program_metrics — add workspace_id, drop SECURITY DEFINER
-- ============================================================

DROP FUNCTION IF EXISTS public.get_program_metrics(TEXT);

CREATE OR REPLACE FUNCTION public.get_program_metrics(
  _program_code TEXT,
  _workspace_id  UUID
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  _result                JSON;
  _facility_count        INT;
  _active_requisitions   INT;
  _total_requisitions    INT;
  _fulfilled_requisitions INT;
  _active_batches        INT;
  _pending_batches       INT;
  _avg_delivery_days     NUMERIC;
BEGIN
  -- Count distinct facilities with requisitions for this program
  SELECT COUNT(DISTINCT facility_id)
  INTO _facility_count
  FROM requisitions
  WHERE program ILIKE _program_code
    AND workspace_id = _workspace_id;

  -- Count active requisitions (pending + approved)
  SELECT COUNT(*)
  INTO _active_requisitions
  FROM requisitions
  WHERE program ILIKE _program_code
    AND workspace_id = _workspace_id
    AND status IN ('pending', 'approved');

  -- Count total requisitions for fulfillment rate
  SELECT COUNT(*)
  INTO _total_requisitions
  FROM requisitions
  WHERE program ILIKE _program_code
    AND workspace_id = _workspace_id;

  -- Count fulfilled requisitions
  SELECT COUNT(*)
  INTO _fulfilled_requisitions
  FROM requisitions
  WHERE program ILIKE _program_code
    AND workspace_id = _workspace_id
    AND status = 'fulfilled';

  -- Count active batches containing facilities with this program's requisitions
  SELECT COUNT(DISTINCT db.id)
  INTO _active_batches
  FROM delivery_batches db
  WHERE db.workspace_id = _workspace_id
    AND db.status IN ('assigned', 'in-progress')
    AND EXISTS (
      SELECT 1 FROM unnest(db.facility_ids) AS fid
      JOIN requisitions r ON r.facility_id = fid
      WHERE r.program ILIKE _program_code
        AND r.workspace_id = _workspace_id
    );

  -- Count pending (planned) batches
  SELECT COUNT(DISTINCT db.id)
  INTO _pending_batches
  FROM delivery_batches db
  WHERE db.workspace_id = _workspace_id
    AND db.status = 'planned'
    AND EXISTS (
      SELECT 1 FROM unnest(db.facility_ids) AS fid
      JOIN requisitions r ON r.facility_id = fid
      WHERE r.program ILIKE _program_code
        AND r.workspace_id = _workspace_id
    );

  -- Average delivery time in days
  SELECT COALESCE(
    AVG(EXTRACT(EPOCH FROM (db.actual_end_time - db.actual_start_time)) / 86400.0),
    0
  )
  INTO _avg_delivery_days
  FROM delivery_batches db
  WHERE db.workspace_id = _workspace_id
    AND db.status = 'completed'
    AND db.actual_start_time IS NOT NULL
    AND db.actual_end_time IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM unnest(db.facility_ids) AS fid
      JOIN requisitions r ON r.facility_id = fid
      WHERE r.program ILIKE _program_code
        AND r.workspace_id = _workspace_id
    );

  SELECT json_build_object(
    'facility_count',        COALESCE(_facility_count, 0),
    'active_requisitions',   COALESCE(_active_requisitions, 0),
    'active_schedules',      0,
    'active_batches',        COALESCE(_active_batches, 0),
    'pending_batches',       COALESCE(_pending_batches, 0),
    'stockout_count',        0,
    'fulfillment_rate', CASE
      WHEN COALESCE(_total_requisitions, 0) = 0 THEN 0
      ELSE ROUND((_fulfilled_requisitions::NUMERIC / _total_requisitions) * 100)
    END,
    'avg_delivery_time', ROUND(COALESCE(_avg_delivery_days, 0)::NUMERIC, 1)
  ) INTO _result;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_program_metrics(TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION public.get_program_metrics IS
  'Computes workspace-scoped program metrics. Requires explicit workspace_id — no SECURITY DEFINER so RLS applies on top.';

-- ============================================================
-- 2. FIX audit_logs RLS — scope SELECT to caller's workspaces
-- ============================================================
-- Guard: only run if the table exists (it may not be deployed in all envs)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'audit_logs'
  ) THEN
    EXECUTE $policy$
      DROP POLICY IF EXISTS "open_select" ON public.audit_logs;
      DROP POLICY IF EXISTS "open_insert" ON public.audit_logs;
      DROP POLICY IF EXISTS "open_delete"  ON public.audit_logs;

      CREATE POLICY "audit_logs_workspace_select"
        ON public.audit_logs
        FOR SELECT
        TO authenticated
        USING (
          organization_id IS NULL
          OR is_workspace_member_v2(organization_id)
        );

      CREATE POLICY "audit_logs_workspace_insert"
        ON public.audit_logs
        FOR INSERT
        TO authenticated
        WITH CHECK (
          organization_id IS NULL
          OR is_workspace_member_v2(organization_id)
        );
    $policy$;
  END IF;
END;
$$;

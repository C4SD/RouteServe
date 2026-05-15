-- ============================================================
-- Manual Scheduling: Operational Refinement
-- ============================================================
-- Adds:
--   1. Planning window (start + end) to pre-batches and delivery_batches
--      replacing single planned_date with an "acceptable execution horizon"
--   2. planned_return timestamp on dispatch_runs for return ETA tracking
--   3. Extended dispatch_run status set for real operational tracking
-- ============================================================

-- ============================================================
-- 1. PLANNING WINDOW on scheduler_pre_batches
-- ============================================================

ALTER TABLE public.scheduler_pre_batches
  ADD COLUMN IF NOT EXISTS planning_window_start DATE,
  ADD COLUMN IF NOT EXISTS planning_window_end   DATE;

-- Backfill from planned_date so existing rows are consistent
UPDATE public.scheduler_pre_batches
SET
  planning_window_start = planned_date,
  planning_window_end   = planned_date
WHERE planning_window_start IS NULL
  AND planned_date IS NOT NULL;

COMMENT ON COLUMN public.scheduler_pre_batches.planning_window_start IS
  'Earliest acceptable dispatch date (replaces planned_date for new workflows)';
COMMENT ON COLUMN public.scheduler_pre_batches.planning_window_end IS
  'Latest acceptable dispatch date. NULL means open-ended from start date.';

-- ============================================================
-- 2. PLANNING WINDOW on delivery_batches
-- ============================================================

-- Drop stale cost_analysis trigger (mat view was dropped in 20260510000001 via CASCADE
-- but the trigger referencing refresh_cost_analysis() was not cleaned up).
DROP TRIGGER IF EXISTS trg_refresh_cost_analysis_batches ON public.delivery_batches;

ALTER TABLE public.delivery_batches
  ADD COLUMN IF NOT EXISTS planning_window_start DATE,
  ADD COLUMN IF NOT EXISTS planning_window_end   DATE;

-- Backfill from scheduled_date
UPDATE public.delivery_batches
SET
  planning_window_start = scheduled_date::date,
  planning_window_end   = scheduled_date::date
WHERE planning_window_start IS NULL;

COMMENT ON COLUMN public.delivery_batches.planning_window_start IS
  'Earliest acceptable execution date carried over from the pre-batch planning window';
COMMENT ON COLUMN public.delivery_batches.planning_window_end IS
  'Latest acceptable execution date. NULL means open-ended.';

-- ============================================================
-- 3. PLANNED RETURN on dispatch_runs
-- ============================================================

ALTER TABLE public.dispatch_runs
  ADD COLUMN IF NOT EXISTS planned_departure  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS planned_return     TIMESTAMPTZ;

COMMENT ON COLUMN public.dispatch_runs.planned_departure IS
  'Planned departure timestamp set during scheduling (not live dispatched_at)';
COMMENT ON COLUMN public.dispatch_runs.planned_return IS
  'Computed return ETA: planned_departure + travel_time + service_time + buffer';

-- ============================================================
-- 4. EXTENDED DISPATCH RUN STATUSES
-- ============================================================
-- Current: pending → dispatched → in_transit → completed | cancelled
-- Extended: planned → loading → departed → in_transit → delayed → partial_delivery → returned → completed | failed | cancelled
--
-- Strategy: widen the CHECK constraint to allow the new states.
-- The existing DB trigger enforces specific transition paths; we extend
-- it to also permit new status values (transition logic remains permissive
-- for new statuses — operational enforcement happens at the app layer).
-- ============================================================

-- Drop the existing status check constraint (name may vary — use DO block)
DO $$
DECLARE
  _con TEXT;
BEGIN
  SELECT conname INTO _con
  FROM pg_constraint
  WHERE conrelid = 'public.dispatch_runs'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';

  IF _con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.dispatch_runs DROP CONSTRAINT IF EXISTS %I', _con);
  END IF;
END
$$;

-- Re-add with extended status set
ALTER TABLE public.dispatch_runs
  ADD CONSTRAINT dispatch_runs_status_check CHECK (
    status IN (
      'planned',
      'loading',
      'pending',
      'departed',
      'dispatched',
      'in_transit',
      'delayed',
      'partial_delivery',
      'returned',
      'completed',
      'failed',
      'cancelled'
    )
  );

-- ============================================================
-- 5. RETURNED DELIVERIES on dispatch_runs
-- ============================================================
-- Stores per-stop return records for incomplete/partial deliveries.
-- Schema: { facility_id, facility_name, reason, action }[]
-- where action in ('reschedule' | 'merge_future' | 'manual' | 'warehouse_return')

ALTER TABLE public.dispatch_runs
  ADD COLUMN IF NOT EXISTS returned_deliveries JSONB;

COMMENT ON COLUMN public.dispatch_runs.returned_deliveries IS
  'Array of {facility_id, facility_name, reason, action} for stops that could not be completed';

-- ============================================================
-- 6. VEHICLE ALLOCATION SNAPSHOT on dispatch_runs
-- ============================================================
-- Stores the vehicle → facility assignments at dispatch time.
-- Schema: { vehicle_id, facilities: [facility_id], slots_used, capacity }[]

ALTER TABLE public.dispatch_runs
  ADD COLUMN IF NOT EXISTS vehicle_allocations JSONB;

COMMENT ON COLUMN public.dispatch_runs.vehicle_allocations IS
  'Array of {vehicle_id, facilities, slots_used, capacity} capturing per-vehicle load plan at dispatch';

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS scheduler_pre_batches_planning_window_idx
  ON public.scheduler_pre_batches (planning_window_start, planning_window_end);

CREATE INDEX IF NOT EXISTS delivery_batches_planning_window_idx
  ON public.delivery_batches (planning_window_start, planning_window_end);

CREATE INDEX IF NOT EXISTS dispatch_runs_planned_departure_idx
  ON public.dispatch_runs (planned_departure);

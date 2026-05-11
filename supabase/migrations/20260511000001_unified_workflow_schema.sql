-- =====================================================
-- Unified Workflow Schema Additions
-- =====================================================
-- 1. policy_context + facility_packaging on scheduler_pre_batches
-- 2. facility_packaging + route_fallback_used on delivery_batches
-- 3. dispatch_runs table (operational state machine)
-- 4. batch_invoice_links junction table

-- ─── 1. scheduler_pre_batches ────────────────────────────────────────────────

ALTER TABLE scheduler_pre_batches
  ADD COLUMN IF NOT EXISTS policy_context       JSONB    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS facility_packaging   JSONB    DEFAULT NULL;

COMMENT ON COLUMN scheduler_pre_batches.policy_context IS
  'Service-policy cluster selection: { service_area_id, policy_id, cluster_id, cluster_code, ... }';

COMMENT ON COLUMN scheduler_pre_batches.facility_packaging IS
  'Snapshot of per-facility packaging rows at draft-save time: Record<facilityId, FacilityPackagingData>';

-- ─── 2. delivery_batches ─────────────────────────────────────────────────────

ALTER TABLE delivery_batches
  ADD COLUMN IF NOT EXISTS facility_packaging   JSONB    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS route_fallback_used  BOOLEAN  DEFAULT FALSE;

COMMENT ON COLUMN delivery_batches.facility_packaging IS
  'Frozen packaging snapshot copied from pre_batch at conversion time';

COMMENT ON COLUMN delivery_batches.route_fallback_used IS
  'TRUE when straight-line distance was used because the road-routing API failed';

-- ─── 3. dispatch_runs ────────────────────────────────────────────────────────
-- A dispatch_run is the live operational execution of a delivery_batch.
-- One batch can have at most one active run; cancelled runs allow a retry.

CREATE TABLE IF NOT EXISTS dispatch_runs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  batch_id          UUID        NOT NULL REFERENCES delivery_batches(id) ON DELETE CASCADE,

  -- State machine
  -- pending → dispatched → in_transit → completed
  --                      ↘ cancelled  (from any state before completed)
  status            TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'dispatched', 'in_transit', 'completed', 'cancelled')),

  -- Assignment (mirrors batch assignment, may be overridden at dispatch time)
  vehicle_id        UUID        REFERENCES vehicles(id),
  vehicle_ids       UUID[]      DEFAULT '{}',
  driver_id         UUID        REFERENCES drivers(id),

  -- Timing
  dispatched_at     TIMESTAMPTZ,
  departed_at       TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  estimated_arrival TIMESTAMPTZ,

  -- Metrics (updated during execution)
  stops_total       INTEGER     NOT NULL DEFAULT 0,
  stops_completed   INTEGER     NOT NULL DEFAULT 0,
  distance_km       NUMERIC(10,2),
  duration_min      INTEGER,

  -- Notes / cancellation
  notes             TEXT,
  cancel_reason     TEXT,

  -- Audit
  created_by        UUID        REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active run per batch (pending/dispatched/in_transit)
CREATE UNIQUE INDEX IF NOT EXISTS dispatch_runs_one_active_per_batch
  ON dispatch_runs (batch_id)
  WHERE status IN ('pending', 'dispatched', 'in_transit');

CREATE INDEX IF NOT EXISTS dispatch_runs_workspace_id      ON dispatch_runs (workspace_id);
CREATE INDEX IF NOT EXISTS dispatch_runs_batch_id          ON dispatch_runs (batch_id);
CREATE INDEX IF NOT EXISTS dispatch_runs_status            ON dispatch_runs (status);
CREATE INDEX IF NOT EXISTS dispatch_runs_vehicle_id        ON dispatch_runs (vehicle_id);
CREATE INDEX IF NOT EXISTS dispatch_runs_driver_id         ON dispatch_runs (driver_id);
CREATE INDEX IF NOT EXISTS dispatch_runs_dispatched_at     ON dispatch_runs (dispatched_at DESC NULLS LAST);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_dispatch_run_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_run_updated_at ON dispatch_runs;
CREATE TRIGGER trg_dispatch_run_updated_at
  BEFORE UPDATE ON dispatch_runs
  FOR EACH ROW EXECUTE FUNCTION update_dispatch_run_updated_at();

-- Enforce legal status transitions
CREATE OR REPLACE FUNCTION enforce_dispatch_run_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  IF NOT (
    (OLD.status = 'pending'     AND NEW.status IN ('dispatched', 'cancelled')) OR
    (OLD.status = 'dispatched'  AND NEW.status IN ('in_transit', 'cancelled')) OR
    (OLD.status = 'in_transit'  AND NEW.status IN ('completed',  'cancelled'))
  ) THEN
    RAISE EXCEPTION 'Invalid dispatch_run transition: % → %', OLD.status, NEW.status;
  END IF;

  -- Stamp timing columns automatically
  IF NEW.status = 'dispatched'  AND NEW.dispatched_at IS NULL THEN
    NEW.dispatched_at = NOW();
  END IF;
  IF NEW.status = 'in_transit'  AND NEW.departed_at IS NULL THEN
    NEW.departed_at = NOW();
  END IF;
  IF NEW.status = 'completed'   AND NEW.completed_at IS NULL THEN
    NEW.completed_at = NOW();
  END IF;
  IF NEW.status = 'cancelled'   AND NEW.cancelled_at IS NULL THEN
    NEW.cancelled_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_run_transition ON dispatch_runs;
CREATE TRIGGER trg_dispatch_run_transition
  BEFORE UPDATE ON dispatch_runs
  FOR EACH ROW EXECUTE FUNCTION enforce_dispatch_run_transition();

-- ─── 4. batch_invoice_links ──────────────────────────────────────────────────
-- Explicit many-to-many between delivery_batches and invoices.
-- Populated at batch-conversion time from facility_requisition_map.

CREATE TABLE IF NOT EXISTS batch_invoice_links (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  batch_id     UUID        NOT NULL REFERENCES delivery_batches(id) ON DELETE CASCADE,
  invoice_id   UUID        NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  facility_id  UUID        REFERENCES facilities(id),
  linked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT batch_invoice_links_unique UNIQUE (batch_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS batch_invoice_links_batch_id    ON batch_invoice_links (batch_id);
CREATE INDEX IF NOT EXISTS batch_invoice_links_invoice_id  ON batch_invoice_links (invoice_id);
CREATE INDEX IF NOT EXISTS batch_invoice_links_workspace   ON batch_invoice_links (workspace_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE dispatch_runs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_invoice_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY dispatch_runs_workspace_isolation ON dispatch_runs
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY batch_invoice_links_workspace_isolation ON batch_invoice_links
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

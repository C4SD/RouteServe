-- =====================================================
-- BATCH SLOT ASSIGNMENTS
-- Migration: 20260405000002
--
-- Adds:
--   1. batch_slot_assignments table — persists vehicle slot → facility mapping
--      for a dispatch batch / trip plan
-- =====================================================

-- =====================================================
-- 1. BATCH SLOT ASSIGNMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.batch_slot_assignments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Batch context
  batch_id     TEXT        NOT NULL,   -- dispatch batch / trip plan ID

  -- Slot identity (matches VehicleSlot.slot_key format)
  vehicle_id   TEXT        NOT NULL,
  slot_key     TEXT        NOT NULL,   -- "{vehicleId}-{tierName}-{slotNumber}"
  tier_name    TEXT        NOT NULL,
  slot_number  INTEGER     NOT NULL,

  -- What is loaded
  facility_id  TEXT        NOT NULL,   -- delivery stop / facility
  load_kg      NUMERIC,
  load_volume_m3 NUMERIC,
  sequence_order INTEGER,

  -- Lifecycle
  status       TEXT        NOT NULL DEFAULT 'assigned'
                 CHECK (status IN ('assigned', 'loaded', 'removed')),

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Each slot can only have one facility per batch
  CONSTRAINT uq_batch_slot UNIQUE (batch_id, slot_key),
  -- Each facility can only appear once per batch
  CONSTRAINT uq_batch_facility UNIQUE (batch_id, facility_id)
);

-- =====================================================
-- 2. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_batch_slot_assignments_workspace
  ON public.batch_slot_assignments (workspace_id);

CREATE INDEX IF NOT EXISTS idx_batch_slot_assignments_batch
  ON public.batch_slot_assignments (batch_id);

CREATE INDEX IF NOT EXISTS idx_batch_slot_assignments_vehicle
  ON public.batch_slot_assignments (vehicle_id);

-- =====================================================
-- 3. UPDATED_AT TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_batch_slot_assignments_updated_at
  BEFORE UPDATE ON public.batch_slot_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- 4. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.batch_slot_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can manage slot assignments"
  ON public.batch_slot_assignments
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id
      FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Fix: snapshot lock trigger blocked vehicle deletion via FK cascade.
--
-- When a vehicle is deleted, the FK (delivery_batches.vehicle_id ON DELETE SET NULL)
-- fires an UPDATE that sets vehicle_id = NULL. The prevent_batch_modifications_after_lock
-- trigger treated this as a forbidden vehicle reassignment and raised an exception.
--
-- The batch_snapshot JSONB already captures the vehicle at dispatch time, so nullifying
-- vehicle_id after deletion is safe. We only block changing to a *different* vehicle.

CREATE OR REPLACE FUNCTION prevent_batch_modifications_after_lock()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_snapshot_locked = TRUE THEN
    -- Allow only status changes to terminal states
    IF NEW.status NOT IN ('in-progress', 'completed', 'cancelled') THEN
      RAISE EXCEPTION 'Cannot change status from % to % after dispatch started', OLD.status, NEW.status;
    END IF;

    -- Prevent facility modifications
    IF NEW.facility_ids IS DISTINCT FROM OLD.facility_ids THEN
      RAISE EXCEPTION 'Cannot modify facility_ids after dispatch started. Batch snapshot is locked.';
    END IF;

    -- Prevent vehicle reassignment, but allow NULL (FK cascade from vehicle deletion)
    IF NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id AND NEW.vehicle_id IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot change vehicle after dispatch started. Batch snapshot is locked.';
    END IF;

    -- Prevent quantity changes
    IF NEW.total_quantity IS DISTINCT FROM OLD.total_quantity THEN
      RAISE EXCEPTION 'Cannot modify total_quantity after dispatch started. Batch snapshot is locked.';
    END IF;

    -- Prevent route changes
    IF NEW.optimized_route IS DISTINCT FROM OLD.optimized_route THEN
      RAISE EXCEPTION 'Cannot modify optimized_route after dispatch started. Batch snapshot is locked.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

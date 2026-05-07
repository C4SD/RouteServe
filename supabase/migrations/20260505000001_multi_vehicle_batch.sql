-- Multi-vehicle assignment for delivery_batches and scheduler_pre_batches
-- Adds vehicle_ids (array) alongside the existing vehicle_id (kept for backward compat)

ALTER TABLE delivery_batches
  ADD COLUMN IF NOT EXISTS vehicle_ids UUID[] DEFAULT '{}';

-- Backfill existing single vehicle_id into the array
UPDATE delivery_batches
  SET vehicle_ids = ARRAY[vehicle_id]
  WHERE vehicle_id IS NOT NULL AND (vehicle_ids IS NULL OR vehicle_ids = '{}');

ALTER TABLE scheduler_pre_batches
  ADD COLUMN IF NOT EXISTS suggested_vehicle_ids UUID[] DEFAULT '{}';

-- Backfill existing suggested_vehicle_id into the array
UPDATE scheduler_pre_batches
  SET suggested_vehicle_ids = ARRAY[suggested_vehicle_id]
  WHERE suggested_vehicle_id IS NOT NULL AND (suggested_vehicle_ids IS NULL OR suggested_vehicle_ids = '{}');

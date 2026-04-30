-- Fix delivery_batches.vehicle_id FK to allow vehicle deletion.
-- The original constraint had no ON DELETE action (defaulting to RESTRICT),
-- which prevents deleting a vehicle that appears on any batch.
-- Setting NULL here preserves historical batch records while unblocking deletion.

ALTER TABLE public.delivery_batches
  DROP CONSTRAINT IF EXISTS delivery_batches_vehicle_id_fkey;

ALTER TABLE public.delivery_batches
  ADD CONSTRAINT delivery_batches_vehicle_id_fkey
    FOREIGN KEY (vehicle_id)
    REFERENCES public.vehicles(id)
    ON DELETE SET NULL;

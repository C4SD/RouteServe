-- Fix dispatch_runs.vehicle_id FK to allow vehicle deletion.
-- The original constraint had no ON DELETE action (defaulting to RESTRICT),
-- which prevents deleting a vehicle that appears in any dispatch run.
-- Setting NULL here preserves historical dispatch run records while unblocking deletion.

ALTER TABLE public.dispatch_runs
  DROP CONSTRAINT IF EXISTS dispatch_runs_vehicle_id_fkey;

ALTER TABLE public.dispatch_runs
  ADD CONSTRAINT dispatch_runs_vehicle_id_fkey
    FOREIGN KEY (vehicle_id)
    REFERENCES public.vehicles(id)
    ON DELETE SET NULL;

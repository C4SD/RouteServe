-- Fix vehicle deletion: two blockers
--
-- 1. handoffs.from_vehicle_id / to_vehicle_id have no ON DELETE action (defaults to
--    RESTRICT), so deleting any vehicle that ever participated in a handoff fails
--    with a FK violation. Cascade-deleting handoff records is correct here because
--    a handoff without either vehicle is meaningless.
--
-- 2. (Context for app-side fix) vehicles with workspace_id = NULL are invisible
--    to the workspace_isolation RLS policy on DELETE, so those deletes silently
--    succeed with 0 rows. The app-side fix adds a count check.

ALTER TABLE public.handoffs
  DROP CONSTRAINT IF EXISTS handoffs_from_vehicle_id_fkey;

ALTER TABLE public.handoffs
  ADD CONSTRAINT handoffs_from_vehicle_id_fkey
    FOREIGN KEY (from_vehicle_id)
    REFERENCES public.vehicles(id)
    ON DELETE CASCADE;

ALTER TABLE public.handoffs
  DROP CONSTRAINT IF EXISTS handoffs_to_vehicle_id_fkey;

ALTER TABLE public.handoffs
  ADD CONSTRAINT handoffs_to_vehicle_id_fkey
    FOREIGN KEY (to_vehicle_id)
    REFERENCES public.vehicles(id)
    ON DELETE CASCADE;

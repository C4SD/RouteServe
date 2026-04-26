-- ============================================================================
-- Fix: warehouses nullable fields for onboarding flow
-- ============================================================================
-- The onboarding DataImportStep only collects name, address, and workspace_id.
-- capacity INTEGER NOT NULL had no default, causing all onboarding inserts
-- to fail with a NOT NULL violation.
-- ============================================================================

ALTER TABLE public.warehouses
  ALTER COLUMN capacity DROP NOT NULL,
  ALTER COLUMN capacity SET DEFAULT NULL;

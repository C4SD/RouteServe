-- Fix zone code uniqueness to be scoped per workspace.
-- The original zones table had `code TEXT UNIQUE` — a global constraint that
-- prevents two different workspaces from using the same zone code (e.g. "Z01").
-- Replace it with a composite unique constraint per (workspace_id, code).

-- Drop the global unique constraint (PostgreSQL names it <table>_<col>_key)
ALTER TABLE public.zones DROP CONSTRAINT IF EXISTS zones_code_key;

-- Add workspace-scoped uniqueness: same code is OK across different workspaces
ALTER TABLE public.zones
  ADD CONSTRAINT zones_workspace_code_key UNIQUE (workspace_id, code);

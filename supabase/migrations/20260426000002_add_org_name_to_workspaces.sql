-- Add org_name to workspaces to separate organization identity from workspace team name.
-- org_name = the locked org-level name (e.g. "Ava Tech")
-- name     = the team-level workspace name (e.g. "Lisbon Team")
-- Existing records: seed org_name from name so nothing breaks.

BEGIN;

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS org_name TEXT;

UPDATE public.workspaces
SET org_name = name
WHERE org_name IS NULL;

-- Update RPC to accept p_org_name (only admins/owners may call this anyway)
CREATE OR REPLACE FUNCTION public.update_workspace_general_settings(
  p_workspace_id UUID,
  p_name         TEXT,
  p_org_type     TEXT    DEFAULT NULL,
  p_settings     JSONB   DEFAULT '{}'::jsonb,
  p_org_name     TEXT    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    JOIN public.roles r ON r.id = wm.role_id
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = auth.uid()
      AND wm.status = 'active'
      AND r.code IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Permission denied: only workspace admins can update settings';
  END IF;

  UPDATE public.workspaces
  SET
    name       = COALESCE(p_name, name),
    org_name   = COALESCE(p_org_name, org_name),
    org_type   = p_org_type,
    settings   = p_settings,
    updated_at = NOW()
  WHERE id = p_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace not found: %', p_workspace_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_workspace_general_settings(UUID, TEXT, TEXT, JSONB, TEXT) TO authenticated;

COMMIT;

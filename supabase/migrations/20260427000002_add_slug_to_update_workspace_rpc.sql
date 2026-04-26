-- Extend update_workspace_general_settings to accept an updated slug.
-- This allows the settings page to sync the workspace ID when the name changes.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_workspace_general_settings(
  p_workspace_id UUID,
  p_name         TEXT,
  p_org_type     TEXT    DEFAULT NULL,
  p_settings     JSONB   DEFAULT '{}'::jsonb,
  p_org_name     TEXT    DEFAULT NULL,
  p_slug         TEXT    DEFAULT NULL
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

  IF p_slug IS NOT NULL AND length(p_slug) < 3 THEN
    RAISE EXCEPTION 'Workspace ID must be at least 3 characters';
  END IF;

  IF p_slug IS NOT NULL AND p_slug !~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' THEN
    RAISE EXCEPTION 'Workspace ID must be lowercase alphanumeric with hyphens only';
  END IF;

  UPDATE public.workspaces
  SET
    name       = COALESCE(p_name, name),
    slug       = COALESCE(p_slug, slug),
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

-- Grant to both old and new signatures so both work during rollout
GRANT EXECUTE ON FUNCTION public.update_workspace_general_settings(UUID, TEXT, TEXT, JSONB, TEXT, TEXT) TO authenticated;

COMMIT;

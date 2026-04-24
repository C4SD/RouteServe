-- ============================================================================
-- check_workspace_name_available
-- Returns whether a proposed org name/slug is available for registration.
-- Used by the onboarding wizard to give real-time feedback before submission.
-- ============================================================================

CREATE OR REPLACE FUNCTION check_workspace_name_available(
  p_name TEXT,
  p_slug TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Slug is globally unique — check first (faster index hit)
  IF EXISTS (
    SELECT 1 FROM workspaces WHERE lower(slug) = lower(trim(p_slug))
  ) THEN
    RETURN jsonb_build_object('available', false, 'reason', 'slug_taken');
  END IF;

  -- Name case-insensitive global check
  IF EXISTS (
    SELECT 1 FROM workspaces WHERE lower(name) = lower(trim(p_name))
  ) THEN
    RETURN jsonb_build_object('available', false, 'reason', 'name_taken');
  END IF;

  RETURN jsonb_build_object('available', true, 'reason', null);
END;
$$;

COMMENT ON FUNCTION check_workspace_name_available IS
  'Pre-registration check: returns {available, reason} for a proposed org name/slug. Callable by authenticated users only.';

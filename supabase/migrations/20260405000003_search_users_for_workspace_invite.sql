-- ============================================================================
-- RPC: search_users_for_workspace_invite
-- ============================================================================
-- Searches all system users NOT already in the given workspace.
-- Required because get_admin_users only returns users in the caller's
-- existing workspaces, making it impossible to add new users.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.search_users_for_workspace_invite(
  p_workspace_id UUID,
  p_search TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Require workspace.manage permission (admin or owner role in the workspace)
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    JOIN public.roles r ON r.id = wm.role_id
    JOIN public.role_permissions rp ON rp.role_id = r.id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE wm.user_id = auth.uid()
      AND wm.workspace_id = p_workspace_id
      AND p.code = 'workspace.manage'
  ) THEN
    -- Fallback: also allow if user is admin/owner by role code directly
    IF NOT EXISTS (
      SELECT 1 FROM public.workspace_members wm
      JOIN public.roles r ON r.id = wm.role_id
      WHERE wm.user_id = auth.uid()
        AND wm.workspace_id = p_workspace_id
        AND r.code IN ('admin', 'owner')
    ) THEN
      RAISE EXCEPTION 'Access denied: workspace admin role required';
    END IF;
  END IF;

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'full_name')), '[]'::json) INTO result
  FROM (
    SELECT
      u.id,
      u.email,
      COALESCE(p.full_name, split_part(u.email, '@', 1)) AS full_name,
      p.phone
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id NOT IN (
      SELECT wm2.user_id FROM public.workspace_members wm2
      WHERE wm2.workspace_id = p_workspace_id
    )
    AND (
      p_search IS NULL
      OR u.email ILIKE '%' || p_search || '%'
      OR p.full_name ILIKE '%' || p_search || '%'
    )
    ORDER BY p.full_name ASC, u.email ASC
    LIMIT 20
  ) t;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_users_for_workspace_invite(UUID, TEXT) TO authenticated;

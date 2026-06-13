-- ============================================================================
-- Fix: NULL role_id breaks workspace visibility across 10+ functions
-- ============================================================================
-- Root cause: accept_invitation() looks up role_id from roles.code, but if the
-- code doesn't exist, role_id is silently set to NULL. Every function that
-- INNER JOINs workspace_members with roles then drops these members, making
-- them invisible — they see 0 data, can't manage settings, can't invite, etc.
--
-- This migration:
--   1. Backfills any existing NULL role_id → 'viewer'
--   2. Fixes accept_invitation with a fallback
--   3. Fixes get_my_workspaces (LEFT JOIN)
--   4. Fixes get_workspace_role (LEFT JOIN + COALESCE)
--   5. Fixes get_workspace_permissions (LEFT JOIN)
--   6. Fixes toggle_member_status (LEFT JOIN)
--   7. Fixes is_admin, is_workspace_admin, has_workspace_role (LEFT JOIN)
--   8. Fixes update_workspace_general_settings (LEFT JOIN)
--   9. Fixes invite_user (LEFT JOIN)
--  10. Fixes search_users_for_workspace_invite (LEFT JOIN)
--  11. Fixes get_admin_users (LEFT JOIN)
-- ============================================================================

BEGIN;

-- ============================================================
-- 0. DATA FIX: backfill NULL role_id
-- ============================================================
UPDATE public.workspace_members
SET role_id = (SELECT id FROM public.roles WHERE code = 'viewer' LIMIT 1)
WHERE role_id IS NULL;

-- ============================================================
-- 1. accept_invitation — fall back to 'viewer' if role_code lookup fails
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_user_id    UUID := auth.uid();
  v_user_email TEXT;
  v_role_id    UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to accept invitation';
  END IF;

  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  SELECT * INTO v_invitation
  FROM public.user_invitations
  WHERE invitation_token = p_token
    AND status = 'pending'
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation token';
  END IF;

  IF v_user_email IS DISTINCT FROM v_invitation.email THEN
    RAISE EXCEPTION 'Invitation was sent to a different email address';
  END IF;

  -- Guard: ensure the profiles row exists
  INSERT INTO public.profiles (id, full_name, phone)
  SELECT au.id, au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'phone'
  FROM auth.users au
  WHERE au.id = v_user_id
  ON CONFLICT (id) DO NOTHING;

  -- Lookup role_id; fall back to 'viewer' if role_code not found
  SELECT id INTO v_role_id FROM public.roles WHERE code = v_invitation.role_code LIMIT 1;
  IF v_role_id IS NULL THEN
    SELECT id INTO v_role_id FROM public.roles WHERE code = 'viewer' LIMIT 1;
  END IF;

  UPDATE public.user_invitations
  SET status = 'accepted', accepted_at = NOW(), accepted_by = v_user_id, updated_at = NOW()
  WHERE id = v_invitation.id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, role_id, status)
  VALUES (
    v_invitation.workspace_id, v_user_id,
    CASE v_invitation.role_code
      WHEN 'admin'  THEN 'admin'
      WHEN 'viewer' THEN 'viewer'
      ELSE 'member'
    END,
    v_role_id, 'active'
  )
  ON CONFLICT (workspace_id, user_id) DO UPDATE
  SET role_id = EXCLUDED.role_id, role = EXCLUDED.role, status = 'active', updated_at = NOW();

  UPDATE public.profiles
  SET user_status = 'role_assigned', role_assigned_at = COALESCE(role_assigned_at, NOW())
  WHERE id = v_user_id AND user_status = 'registered';

  IF v_invitation.role_code = 'driver' THEN
    INSERT INTO public.mod4_driver_links (user_id, status, link_method, linked_by)
    VALUES (v_user_id, 'active', 'email_invitation', v_invitation.invited_by)
    ON CONFLICT (user_id) DO UPDATE
    SET status = 'active', link_method = 'email_invitation', updated_at = NOW()
    WHERE mod4_driver_links.status != 'active';
  END IF;

  RETURN jsonb_build_object(
    'success',        true,
    'workspace_id',   v_invitation.workspace_id,
    'workspace_name', (SELECT name FROM public.workspaces WHERE id = v_invitation.workspace_id),
    'role_code',      v_invitation.role_code,
    'workspace_role', v_invitation.workspace_role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(UUID) TO authenticated;

-- ============================================================
-- 2. get_my_workspaces — LEFT JOIN so NULL role_id doesn't hide members
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_workspaces()
RETURNS TABLE (
  workspace_id UUID,
  name TEXT,
  slug TEXT,
  role_code TEXT,
  role_name TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    w.id AS workspace_id,
    w.name,
    w.slug,
    COALESCE(r.code, 'viewer') AS role_code,
    COALESCE(r.name, 'Viewer') AS role_name
  FROM public.workspace_members wm
  JOIN public.workspaces w ON w.id = wm.workspace_id
  LEFT JOIN public.roles r ON r.id = wm.role_id
  WHERE wm.user_id = auth.uid()
    AND wm.status = 'active'
    AND w.is_active = true
  ORDER BY w.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_workspaces() TO authenticated;

-- ============================================================
-- 3. get_workspace_role — LEFT JOIN + COALESCE
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_workspace_role(p_workspace_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(r.code, 'viewer')
  FROM public.workspace_members wm
  LEFT JOIN public.roles r ON r.id = wm.role_id
  WHERE wm.user_id = auth.uid()
    AND wm.workspace_id = p_workspace_id
    AND wm.status = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_role(UUID) TO authenticated;

-- ============================================================
-- 4. get_workspace_permissions — LEFT JOIN on role_permissions
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_workspace_permissions(p_workspace_id UUID)
RETURNS TABLE(permission_code TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  -- Base permissions from role
  SELECT DISTINCT p.code AS permission_code
  FROM public.workspace_members wm
  JOIN public.role_permissions rp ON rp.role_id = wm.role_id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE wm.user_id = auth.uid()
    AND wm.workspace_id = p_workspace_id
    AND wm.role_id IS NOT NULL

  UNION

  -- Per-user granted overrides
  SELECT p.code AS permission_code
  FROM public.workspace_members wm
  JOIN public.member_permissions mp ON mp.workspace_member_id = wm.id
  JOIN public.permissions p ON p.id = mp.permission_id
  WHERE wm.user_id = auth.uid()
    AND wm.workspace_id = p_workspace_id
    AND mp.granted = true

  EXCEPT

  -- Per-user revoked overrides
  SELECT p.code AS permission_code
  FROM public.workspace_members wm
  JOIN public.member_permissions mp ON mp.workspace_member_id = wm.id
  JOIN public.permissions p ON p.id = mp.permission_id
  WHERE wm.user_id = auth.uid()
    AND wm.workspace_id = p_workspace_id
    AND mp.granted = false;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_permissions(UUID) TO authenticated;

-- ============================================================
-- 5. toggle_member_status — LEFT JOIN for role lookups
-- ============================================================
CREATE OR REPLACE FUNCTION public.toggle_member_status(
  p_workspace_id UUID,
  p_member_user_id UUID,
  p_status TEXT
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role TEXT;
  v_target_role TEXT;
  v_old_status TEXT;
BEGIN
  IF p_status NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'Invalid status: must be active or inactive';
  END IF;

  -- Get caller role (LEFT JOIN: NULL role_id → NULL role, which fails the check below)
  SELECT COALESCE(r.code, 'viewer') INTO v_caller_role
  FROM public.workspace_members wm
  LEFT JOIN public.roles r ON r.id = wm.role_id
  WHERE wm.workspace_id = p_workspace_id
    AND wm.user_id = v_caller_id
    AND wm.status = 'active';

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Permission denied: only owner or admin can change member status';
  END IF;

  -- Get target role
  SELECT COALESCE(r.code, 'viewer'), wm.status INTO v_target_role, v_old_status
  FROM public.workspace_members wm
  LEFT JOIN public.roles r ON r.id = wm.role_id
  WHERE wm.workspace_id = p_workspace_id
    AND wm.user_id = p_member_user_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'User is not a member of this workspace';
  END IF;

  IF v_target_role = 'owner' AND p_status = 'inactive' THEN
    RAISE EXCEPTION 'Cannot deactivate the workspace owner';
  END IF;

  IF p_member_user_id = v_caller_id THEN
    RAISE EXCEPTION 'Cannot change your own status';
  END IF;

  UPDATE public.workspace_members
  SET status = p_status
  WHERE workspace_id = p_workspace_id AND user_id = p_member_user_id;

  INSERT INTO public.rbac_audit_logs (workspace_id, user_id, action, target_user_id, metadata)
  VALUES (p_workspace_id, v_caller_id,
    CASE WHEN p_status = 'inactive' THEN 'member_removed' ELSE 'member_added' END,
    p_member_user_id,
    jsonb_build_object('old_status', v_old_status, 'new_status', p_status)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_member_status(UUID, UUID, TEXT) TO authenticated;

-- ============================================================
-- 6. is_admin — LEFT JOIN
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    LEFT JOIN public.roles r ON r.id = wm.role_id
    WHERE wm.user_id = auth.uid()
      AND wm.status = 'active'
      AND COALESCE(r.code, 'viewer') IN ('owner', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================
-- 7. is_workspace_admin — LEFT JOIN
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    LEFT JOIN public.roles r ON r.id = wm.role_id
    WHERE wm.user_id = auth.uid()
      AND wm.workspace_id = p_workspace_id
      AND wm.status = 'active'
      AND COALESCE(r.code, 'viewer') IN ('owner', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_workspace_admin(UUID) TO authenticated;

-- ============================================================
-- 8. has_workspace_role — LEFT JOIN
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_workspace_role(
  p_workspace_id UUID,
  p_codes TEXT[]
)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    LEFT JOIN public.roles r ON r.id = wm.role_id
    WHERE wm.user_id = auth.uid()
      AND wm.workspace_id = p_workspace_id
      AND wm.status = 'active'
      AND COALESCE(r.code, 'viewer') = ANY(p_codes)
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_workspace_role(UUID, TEXT[]) TO authenticated;

-- ============================================================
-- 9. update_workspace_general_settings — LEFT JOIN in permission check
-- ============================================================
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
    LEFT JOIN public.roles r ON r.id = wm.role_id
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = auth.uid()
      AND wm.status = 'active'
      AND COALESCE(r.code, 'viewer') IN ('admin', 'owner')
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
  SET name = COALESCE(p_name, name), slug = COALESCE(p_slug, slug),
      org_name = COALESCE(p_org_name, org_name), org_type = p_org_type,
      settings = p_settings, updated_at = NOW()
  WHERE id = p_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace not found: %', p_workspace_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_workspace_general_settings(UUID, TEXT, TEXT, JSONB, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 10. invite_user — LEFT JOIN in permission check
-- ============================================================
CREATE OR REPLACE FUNCTION public.invite_user(
  p_email TEXT,
  p_workspace_id UUID,
  p_role_code TEXT DEFAULT 'viewer',
  p_workspace_role TEXT DEFAULT 'member',
  p_personal_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_invitation_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    LEFT JOIN public.roles r ON r.id = wm.role_id
    WHERE wm.user_id = v_user_id
      AND wm.workspace_id = p_workspace_id
      AND wm.status = 'active'
      AND COALESCE(r.code, 'viewer') IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: workspace admin role required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE code = p_role_code) THEN
    RAISE EXCEPTION 'Invalid role_code: %', p_role_code;
  END IF;

  INSERT INTO public.user_invitations (
    email, workspace_id, role_code, workspace_role, invited_by, personal_message
  ) VALUES (
    lower(trim(p_email)), p_workspace_id, p_role_code, p_workspace_role, v_user_id, p_personal_message
  )
  ON CONFLICT (email, workspace_id) WHERE status = 'pending'
  DO UPDATE SET
    role_code = EXCLUDED.role_code,
    workspace_role = EXCLUDED.workspace_role,
    personal_message = EXCLUDED.personal_message,
    invited_by = EXCLUDED.invited_by,
    invited_at = NOW(),
    expires_at = NOW() + INTERVAL '7 days',
    invitation_token = gen_random_uuid(),
    updated_at = NOW()
  RETURNING id INTO v_invitation_id;

  RETURN (
    SELECT jsonb_build_object(
      'id', ui.id,
      'invitation_token', ui.invitation_token
    )
    FROM public.user_invitations ui
    WHERE ui.id = v_invitation_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_user(TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 11. search_users_for_workspace_invite — LEFT JOIN in permission check
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_users_for_workspace_invite(
  p_workspace_id UUID,
  p_search TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Check workspace.manage permission
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    LEFT JOIN public.roles r ON r.id = wm.role_id
    LEFT JOIN public.role_permissions rp ON rp.role_id = r.id
    LEFT JOIN public.permissions p ON p.id = rp.permission_id
    WHERE wm.user_id = auth.uid()
      AND wm.workspace_id = p_workspace_id
      AND wm.status = 'active'
      AND p.code = 'workspace.manage'
  ) THEN
    -- Fallback: allow if user is admin/owner by role code
    IF NOT EXISTS (
      SELECT 1 FROM public.workspace_members wm
      LEFT JOIN public.roles r ON r.id = wm.role_id
      WHERE wm.user_id = auth.uid()
        AND wm.workspace_id = p_workspace_id
        AND wm.status = 'active'
        AND COALESCE(r.code, 'viewer') IN ('admin', 'owner')
    ) THEN
      RAISE EXCEPTION 'Access denied: workspace admin role required';
    END IF;
  END IF;

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'full_name')), '[]'::json) INTO result
  FROM (
    SELECT
      u.id, u.email,
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

-- ============================================================
-- 12. get_admin_users — LEFT JOIN for role aggregation + permission check
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_admin_users(
  p_search TEXT DEFAULT NULL,
  p_role_filter TEXT[] DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result JSON;
  v_caller_workspaces UUID[];
BEGIN
  -- Require admin role (LEFT JOIN tolerant)
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    LEFT JOIN public.roles r ON r.id = wm.role_id
    WHERE wm.user_id = auth.uid()
      AND wm.status = 'active'
      AND COALESCE(r.code, 'viewer') = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT ARRAY(
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ) INTO v_caller_workspaces;

  SELECT json_build_object(
    'users', COALESCE((
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT
          u.id, u.email, u.phone, u.created_at, u.last_sign_in_at,
          u.confirmed_at, u.email_confirmed_at,
          u.raw_user_meta_data AS user_metadata, u.raw_app_meta_data AS app_metadata,
          p.full_name, p.avatar_url, p.updated_at AS profile_updated_at,
          (
            SELECT w.name
            FROM public.workspace_members wm2
            JOIN public.workspaces w ON w.id = wm2.workspace_id
            WHERE wm2.user_id = u.id
            ORDER BY w.name LIMIT 1
          ) AS organization,
          COALESCE(
            (SELECT array_agg(DISTINCT r.code ORDER BY r.code)
             FROM public.workspace_members wm2
             LEFT JOIN public.roles r ON r.id = wm2.role_id
             WHERE wm2.user_id = u.id AND r.code IS NOT NULL),
            ARRAY[]::text[]
          ) AS roles,
          (SELECT COUNT(DISTINCT r.code)
           FROM public.workspace_members wm2
           LEFT JOIN public.roles r ON r.id = wm2.role_id
           WHERE wm2.user_id = u.id AND r.code IS NOT NULL) AS role_count,
          (SELECT COUNT(*)
           FROM public.workspace_members wm2
           WHERE wm2.user_id = u.id) AS workspace_count
        FROM auth.users u
        LEFT JOIN public.profiles p ON p.id = u.id
        WHERE u.id IN (
          SELECT wm1.user_id FROM public.workspace_members wm1
          WHERE wm1.workspace_id = ANY(v_caller_workspaces)
        )
        AND (
          p_search IS NULL
          OR u.email ILIKE '%' || p_search || '%'
          OR p.full_name ILIKE '%' || p_search || '%'
        )
        AND (
          p_role_filter IS NULL
          OR u.id IN (
            SELECT wm3.user_id
            FROM public.workspace_members wm3
            LEFT JOIN public.roles r ON r.id = wm3.role_id
            WHERE COALESCE(r.code, 'viewer') = ANY(p_role_filter)
          )
        )
        ORDER BY u.created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) t
    ), '[]'::json),
    'total', (
      SELECT COUNT(DISTINCT u.id)
      FROM auth.users u
      LEFT JOIN public.profiles p ON p.id = u.id
      WHERE u.id IN (
        SELECT wm1.user_id FROM public.workspace_members wm1
        WHERE wm1.workspace_id = ANY(v_caller_workspaces)
      )
      AND (
        p_search IS NULL
        OR u.email ILIKE '%' || p_search || '%'
        OR p.full_name ILIKE '%' || p_search || '%'
      )
      AND (
        p_role_filter IS NULL
        OR u.id IN (
          SELECT wm3.user_id
          FROM public.workspace_members wm3
          LEFT JOIN public.roles r ON r.id = wm3.role_id
          WHERE COALESCE(r.code, 'viewer') = ANY(p_role_filter)
        )
      )
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_users(TEXT, TEXT[], INT, INT) TO authenticated;

COMMIT;

-- ============================================================================
-- Fix FK violations in verify_mod4_otp and link_user_to_mod4
-- ============================================================================
-- Same class of bug as accept_invitation (fixed in 20260613000001):
-- workspace_members.user_id FK references profiles.id, but these RPCs
-- INSERT into workspace_members without ensuring the profiles row exists.
--
-- verify_mod4_otp auto-creates auth.users for new drivers, relying on
-- handle_new_user() trigger to create profiles. If the trigger fails or
-- the user was created via a different path, the workspace_members INSERT
-- fails with: "violates foreign key constraint workspace_members_user_id_fkey"
--
-- link_user_to_mod4 takes an existing user_id and inserts into
-- workspace_members — same risk if the profiles row doesn't exist.
-- ============================================================================

BEGIN;

-- 1. verify_mod4_otp — add profiles guard before workspace_members INSERT
CREATE OR REPLACE FUNCTION public.verify_mod4_otp(
  p_email TEXT,
  p_otp   TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_otp_record      RECORD;
  v_user_id         UUID;
  v_is_phone        BOOLEAN;
  v_resolved_email  TEXT;
  v_driver_role_id  UUID;
  v_workspace_id    UUID;
  v_driver_id       UUID;
  v_user_phone      TEXT;
BEGIN
  SELECT id INTO v_driver_role_id
  FROM roles
  WHERE code = 'driver' AND is_system_role = TRUE
  LIMIT 1;

  IF v_driver_role_id IS NULL THEN
    RAISE EXCEPTION 'Driver role not found in roles table';
  END IF;

  v_is_phone := p_email ~ '^\+?\d[\d\s\-]{6,}$';

  IF v_is_phone THEN
    DECLARE v_clean_phone TEXT;
    BEGIN
      v_clean_phone := regexp_replace(p_email, '[^\d+]', '', 'g');

      SELECT id, email, phone INTO v_user_id, v_resolved_email, v_user_phone
      FROM auth.users
      WHERE phone = v_clean_phone;

      IF v_user_id IS NULL THEN
        RETURN NULL;
      END IF;

      SELECT * INTO v_otp_record
      FROM public.mod4_otp_codes
      WHERE target_email = v_resolved_email
        AND status = 'pending'
        AND expires_at > NOW()
        AND attempts < max_attempts
      ORDER BY created_at DESC
      LIMIT 1;
    END;
  ELSE
    v_resolved_email := p_email;

    SELECT * INTO v_otp_record
    FROM public.mod4_otp_codes
    WHERE target_email = p_email
      AND status = 'pending'
      AND expires_at > NOW()
      AND attempts < max_attempts
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_otp_record IS NULL THEN
      RETURN NULL;
    END IF;

    UPDATE public.mod4_otp_codes
    SET attempts = attempts + 1
    WHERE id = v_otp_record.id;

    -- Bcrypt comparison
    IF extensions.crypt(p_otp, v_otp_record.otp_code) != v_otp_record.otp_code THEN
      RETURN NULL;
    END IF;

    SELECT id, phone INTO v_user_id, v_user_phone FROM auth.users WHERE email = p_email;

    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();
      INSERT INTO auth.users (
        id, instance_id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, recovery_token
      ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        p_email,
        extensions.crypt(p_otp, extensions.gen_salt('bf', 10)),
        NOW(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        jsonb_build_object('email', p_email),
        NOW(), NOW(), '', ''
      );

      INSERT INTO auth.identities (
        id, user_id, provider_id, provider, identity_data,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), v_user_id, v_user_id::text, 'email',
        jsonb_build_object('sub', v_user_id::text, 'email', p_email, 'email_verified', true),
        NOW(), NOW(), NOW()
      );
    ELSE
      UPDATE auth.users
      SET encrypted_password = extensions.crypt(p_otp, extensions.gen_salt('bf', 10)),
          updated_at = NOW()
      WHERE id = v_user_id;
    END IF;

    UPDATE public.mod4_otp_codes
    SET status = 'used', used_at = NOW(), used_by = v_user_id
    WHERE id = v_otp_record.id;

    v_workspace_id := v_otp_record.workspace_id;

    -- ── Guard: ensure profiles row exists before workspace_members INSERT ──
    INSERT INTO public.profiles (id, full_name, phone)
    SELECT au.id,
           au.raw_user_meta_data ->> 'full_name',
           au.raw_user_meta_data ->> 'phone'
    FROM auth.users au
    WHERE au.id = v_user_id
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.mod4_driver_links (user_id, link_method, linked_by)
    VALUES (v_user_id, 'otp', v_user_id)
    ON CONFLICT (user_id) DO UPDATE SET
      status = 'active', link_method = 'otp', linked_by = v_user_id,
      linked_at = NOW(), updated_at = NOW();

    INSERT INTO public.user_roles (user_id, role, role_id)
    VALUES (v_user_id, 'driver', v_driver_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;

    IF v_workspace_id IS NOT NULL THEN
      INSERT INTO public.workspace_members (workspace_id, user_id, role)
      VALUES (v_workspace_id, v_user_id, 'member')
      ON CONFLICT (workspace_id, user_id) DO NOTHING;
    END IF;

    SELECT driver_id INTO v_driver_id
    FROM public.mod4_driver_links
    WHERE user_id = v_user_id AND driver_id IS NOT NULL;

    IF v_driver_id IS NULL THEN
      INSERT INTO public.drivers (
        name, phone, email, license_type,
        shift_start, shift_end, max_hours, status, onboarding_completed
      ) VALUES (
        COALESCE(v_resolved_email, p_email),
        COALESCE(v_user_phone, v_resolved_email),
        v_resolved_email, 'standard',
        '08:00'::TIME, '17:00'::TIME, 8, 'available', FALSE
      )
      RETURNING id INTO v_driver_id;

      UPDATE public.mod4_driver_links
      SET driver_id = v_driver_id, updated_at = NOW()
      WHERE user_id = v_user_id;
    END IF;

    RETURN v_resolved_email;
  END IF;

  -- Phone path: OTP check
  IF v_otp_record IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.mod4_otp_codes
  SET attempts = attempts + 1
  WHERE id = v_otp_record.id;

  -- Bcrypt comparison
  IF extensions.crypt(p_otp, v_otp_record.otp_code) != v_otp_record.otp_code THEN
    RETURN NULL;
  END IF;

  UPDATE public.mod4_otp_codes
  SET status = 'used', used_at = NOW(), used_by = v_user_id
  WHERE id = v_otp_record.id;

  v_workspace_id := v_otp_record.workspace_id;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_otp, extensions.gen_salt('bf', 10)),
      updated_at = NOW()
  WHERE id = v_user_id;

  -- ── Guard: ensure profiles row exists before workspace_members INSERT ──
  INSERT INTO public.profiles (id, full_name, phone)
  SELECT au.id,
         au.raw_user_meta_data ->> 'full_name',
         au.raw_user_meta_data ->> 'phone'
  FROM auth.users au
  WHERE au.id = v_user_id
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.mod4_driver_links (user_id, link_method, linked_by)
  VALUES (v_user_id, 'otp', v_user_id)
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'active', link_method = 'otp', linked_by = v_user_id,
    linked_at = NOW(), updated_at = NOW();

  INSERT INTO public.user_roles (user_id, role, role_id)
  VALUES (v_user_id, 'driver', v_driver_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;

  IF v_workspace_id IS NOT NULL THEN
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, v_user_id, 'member')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END IF;

  SELECT driver_id INTO v_driver_id
  FROM public.mod4_driver_links
  WHERE user_id = v_user_id AND driver_id IS NOT NULL;

  IF v_driver_id IS NULL THEN
    INSERT INTO public.drivers (
      name, phone, email, license_type,
      shift_start, shift_end, max_hours, status, onboarding_completed
    ) VALUES (
      COALESCE(v_resolved_email, p_email),
      COALESCE(v_user_phone, v_resolved_email),
      v_resolved_email, 'standard',
      '08:00'::TIME, '17:00'::TIME, 8, 'available', FALSE
    )
    RETURNING id INTO v_driver_id;

    UPDATE public.mod4_driver_links
    SET driver_id = v_driver_id, updated_at = NOW()
    WHERE user_id = v_user_id;
  END IF;

  RETURN v_resolved_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_mod4_otp(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_mod4_otp(TEXT, TEXT) TO authenticated;


-- 2. link_user_to_mod4 — add profiles guard before workspace_members INSERT
CREATE OR REPLACE FUNCTION public.link_user_to_mod4(
  p_user_id UUID,
  p_link_method TEXT DEFAULT 'manual',
  p_workspace_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link_id UUID;
  v_admin_id UUID := auth.uid();
  v_driver_role_id UUID;
  v_ws_id UUID;
  v_driver_id UUID;
  v_user_email TEXT;
  v_user_phone TEXT;
  v_user_name TEXT;
BEGIN
  -- Look up the driver role ID
  SELECT id INTO v_driver_role_id
  FROM roles
  WHERE code = 'driver' AND is_system_role = TRUE
  LIMIT 1;

  IF v_driver_role_id IS NULL THEN
    RAISE EXCEPTION 'Driver role not found in roles table';
  END IF;

  -- Fetch user info for driver record
  SELECT email, phone, raw_user_meta_data->>'full_name'
  INTO v_user_email, v_user_phone, v_user_name
  FROM auth.users
  WHERE id = p_user_id;

  -- ── Guard: ensure profiles row exists before workspace_members INSERT ──
  INSERT INTO public.profiles (id, full_name, phone)
  SELECT au.id,
         au.raw_user_meta_data ->> 'full_name',
         au.raw_user_meta_data ->> 'phone'
  FROM auth.users au
  WHERE au.id = p_user_id
  ON CONFLICT (id) DO NOTHING;

  -- Insert the link
  INSERT INTO public.mod4_driver_links (user_id, link_method, linked_by)
  VALUES (p_user_id, p_link_method, v_admin_id)
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'active',
    link_method = p_link_method,
    linked_by = v_admin_id,
    linked_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_link_id;

  -- Ensure user has driver role (with role_id)
  INSERT INTO public.user_roles (user_id, role, role_id)
  VALUES (p_user_id, 'driver', v_driver_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;

  -- Determine workspace: use explicit param, or fall back to admin's workspace
  v_ws_id := p_workspace_id;
  IF v_ws_id IS NULL AND v_admin_id IS NOT NULL THEN
    SELECT workspace_id INTO v_ws_id
    FROM public.workspace_members
    WHERE user_id = v_admin_id
    LIMIT 1;
  END IF;

  -- Add driver to workspace so they appear in integration page
  IF v_ws_id IS NOT NULL THEN
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_ws_id, p_user_id, 'member')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END IF;

  -- Create a drivers table record if not already linked
  SELECT driver_id INTO v_driver_id
  FROM public.mod4_driver_links
  WHERE user_id = p_user_id AND driver_id IS NOT NULL;

  IF v_driver_id IS NULL THEN
    INSERT INTO public.drivers (
      name, phone, email, license_type,
      shift_start, shift_end, max_hours, status, onboarding_completed
    ) VALUES (
      COALESCE(v_user_name, v_user_email, 'Unknown'),
      COALESCE(v_user_phone, v_user_email, 'N/A'),
      v_user_email,
      'standard',
      '08:00'::TIME,
      '17:00'::TIME,
      8,
      'available',
      FALSE
    )
    RETURNING id INTO v_driver_id;

    UPDATE public.mod4_driver_links
    SET driver_id = v_driver_id, updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  RETURN v_link_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_user_to_mod4(UUID, TEXT, UUID) TO authenticated;

COMMIT;

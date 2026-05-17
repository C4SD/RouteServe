-- ============================================================================
-- OTP Security Hardening
-- ============================================================================
-- 1. generate_mod4_otp   — replace RANDOM() with gen_random_bytes (CSPRNG);
--                          store bcrypt hash instead of plaintext OTP.
-- 2. verify_mod4_otp     — compare via bcrypt instead of plaintext equality.
-- 3. generate_email_login_otp — replace RANDOM() with CSPRNG.
-- 4. Revoke anon execute on email-login OTP RPCs (unused in frontend;
--    leaving them anon-callable allows unauthenticated password overwrites).
-- ============================================================================


-- ============================================================================
-- 1. generate_mod4_otp — CSPRNG + bcrypt storage
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_mod4_otp(
  p_email        TEXT,
  p_workspace_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_otp        TEXT;
  v_created_by UUID;
BEGIN
  v_created_by := auth.uid();

  IF v_created_by IS NULL THEN
    SELECT user_id INTO v_created_by
    FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND role IN ('owner', 'admin')
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- CSPRNG: 3 random bytes → 24-bit integer → mod 1,000,000 → zero-padded 6 digits
  v_otp := LPAD(
    (('x' || encode(gen_random_bytes(3), 'hex'))::bit(24)::int % 1000000)::TEXT,
    6, '0'
  );

  -- Expire any existing pending OTPs for this email
  UPDATE public.mod4_otp_codes
  SET status = 'expired', updated_at = NOW()
  WHERE target_email = p_email AND status = 'pending';

  -- Store bcrypt hash — plain OTP never written to DB
  INSERT INTO public.mod4_otp_codes (target_email, otp_code, workspace_id, created_by)
  VALUES (p_email, extensions.crypt(v_otp, extensions.gen_salt('bf', 8)), p_workspace_id, v_created_by);

  RETURN v_otp;  -- return plain code so caller can send it to the driver
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_mod4_otp(TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.generate_mod4_otp(TEXT, UUID) TO authenticated;


-- ============================================================================
-- 2. verify_mod4_otp — bcrypt comparison
-- Full function body kept in sync with 20260302000002_auto_create_driver_on_otp
-- Changes: both `otp_code != p_otp` comparisons replaced with bcrypt verify.
-- ============================================================================
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

    -- Bcrypt comparison (replaces plaintext != check)
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

  -- Bcrypt comparison (replaces plaintext != check)
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


-- ============================================================================
-- 3. generate_email_login_otp — CSPRNG
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_email_login_otp(
  p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code       TEXT;
  v_expires_at TIMESTAMPTZ;
  v_otp_id     UUID;
BEGIN
  IF p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid email format');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'No account found with this email');
  END IF;

  UPDATE email_login_otps
  SET used = TRUE, used_at = NOW()
  WHERE email = p_email AND NOT used;

  -- CSPRNG (replaces RANDOM())
  v_code := LPAD(
    (('x' || encode(gen_random_bytes(3), 'hex'))::bit(24)::int % 1000000)::TEXT,
    6, '0'
  );

  v_expires_at := NOW() + INTERVAL '10 minutes';

  INSERT INTO email_login_otps (email, code, expires_at)
  VALUES (p_email, v_code, v_expires_at)
  RETURNING id INTO v_otp_id;

  RETURN jsonb_build_object(
    'success', true,
    'code', v_code,
    'expires_at', v_expires_at,
    'otp_id', v_otp_id
  );
END;
$$;

-- Restrict to authenticated callers only — anon access enables email enumeration
-- and unauthenticated password mutation via verify_email_login_otp.
REVOKE EXECUTE ON FUNCTION generate_email_login_otp(TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION generate_email_login_otp(TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION verify_email_login_otp(TEXT, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION verify_email_login_otp(TEXT, TEXT) TO authenticated;

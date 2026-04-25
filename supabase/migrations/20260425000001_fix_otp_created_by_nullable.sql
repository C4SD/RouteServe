-- ============================================================================
-- Fix generate_mod4_otp: created_by violates NOT NULL when called by anon
-- ============================================================================
-- Issue: Drivers request an OTP before they are authenticated, so auth.uid()
-- returns NULL and the INSERT into mod4_otp_codes fails with:
--   "null value in column created_by violates not-null constraint"
--
-- Fix:
--   1. Make created_by nullable (the workspace_id already captures context).
--   2. Replace generate_mod4_otp so it uses a workspace-owner fallback when
--      the caller is anonymous, and grants EXECUTE to anon.
-- ============================================================================

-- 1. Relax the NOT NULL constraint
ALTER TABLE public.mod4_otp_codes
  ALTER COLUMN created_by DROP NOT NULL;

-- 2. Recreate the function — uses caller uid when available, workspace owner otherwise
CREATE OR REPLACE FUNCTION public.generate_mod4_otp(
  p_email       TEXT,
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
  -- Prefer the authenticated caller; fall back to the workspace owner for anon requests
  v_created_by := auth.uid();

  IF v_created_by IS NULL THEN
    SELECT user_id INTO v_created_by
    FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND role IN ('owner', 'admin')
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Generate 6-digit code
  v_otp := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

  -- Expire any existing pending OTPs for this email
  UPDATE public.mod4_otp_codes
  SET status = 'expired', updated_at = NOW()
  WHERE target_email = p_email AND status = 'pending';

  -- Insert new OTP (created_by may still be NULL if workspace has no owner yet)
  INSERT INTO public.mod4_otp_codes (target_email, otp_code, workspace_id, created_by)
  VALUES (p_email, v_otp, p_workspace_id, v_created_by);

  RETURN v_otp;
END;
$$;

-- Grant anon access so unauthenticated drivers can request OTPs
GRANT EXECUTE ON FUNCTION public.generate_mod4_otp(TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.generate_mod4_otp(TEXT, UUID) TO authenticated;

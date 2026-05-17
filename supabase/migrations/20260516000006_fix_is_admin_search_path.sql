-- Fix: two stacked RBAC bugs surfaced on linked project nksxyuuyklokpsuqwicl
-- (2026-05-16) during post-restore audit. Both stem from RBAC v2 (migration
-- 20260324000002_rbac_v2_schema.sql) reorganizing role storage without updating
-- the legacy helper functions.
--
-- Bug 1 — public.is_admin() raises 42883 at runtime:
--     ERROR: function has_role(unknown) does not exist
--   Cause: function declared with `SET search_path TO ''` calls has_role()
--   unqualified. Empty search_path prevents resolution of public.has_role.
--
-- Bug 2 — public.has_role(text) raises 42703 once is_admin's search_path
--   is repaired:
--     ERROR: column "role" does not exist
--     QUERY: SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = role_name
--   Cause: legacy v1 body queries user_roles.role text column. Post-RBAC v2 the
--   column is user_roles.role_id (FK to roles.id); the text identifier moved to
--   roles.code. is_system_admin() (rewritten correctly in v2) already uses the
--   correct join pattern.
--
-- Combined effect prior to this fix: every RLS policy gated on is_admin()
-- (reference tables vehicle_tiers, vehicle_categories, vehicle_types,
-- facility_types, levels_of_care, etc.) silently denied access for all users
-- including the 2 admin users present in user_roles.
--
-- Resolution: rewrite both functions to v2 schema with explicit search_path.
-- Semantics: admin == user has role code 'admin' or 'super_admin' via
-- user_roles.role_id -> roles.code.

CREATE OR REPLACE FUNCTION public.has_role(role_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.code = role_name
  );
$$;

COMMENT ON FUNCTION public.has_role(text) IS
  'Returns true if the current user has the named role (matched by roles.code via user_roles.role_id). Repaired 2026-05-16: previous v1 body queried user_roles.role text column which no longer exists post-RBAC v2.';

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.has_role('admin') OR public.has_role('super_admin');
END;
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Returns true when the current user holds the admin or super_admin role via public.user_roles. Search_path repaired 2026-05-16 (previously empty, causing 42883 at runtime).';

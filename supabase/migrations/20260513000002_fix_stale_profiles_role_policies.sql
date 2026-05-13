-- Fix: RLS policies on vehicle_categories, vehicle_types, and facility
-- reference tables still reference profiles.role which no longer exists
-- on the profiles table. This causes error 42703 "column 'role' does not
-- exist" when any query evaluates these policies (including vehicle INSERT
-- which triggers FK checks against vehicle_categories/vehicle_types).

-- ============================================================
-- vehicle_categories
-- ============================================================
DROP POLICY IF EXISTS "Allow admin insert on vehicle_categories" ON public.vehicle_categories;
DROP POLICY IF EXISTS "Allow admin update on vehicle_categories" ON public.vehicle_categories;
DROP POLICY IF EXISTS "Allow admin delete on vehicle_categories" ON public.vehicle_categories;

CREATE POLICY "Allow admin insert on vehicle_categories"
  ON public.vehicle_categories FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Allow admin update on vehicle_categories"
  ON public.vehicle_categories FOR UPDATE TO authenticated
  USING (is_admin());

CREATE POLICY "Allow admin delete on vehicle_categories"
  ON public.vehicle_categories FOR DELETE TO authenticated
  USING (is_admin());

-- ============================================================
-- vehicle_types
-- ============================================================
DROP POLICY IF EXISTS "Allow update on vehicle_types for creators and admins" ON public.vehicle_types;
DROP POLICY IF EXISTS "Allow delete on vehicle_types for creators and admins" ON public.vehicle_types;

CREATE POLICY "Allow update on vehicle_types for creators and admins"
  ON public.vehicle_types FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "Allow delete on vehicle_types for creators and admins"
  ON public.vehicle_types FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR is_admin());

-- ============================================================
-- facility_types (from facility_reference_tables migration)
-- ============================================================
DROP POLICY IF EXISTS "Facility types can be inserted by admins" ON public.facility_types;
DROP POLICY IF EXISTS "Facility types can be updated by admins" ON public.facility_types;

CREATE POLICY "Facility types can be inserted by admins"
  ON public.facility_types FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Facility types can be updated by admins"
  ON public.facility_types FOR UPDATE TO authenticated
  USING (is_admin());

-- ============================================================
-- levels_of_care (from facility_reference_tables migration)
-- ============================================================
DROP POLICY IF EXISTS "Levels of care can be inserted by admins" ON public.levels_of_care;
DROP POLICY IF EXISTS "Levels of care can be updated by admins" ON public.levels_of_care;

CREATE POLICY "Levels of care can be inserted by admins"
  ON public.levels_of_care FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Levels of care can be updated by admins"
  ON public.levels_of_care FOR UPDATE TO authenticated
  USING (is_admin());

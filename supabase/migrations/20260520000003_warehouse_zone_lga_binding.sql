-- Add zone_id to warehouses so each warehouse can be assigned to a zone.
-- Add warehouse_id to admin_units so each LGA can be bound to a specific
-- warehouse within the same zone.
-- Zone → Warehouse 1, Warehouse 2
-- LGA/Facility → bound to one warehouse within that zone

ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS zone_id UUID
    REFERENCES public.zones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_warehouses_zone_id
  ON public.warehouses(zone_id);

ALTER TABLE public.admin_units
  ADD COLUMN IF NOT EXISTS warehouse_id UUID
    REFERENCES public.warehouses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_admin_units_warehouse_id
  ON public.admin_units(warehouse_id);

-- SECURITY DEFINER RPC: assign a warehouse to an LGA.
-- Direct UPDATE on admin_units is blocked by RLS for global records
-- (workspace_id IS NULL). This function bypasses RLS while verifying
-- that the caller is an authenticated user.
CREATE OR REPLACE FUNCTION assign_lga_warehouse(
  p_lga_id      UUID,
  p_warehouse_id UUID  -- pass NULL to clear the warehouse assignment
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE admin_units
  SET warehouse_id = p_warehouse_id
  WHERE id = p_lga_id;
END;
$$;

GRANT EXECUTE ON FUNCTION assign_lga_warehouse TO authenticated;

COMMENT ON FUNCTION assign_lga_warehouse IS
  'Bind an LGA (admin_unit) to a specific warehouse within its zone. '
  'Bypasses RLS for globally-shared admin_units with NULL workspace_id.';

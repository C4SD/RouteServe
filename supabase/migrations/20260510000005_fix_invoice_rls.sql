-- Migration: Fix invoice table RLS policies — workspace isolation
-- Fixes: invoice_line_items, invoice_packaging, package_items had USING(true)
-- Also: invoices table itself had USING(true) — now scoped to workspace membership
-- Also: revoke anon role from all analytics functions/views

-- ===========================================================================
-- STEP 1: Fix RLS on invoices (has workspace_id column)
-- ===========================================================================

DROP POLICY IF EXISTS "Invoices are viewable by authenticated users" ON public.invoices;
DROP POLICY IF EXISTS "Invoices can be created by authenticated users" ON public.invoices;
DROP POLICY IF EXISTS "Invoices can be updated by authenticated users" ON public.invoices;
DROP POLICY IF EXISTS "Invoices can be deleted by authenticated users" ON public.invoices;

CREATE POLICY "invoices_select_workspace"
  ON public.invoices FOR SELECT TO authenticated
  USING (is_workspace_member_v2(workspace_id));

CREATE POLICY "invoices_insert_workspace"
  ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member_v2(workspace_id));

CREATE POLICY "invoices_update_workspace"
  ON public.invoices FOR UPDATE TO authenticated
  USING (is_workspace_member_v2(workspace_id))
  WITH CHECK (is_workspace_member_v2(workspace_id));

CREATE POLICY "invoices_delete_workspace"
  ON public.invoices FOR DELETE TO authenticated
  USING (is_workspace_member_v2(workspace_id));

-- ===========================================================================
-- STEP 2: Fix RLS on invoice_line_items (no workspace_id — join through invoices)
-- ===========================================================================

DROP POLICY IF EXISTS "Invoice line items are viewable by authenticated users" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Invoice line items can be created by authenticated users" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Invoice line items can be updated by authenticated users" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Invoice line items can be deleted by authenticated users" ON public.invoice_line_items;

CREATE POLICY "invoice_line_items_select_workspace"
  ON public.invoice_line_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND is_workspace_member_v2(i.workspace_id)
    )
  );

CREATE POLICY "invoice_line_items_insert_workspace"
  ON public.invoice_line_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND is_workspace_member_v2(i.workspace_id)
    )
  );

CREATE POLICY "invoice_line_items_update_workspace"
  ON public.invoice_line_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND is_workspace_member_v2(i.workspace_id)
    )
  );

CREATE POLICY "invoice_line_items_delete_workspace"
  ON public.invoice_line_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND is_workspace_member_v2(i.workspace_id)
    )
  );

-- ===========================================================================
-- STEP 3: Fix RLS on invoice_packaging (join through invoices)
-- ===========================================================================

DROP POLICY IF EXISTS "Invoice packaging is viewable by authenticated users" ON public.invoice_packaging;
DROP POLICY IF EXISTS "Invoice packaging can be created by authenticated users" ON public.invoice_packaging;
DROP POLICY IF EXISTS "Invoice packaging can be updated by authenticated users" ON public.invoice_packaging;
DROP POLICY IF EXISTS "Invoice packaging can be deleted by authenticated users" ON public.invoice_packaging;

CREATE POLICY "invoice_packaging_select_workspace"
  ON public.invoice_packaging FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND is_workspace_member_v2(i.workspace_id)
    )
  );

CREATE POLICY "invoice_packaging_insert_workspace"
  ON public.invoice_packaging FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND is_workspace_member_v2(i.workspace_id)
    )
  );

CREATE POLICY "invoice_packaging_update_workspace"
  ON public.invoice_packaging FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND is_workspace_member_v2(i.workspace_id)
    )
  );

CREATE POLICY "invoice_packaging_delete_workspace"
  ON public.invoice_packaging FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND is_workspace_member_v2(i.workspace_id)
    )
  );

-- ===========================================================================
-- STEP 4: Fix RLS on package_items (join through invoice_packaging → invoices)
-- ===========================================================================

DROP POLICY IF EXISTS "Package items are viewable by authenticated users" ON public.package_items;
DROP POLICY IF EXISTS "Package items can be created by authenticated users" ON public.package_items;
DROP POLICY IF EXISTS "Package items can be updated by authenticated users" ON public.package_items;
DROP POLICY IF EXISTS "Package items can be deleted by authenticated users" ON public.package_items;

CREATE POLICY "package_items_select_workspace"
  ON public.package_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoice_packaging ip
      JOIN public.invoices i ON i.id = ip.invoice_id
      WHERE ip.id = packaging_id
        AND is_workspace_member_v2(i.workspace_id)
    )
  );

CREATE POLICY "package_items_insert_workspace"
  ON public.package_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoice_packaging ip
      JOIN public.invoices i ON i.id = ip.invoice_id
      WHERE ip.id = packaging_id
        AND is_workspace_member_v2(i.workspace_id)
    )
  );

CREATE POLICY "package_items_update_workspace"
  ON public.package_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoice_packaging ip
      JOIN public.invoices i ON i.id = ip.invoice_id
      WHERE ip.id = packaging_id
        AND is_workspace_member_v2(i.workspace_id)
    )
  );

CREATE POLICY "package_items_delete_workspace"
  ON public.package_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoice_packaging ip
      JOIN public.invoices i ON i.id = ip.invoice_id
      WHERE ip.id = packaging_id
        AND is_workspace_member_v2(i.workspace_id)
    )
  );

-- ===========================================================================
-- STEP 5: Revoke anon access from all analytics views and functions
-- ===========================================================================

REVOKE SELECT ON analytics.delivery_performance FROM anon;
REVOKE SELECT ON analytics.driver_efficiency FROM anon;
REVOKE SELECT ON analytics.vehicle_utilization FROM anon;

REVOKE EXECUTE ON FUNCTION analytics.get_delivery_kpis(UUID, DATE, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION analytics.get_top_vehicles_by_ontime(UUID, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION analytics.get_driver_kpis(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION analytics.get_top_drivers(UUID, TEXT, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION analytics.get_vehicle_kpis(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION analytics.get_vehicles_needing_maintenance(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION analytics.get_cost_kpis(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION analytics.get_vehicle_costs(UUID, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION analytics.get_driver_costs(UUID, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION analytics.get_dashboard_summary(UUID, DATE, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION analytics.get_vehicle_payload_utilization(UUID, DATE, DATE, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION analytics.get_driver_utilization(UUID, DATE, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION analytics.get_route_efficiency(UUID, DATE, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION analytics.get_program_performance(UUID, DATE, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION analytics.get_facility_coverage(UUID, DATE, DATE, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION analytics.get_cost_by_program(UUID, DATE, DATE) FROM anon;

REVOKE EXECUTE ON FUNCTION public.get_delivery_kpis(UUID, DATE, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_top_vehicles_by_ontime(UUID, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_driver_kpis(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_top_drivers(UUID, TEXT, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_vehicle_kpis(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_vehicles_needing_maintenance(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_cost_kpis(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_vehicle_costs(UUID, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_driver_costs(UUID, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_summary(UUID, DATE, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_vehicle_payload_utilization(UUID, DATE, DATE, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_driver_utilization(UUID, DATE, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_route_efficiency(UUID, DATE, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_program_performance(UUID, DATE, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_facility_coverage(UUID, DATE, DATE, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_cost_by_program(UUID, DATE, DATE) FROM anon;

-- Fix missing RLS policies for requisition_items table
-- This migration adds the missing INSERT policies that were removed during RLS re-enable

-- Ensure has_role function exists (it should from the RBAC migration)
CREATE OR REPLACE FUNCTION public.has_role(role_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = role_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure is_admin function exists
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN has_role('admin') OR has_role('super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can view requisition items" ON public.requisition_items;
DROP POLICY IF EXISTS "Warehouse officers can manage requisition items" ON public.requisition_items;

-- Create RLS Policies for requisition_items
CREATE POLICY "Authenticated users can view requisition items"
  ON public.requisition_items FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create requisition items for their own requisitions"
  ON public.requisition_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.requisitions 
      WHERE id = requisition_id 
      AND requested_by = auth.uid()
    )
  );

CREATE POLICY "Admins and warehouse officers can manage requisition items"
  ON public.requisition_items FOR ALL
  USING (
    has_role('warehouse_officer') OR 
    is_admin()
  );

-- Add policy for users to update items in their own requisitions
CREATE POLICY "Users can update requisition items for their own requisitions"
  ON public.requisition_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.requisitions 
      WHERE id = requisition_id 
      AND requested_by = auth.uid()
    )
  );

-- Add policy for users to delete items from their own requisitions
CREATE POLICY "Users can delete requisition items for their own requisitions"
  ON public.requisition_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.requisitions 
      WHERE id = requisition_id 
      AND requested_by = auth.uid()
    )
  );

-- Also fix requisitions table to ensure it has proper policies
DROP POLICY IF EXISTS "Users can create their own requisitions" ON public.requisitions;
DROP POLICY IF EXISTS "Authenticated users can view requisitions" ON public.requisitions;
DROP POLICY IF EXISTS "Warehouse officers can manage requisitions" ON public.requisitions;

-- Enhanced RLS Policies for requisitions with workspace support
CREATE POLICY "Users can view requisitions in their workspace"
  ON public.requisitions FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create requisitions in their workspace"
  ON public.requisitions FOR INSERT
  WITH CHECK (
    requested_by = auth.uid() AND
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own requisitions"
  ON public.requisitions FOR UPDATE
  USING (
    requested_by = auth.uid() OR
    has_role('warehouse_officer') OR
    is_admin()
  );

CREATE POLICY "Admins and warehouse officers can manage requisitions in their workspace"
  ON public.requisitions FOR ALL
  USING (
    (has_role('warehouse_officer') OR is_admin()) AND
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.has_role(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

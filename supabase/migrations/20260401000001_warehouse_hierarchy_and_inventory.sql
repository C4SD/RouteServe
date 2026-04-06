-- =====================================================
-- WAREHOUSE HIERARCHY & INVENTORY SYSTEM
-- Migration: 20260401000001
--
-- Adds:
--   1a. Hierarchy columns to warehouses (parent_id, capabilities, storage_conditions)
--   1b. warehouse_inventory table (per-node stock tracking)
--   1c. inventory_transfers + inventory_transfer_items tables
--   1d. delivery_logs table (reconciliation)
--   1e. dispatch_node_id + correlation_id on delivery_batches
--   1f. Audit trigger for workspace_id tables + trigger attachments
-- =====================================================

-- =====================================================
-- 1a. ADD HIERARCHY COLUMNS TO WAREHOUSES
-- =====================================================

ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT '{"can_receive": true, "can_dispatch": true, "can_store": true}'::jsonb,
  ADD COLUMN IF NOT EXISTS storage_conditions TEXT[] NOT NULL DEFAULT '{}';

-- Prevent self-referencing
ALTER TABLE public.warehouses
  ADD CONSTRAINT chk_warehouses_no_self_parent CHECK (parent_id IS NULL OR parent_id != id);

-- Index for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_warehouses_parent_id ON public.warehouses(parent_id);

-- Trigger: validate hierarchy depth (max 3) and prevent cycles
CREATE OR REPLACE FUNCTION public.validate_warehouse_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
  v_depth INTEGER := 0;
  v_current_id UUID;
  v_max_depth CONSTANT INTEGER := 3;
BEGIN
  -- Skip if parent_id is NULL (root node)
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Walk up the ancestor chain to compute depth and detect cycles
  v_current_id := NEW.parent_id;
  WHILE v_current_id IS NOT NULL LOOP
    v_depth := v_depth + 1;

    -- Check max depth (depth = number of ancestors)
    IF v_depth > v_max_depth THEN
      RAISE EXCEPTION 'Warehouse hierarchy depth exceeds maximum of % levels', v_max_depth;
    END IF;

    -- Cycle detection: if we encounter our own ID in the ancestor chain
    IF v_current_id = NEW.id THEN
      RAISE EXCEPTION 'Circular reference detected in warehouse hierarchy';
    END IF;

    SELECT parent_id INTO v_current_id
    FROM public.warehouses
    WHERE id = v_current_id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_warehouse_hierarchy
  BEFORE INSERT OR UPDATE OF parent_id ON public.warehouses
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_warehouse_hierarchy();


-- =====================================================
-- 1b. WAREHOUSE INVENTORY TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.warehouse_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved_qty INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Inventory invariants
  CONSTRAINT chk_inventory_quantity_non_negative CHECK (quantity >= 0),
  CONSTRAINT chk_inventory_reserved_non_negative CHECK (reserved_qty >= 0),
  CONSTRAINT chk_inventory_reserved_lte_quantity CHECK (reserved_qty <= quantity),

  -- One inventory record per item per node
  CONSTRAINT uq_inventory_node_item UNIQUE (node_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_node ON public.warehouse_inventory(node_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_item ON public.warehouse_inventory(item_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_workspace ON public.warehouse_inventory(workspace_id);

-- RLS
ALTER TABLE public.warehouse_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_isolation_select"
  ON public.warehouse_inventory FOR SELECT TO authenticated
  USING (is_workspace_member_v2(workspace_id));

CREATE POLICY "workspace_isolation_insert"
  ON public.warehouse_inventory FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member_v2(workspace_id));

CREATE POLICY "workspace_isolation_update"
  ON public.warehouse_inventory FOR UPDATE TO authenticated
  USING (is_workspace_member_v2(workspace_id))
  WITH CHECK (is_workspace_member_v2(workspace_id));

CREATE POLICY "workspace_isolation_delete"
  ON public.warehouse_inventory FOR DELETE TO authenticated
  USING (is_workspace_member_v2(workspace_id));


-- =====================================================
-- 1c. INVENTORY TRANSFERS + ITEMS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.inventory_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  transfer_number TEXT NOT NULL,
  correlation_id UUID DEFAULT gen_random_uuid(),
  from_node_id UUID NOT NULL REFERENCES public.warehouses(id),
  to_node_id UUID NOT NULL REFERENCES public.warehouses(id),
  status TEXT NOT NULL DEFAULT 'draft',
  initiated_by UUID REFERENCES auth.users(id),
  dispatched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Transfer invariants
  CONSTRAINT chk_transfer_no_self_transfer CHECK (from_node_id != to_node_id),
  CONSTRAINT chk_transfer_status CHECK (status IN ('draft', 'in_transit', 'completed', 'partial', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_transfers_workspace ON public.inventory_transfers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_from_node ON public.inventory_transfers(from_node_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_to_node ON public.inventory_transfers(to_node_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_status ON public.inventory_transfers(status);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_correlation ON public.inventory_transfers(correlation_id);

-- RLS
ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_isolation_select"
  ON public.inventory_transfers FOR SELECT TO authenticated
  USING (is_workspace_member_v2(workspace_id));

CREATE POLICY "workspace_isolation_insert"
  ON public.inventory_transfers FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member_v2(workspace_id));

CREATE POLICY "workspace_isolation_update"
  ON public.inventory_transfers FOR UPDATE TO authenticated
  USING (is_workspace_member_v2(workspace_id))
  WITH CHECK (is_workspace_member_v2(workspace_id));

CREATE POLICY "workspace_isolation_delete"
  ON public.inventory_transfers FOR DELETE TO authenticated
  USING (is_workspace_member_v2(workspace_id));


-- Transfer Items
CREATE TABLE IF NOT EXISTS public.inventory_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.inventory_transfers(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id),
  quantity_sent INTEGER NOT NULL,
  quantity_received INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Item invariants
  CONSTRAINT chk_transfer_item_qty_sent_positive CHECK (quantity_sent > 0),
  CONSTRAINT chk_transfer_item_qty_received_non_negative CHECK (quantity_received >= 0),

  -- One entry per item per transfer
  CONSTRAINT uq_transfer_item UNIQUE (transfer_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON public.inventory_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_item ON public.inventory_transfer_items(item_id);

-- RLS via parent table join
ALTER TABLE public.inventory_transfer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_isolation_select"
  ON public.inventory_transfer_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inventory_transfers t
      WHERE t.id = transfer_id
        AND is_workspace_member_v2(t.workspace_id)
    )
  );

CREATE POLICY "workspace_isolation_insert"
  ON public.inventory_transfer_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inventory_transfers t
      WHERE t.id = transfer_id
        AND is_workspace_member_v2(t.workspace_id)
    )
  );

CREATE POLICY "workspace_isolation_update"
  ON public.inventory_transfer_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inventory_transfers t
      WHERE t.id = transfer_id
        AND is_workspace_member_v2(t.workspace_id)
    )
  );

CREATE POLICY "workspace_isolation_delete"
  ON public.inventory_transfer_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inventory_transfers t
      WHERE t.id = transfer_id
        AND is_workspace_member_v2(t.workspace_id)
    )
  );


-- =====================================================
-- 1d. DELIVERY LOGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.delivery_batches(id),
  transfer_id UUID REFERENCES public.inventory_transfers(id),
  facility_id UUID REFERENCES public.facilities(id),
  correlation_id UUID,
  event_type TEXT NOT NULL,
  item_id UUID REFERENCES public.items(id),
  expected_qty INTEGER,
  actual_qty INTEGER,
  discrepancy_reason TEXT,
  logged_by UUID REFERENCES auth.users(id),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT chk_delivery_log_event_type CHECK (
    event_type IN ('dispatched', 'arrived', 'delivered', 'returned', 'discrepancy')
  )
);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_workspace ON public.delivery_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_batch ON public.delivery_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_transfer ON public.delivery_logs(transfer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_correlation ON public.delivery_logs(correlation_id);

-- RLS
ALTER TABLE public.delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_isolation_select"
  ON public.delivery_logs FOR SELECT TO authenticated
  USING (is_workspace_member_v2(workspace_id));

CREATE POLICY "workspace_isolation_insert"
  ON public.delivery_logs FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member_v2(workspace_id));

-- Delivery logs are immutable: no update/delete policies


-- =====================================================
-- 1e. ADD COLUMNS TO DELIVERY_BATCHES
-- =====================================================

ALTER TABLE public.delivery_batches
  ADD COLUMN IF NOT EXISTS dispatch_node_id UUID REFERENCES public.warehouses(id),
  ADD COLUMN IF NOT EXISTS correlation_id UUID;

CREATE INDEX IF NOT EXISTS idx_delivery_batches_dispatch_node ON public.delivery_batches(dispatch_node_id);
CREATE INDEX IF NOT EXISTS idx_delivery_batches_correlation ON public.delivery_batches(correlation_id);


-- =====================================================
-- 1f. AUDIT TRIGGERS FOR NEW TABLES
-- =====================================================

-- The existing create_audit_log_trigger() extracts organization_id from NEW/OLD.
-- Our new tables use workspace_id instead. Create a wrapper trigger that maps workspace_id → organization_id.

CREATE OR REPLACE FUNCTION public.create_audit_log_trigger_workspace()
RETURNS TRIGGER AS $$
DECLARE
  _action TEXT;
  _workspace_id UUID;
  _severity TEXT;
  _diff JSONB;
BEGIN
  _action := TG_ARGV[0];
  _severity := COALESCE(TG_ARGV[1], 'medium');

  -- Extract workspace_id (our tables use workspace_id, not organization_id)
  IF TG_OP = 'DELETE' THEN
    _workspace_id := OLD.workspace_id;
  ELSE
    _workspace_id := NEW.workspace_id;
  END IF;

  -- Compute state diff for updates
  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(key, value)
    INTO _diff
    FROM (
      SELECT key, value
      FROM jsonb_each(to_jsonb(NEW))
      WHERE to_jsonb(NEW) -> key IS DISTINCT FROM to_jsonb(OLD) -> key
    ) AS changed_fields;
  ELSE
    _diff := NULL;
  END IF;

  INSERT INTO public.audit_logs (
    organization_id,
    user_id,
    action,
    resource,
    resource_id,
    previous_state,
    new_state,
    state_diff,
    timestamp,
    severity
  ) VALUES (
    _workspace_id,
    auth.uid(),
    _action,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    _diff,
    now(),
    _severity
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach audit triggers to new tables
CREATE TRIGGER audit_warehouse_inventory
  AFTER INSERT OR UPDATE OR DELETE ON public.warehouse_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.create_audit_log_trigger_workspace('inventory.change', 'high');

CREATE TRIGGER audit_inventory_transfers
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.create_audit_log_trigger_workspace('transfer.change', 'high');

CREATE TRIGGER audit_delivery_logs
  AFTER INSERT ON public.delivery_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.create_audit_log_trigger_workspace('delivery.logged', 'medium');

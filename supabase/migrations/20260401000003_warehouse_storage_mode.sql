-- =====================================================
-- WAREHOUSE STORAGE MODE
-- Migration: 20260401000003
--
-- Adds:
--   1. storage_mode ('active' | 'passive') column to warehouses
--   2. activated_at timestamp
--   3. Trigger: passive nodes cannot hold inventory
--   4. Trigger: block active→passive if inventory exists
--   5. RPC: activate_warehouse()
--   6. RPC: deactivate_warehouse()
--   7. receive_transfer() updated to enforce active destination
-- =====================================================


-- =====================================================
-- 1. ADD COLUMNS TO WAREHOUSES
-- =====================================================

ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS storage_mode TEXT
    NOT NULL DEFAULT 'active'
    CHECK (storage_mode IN ('active', 'passive')),
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

-- Backfill activated_at for all existing nodes (assume they were active at creation)
UPDATE public.warehouses
SET activated_at = created_at
WHERE storage_mode = 'active' AND activated_at IS NULL;


-- =====================================================
-- 2. CONSTRAINT: passive nodes cannot hold inventory
-- =====================================================

CREATE OR REPLACE FUNCTION public.enforce_active_node_for_inventory()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.warehouses
    WHERE id = NEW.node_id AND storage_mode = 'passive'
  ) THEN
    RAISE EXCEPTION 'Node % is passive and cannot hold inventory. Activate the node first.', NEW.node_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_active_node_inventory
  BEFORE INSERT OR UPDATE ON public.warehouse_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_active_node_for_inventory();


-- =====================================================
-- 3. CONSTRAINT: block active→passive with inventory
-- =====================================================

CREATE OR REPLACE FUNCTION public.prevent_deactivation_with_inventory()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.storage_mode = 'active' AND NEW.storage_mode = 'passive' THEN
    IF EXISTS (
      SELECT 1 FROM public.warehouse_inventory
      WHERE node_id = NEW.id AND quantity > 0
    ) THEN
      RAISE EXCEPTION
        'Cannot deactivate node "%": it still holds inventory. Transfer or remove all stock first.',
        NEW.name;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_deactivation_with_inventory
  BEFORE UPDATE OF storage_mode ON public.warehouses
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_deactivation_with_inventory();


-- =====================================================
-- 4. RPC: activate_warehouse(p_warehouse_id)
--
-- Sets storage_mode = 'active' and records activated_at.
-- Idempotent: returns TRUE if already active.
-- =====================================================

CREATE OR REPLACE FUNCTION public.activate_warehouse(p_warehouse_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_warehouse RECORD;
BEGIN
  SELECT * INTO v_warehouse
  FROM public.warehouses
  WHERE id = p_warehouse_id
  FOR UPDATE;

  IF v_warehouse IS NULL THEN
    RAISE EXCEPTION 'Warehouse % not found', p_warehouse_id;
  END IF;

  -- Idempotent
  IF v_warehouse.storage_mode = 'active' THEN
    RETURN TRUE;
  END IF;

  UPDATE public.warehouses
  SET storage_mode = 'active',
      activated_at = now(),
      updated_at = now()
  WHERE id = p_warehouse_id;

  PERFORM public.create_audit_log(
    'warehouse.activated',
    'warehouses',
    p_warehouse_id,
    jsonb_build_object('storage_mode', 'passive'),
    jsonb_build_object('storage_mode', 'active', 'activated_at', now()),
    '{}'::jsonb,
    'high'
  );

  RETURN TRUE;
END;
$$;


-- =====================================================
-- 5. RPC: deactivate_warehouse(p_warehouse_id)
--
-- Sets storage_mode = 'passive'.
-- Blocks if the node has any inventory (quantity > 0).
-- =====================================================

CREATE OR REPLACE FUNCTION public.deactivate_warehouse(p_warehouse_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_warehouse RECORD;
BEGIN
  SELECT * INTO v_warehouse
  FROM public.warehouses
  WHERE id = p_warehouse_id
  FOR UPDATE;

  IF v_warehouse IS NULL THEN
    RAISE EXCEPTION 'Warehouse % not found', p_warehouse_id;
  END IF;

  -- Idempotent
  IF v_warehouse.storage_mode = 'passive' THEN
    RETURN TRUE;
  END IF;

  -- Guard: refuse if inventory exists (the trigger also enforces this)
  IF EXISTS (
    SELECT 1 FROM public.warehouse_inventory
    WHERE node_id = p_warehouse_id AND quantity > 0
  ) THEN
    RAISE EXCEPTION
      'Cannot deactivate node "%": it still holds inventory. Transfer or remove all stock first.',
      v_warehouse.name;
  END IF;

  UPDATE public.warehouses
  SET storage_mode = 'passive',
      updated_at = now()
  WHERE id = p_warehouse_id;

  PERFORM public.create_audit_log(
    'warehouse.deactivated',
    'warehouses',
    p_warehouse_id,
    jsonb_build_object('storage_mode', 'active'),
    jsonb_build_object('storage_mode', 'passive'),
    '{}'::jsonb,
    'high'
  );

  RETURN TRUE;
END;
$$;


-- =====================================================
-- 6. UPDATE receive_transfer() to enforce active destination
-- =====================================================

CREATE OR REPLACE FUNCTION public.receive_transfer(
  p_transfer_id UUID,
  p_items JSONB  -- [{item_id: UUID, quantity_received: INTEGER}]
)
RETURNS TEXT  -- returns new status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer RECORD;
  v_to_node RECORD;
  v_item JSONB;
  v_item_id UUID;
  v_qty_received INTEGER;
  v_all_received BOOLEAN := TRUE;
  v_transfer_item RECORD;
BEGIN
  -- Lock and fetch the transfer
  SELECT t.* INTO v_transfer
  FROM public.inventory_transfers t
  WHERE t.id = p_transfer_id
  FOR UPDATE;

  IF v_transfer IS NULL THEN
    RAISE EXCEPTION 'Transfer % not found', p_transfer_id;
  END IF;

  IF v_transfer.status NOT IN ('in_transit', 'partial') THEN
    RAISE EXCEPTION 'Transfer % cannot receive items in status "%"', p_transfer_id, v_transfer.status;
  END IF;

  -- Enforce can_receive capability and active storage_mode on to_node
  SELECT w.id, w.capabilities, w.name, w.storage_mode INTO v_to_node
  FROM public.warehouses w
  WHERE w.id = v_transfer.to_node_id;

  IF NOT (v_to_node.capabilities->>'can_receive')::boolean THEN
    RAISE EXCEPTION 'Node "%" does not have receive capability', v_to_node.name;
  END IF;

  IF v_to_node.storage_mode = 'passive' THEN
    RAISE EXCEPTION 'Node "%" is passive and cannot receive inventory. Activate the node first.', v_to_node.name;
  END IF;

  -- Process each received item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := (v_item->>'item_id')::UUID;
    v_qty_received := (v_item->>'quantity_received')::INTEGER;

    IF v_qty_received <= 0 THEN
      CONTINUE;
    END IF;

    -- Update transfer item received quantity
    UPDATE public.inventory_transfer_items
    SET quantity_received = quantity_received + v_qty_received
    WHERE transfer_id = p_transfer_id
      AND item_id = v_item_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Transfer item not found: transfer=%, item=%', p_transfer_id, v_item_id;
    END IF;

    -- Upsert inventory at destination node
    INSERT INTO public.warehouse_inventory (workspace_id, node_id, item_id, quantity, reserved_qty)
    VALUES (v_transfer.workspace_id, v_transfer.to_node_id, v_item_id, v_qty_received, 0)
    ON CONFLICT (node_id, item_id)
    DO UPDATE SET
      quantity = warehouse_inventory.quantity + v_qty_received,
      updated_at = now();
  END LOOP;

  -- Check if all items fully received
  FOR v_transfer_item IN
    SELECT ti.quantity_sent, ti.quantity_received
    FROM public.inventory_transfer_items ti
    WHERE ti.transfer_id = p_transfer_id
  LOOP
    IF v_transfer_item.quantity_received < v_transfer_item.quantity_sent THEN
      v_all_received := FALSE;
      EXIT;
    END IF;
  END LOOP;

  -- Update transfer status
  IF v_all_received THEN
    UPDATE public.inventory_transfers
    SET status = 'completed',
        completed_at = now(),
        updated_at = now()
    WHERE id = p_transfer_id;
  ELSE
    UPDATE public.inventory_transfers
    SET status = 'partial',
        updated_at = now()
    WHERE id = p_transfer_id;
  END IF;

  -- Explicit audit log
  PERFORM public.create_audit_log(
    'transfer.received',
    'inventory_transfers',
    p_transfer_id,
    jsonb_build_object('status', v_transfer.status),
    jsonb_build_object(
      'status', CASE WHEN v_all_received THEN 'completed' ELSE 'partial' END,
      'items_received', p_items,
      'workspace_id', v_transfer.workspace_id
    ),
    jsonb_build_object('correlation_id', v_transfer.correlation_id),
    'high'
  );

  RETURN CASE WHEN v_all_received THEN 'completed' ELSE 'partial' END;
END;
$$;

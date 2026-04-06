-- =====================================================
-- WAREHOUSE INVENTORY RPC FUNCTIONS
-- Migration: 20260401000002
--
-- Implements:
--   - allocate_inventory()    — reserve stock across hierarchy
--   - dispatch_transfer()     — deduct stock + release reservations
--   - receive_transfer()      — add stock at destination
--   - release_reservation()   — free reserved stock
--
-- Critical Invariants:
--   - available_qty = quantity - reserved_qty (NEVER use quantity directly)
--   - All mutations use FOR UPDATE row locking
--   - All functions insert explicit audit_logs entries
--   - Capability enforcement: can_dispatch / can_receive asserted in RPCs
-- =====================================================


-- =====================================================
-- allocate_inventory()
--
-- Reserves stock at a node, walking up the hierarchy if
-- the starting node has insufficient available_qty.
-- Returns JSON array: [{node_id, quantity_allocated}]
-- =====================================================

CREATE OR REPLACE FUNCTION public.allocate_inventory(
  p_workspace_id UUID,
  p_node_id UUID,
  p_item_id UUID,
  p_quantity INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining INTEGER := p_quantity;
  v_available INTEGER;
  v_to_allocate INTEGER;
  v_current_node_id UUID;
  v_inv_row RECORD;
  v_result JSONB := '[]'::jsonb;
  v_depth INTEGER := 0;
  v_max_depth CONSTANT INTEGER := 3;
BEGIN
  -- Validate input
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Allocation quantity must be positive, got %', p_quantity;
  END IF;

  v_current_node_id := p_node_id;

  -- Walk up the hierarchy
  WHILE v_current_node_id IS NOT NULL AND v_remaining > 0 AND v_depth <= v_max_depth LOOP
    -- Lock the inventory row for this node + item
    SELECT wi.id, wi.quantity, wi.reserved_qty, wi.node_id
    INTO v_inv_row
    FROM public.warehouse_inventory wi
    WHERE wi.node_id = v_current_node_id
      AND wi.item_id = p_item_id
      AND wi.workspace_id = p_workspace_id
    FOR UPDATE;

    IF v_inv_row IS NOT NULL THEN
      -- Compute available_qty = quantity - reserved_qty
      v_available := v_inv_row.quantity - v_inv_row.reserved_qty;

      IF v_available > 0 THEN
        v_to_allocate := LEAST(v_available, v_remaining);

        -- Increment reserved_qty
        UPDATE public.warehouse_inventory
        SET reserved_qty = reserved_qty + v_to_allocate,
            updated_at = now()
        WHERE id = v_inv_row.id;

        -- Add to result
        v_result := v_result || jsonb_build_object(
          'node_id', v_current_node_id,
          'quantity_allocated', v_to_allocate
        );

        v_remaining := v_remaining - v_to_allocate;
      END IF;
    END IF;

    -- If still need more, walk up to parent
    IF v_remaining > 0 THEN
      SELECT w.parent_id INTO v_current_node_id
      FROM public.warehouses w
      WHERE w.id = v_current_node_id;

      v_depth := v_depth + 1;
    END IF;
  END LOOP;

  -- Must fully satisfy or fail
  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Insufficient inventory: could not allocate % units of item %, short by %',
      p_quantity, p_item_id, v_remaining;
  END IF;

  -- Explicit audit log
  PERFORM public.create_audit_log(
    'inventory.allocated',
    'warehouse_inventory',
    p_node_id,
    NULL,
    jsonb_build_object(
      'item_id', p_item_id,
      'quantity_requested', p_quantity,
      'allocations', v_result,
      'workspace_id', p_workspace_id
    ),
    jsonb_build_object('starting_node', p_node_id),
    'high'
  );

  RETURN v_result;
END;
$$;


-- =====================================================
-- dispatch_transfer()
--
-- Transitions transfer: draft → in_transit
-- Deducts stock from source node, releases reservations.
-- Enforces can_dispatch capability on from_node.
-- =====================================================

CREATE OR REPLACE FUNCTION public.dispatch_transfer(
  p_transfer_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer RECORD;
  v_from_node RECORD;
  v_item RECORD;
  v_inv RECORD;
  v_available INTEGER;
BEGIN
  -- Lock and fetch the transfer
  SELECT t.* INTO v_transfer
  FROM public.inventory_transfers t
  WHERE t.id = p_transfer_id
  FOR UPDATE;

  IF v_transfer IS NULL THEN
    RAISE EXCEPTION 'Transfer % not found', p_transfer_id;
  END IF;

  IF v_transfer.status != 'draft' THEN
    RAISE EXCEPTION 'Transfer % cannot be dispatched from status "%"', p_transfer_id, v_transfer.status;
  END IF;

  -- Enforce can_dispatch capability on from_node
  SELECT w.id, w.capabilities, w.name INTO v_from_node
  FROM public.warehouses w
  WHERE w.id = v_transfer.from_node_id;

  IF NOT (v_from_node.capabilities->>'can_dispatch')::boolean THEN
    RAISE EXCEPTION 'Node "%" does not have dispatch capability', v_from_node.name;
  END IF;

  -- Process each transfer item
  FOR v_item IN
    SELECT ti.*
    FROM public.inventory_transfer_items ti
    WHERE ti.transfer_id = p_transfer_id
  LOOP
    -- Lock inventory row at from_node
    SELECT wi.* INTO v_inv
    FROM public.warehouse_inventory wi
    WHERE wi.node_id = v_transfer.from_node_id
      AND wi.item_id = v_item.item_id
    FOR UPDATE;

    IF v_inv IS NULL THEN
      RAISE EXCEPTION 'No inventory found for item % at node %', v_item.item_id, v_transfer.from_node_id;
    END IF;

    -- Compute available_qty = quantity - reserved_qty
    v_available := v_inv.quantity - v_inv.reserved_qty;

    -- If stock was pre-reserved, deduct from both quantity and reserved_qty
    IF v_inv.reserved_qty >= v_item.quantity_sent THEN
      UPDATE public.warehouse_inventory
      SET quantity = quantity - v_item.quantity_sent,
          reserved_qty = reserved_qty - v_item.quantity_sent,
          updated_at = now()
      WHERE id = v_inv.id;
    ELSE
      -- Not pre-reserved: validate available stock, then deduct from quantity only
      IF v_available < v_item.quantity_sent THEN
        RAISE EXCEPTION 'Insufficient available stock for item % at node %: available=%, required=%',
          v_item.item_id, v_transfer.from_node_id, v_available, v_item.quantity_sent;
      END IF;

      -- Release any partial reservation and deduct full amount from quantity
      UPDATE public.warehouse_inventory
      SET quantity = quantity - v_item.quantity_sent,
          reserved_qty = GREATEST(reserved_qty - v_item.quantity_sent, 0),
          updated_at = now()
      WHERE id = v_inv.id;
    END IF;
  END LOOP;

  -- Update transfer status
  UPDATE public.inventory_transfers
  SET status = 'in_transit',
      dispatched_at = now(),
      updated_at = now()
  WHERE id = p_transfer_id;

  -- Explicit audit log
  PERFORM public.create_audit_log(
    'transfer.dispatched',
    'inventory_transfers',
    p_transfer_id,
    jsonb_build_object('status', 'draft'),
    jsonb_build_object(
      'status', 'in_transit',
      'from_node_id', v_transfer.from_node_id,
      'to_node_id', v_transfer.to_node_id,
      'workspace_id', v_transfer.workspace_id
    ),
    jsonb_build_object('correlation_id', v_transfer.correlation_id),
    'high'
  );

  RETURN TRUE;
END;
$$;


-- =====================================================
-- receive_transfer()
--
-- Receives items at destination node.
-- Supports partial receipt. Enforces can_receive capability.
-- Status: in_transit → completed | partial
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

  -- Enforce can_receive capability on to_node
  SELECT w.id, w.capabilities, w.name INTO v_to_node
  FROM public.warehouses w
  WHERE w.id = v_transfer.to_node_id;

  IF NOT (v_to_node.capabilities->>'can_receive')::boolean THEN
    RAISE EXCEPTION 'Node "%" does not have receive capability', v_to_node.name;
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


-- =====================================================
-- release_reservation()
--
-- Frees reserved stock at a specific node.
-- Used for rollback scenarios or order cancellations.
-- =====================================================

CREATE OR REPLACE FUNCTION public.release_reservation(
  p_workspace_id UUID,
  p_node_id UUID,
  p_item_id UUID,
  p_quantity INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv RECORD;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Release quantity must be positive, got %', p_quantity;
  END IF;

  -- Lock the inventory row
  SELECT wi.* INTO v_inv
  FROM public.warehouse_inventory wi
  WHERE wi.node_id = p_node_id
    AND wi.item_id = p_item_id
    AND wi.workspace_id = p_workspace_id
  FOR UPDATE;

  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'No inventory found for item % at node %', p_item_id, p_node_id;
  END IF;

  IF v_inv.reserved_qty < p_quantity THEN
    RAISE EXCEPTION 'Cannot release % units: only % reserved for item % at node %',
      p_quantity, v_inv.reserved_qty, p_item_id, p_node_id;
  END IF;

  UPDATE public.warehouse_inventory
  SET reserved_qty = reserved_qty - p_quantity,
      updated_at = now()
  WHERE id = v_inv.id;

  -- Explicit audit log
  PERFORM public.create_audit_log(
    'inventory.reservation_released',
    'warehouse_inventory',
    p_node_id,
    jsonb_build_object('reserved_qty', v_inv.reserved_qty),
    jsonb_build_object(
      'reserved_qty', v_inv.reserved_qty - p_quantity,
      'released', p_quantity,
      'item_id', p_item_id,
      'workspace_id', p_workspace_id
    ),
    '{}'::jsonb,
    'medium'
  );

  RETURN TRUE;
END;
$$;

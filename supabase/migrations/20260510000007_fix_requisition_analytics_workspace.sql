-- Migration: Add workspace isolation to requisition workflow analytics functions
-- Fixes: get_storefront_requisition_analytics, get_fleetops_dispatch_analytics,
--        get_packaging_type_distribution had no workspace_id parameter

-- ===========================================================================
-- STEP 1: Drop old functions
-- ===========================================================================

DROP FUNCTION IF EXISTS public.get_storefront_requisition_analytics(DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.get_fleetops_dispatch_analytics(DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.get_packaging_type_distribution(DATE, DATE) CASCADE;

-- ===========================================================================
-- STEP 2: get_storefront_requisition_analytics with workspace isolation
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.get_storefront_requisition_analytics(
  p_workspace_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  IF NOT is_workspace_member_v2(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;

  v_start := COALESCE(p_start_date::TIMESTAMPTZ, NOW() - INTERVAL '30 days');
  v_end := COALESCE(p_end_date::TIMESTAMPTZ + INTERVAL '1 day', NOW());

  RETURN (
    SELECT json_build_object(
      'approval_turnaround', json_build_object(
        'avg_hours', COALESCE(ROUND(AVG(approval_hours)::NUMERIC, 2), 0),
        'median_hours', COALESCE(ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY approval_hours)::NUMERIC, 2), 0),
        'p95_hours', COALESCE(ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY approval_hours)::NUMERIC, 2), 0),
        'count', COUNT(*) FILTER (WHERE approval_hours IS NOT NULL)
      ),
      'packaging_efficiency', json_build_object(
        'avg_minutes', COALESCE(ROUND(AVG(packaging_minutes)::NUMERIC, 2), 0),
        'median_minutes', COALESCE(ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY packaging_minutes)::NUMERIC, 2), 0),
        'total_packaged', COUNT(*) FILTER (WHERE packaging_minutes IS NOT NULL)
      ),
      'ready_for_dispatch_queue', json_build_object(
        'avg_wait_hours', COALESCE(ROUND(AVG(ready_wait_hours)::NUMERIC, 2), 0),
        'current_queue_depth', (
          SELECT COUNT(*)
          FROM public.requisitions
          WHERE status = 'ready_for_dispatch'
            AND workspace_id = p_workspace_id
        ),
        'total_processed', COUNT(*) FILTER (WHERE assignment_wait_hours IS NOT NULL)
      ),
      'slot_demand', json_build_object(
        'avg_slot_demand', COALESCE(ROUND(AVG(total_slot_demand)::NUMERIC, 2), 0),
        'total_slot_demand', COALESCE(SUM(total_slot_demand), 0),
        'avg_rounded_slots', COALESCE(ROUND(AVG(rounded_slot_demand)::NUMERIC, 2), 0),
        'total_requisitions', COUNT(*) FILTER (WHERE total_slot_demand IS NOT NULL)
      ),
      'fulfillment_rate', json_build_object(
        'total_requisitions', COUNT(*),
        'fulfilled', COUNT(*) FILTER (WHERE is_fulfilled),
        'failed', COUNT(*) FILTER (WHERE is_failed),
        'in_progress', COUNT(*) FILTER (WHERE status IN ('pending', 'approved', 'packaged', 'ready_for_dispatch', 'assigned_to_batch', 'in_transit')),
        'fulfillment_percentage', COALESCE(ROUND((COUNT(*) FILTER (WHERE is_fulfilled)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2), 0)
      )
    )
    FROM analytics.mv_requisition_workflow_metrics m
    WHERE m.requisition_id IN (
      SELECT id FROM public.requisitions WHERE workspace_id = p_workspace_id
    )
    AND m.created_at >= v_start
    AND m.created_at <= v_end
  );
END;
$$;

-- ===========================================================================
-- STEP 3: get_fleetops_dispatch_analytics with workspace isolation
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.get_fleetops_dispatch_analytics(
  p_workspace_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  IF NOT is_workspace_member_v2(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;

  v_start := COALESCE(p_start_date::TIMESTAMPTZ, NOW() - INTERVAL '30 days');
  v_end := COALESCE(p_end_date::TIMESTAMPTZ + INTERVAL '1 day', NOW());

  RETURN (
    SELECT json_build_object(
      'batch_assembly', json_build_object(
        'avg_hours', COALESCE(ROUND(AVG(assembly_hours)::NUMERIC, 2), 0),
        'median_hours', COALESCE(ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY assembly_hours)::NUMERIC, 2), 0),
        'total_batches_assembled', COUNT(*) FILTER (WHERE assembly_hours IS NOT NULL)
      ),
      'dispatch_efficiency', json_build_object(
        'avg_dispatch_hours', COALESCE(ROUND(AVG(dispatch_duration_hours)::NUMERIC, 2), 0),
        'median_dispatch_hours', COALESCE(ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dispatch_duration_hours)::NUMERIC, 2), 0),
        'total_dispatches_completed', COUNT(*) FILTER (WHERE is_completed)
      ),
      'snapshot_lock_duration', json_build_object(
        'avg_hours', COALESCE(ROUND(AVG(snapshot_lock_hours)::NUMERIC, 2), 0),
        'median_hours', COALESCE(ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY snapshot_lock_hours)::NUMERIC, 2), 0),
        'currently_locked', (
          SELECT COUNT(*)
          FROM public.delivery_batches
          WHERE is_snapshot_locked = TRUE
            AND workspace_id = p_workspace_id
        )
      ),
      'batch_status_distribution', json_build_object(
        'planned', COUNT(*) FILTER (WHERE status = 'planned'),
        'assigned', COUNT(*) FILTER (WHERE status = 'assigned'),
        'in_progress', COUNT(*) FILTER (WHERE status = 'in-progress'),
        'completed', COUNT(*) FILTER (WHERE is_completed),
        'cancelled', COUNT(*) FILTER (WHERE is_cancelled)
      ),
      'slot_demand_per_batch', json_build_object(
        'avg_slot_demand', COALESCE(ROUND(AVG(total_batch_slot_demand)::NUMERIC, 2), 0),
        'avg_requisitions_per_batch', COALESCE(ROUND(AVG(requisition_count)::NUMERIC, 2), 0)
      )
    )
    FROM analytics.mv_batch_assembly_metrics m
    WHERE m.batch_id IN (
      SELECT id FROM public.delivery_batches WHERE workspace_id = p_workspace_id
    )
    AND m.created_at >= v_start
    AND m.created_at <= v_end
  );
END;
$$;

-- ===========================================================================
-- STEP 4: get_packaging_type_distribution with workspace isolation
-- Queries base tables directly (mv_packaging_analytics is not workspace-scoped)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.get_packaging_type_distribution(
  p_workspace_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  packaging_type TEXT,
  item_count BIGINT,
  total_quantity BIGINT,
  total_slot_cost NUMERIC,
  avg_slot_cost_per_item NUMERIC,
  total_package_count BIGINT,
  requisition_count BIGINT,
  avg_slot_demand_per_requisition NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_start DATE;
  v_end DATE;
BEGIN
  IF NOT is_workspace_member_v2(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;

  v_start := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
  v_end := COALESCE(p_end_date, CURRENT_DATE);

  RETURN QUERY
  SELECT
    rpi.packaging_type::TEXT,
    COUNT(*)::BIGINT as item_count,
    SUM(rpi.quantity)::BIGINT as total_quantity,
    SUM(rpi.slot_cost) as total_slot_cost,
    AVG(rpi.slot_cost) as avg_slot_cost_per_item,
    SUM(rpi.package_count)::BIGINT as total_package_count,
    COUNT(DISTINCT rp.requisition_id)::BIGINT as requisition_count,
    COALESCE(
      ROUND(SUM(rp.total_slot_demand)::NUMERIC / NULLIF(COUNT(DISTINCT rp.requisition_id), 0), 2),
      0
    ) as avg_slot_demand_per_requisition
  FROM public.requisition_packaging_items rpi
  JOIN public.requisition_packaging rp ON rpi.packaging_id = rp.id
  JOIN public.requisitions r ON rp.requisition_id = r.id
  WHERE r.workspace_id = p_workspace_id
    AND rp.is_final = TRUE
    AND r.created_at::DATE >= v_start
    AND r.created_at::DATE <= v_end
  GROUP BY rpi.packaging_type
  ORDER BY total_quantity DESC;
END;
$$;

-- ===========================================================================
-- STEP 5: Grant permissions (authenticated only)
-- ===========================================================================

GRANT EXECUTE ON FUNCTION public.get_storefront_requisition_analytics(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fleetops_dispatch_analytics(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_packaging_type_distribution(UUID, DATE, DATE) TO authenticated;

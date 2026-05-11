-- Migration: Add workspace isolation to all stock analytics functions
-- Fixes: get_stock_status, get_stock_balance, get_stock_performance,
--        get_stock_by_zone, get_low_stock_alerts had no workspace_id parameter
-- Also: adds workspace_id column to notifications for workspace-scoped filtering

-- ===========================================================================
-- STEP 1: Drop old stock analytics public wrappers (no workspace_id)
-- ===========================================================================

DROP FUNCTION IF EXISTS public.get_stock_status() CASCADE;
DROP FUNCTION IF EXISTS public.get_stock_balance(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_stock_performance(DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.get_stock_by_zone() CASCADE;
DROP FUNCTION IF EXISTS public.get_low_stock_alerts(INTEGER) CASCADE;

DROP FUNCTION IF EXISTS analytics.get_stock_status() CASCADE;
DROP FUNCTION IF EXISTS analytics.get_stock_balance(TEXT) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_stock_performance(DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS analytics.get_stock_by_zone() CASCADE;
DROP FUNCTION IF EXISTS analytics.get_low_stock_alerts(INTEGER) CASCADE;

-- ===========================================================================
-- STEP 2: Recreate analytics.get_stock_status with workspace isolation
-- ===========================================================================

CREATE OR REPLACE FUNCTION analytics.get_stock_status(p_workspace_id UUID)
RETURNS TABLE (
  total_products BIGINT,
  total_facilities_with_stock BIGINT,
  total_stock_items BIGINT,
  low_stock_count BIGINT,
  out_of_stock_count BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_low_stock_threshold INTEGER := 10;
BEGIN
  RETURN QUERY
  WITH workspace_facilities AS (
    SELECT id FROM public.facilities WHERE workspace_id = p_workspace_id AND deleted_at IS NULL
  ),
  stock_summary AS (
    SELECT
      COUNT(DISTINCT fs.product_name) as products,
      COUNT(DISTINCT fs.facility_id) as facilities,
      COALESCE(SUM(fs.quantity), 0) as items
    FROM public.facility_stock fs
    WHERE fs.quantity > 0
      AND fs.facility_id IN (SELECT id FROM workspace_facilities)
  ),
  low_stock_facilities AS (
    SELECT COUNT(DISTINCT fs.facility_id) as count
    FROM public.facility_stock fs
    WHERE fs.quantity > 0
      AND fs.quantity < v_low_stock_threshold
      AND fs.facility_id IN (SELECT id FROM workspace_facilities)
  ),
  out_of_stock_facilities AS (
    SELECT COUNT(DISTINCT f.id) as count
    FROM workspace_facilities wf
    JOIN public.facilities f ON f.id = wf.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.facility_stock fs
      WHERE fs.facility_id = f.id AND fs.quantity > 0
    )
  )
  SELECT
    ss.products::BIGINT,
    ss.facilities::BIGINT,
    ss.items::BIGINT,
    COALESCE(ls.count, 0)::BIGINT,
    COALESCE(oos.count, 0)::BIGINT
  FROM stock_summary ss
  CROSS JOIN low_stock_facilities ls
  CROSS JOIN out_of_stock_facilities oos;
END;
$$;

-- ===========================================================================
-- STEP 3: analytics.get_stock_balance with workspace isolation
-- ===========================================================================

CREATE OR REPLACE FUNCTION analytics.get_stock_balance(
  p_workspace_id UUID,
  p_product_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  product_name TEXT,
  total_quantity BIGINT,
  allocated_quantity BIGINT,
  available_quantity BIGINT,
  facilities_count BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH workspace_facilities AS (
    SELECT id FROM public.facilities WHERE workspace_id = p_workspace_id AND deleted_at IS NULL
  ),
  total_stock AS (
    SELECT
      fs.product_name,
      SUM(fs.quantity) as total_qty,
      COUNT(DISTINCT fs.facility_id) as facility_count
    FROM public.facility_stock fs
    WHERE fs.quantity > 0
      AND fs.facility_id IN (SELECT id FROM workspace_facilities)
      AND (p_product_name IS NULL OR fs.product_name = p_product_name)
    GROUP BY fs.product_name
  ),
  allocated_stock AS (
    SELECT
      db.medication_type as product,
      COALESCE(SUM(db.total_quantity), 0) as allocated_qty
    FROM public.delivery_batches db
    WHERE db.workspace_id = p_workspace_id
      AND db.status IN ('planned', 'assigned', 'in-progress')
      AND (p_product_name IS NULL OR db.medication_type = p_product_name)
    GROUP BY db.medication_type
  )
  SELECT
    ts.product_name::TEXT,
    COALESCE(ts.total_qty, 0)::BIGINT,
    COALESCE(als.allocated_qty, 0)::BIGINT,
    GREATEST(COALESCE(ts.total_qty, 0) - COALESCE(als.allocated_qty, 0), 0)::BIGINT,
    COALESCE(ts.facility_count, 0)::BIGINT
  FROM total_stock ts
  LEFT JOIN allocated_stock als ON ts.product_name = als.product
  ORDER BY ts.product_name;
END;
$$;

-- ===========================================================================
-- STEP 4: analytics.get_stock_performance with workspace isolation
-- ===========================================================================

CREATE OR REPLACE FUNCTION analytics.get_stock_performance(
  p_workspace_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  product_name TEXT,
  turnover_rate NUMERIC,
  avg_days_supply NUMERIC,
  total_delivered BIGINT,
  current_stock BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_days_in_period INTEGER;
BEGIN
  v_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
  v_end_date := COALESCE(p_end_date, CURRENT_DATE);
  v_days_in_period := GREATEST(v_end_date - v_start_date, 1);

  RETURN QUERY
  WITH workspace_facilities AS (
    SELECT id FROM public.facilities WHERE workspace_id = p_workspace_id AND deleted_at IS NULL
  ),
  delivered_items AS (
    SELECT
      db.medication_type as prod_name,
      COALESCE(SUM(db.total_quantity), 0) as total_del
    FROM public.delivery_batches db
    WHERE db.workspace_id = p_workspace_id
      AND db.scheduled_date >= v_start_date
      AND db.scheduled_date <= v_end_date
      AND db.status IN ('completed', 'in_progress')
    GROUP BY db.medication_type
  ),
  current_inventory AS (
    SELECT
      fs.product_name as prod_name,
      SUM(fs.quantity) as current_qty,
      AVG(fs.quantity) as avg_stock_level
    FROM public.facility_stock fs
    WHERE fs.quantity > 0
      AND fs.facility_id IN (SELECT id FROM workspace_facilities)
    GROUP BY fs.product_name
  )
  SELECT
    COALESCE(di.prod_name, ci.prod_name)::TEXT,
    CASE
      WHEN ci.avg_stock_level > 0 THEN
        ROUND((COALESCE(di.total_del, 0)::NUMERIC / ci.avg_stock_level), 2)
      ELSE 0
    END as turnover,
    CASE
      WHEN di.total_del > 0 AND v_days_in_period > 0 THEN
        ROUND((COALESCE(ci.current_qty, 0)::NUMERIC / (di.total_del::NUMERIC / v_days_in_period)), 1)
      ELSE NULL
    END as days_supply,
    COALESCE(di.total_del, 0)::BIGINT,
    COALESCE(ci.current_qty, 0)::BIGINT
  FROM current_inventory ci
  LEFT JOIN delivered_items di ON ci.prod_name = di.prod_name
  WHERE COALESCE(di.prod_name, ci.prod_name) IS NOT NULL
  ORDER BY turnover DESC NULLS LAST;
END;
$$;

-- ===========================================================================
-- STEP 5: analytics.get_stock_by_zone with workspace isolation
-- ===========================================================================

CREATE OR REPLACE FUNCTION analytics.get_stock_by_zone(p_workspace_id UUID)
RETURNS TABLE (
  zone TEXT,
  total_products BIGINT,
  total_quantity BIGINT,
  facilities_count BIGINT,
  low_stock_facilities BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_low_stock_threshold INTEGER := 10;
BEGIN
  RETURN QUERY
  WITH zone_stock AS (
    SELECT
      f.service_zone,
      COUNT(DISTINCT fs.product_name) as products,
      COALESCE(SUM(fs.quantity), 0) as total_qty,
      COUNT(DISTINCT f.id) as facility_count
    FROM public.facilities f
    LEFT JOIN public.facility_stock fs ON f.id = fs.facility_id AND fs.quantity > 0
    WHERE f.workspace_id = p_workspace_id
      AND f.service_zone IS NOT NULL
      AND f.deleted_at IS NULL
    GROUP BY f.service_zone
  ),
  low_stock_by_zone AS (
    SELECT
      f.service_zone,
      COUNT(DISTINCT fs.facility_id) as low_stock_count
    FROM public.facility_stock fs
    JOIN public.facilities f ON fs.facility_id = f.id
    WHERE f.workspace_id = p_workspace_id
      AND fs.quantity > 0
      AND fs.quantity < v_low_stock_threshold
      AND f.service_zone IS NOT NULL
      AND f.deleted_at IS NULL
    GROUP BY f.service_zone
  )
  SELECT
    zs.service_zone::TEXT,
    COALESCE(zs.products, 0)::BIGINT,
    COALESCE(zs.total_qty, 0)::BIGINT,
    COALESCE(zs.facility_count, 0)::BIGINT,
    COALESCE(ls.low_stock_count, 0)::BIGINT
  FROM zone_stock zs
  LEFT JOIN low_stock_by_zone ls ON zs.service_zone = ls.service_zone
  WHERE zs.service_zone IS NOT NULL
  ORDER BY zs.service_zone;
END;
$$;

-- ===========================================================================
-- STEP 6: analytics.get_low_stock_alerts with workspace isolation
-- ===========================================================================

CREATE OR REPLACE FUNCTION analytics.get_low_stock_alerts(
  p_workspace_id UUID,
  p_threshold_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  facility_id UUID,
  facility_name TEXT,
  product_name TEXT,
  current_quantity BIGINT,
  avg_daily_consumption NUMERIC,
  days_remaining NUMERIC,
  alert_level TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH consumption AS (
    SELECT
      db.medication_type as product,
      unnest(db.facility_ids) as fac_id,
      AVG(db.total_quantity::NUMERIC / NULLIF(EXTRACT(EPOCH FROM (COALESCE(db.actual_end_time, NOW()) - db.actual_start_time)) / 86400, 0)) as avg_daily
    FROM public.delivery_batches db
    WHERE db.workspace_id = p_workspace_id
      AND db.status IN ('completed', 'in_progress')
      AND db.actual_start_time IS NOT NULL
      AND db.scheduled_date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY db.medication_type, fac_id
  ),
  stock_with_consumption AS (
    SELECT
      fs.facility_id,
      f.name as facility_name,
      fs.product_name,
      fs.quantity as current_qty,
      COALESCE(c.avg_daily, 0) as avg_daily_consumption,
      CASE
        WHEN COALESCE(c.avg_daily, 0) > 0 THEN
          ROUND(fs.quantity::NUMERIC / c.avg_daily, 1)
        ELSE NULL
      END as days_left
    FROM public.facility_stock fs
    JOIN public.facilities f ON fs.facility_id = f.id
    LEFT JOIN consumption c ON c.fac_id = fs.facility_id AND c.product = fs.product_name
    WHERE f.workspace_id = p_workspace_id
      AND f.deleted_at IS NULL
      AND fs.quantity >= 0
  )
  SELECT
    swc.facility_id,
    swc.facility_name::TEXT,
    swc.product_name::TEXT,
    swc.current_qty::BIGINT,
    ROUND(swc.avg_daily_consumption, 2),
    swc.days_left,
    CASE
      WHEN swc.current_qty = 0 THEN 'out_of_stock'
      WHEN swc.days_left IS NOT NULL AND swc.days_left <= p_threshold_days THEN 'critical'
      WHEN swc.current_qty < 10 THEN 'low'
      ELSE 'adequate'
    END as alert_level
  FROM stock_with_consumption swc
  WHERE swc.current_qty = 0
     OR swc.days_left <= p_threshold_days
     OR swc.current_qty < 10
  ORDER BY swc.current_qty ASC, swc.days_left ASC NULLS FIRST;
END;
$$;

-- ===========================================================================
-- STEP 7: Public wrapper functions with workspace_id
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.get_stock_status(workspace_id UUID)
RETURNS TABLE (
  total_products BIGINT, total_facilities_with_stock BIGINT,
  total_stock_items BIGINT, low_stock_count BIGINT, out_of_stock_count BIGINT
) AS $$
BEGIN
  IF NOT is_workspace_member_v2(workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;
  RETURN QUERY SELECT * FROM analytics.get_stock_status(workspace_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_stock_balance(
  workspace_id UUID,
  p_product_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  product_name TEXT, total_quantity BIGINT, allocated_quantity BIGINT,
  available_quantity BIGINT, facilities_count BIGINT
) AS $$
BEGIN
  IF NOT is_workspace_member_v2(workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;
  RETURN QUERY SELECT * FROM analytics.get_stock_balance(workspace_id, p_product_name);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_stock_performance(
  workspace_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  product_name TEXT, turnover_rate NUMERIC, avg_days_supply NUMERIC,
  total_delivered BIGINT, current_stock BIGINT
) AS $$
BEGIN
  IF NOT is_workspace_member_v2(workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;
  RETURN QUERY SELECT * FROM analytics.get_stock_performance(workspace_id, p_start_date, p_end_date);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_stock_by_zone(workspace_id UUID)
RETURNS TABLE (
  zone TEXT, total_products BIGINT, total_quantity BIGINT,
  facilities_count BIGINT, low_stock_facilities BIGINT
) AS $$
BEGIN
  IF NOT is_workspace_member_v2(workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;
  RETURN QUERY SELECT * FROM analytics.get_stock_by_zone(workspace_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_low_stock_alerts(
  workspace_id UUID,
  p_threshold_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  facility_id UUID, facility_name TEXT, product_name TEXT,
  current_quantity BIGINT, avg_daily_consumption NUMERIC,
  days_remaining NUMERIC, alert_level TEXT
) AS $$
BEGIN
  IF NOT is_workspace_member_v2(workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this workspace';
  END IF;
  RETURN QUERY SELECT * FROM analytics.get_low_stock_alerts(workspace_id, p_threshold_days);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ===========================================================================
-- STEP 8: Grant permissions (authenticated only — anon excluded)
-- ===========================================================================

GRANT EXECUTE ON FUNCTION analytics.get_stock_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION analytics.get_stock_balance(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION analytics.get_stock_performance(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION analytics.get_stock_by_zone(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION analytics.get_low_stock_alerts(UUID, INTEGER) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_stock_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stock_balance(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stock_performance(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stock_by_zone(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_low_stock_alerts(UUID, INTEGER) TO authenticated;

-- ===========================================================================
-- STEP 9: Add workspace_id to notifications table
-- ===========================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_notifications_workspace_id ON public.notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace_user ON public.notifications(workspace_id, user_id);

-- Backfill workspace_id from related entities
UPDATE public.notifications n
SET workspace_id = db.workspace_id
FROM public.delivery_batches db
WHERE n.related_entity_type = 'batch'
  AND n.related_entity_id = db.id::TEXT::UUID
  AND n.workspace_id IS NULL;

UPDATE public.notifications n
SET workspace_id = d.workspace_id
FROM public.drivers d
WHERE n.related_entity_type = 'driver'
  AND n.related_entity_id = d.id::TEXT::UUID
  AND n.workspace_id IS NULL;

UPDATE public.notifications n
SET workspace_id = v.workspace_id
FROM public.vehicles v
WHERE n.related_entity_type = 'vehicle'
  AND n.related_entity_id = v.id::TEXT::UUID
  AND n.workspace_id IS NULL;

UPDATE public.notifications n
SET workspace_id = f.workspace_id
FROM public.facilities f
WHERE n.related_entity_type = 'facility'
  AND n.related_entity_id = f.id::TEXT::UUID
  AND n.workspace_id IS NULL;

-- Update RLS to also scope by workspace when workspace_id is set
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;

CREATE POLICY "notifications_select_workspace"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND (workspace_id IS NULL OR is_workspace_member_v2(workspace_id))
  );

-- Tighten markAllAsRead — require user_id match
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;

CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND (workspace_id IS NULL OR is_workspace_member_v2(workspace_id))
  );

-- Fix get_route_efficiency: ROUND(double precision, integer) does not exist in PostgreSQL
-- Must cast to NUMERIC before calling ROUND with a precision argument.
-- total_distance and estimated_distance_km columns are FLOAT/double precision.

CREATE OR REPLACE FUNCTION analytics.get_route_efficiency(
  p_workspace_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  batch_id UUID,
  batch_name TEXT,
  vehicle_plate TEXT,
  estimated_distance_km DECIMAL,
  actual_distance_km DECIMAL,
  distance_variance_pct NUMERIC,
  estimated_duration_min INTEGER,
  actual_duration_min NUMERIC,
  duration_variance_pct NUMERIC,
  efficiency_rating TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH route_comparison AS (
    SELECT
      db.id AS batch_id,
      db.name AS batch_name,
      v.plate_number AS vehicle_plate,
      db.total_distance AS actual_dist,
      COALESCE(db.estimated_distance_km, db.total_distance) AS estimated_dist,
      db.estimated_duration AS estimated_dur,
      EXTRACT(EPOCH FROM (db.actual_end_time - db.actual_start_time)) / 60.0 AS actual_dur_min
    FROM public.delivery_batches db
    JOIN public.vehicles v ON db.vehicle_id = v.id
    WHERE db.workspace_id = p_workspace_id
      AND db.status = 'completed'
      AND db.actual_start_time IS NOT NULL
      AND db.actual_end_time IS NOT NULL
      AND db.estimated_duration IS NOT NULL
      AND (p_start_date IS NULL OR db.actual_end_time::DATE >= p_start_date)
      AND (p_end_date IS NULL OR db.actual_end_time::DATE <= p_end_date)
  )
  SELECT
    rc.batch_id,
    rc.batch_name,
    rc.vehicle_plate,
    rc.estimated_dist::DECIMAL,
    rc.actual_dist::DECIMAL,
    ROUND(((rc.actual_dist - rc.estimated_dist) / NULLIF(rc.estimated_dist, 0))::NUMERIC * 100, 2),
    rc.estimated_dur::INTEGER,
    ROUND(rc.actual_dur_min::NUMERIC, 2),
    ROUND(((rc.actual_dur_min - rc.estimated_dur) / NULLIF(rc.estimated_dur::NUMERIC, 0)) * 100, 2),
    CASE
      WHEN ABS((rc.actual_dur_min - rc.estimated_dur) / NULLIF(rc.estimated_dur::NUMERIC, 0)) <= 0.10 THEN 'Excellent'
      WHEN ABS((rc.actual_dur_min - rc.estimated_dur) / NULLIF(rc.estimated_dur::NUMERIC, 0)) <= 0.25 THEN 'Good'
      WHEN ABS((rc.actual_dur_min - rc.estimated_dur) / NULLIF(rc.estimated_dur::NUMERIC, 0)) <= 0.50 THEN 'Fair'
      ELSE 'Poor'
    END::TEXT
  FROM route_comparison rc
  ORDER BY ABS(ROUND(((rc.actual_dur_min - rc.estimated_dur) / NULLIF(rc.estimated_dur::NUMERIC, 0)) * 100, 2)) DESC NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_route_efficiency(
  workspace_id UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  batch_id UUID, batch_name TEXT, vehicle_plate TEXT,
  estimated_distance_km DECIMAL, actual_distance_km DECIMAL, distance_variance_pct NUMERIC,
  estimated_duration_min INTEGER, actual_duration_min NUMERIC,
  duration_variance_pct NUMERIC, efficiency_rating TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT * FROM analytics.get_route_efficiency(workspace_id, start_date, end_date);
END;
$$;

GRANT EXECUTE ON FUNCTION analytics.get_route_efficiency(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_route_efficiency(UUID, DATE, DATE) TO authenticated, anon;

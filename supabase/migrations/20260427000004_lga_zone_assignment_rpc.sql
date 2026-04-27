-- SECURITY DEFINER RPCs for assigning/unassigning LGAs to/from operational zones.
--
-- Direct UPDATE on admin_units is blocked by RLS when the LGA is a global
-- shared record (workspace_id IS NULL), because the update policy requires
-- admin_units.workspace_id = wm.workspace_id, and NULL never equals anything.
-- These RPCs bypass RLS while still enforcing that the caller is an owner/admin
-- of the workspace that owns the target zone.

CREATE OR REPLACE FUNCTION assign_lga_to_zone(
  p_lga_id  UUID,
  p_zone_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Caller must be owner/admin of the zone's workspace
  IF NOT EXISTS (
    SELECT 1
    FROM zones z
    JOIN workspace_members wm ON wm.workspace_id = z.workspace_id
    WHERE z.id = p_zone_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized to assign LGAs to this zone';
  END IF;

  UPDATE admin_units SET zone_id = p_zone_id WHERE id = p_lga_id;
END;
$$;

CREATE OR REPLACE FUNCTION unassign_lga_from_zone(
  p_lga_id  UUID,
  p_zone_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Caller must be owner/admin of the zone's workspace
  IF NOT EXISTS (
    SELECT 1
    FROM zones z
    JOIN workspace_members wm ON wm.workspace_id = z.workspace_id
    WHERE z.id = p_zone_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized to remove LGAs from this zone';
  END IF;

  UPDATE admin_units
  SET zone_id = NULL
  WHERE id = p_lga_id AND zone_id = p_zone_id;
END;
$$;

GRANT EXECUTE ON FUNCTION assign_lga_to_zone   TO authenticated;
GRANT EXECUTE ON FUNCTION unassign_lga_from_zone TO authenticated;

/**
 * useBatchSlotAssignments
 *
 * Manages slot assignment state for a batch + vehicle pair.
 * Handles load, save, and clear against the batch_slot_assignments table.
 *
 * Usage:
 *   const { assignments, loading, save, clear } = useBatchSlotAssignments({
 *     workspaceId,
 *     batchId,
 *     vehicleId,
 *   })
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { SlotAssignment } from '@/fleetops/payload/types';

// ─────────────────────────────────────────────────────────────────────────────
// DB row type (mirrors the migration schema)
// ─────────────────────────────────────────────────────────────────────────────

interface BatchSlotAssignmentRow {
  id: string;
  workspace_id: string;
  batch_id: string;
  vehicle_id: string;
  slot_key: string;
  tier_name: string;
  slot_number: number;
  facility_id: string;
  load_kg: number | null;
  load_volume_m3: number | null;
  sequence_order: number | null;
  status: 'assigned' | 'loaded' | 'removed';
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

interface UseBatchSlotAssignmentsOptions {
  workspaceId: string;
  batchId: string;
  vehicleId?: string;
}

interface UseBatchSlotAssignmentsResult {
  /** Persisted assignments for this batch (all vehicles, or filtered by vehicleId) */
  assignments: SlotAssignment[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  /** Upsert a full set of assignments for this batch + vehicle */
  save: (vehicleId: string, newAssignments: SlotAssignment[]) => Promise<void>;
  /** Remove all assignments for this batch + vehicle */
  clear: (vehicleId: string) => Promise<void>;
  /** Reload from DB */
  reload: () => void;
}

export function useBatchSlotAssignments({
  workspaceId,
  batchId,
  vehicleId,
}: UseBatchSlotAssignmentsOptions): UseBatchSlotAssignmentsResult {
  const [assignments, setAssignments] = useState<SlotAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // ── Fetch ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!workspaceId || !batchId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const run = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('batch_slot_assignments')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('batch_id', batchId)
        .neq('status', 'removed')
        .order('sequence_order', { ascending: true });

      if (vehicleId) {
        query = query.eq('vehicle_id', vehicleId);
      }

      const { data, error: fetchError } = await query;

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as BatchSlotAssignmentRow[];
      setAssignments(
        rows.map((row) => ({
          slot_key: row.slot_key,
          vehicle_id: row.vehicle_id,
          tier_name: row.tier_name,
          slot_number: row.slot_number,
          facility_id: row.facility_id,
          load_kg: row.load_kg ?? undefined,
          load_volume_m3: row.load_volume_m3 ?? undefined,
          sequence_order: row.sequence_order ?? undefined,
        })),
      );
      setLoading(false);
    };

    run();
    return () => { cancelled = true; };
  }, [workspaceId, batchId, vehicleId, reloadTrigger]);

  // ── Save (upsert) ───────────────────────────────────────────────────────

  const save = useCallback(
    async (vid: string, newAssignments: SlotAssignment[]) => {
      if (!workspaceId || !batchId) return;
      setSaving(true);
      setError(null);

      try {
        // Step 1: mark existing assignments for this vehicle as 'removed'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: removeError } = await (supabase as any)
          .from('batch_slot_assignments')
          .update({ status: 'removed' })
          .eq('workspace_id', workspaceId)
          .eq('batch_id', batchId)
          .eq('vehicle_id', vid);

        if (removeError) throw new Error(removeError.message);

        if (newAssignments.length === 0) {
          setSaving(false);
          setReloadTrigger((t) => t + 1);
          return;
        }

        // Step 2: insert new assignments
        const rows = newAssignments.map((a) => ({
          workspace_id: workspaceId,
          batch_id: batchId,
          vehicle_id: vid,
          slot_key: a.slot_key,
          tier_name: a.tier_name,
          slot_number: a.slot_number,
          facility_id: a.facility_id,
          load_kg: a.load_kg ?? null,
          load_volume_m3: a.load_volume_m3 ?? null,
          sequence_order: a.sequence_order ?? null,
          status: 'assigned' as const,
        }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (supabase as any)
          .from('batch_slot_assignments')
          .insert(rows);

        if (insertError) throw new Error(insertError.message);

        setReloadTrigger((t) => t + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save assignments');
      } finally {
        setSaving(false);
      }
    },
    [workspaceId, batchId],
  );

  // ── Clear ───────────────────────────────────────────────────────────────

  const clear = useCallback(
    async (vid: string) => {
      if (!workspaceId || !batchId) return;
      setSaving(true);
      setError(null);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: clearError } = await (supabase as any)
        .from('batch_slot_assignments')
        .update({ status: 'removed' })
        .eq('workspace_id', workspaceId)
        .eq('batch_id', batchId)
        .eq('vehicle_id', vid);

      setSaving(false);

      if (clearError) {
        setError(clearError.message);
      } else {
        setReloadTrigger((t) => t + 1);
      }
    },
    [workspaceId, batchId],
  );

  const reload = useCallback(() => setReloadTrigger((t) => t + 1), []);

  return { assignments, loading, saving, error, save, clear, reload };
}

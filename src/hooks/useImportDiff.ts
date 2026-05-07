/**
 * Hooks for the smart import diff system:
 * - Fetch existing DB records (fresh, no cache) for diff computation
 * - Bulk update matched records (facilities, items, program items)
 * - Persist import session + per-row log entries after commit
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';
import type { ImportDiffResult, DiffRecord, FieldDiff, DbRow } from '@/lib/import-diff';

// ─── Fetch hooks (staleTime: 0 — always fresh before import) ─────────────────

/** Returns raw DB snake_case rows — same format as buildDbFacility() output in the import dialogs */
export function useAllFacilitiesForDiff() {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ['facilities-for-diff', workspaceId],
    enabled: !!workspaceId,
    staleTime: 0,
    queryFn: async (): Promise<DbRow[]> => {
      const { data, error } = await supabase
        .from('facilities')
        .select([
          'id', 'name', 'address', 'lat', 'lng', 'type', 'phone', 'contact_person',
          'capacity', 'operating_hours', 'warehouse_code', 'state', 'ip_name',
          'funding_source', 'programme', 'ip_names', 'funding_sources', 'programmes',
          'pcr_service', 'cd4_service', 'type_of_service', 'service_zone',
          'level_of_care', 'lga', 'ward', 'contact_name_pharmacy', 'designation',
          'phone_pharmacy', 'email', 'storage_capacity', 'zone_id',
        ].join(', '))
        .eq('workspace_id', workspaceId!)
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      return (data || []) as DbRow[];
    },
  });
}

/** Returns raw DB snake_case rows — serial_number is the primary key field */
export function useAllItemsForDiff() {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ['items-for-diff', workspaceId],
    enabled: !!workspaceId,
    staleTime: 0,
    queryFn: async (): Promise<DbRow[]> => {
      const { data, error } = await supabase
        .from('items')
        .select([
          'id', 'serial_number', 'description', 'unit_pack', 'category', 'program',
          'weight_kg', 'volume_m3', 'batch_number', 'mfg_date', 'expiry_date',
          'store_address', 'lot_number', 'stock_on_hand', 'unit_price', 'warehouse_id',
        ].join(', '))
        .eq('workspace_id', workspaceId!)
        .order('description');
      if (error) throw error;
      return (data || []) as DbRow[];
    },
  });
}

/** Returns raw DB snake_case rows for items belonging to a specific program */
export function useAllProgramItemsForDiff(programCode: string | undefined) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ['program-items-for-diff', workspaceId, programCode],
    enabled: !!workspaceId && !!programCode,
    staleTime: 0,
    queryFn: async (): Promise<DbRow[]> => {
      const { data, error } = await supabase
        .from('items')
        .select([
          'id', 'serial_number', 'description', 'unit_pack',
          'category', 'stock_on_hand', 'unit_price', 'batch_number', 'expiry_date',
          'lot_number', 'weight_kg', 'volume_m3',
        ].join(', '))
        .eq('workspace_id', workspaceId!)
        .eq('program', programCode!)
        .order('description');
      if (error) throw error;
      return (data || []) as DbRow[];
    },
  });
}

// ─── Bulk update mutations ─────────────────────────────────────────────────────

const CONCURRENCY = 10;

async function batchUpdate(
  table: string,
  updates: Array<{ id: string; fields: Record<string, unknown> }>,
): Promise<{ successIds: string[]; errors: Array<{ id: string; message: string }> }> {
  const successIds: string[] = [];
  const errors: Array<{ id: string; message: string }> = [];

  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    const batch = updates.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(({ id, fields }) =>
        supabase.from(table).update(fields).eq('id', id).select('id').single()
      )
    );
    for (let j = 0; j < results.length; j++) {
      const { data, error } = results[j];
      if (error) errors.push({ id: batch[j].id, message: error.message });
      else if (data) successIds.push(data.id);
    }
  }
  return { successIds, errors };
}

export function useBulkUpdateFacilities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Array<{ id: string; fields: Record<string, unknown> }>) =>
      batchUpdate('facilities', updates),
    onSuccess: ({ successIds, errors }) => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      queryClient.invalidateQueries({ queryKey: ['facilities-for-diff'] });
      if (successIds.length) toast.success(`${successIds.length} facilities updated`);
      if (errors.length) toast.error(`${errors.length} facility updates failed`);
    },
    onError: (err: Error) => toast.error(`Facility update failed: ${err.message}`),
  });
}

export function useBulkUpdateItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Array<{ id: string; fields: Record<string, unknown> }>) =>
      batchUpdate('items', updates),
    onSuccess: ({ successIds, errors }) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['items-for-diff'] });
      if (successIds.length) toast.success(`${successIds.length} items updated`);
      if (errors.length) toast.error(`${errors.length} item updates failed`);
    },
    onError: (err: Error) => toast.error(`Item update failed: ${err.message}`),
  });
}

export function useBulkUpdateProgramItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Array<{ id: string; fields: Record<string, unknown> }>) =>
      batchUpdate('items', updates),
    onSuccess: ({ successIds, errors }) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['program-items-for-diff'] });
      if (successIds.length) toast.success(`${successIds.length} program items updated`);
      if (errors.length) toast.error(`${errors.length} program item updates failed`);
    },
    onError: (err: Error) => toast.error(`Program item update failed: ${err.message}`),
  });
}

// ─── Import session logging ───────────────────────────────────────────────────

export interface LogImportSessionInput {
  entityType: 'facility' | 'item' | 'program_item';
  sourceFile: string;
  diffResult: ImportDiffResult;
  selectedUpdateIds: Set<string>;
  commitResults: {
    insertedIds: string[];
    updatedIds: string[];
    errors: Array<{ rowNumber: number; message: string; dbId?: string }>;
  };
  getRecordName: (row: DbRow) => string;
  metadata?: Record<string, unknown>;
}

export function useLogImportSession() {
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (input: LogImportSessionInput): Promise<string> => {
      if (!workspaceId) throw new Error('No workspace');

      const { diffResult, selectedUpdateIds, commitResults, entityType, sourceFile, getRecordName, metadata } = input;
      const insertedIdSet = new Set(commitResults.insertedIds);
      const updatedIdSet = new Set(commitResults.updatedIds);
      const errorsByRow = new Map(commitResults.errors.map(e => [e.rowNumber, e.message]));

      // Tally summary counts
      const inserted = commitResults.insertedIds.length;
      const updated = commitResults.updatedIds.length;
      const skipped = diffResult.duplicateRecords.length +
        diffResult.updateRecords.filter(r => !selectedUpdateIds.has(r.dbId)).length;
      const failed = commitResults.errors.length;
      const total = diffResult.newRecords.length + diffResult.updateRecords.length + diffResult.duplicateRecords.length;
      const status: 'complete' | 'partial' | 'failed' =
        failed === total ? 'failed' : failed > 0 ? 'partial' : 'complete';

      // Create session row
      const { data: session, error: sessionError } = await supabase
        .from('import_sessions')
        .insert({
          workspace_id: workspaceId,
          entity_type: entityType,
          source_file: sourceFile,
          status,
          total_rows: total,
          inserted,
          updated,
          skipped,
          failed,
          metadata: metadata ?? {},
        })
        .select('id')
        .single();

      if (sessionError || !session) throw sessionError ?? new Error('Failed to create import session');

      // Build log entries
      const entries: object[] = [];
      let rowNum = 0;

      for (const row of diffResult.newRecords) {
        rowNum++;
        const err = errorsByRow.get(rowNum);
        entries.push({
          session_id: session.id,
          row_number: rowNum,
          outcome: err ? 'error' : 'inserted',
          record_name: getRecordName(row),
          raw_data: row as object,
          error_message: err ?? null,
        });
      }

      for (const rec of diffResult.updateRecords) {
        rowNum++;
        const isSelected = selectedUpdateIds.has(rec.dbId);
        const didUpdate = updatedIdSet.has(rec.dbId);
        const err = errorsByRow.get(rowNum);
        const hasConflicts = rec.fieldDiffs.some(d => d.kind === 'conflict');

        let outcome: string;
        if (!isSelected && hasConflicts) {
          outcome = 'conflict_pending';
        } else if (!isSelected) {
          outcome = 'skipped_by_user';
        } else if (err) {
          outcome = 'error';
        } else if (didUpdate) {
          outcome = 'updated';
        } else {
          outcome = 'error';
        }

        entries.push({
          session_id: session.id,
          row_number: rowNum,
          outcome,
          entity_id: rec.dbId ?? null,
          match_confidence: rec.matchConfidence,
          record_name: getRecordName(rec.uploadRow),
          raw_data: rec.uploadRow as object,
          field_diffs: rec.fieldDiffs as unknown as object,
          error_message: err ?? null,
        });
      }

      for (const rec of diffResult.duplicateRecords) {
        rowNum++;
        entries.push({
          session_id: session.id,
          row_number: rowNum,
          outcome: 'skipped_duplicate',
          entity_id: rec.dbId,
          match_confidence: rec.matchConfidence,
          record_name: getRecordName(rec.uploadRow),
          raw_data: rec.uploadRow as object,
        });
      }

      // Bulk insert log entries in chunks of 200
      for (let i = 0; i < entries.length; i += 200) {
        const chunk = entries.slice(i, i + 200);
        const { error } = await supabase.from('import_log_entries').insert(chunk);
        if (error) console.error('Failed to log import entries:', error);
      }

      return session.id;
    },
    onError: (err: Error) => console.error('Failed to log import session:', err),
  });
}


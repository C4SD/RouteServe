/**
 * Hooks for the Import Audit page:
 * - List import sessions (with filters)
 * - List log entries for a session
 * - Resolve conflict_pending entries (apply upload value to DB)
 * - Retry error entries
 * - Dismiss entries
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';
import type { FieldDiff } from '@/lib/import-diff';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImportOutcome =
  | 'inserted'
  | 'updated'
  | 'skipped_duplicate'
  | 'skipped_by_user'
  | 'conflict_pending'
  | 'error';

export interface ImportSession {
  id: string;
  workspace_id: string;
  created_by: string | null;
  created_at: string;
  entity_type: 'facility' | 'item' | 'program_item';
  source_file: string | null;
  status: 'complete' | 'partial' | 'failed';
  total_rows: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  metadata: Record<string, unknown>;
  // joined
  created_by_email?: string;
}

export interface ImportLogEntry {
  id: string;
  session_id: string;
  row_number: number;
  outcome: ImportOutcome;
  entity_id: string | null;
  match_confidence: 'exact_key' | 'fuzzy_name' | null;
  record_name: string | null;
  raw_data: Record<string, unknown> | null;
  field_diffs: FieldDiff[] | null;
  error_message: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface ImportSessionFilters {
  entityType?: 'facility' | 'item' | 'program_item';
  status?: 'complete' | 'partial' | 'failed';
  dateFrom?: string;
  dateTo?: string;
}

// ─── List sessions ────────────────────────────────────────────────────────────

export function useImportSessions(filters?: ImportSessionFilters) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['import-sessions', workspaceId, filters],
    enabled: !!workspaceId,
    queryFn: async (): Promise<ImportSession[]> => {
      let query = supabase
        .from('import_sessions')
        .select('*')
        .eq('workspace_id', workspaceId!)
        .order('created_at', { ascending: false });

      if (filters?.entityType) query = query.eq('entity_type', filters.entityType);
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.dateFrom) query = query.gte('created_at', filters.dateFrom);
      if (filters?.dateTo) query = query.lte('created_at', filters.dateTo);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ImportSession[];
    },
  });
}

// ─── List entries for a session ───────────────────────────────────────────────

export function useImportSessionEntries(
  sessionId: string | null,
  outcomeFilter?: ImportOutcome | 'all',
) {
  return useQuery({
    queryKey: ['import-log-entries', sessionId, outcomeFilter],
    enabled: !!sessionId,
    queryFn: async (): Promise<ImportLogEntry[]> => {
      let query = supabase
        .from('import_log_entries')
        .select('*')
        .eq('session_id', sessionId!)
        .order('row_number');

      if (outcomeFilter && outcomeFilter !== 'all') {
        query = query.eq('outcome', outcomeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ImportLogEntry[];
    },
  });
}

// Count of unresolved conflict_pending entries across the workspace (for badge)
export function usePendingConflictsCount() {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['import-pending-conflicts-count', workspaceId],
    enabled: !!workspaceId,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('import_log_entries')
        .select('id', { count: 'exact', head: true })
        .eq('outcome', 'conflict_pending')
        .is('resolved_at', null)
        .in('session_id', (
          await supabase
            .from('import_sessions')
            .select('id')
            .eq('workspace_id', workspaceId!)
        ).data?.map(s => s.id) ?? []);

      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60_000,
  });
}

// ─── Resolve a conflict_pending entry ─────────────────────────────────────────

export interface ResolveConflictInput {
  entry: ImportLogEntry;
  action: 'apply_upload' | 'keep_db';
  entityType: 'facility' | 'item' | 'program_item';
}

export function useResolveImportConflict() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entry, action, entityType }: ResolveConflictInput) => {
      if (!entry.entity_id) throw new Error('No entity ID on this log entry');
      if (!entry.field_diffs?.length) throw new Error('No field diffs to resolve');

      if (action === 'apply_upload') {
        // Build update object from conflict-kind field diffs
        const updates: Record<string, unknown> = {};
        for (const diff of entry.field_diffs) {
          if (diff.kind === 'conflict' || diff.kind === 'enrichment') {
            updates[diff.field] = diff.uploadValue;
          }
        }

        const table = entityType === 'facility' ? 'facilities' : 'items';
        const { error } = await supabase
          .from(table)
          .update(updates)
          .eq('id', entry.entity_id);
        if (error) throw error;
      }
      // For 'keep_db', no DB write needed — just mark resolved

      // Mark entry resolved
      const { error: logError } = await supabase
        .from('import_log_entries')
        .update({ resolved_at: new Date().toISOString() })
        .eq('id', entry.id);
      if (logError) throw logError;
    },
    onSuccess: (_, { action, entry }) => {
      queryClient.invalidateQueries({ queryKey: ['import-log-entries', entry.session_id] });
      queryClient.invalidateQueries({ queryKey: ['import-pending-conflicts-count'] });
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success(action === 'apply_upload' ? 'Upload value applied' : 'DB value kept');
    },
    onError: (err: Error) => toast.error(`Failed to resolve conflict: ${err.message}`),
  });
}

// ─── Apply a skipped_by_user entry ────────────────────────────────────────────

export function useApplySkippedEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entry, entityType }: { entry: ImportLogEntry; entityType: 'facility' | 'item' | 'program_item' }) => {
      if (!entry.entity_id) throw new Error('No entity ID');
      if (!entry.field_diffs?.length) throw new Error('No field diffs');

      const updates: Record<string, unknown> = {};
      for (const diff of entry.field_diffs) {
        if (diff.kind !== 'unchanged') updates[diff.field] = diff.uploadValue;
      }

      const table = entityType === 'facility' ? 'facilities' : 'items';
      const { error } = await supabase.from(table).update(updates).eq('id', entry.entity_id);
      if (error) throw error;

      const { error: logError } = await supabase
        .from('import_log_entries')
        .update({ outcome: 'updated', resolved_at: new Date().toISOString() })
        .eq('id', entry.id);
      if (logError) throw logError;
    },
    onSuccess: (_, { entry }) => {
      queryClient.invalidateQueries({ queryKey: ['import-log-entries', entry.session_id] });
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Changes applied');
    },
    onError: (err: Error) => toast.error(`Failed to apply: ${err.message}`),
  });
}

// ─── Retry an error entry ──────────────────────────────────────────────────────

export function useRetryImportEntry() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      entry,
      entityType,
    }: {
      entry: ImportLogEntry;
      entityType: 'facility' | 'item' | 'program_item';
    }) => {
      if (!entry.raw_data) throw new Error('No raw data to retry');

      const table = entityType === 'facility' ? 'facilities' : 'items';
      const { error } = await supabase
        .from(table)
        .insert({ ...entry.raw_data, workspace_id: workspaceId });
      if (error) throw error;

      // Mark the log entry as resolved (won't change outcome to 'inserted' since we'd need the new id)
      await supabase
        .from('import_log_entries')
        .update({ resolved_at: new Date().toISOString() })
        .eq('id', entry.id);
    },
    onSuccess: (_, { entry }) => {
      queryClient.invalidateQueries({ queryKey: ['import-log-entries', entry.session_id] });
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Row re-imported successfully');
    },
    onError: (err: Error) => toast.error(`Retry failed: ${err.message}`),
  });
}

// ─── Dismiss an entry (mark resolved without action) ─────────────────────────

export function useDismissImportEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('import_log_entries')
        .update({ resolved_at: new Date().toISOString() })
        .eq('id', entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-log-entries'] });
      queryClient.invalidateQueries({ queryKey: ['import-pending-conflicts-count'] });
    },
    onError: (err: Error) => toast.error(`Dismiss failed: ${err.message}`),
  });
}

/**
 * =====================================================
 * Dispatch Run Hooks
 * =====================================================
 * CRUD and state-machine transitions for dispatch_runs.
 * A dispatch_run is the live operational record for a
 * delivery_batch in execution.
 *
 * State machine:  pending → dispatched → in_transit → completed
 *                                      ↘ cancelled (from any pre-completed state)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import type {
  DispatchRun,
  DispatchRunStatus,
  CreateDispatchRunPayload,
  UpdateDispatchRunPayload,
  DISPATCH_RUN_TRANSITIONS,
} from '@/types/unified-workflow';
import { DISPATCH_RUN_TRANSITIONS as TRANSITIONS } from '@/types/unified-workflow';

// =====================================================
// QUERY KEY FACTORY
// =====================================================

export const dispatchRunKeys = {
  all:     ['dispatch-runs'] as const,
  lists:   () => [...dispatchRunKeys.all, 'list'] as const,
  list:    (filters?: object) => [...dispatchRunKeys.lists(), filters] as const,
  details: () => [...dispatchRunKeys.all, 'detail'] as const,
  detail:  (id: string, workspaceId?: string) => workspaceId ? [...dispatchRunKeys.details(), id, workspaceId] as const : [...dispatchRunKeys.details(), id] as const,
  byBatch: (batchId: string, workspaceId?: string) => workspaceId ? [...dispatchRunKeys.all, 'batch', batchId, workspaceId] as const : [...dispatchRunKeys.all, 'batch', batchId] as const,
};

// =====================================================
// LIST DISPATCH RUNS
// =====================================================

interface UseDispatchRunsOptions {
  status?: DispatchRunStatus | DispatchRunStatus[];
  batchId?: string;
  vehicleId?: string;
  driverId?: string;
  enabled?: boolean;
}

export function useDispatchRuns(options: UseDispatchRunsOptions = {}) {
  const { workspaceId } = useWorkspace();
  const { status, batchId, vehicleId, driverId, enabled = true } = options;

  return useQuery({
    queryKey: [...dispatchRunKeys.list({ status, batchId, vehicleId, driverId }), workspaceId],
    queryFn: async () => {
      let query = supabase
        .from('dispatch_runs')
        .select('*')
        .eq('workspace_id', workspaceId!)
        .order('created_at', { ascending: false });

      if (status) {
        const statuses = Array.isArray(status) ? status : [status];
        query = query.in('status', statuses);
      }
      if (batchId)   query = query.eq('batch_id', batchId);
      if (vehicleId) query = query.eq('vehicle_id', vehicleId);
      if (driverId)  query = query.eq('driver_id', driverId);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as DispatchRun[];
    },
    enabled: enabled && !!workspaceId,
    staleTime: 1000 * 30,
  });
}

// =====================================================
// SINGLE DISPATCH RUN
// =====================================================

export function useDispatchRun(id: string | null) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: dispatchRunKeys.detail(id || '', workspaceId ?? undefined),
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('dispatch_runs')
        .select('*')
        .eq('id', id)
        .eq('workspace_id', workspaceId!)
        .single();
      if (error) throw error;
      return data as DispatchRun;
    },
    enabled: !!id && !!workspaceId,
    staleTime: 1000 * 15,
  });
}

// =====================================================
// DISPATCH RUN FOR A SPECIFIC BATCH
// =====================================================

export function useDispatchRunForBatch(batchId: string | null) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: dispatchRunKeys.byBatch(batchId || '', workspaceId ?? undefined),
    queryFn: async () => {
      if (!batchId) return null;
      const { data, error } = await supabase
        .from('dispatch_runs')
        .select('*')
        .eq('batch_id', batchId)
        .eq('workspace_id', workspaceId!)
        .in('status', ['pending', 'dispatched', 'in_transit'])
        .maybeSingle();
      if (error) throw error;
      return data as DispatchRun | null;
    },
    enabled: !!batchId && !!workspaceId,
    staleTime: 1000 * 15,
  });
}

// =====================================================
// CREATE DISPATCH RUN
// =====================================================

export function useCreateDispatchRun() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (payload: CreateDispatchRunPayload) => {
      if (!workspaceId) throw new Error('No active workspace');

      const { data, error } = await supabase
        .from('dispatch_runs')
        .insert({
          workspace_id:    workspaceId,
          batch_id:        payload.batch_id,
          vehicle_id:      payload.vehicle_id ?? null,
          vehicle_ids:     payload.vehicle_ids ?? [],
          driver_id:       payload.driver_id ?? null,
          stops_total:     payload.stops_total ?? 0,
          stops_completed: 0,
          distance_km:     payload.distance_km ?? null,
          duration_min:    payload.duration_min ?? null,
          notes:           payload.notes ?? null,
          created_by:      user?.id ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as DispatchRun;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: dispatchRunKeys.lists() });
      queryClient.invalidateQueries({ queryKey: dispatchRunKeys.byBatch(data.batch_id) });
      toast.success('Dispatch run created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create dispatch run: ${error.message}`);
    },
  });
}

// =====================================================
// TRANSITION DISPATCH RUN STATUS
// =====================================================

export function useTransitionDispatchRun() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      id,
      to,
      cancelReason,
    }: {
      id: string;
      to: DispatchRunStatus;
      cancelReason?: string;
    }) => {
      // Fetch current state first to validate transition client-side
      const { data: current, error: fetchError } = await supabase
        .from('dispatch_runs')
        .select('status, batch_id')
        .eq('id', id)
        .eq('workspace_id', workspaceId!)
        .single();

      if (fetchError) throw fetchError;
      if (!current)   throw new Error('Dispatch run not found');

      const allowed = TRANSITIONS[current.status as DispatchRunStatus] ?? [];
      if (!allowed.includes(to)) {
        throw new Error(
          `Cannot transition dispatch run from "${current.status}" to "${to}"`
        );
      }

      const updates: UpdateDispatchRunPayload & { cancel_reason?: string } = { status: to };
      if (to === 'cancelled' && cancelReason) {
        updates.cancel_reason = cancelReason;
      }

      const { data, error } = await supabase
        .from('dispatch_runs')
        .update(updates)
        .eq('id', id)
        .eq('workspace_id', workspaceId!)
        .select()
        .single();

      if (error) throw error;
      return data as DispatchRun;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: dispatchRunKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: dispatchRunKeys.byBatch(data.batch_id) });
      queryClient.invalidateQueries({ queryKey: dispatchRunKeys.lists() });

      const labels: Record<DispatchRunStatus, string> = {
        pending:     'Run set to pending',
        dispatched:  'Run dispatched',
        in_transit:  'Run now in transit',
        completed:   'Run completed',
        cancelled:   'Run cancelled',
      };
      toast.success(labels[data.status]);
    },
    onError: (error: Error) => {
      toast.error(`Failed to transition run: ${error.message}`);
    },
  });
}

// =====================================================
// UPDATE PROGRESS (stops_completed, ETA)
// =====================================================

export function useUpdateDispatchRunProgress() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      id,
      stopsCompleted,
      estimatedArrival,
    }: {
      id: string;
      stopsCompleted: number;
      estimatedArrival?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('dispatch_runs')
        .update({
          stops_completed:  stopsCompleted,
          estimated_arrival: estimatedArrival ?? null,
        })
        .eq('id', id)
        .eq('workspace_id', workspaceId!)
        .select()
        .single();

      if (error) throw error;
      return data as DispatchRun;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: dispatchRunKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: dispatchRunKeys.byBatch(data.batch_id) });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update run progress: ${error.message}`);
    },
  });
}

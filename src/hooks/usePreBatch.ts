/**
 * =====================================================
 * Pre-Batch Data Hooks
 * =====================================================
 * Query and manage pre-batch records for the unified
 * scheduler-batch workflow.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type {
  PreBatch,
  PreBatchWithRelations,
  CreatePreBatchPayload,
  UpdatePreBatchPayload,
  PreBatchFilters,
  PreBatchStatus,
  ConvertPreBatchPayload,
} from '@/types/unified-workflow';
import type { CopilotPlan } from '@/types/scheduling-copilot';

// =====================================================
// QUERY KEY FACTORY
// =====================================================

export const preBatchKeys = {
  all: ['pre-batches'] as const,
  lists: () => [...preBatchKeys.all, 'list'] as const,
  list: (filters?: PreBatchFilters) => [...preBatchKeys.lists(), filters] as const,
  details: () => [...preBatchKeys.all, 'detail'] as const,
  detail: (id: string) => [...preBatchKeys.details(), id] as const,
  stats: () => [...preBatchKeys.all, 'stats'] as const,
};

// =====================================================
// QUERY PRE-BATCHES (LIST)
// =====================================================

interface UsePreBatchesOptions {
  filters?: PreBatchFilters;
  enabled?: boolean;
}

export function usePreBatches(options: UsePreBatchesOptions = {}) {
  const { filters, enabled = true } = options;
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: [...preBatchKeys.list(filters), workspaceId],
    queryFn: async () => {
      let query = supabase
        .from('scheduler_pre_batches')
        .select(`
          *,
          suggested_vehicle:vehicles!suggested_vehicle_id(id, model, plate_number, capacity, max_weight),
          converted_batch:delivery_batches!converted_batch_id(id, name, status)
        `)
        .eq('workspace_id', workspaceId!)
        .order('created_at', { ascending: false });

      if (filters) {
        if (filters.status && filters.status.length > 0) {
          query = query.in('status', filters.status);
        }
        if (filters.start_location_id) {
          query = query.eq('start_location_id', filters.start_location_id);
        }
        if (filters.planned_date_from) {
          query = query.gte('planned_date', filters.planned_date_from);
        }
        if (filters.planned_date_to) {
          query = query.lte('planned_date', filters.planned_date_to);
        }
        if (filters.created_by) {
          query = query.eq('created_by', filters.created_by);
        }
        if (filters.search) {
          query = query.ilike('schedule_title', `%${filters.search}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PreBatchWithRelations[];
    },
    enabled: enabled && !!workspaceId,
    staleTime: 1000 * 60,
  });
}

// =====================================================
// QUERY SINGLE PRE-BATCH
// =====================================================

interface UsePreBatchOptions {
  enabled?: boolean;
}

export function usePreBatch(id: string | null, options: UsePreBatchOptions = {}) {
  const { enabled = true } = options;
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: [...preBatchKeys.detail(id || ''), workspaceId],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('scheduler_pre_batches')
        .select(`
          *,
          suggested_vehicle:vehicles!suggested_vehicle_id(id, model, plate_number, capacity, max_weight),
          converted_batch:delivery_batches!converted_batch_id(id, name, status)
        `)
        .eq('id', id)
        .eq('workspace_id', workspaceId!)
        .single();

      if (error) throw error;
      return data as PreBatchWithRelations;
    },
    enabled: enabled && !!id && !!workspaceId,
    staleTime: 1000 * 60,
  });
}

// =====================================================
// CREATE PRE-BATCH
// =====================================================

export function useCreatePreBatch() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (payload: Omit<CreatePreBatchPayload, 'workspace_id' | 'created_by'>) => {
      if (!workspaceId) {
        throw new Error('No active workspace. Please select a workspace and try again.');
      }

      const normalizeUUID = (value: string | null | undefined): string | null => {
        if (!value || value === 'null' || value === 'undefined') return null;
        return value;
      };

      const normalizedPayload = {
        ...payload,
        start_location_id: normalizeUUID(payload.start_location_id) || '',
        suggested_vehicle_id: normalizeUUID(payload.suggested_vehicle_id),
      };

      if (!normalizedPayload.start_location_id) {
        throw new Error('Start location is required');
      }

      const { data, error } = await supabase
        .from('scheduler_pre_batches')
        .insert({
          ...normalizedPayload,
          workspace_id: workspaceId,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as PreBatch;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: preBatchKeys.lists() });
      toast.success('Schedule draft saved successfully');
      return data;
    },
    onError: (error: Error) => {
      console.error('Error creating pre-batch:', error);
      toast.error(`Failed to save schedule draft: ${error.message}`);
    },
  });
}

// =====================================================
// UPDATE PRE-BATCH
// =====================================================

export function useUpdatePreBatch() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdatePreBatchPayload }) => {
      const { data, error } = await supabase
        .from('scheduler_pre_batches')
        .update(updates)
        .eq('id', id)
        .eq('workspace_id', workspaceId!)
        .select()
        .single();

      if (error) throw error;
      return data as PreBatch;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: preBatchKeys.lists() });
      queryClient.invalidateQueries({ queryKey: preBatchKeys.detail(data.id) });
      toast.success('Schedule draft updated');
    },
    onError: (error: Error) => {
      console.error('Error updating pre-batch:', error);
      toast.error(`Failed to update schedule draft: ${error.message}`);
    },
  });
}

// =====================================================
// DELETE PRE-BATCH
// =====================================================

export function useDeletePreBatch() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduler_pre_batches')
        .delete()
        .eq('id', id)
        .eq('workspace_id', workspaceId!);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: preBatchKeys.lists() });
      toast.success('Schedule draft deleted');
    },
    onError: (error: Error) => {
      console.error('Error deleting pre-batch:', error);
      toast.error(`Failed to delete schedule draft: ${error.message}`);
    },
  });
}

// =====================================================
// UPDATE PRE-BATCH STATUS
// =====================================================

export function useUpdatePreBatchStatus() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      convertedBatchId,
    }: {
      id: string;
      status: PreBatchStatus;
      convertedBatchId?: string;
    }) => {
      const updates: UpdatePreBatchPayload = { status };
      if (convertedBatchId) {
        updates.converted_batch_id = convertedBatchId;
      }

      const { data, error } = await supabase
        .from('scheduler_pre_batches')
        .update(updates)
        .eq('id', id)
        .eq('workspace_id', workspaceId!)
        .select()
        .single();

      if (error) throw error;
      return data as PreBatch;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: preBatchKeys.lists() });
      queryClient.invalidateQueries({ queryKey: preBatchKeys.detail(data.id) });

      const statusMessages: Record<PreBatchStatus, string> = {
        draft: 'Schedule saved as draft',
        ready: 'Schedule marked as ready',
        converted: 'Schedule converted to batch',
        cancelled: 'Schedule cancelled',
      };
      toast.success(statusMessages[data.status]);
    },
    onError: (error: Error) => {
      console.error('Error updating pre-batch status:', error);
      toast.error(`Failed to update status: ${error.message}`);
    },
  });
}

// =====================================================
// CONVERT PRE-BATCH TO DELIVERY BATCH
// =====================================================

export function useConvertPreBatchToBatch() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (payload: ConvertPreBatchPayload) => {
      // ── 1. Fetch pre-batch ────────────────────────────────────────────────
      const { data: preBatch, error: fetchError } = await supabase
        .from('scheduler_pre_batches')
        .select('*')
        .eq('id', payload.preBatchId)
        .eq('workspace_id', workspaceId!)
        .single();

      if (fetchError) throw fetchError;
      if (!preBatch) throw new Error('Pre-batch not found');

      const normalizeUUID = (value: string | null | undefined): string | null => {
        if (!value || value === 'null' || value === 'undefined') return null;
        return value;
      };

      const vehicleId  = normalizeUUID(payload.vehicleId);
      const driverId   = normalizeUUID(payload.driverId);
      const warehouseId = normalizeUUID(preBatch.start_location_id);
      const preBatchId  = normalizeUUID(payload.preBatchId);

      if (!vehicleId)   throw new Error('At least one vehicle is required');
      if (!warehouseId) throw new Error('Start location (warehouse) is required');
      if (!preBatchId)  throw new Error('Pre-batch reference is required');

      // vehicle_ids: use full multi-vehicle list; fall back to single vehicleId
      const vehicleIds: string[] =
        payload.vehicleIds.length > 0 ? payload.vehicleIds : [vehicleId];

      // ── 2. Create delivery_batch ──────────────────────────────────────────
      const { data: batch, error: createError } = await supabase
        .from('delivery_batches')
        .insert({
          name:                 payload.batchName,
          workspace_id:         preBatch.workspace_id,
          warehouse_id:         warehouseId,
          facility_ids:         preBatch.facility_order,
          scheduled_date:       preBatch.planned_date,
          scheduled_time:       getTimeFromWindow(preBatch.time_window),
          vehicle_id:           vehicleId,
          vehicle_ids:          vehicleIds,
          driver_id:            driverId,
          status:               driverId ? 'assigned' : 'planned',
          priority:             payload.priority,
          pre_batch_id:         preBatchId,
          slot_assignments:     payload.slotAssignments,
          facility_packaging:   payload.facilityPackaging,
          optimized_route:      payload.optimizedRoute ?? [],
          total_distance:       payload.totalDistanceKm ?? 0,
          estimated_duration:   payload.estimatedDurationMin ?? 0,
          route_fallback_used:  payload.routeFallbackUsed ?? false,
          medication_type:      'Mixed',
          total_quantity:       preBatch.facility_order.length || 1,
          notes:                payload.notes ?? preBatch.notes ?? null,
        })
        .select()
        .single();

      if (createError) throw createError;

      // ── 3. Mark pre-batch converted (atomic with batch creation) ──────────
      const { error: preBatchUpdateError } = await supabase
        .from('scheduler_pre_batches')
        .update({
          status:             'converted',
          converted_batch_id: batch.id,
          facility_packaging: payload.facilityPackaging,
        })
        .eq('id', payload.preBatchId)
        .eq('workspace_id', workspaceId!);

      if (preBatchUpdateError) {
        // Best-effort rollback: delete the batch we just created
        await supabase.from('delivery_batches').delete().eq('id', batch.id).eq('workspace_id', workspaceId!);
        throw new Error(
          `Failed to update schedule status: ${preBatchUpdateError.message}. Batch creation rolled back.`
        );
      }

      // ── 4. Update requisitions — blocking, with rollback ──────────────────
      const requisitionMap = preBatch.facility_requisition_map as Record<string, string[]> | null;
      const facilityIds    = preBatch.facility_order as string[] | null;
      const allRequisitionIds = requisitionMap
        ? Object.values(requisitionMap).flat()
        : [];

      if (allRequisitionIds.length > 0) {
        const { error: reqError } = await supabase
          .from('requisitions')
          .update({
            status:               'assigned_to_batch',
            batch_id:             batch.id,
            assigned_to_batch_at: new Date().toISOString(),
            updated_at:           new Date().toISOString(),
          })
          .in('id', allRequisitionIds)
          .eq('workspace_id', preBatch.workspace_id);

        if (reqError) {
          // Rollback both batch and pre-batch update
          await Promise.all([
            supabase.from('delivery_batches').delete().eq('id', batch.id).eq('workspace_id', workspaceId!),
            supabase
              .from('scheduler_pre_batches')
              .update({ status: 'ready', converted_batch_id: null })
              .eq('id', payload.preBatchId)
              .eq('workspace_id', workspaceId!),
          ]);
          throw new Error(
            `Failed to assign requisitions to batch: ${reqError.message}. Batch creation rolled back.`
          );
        }
      } else if (facilityIds && facilityIds.length > 0) {
        // Fallback: no explicit requisition map — assign by facility
        const { error: reqError } = await supabase
          .from('requisitions')
          .update({
            status:               'assigned_to_batch',
            batch_id:             batch.id,
            assigned_to_batch_at: new Date().toISOString(),
            updated_at:           new Date().toISOString(),
          })
          .in('facility_id', facilityIds)
          .eq('status', 'ready_for_dispatch')
          .eq('workspace_id', preBatch.workspace_id);

        if (reqError) {
          await Promise.all([
            supabase.from('delivery_batches').delete().eq('id', batch.id).eq('workspace_id', workspaceId!),
            supabase
              .from('scheduler_pre_batches')
              .update({ status: 'ready', converted_batch_id: null })
              .eq('id', payload.preBatchId)
              .eq('workspace_id', workspaceId!),
          ]);
          throw new Error(
            `Failed to assign requisitions to batch: ${reqError.message}. Batch creation rolled back.`
          );
        }
      }

      // ── 5. Transition linked invoices → dispatched ─────────────────────────
      // Fetch invoice IDs from requisitions that were just assigned
      if (allRequisitionIds.length > 0) {
        const { data: linkedInvoices, error: invFetchError } = await supabase
          .from('invoices')
          .select('id')
          .in('requisition_id', allRequisitionIds)
          .eq('workspace_id', preBatch.workspace_id)
          .not('status', 'in', '("completed","cancelled")');

        if (!invFetchError && linkedInvoices && linkedInvoices.length > 0) {
          const invoiceIds = linkedInvoices.map((inv) => inv.id);

          // Update invoice status
          const { error: invUpdateError } = await supabase
            .from('invoices')
            .update({ status: 'dispatched', updated_at: new Date().toISOString() })
            .in('id', invoiceIds)
            .eq('workspace_id', preBatch.workspace_id);

          if (invUpdateError) {
            // Non-fatal: batch and requisitions are committed; log and surface warning
            console.error('Failed to transition invoice statuses to dispatched:', invUpdateError);
          } else {
            // Insert batch_invoice_links rows
            const linkRows = invoiceIds.map((invId: string) => ({
              workspace_id: preBatch.workspace_id,
              batch_id:     batch.id,
              invoice_id:   invId,
            }));
            const { error: linkError } = await supabase
              .from('batch_invoice_links')
              .insert(linkRows)
              .select();

            if (linkError) {
              console.error('Failed to create batch_invoice_links:', linkError);
            }
          }
        }
      }

      // ── 6. Create initial dispatch_run (pending) ───────────────────────────
      const { error: runError } = await supabase
        .from('dispatch_runs')
        .insert({
          workspace_id:  preBatch.workspace_id,
          batch_id:      batch.id,
          status:        'pending',
          vehicle_id:    vehicleId,
          vehicle_ids:   vehicleIds,
          driver_id:     driverId,
          stops_total:   preBatch.facility_order.length,
          stops_completed: 0,
          distance_km:   payload.totalDistanceKm ?? null,
          duration_min:  payload.estimatedDurationMin ?? null,
        });

      if (runError) {
        // Non-fatal: batch is fully created; dispatch_run can be recreated from batch
        console.error('Failed to create initial dispatch_run:', runError);
      }

      return batch;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: preBatchKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['delivery-batches'] });
      queryClient.invalidateQueries({ queryKey: ['ready-consignments'] });
      queryClient.invalidateQueries({ queryKey: ['requisitions'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dispatch-runs'] });
      toast.success('Batch created successfully');
      return data;
    },
    onError: (error: Error) => {
      console.error('Error converting pre-batch to batch:', error);
      toast.error(`Failed to create batch: ${error.message}`);
    },
  });
}

// =====================================================
// PRE-BATCH STATS
// =====================================================

export function usePreBatchStats() {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: [...preBatchKeys.stats(), workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduler_pre_batches')
        .select('status')
        .eq('workspace_id', workspaceId!);

      if (error) throw error;

      const stats = { total: data?.length || 0, draft: 0, ready: 0, converted: 0, cancelled: 0 };
      data?.forEach((item) => {
        if (item.status in stats) {
          stats[item.status as keyof typeof stats]++;
        }
      });

      return stats;
    },
    enabled: !!workspaceId,
    staleTime: 1000 * 30,
  });
}

// =====================================================
// SAVE COPILOT PLAN (creates one delivery_batch per dispatch run)
// =====================================================

export function useSaveCopilotPlan() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      plan,
      startLocationId,
      notes,
      facilityPackaging,
    }: {
      plan: CopilotPlan;
      startLocationId: string;
      notes?: string | null;
      facilityPackaging?: Record<string, unknown>;
    }) => {
      if (!workspaceId) throw new Error('No active workspace');

      const normalizeUUID = (v: string | null | undefined) =>
        !v || v === 'null' || v === 'undefined' ? null : v;

      const warehouseId = normalizeUUID(startLocationId);
      if (!warehouseId) throw new Error('Start location is required');

      const createdBatchIds: string[] = [];

      for (const run of plan.dispatch_runs) {
        const vehicleId = normalizeUUID(run.vehicle_id);
        if (!vehicleId) continue; // skip runs with no vehicle assigned

        const driverId = normalizeUUID(run.driver_id);
        const facilityIds = run.candidates.map((c) => c.facility_id);
        const requisitionMap = run.candidates.reduce(
          (acc, c) => {
            if (c.requisition_ids.length > 0) acc[c.facility_id] = c.requisition_ids;
            return acc;
          },
          {} as Record<string, string[]>
        );
        const allRequisitionIds = Object.values(requisitionMap).flat();

        const { data: batch, error: batchError } = await supabase
          .from('delivery_batches')
          .insert({
            name: `Copilot Run #${run.run_number} – ${run.planned_date}`,
            workspace_id: workspaceId,
            warehouse_id: warehouseId,
            facility_ids: facilityIds,
            scheduled_date: run.planned_date,
            scheduled_time: `${run.planned_departure}:00`,
            vehicle_id: vehicleId,
            vehicle_ids: [vehicleId],
            driver_id: driverId,
            status: driverId ? 'assigned' : 'planned',
            medication_type: 'Mixed',
            total_quantity: facilityIds.length || 1,
            notes: notes ?? null,
            facility_packaging: facilityPackaging ?? null,
          })
          .select()
          .single();

        if (batchError) throw batchError;
        createdBatchIds.push(batch.id);

        if (allRequisitionIds.length > 0) {
          const { error: reqError } = await supabase
            .from('requisitions')
            .update({
              status: 'assigned_to_batch',
              batch_id: batch.id,
              assigned_to_batch_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .in('id', allRequisitionIds)
            .eq('workspace_id', workspaceId);

          if (reqError) {
            console.error(`Failed to assign requisitions for run #${run.run_number}:`, reqError);
          }
        }

        const { error: runError } = await supabase.from('dispatch_runs').insert({
          workspace_id: workspaceId,
          batch_id: batch.id,
          status: 'pending',
          vehicle_id: vehicleId,
          vehicle_ids: [vehicleId],
          driver_id: driverId,
          stops_total: facilityIds.length,
          stops_completed: 0,
          distance_km: null,
          duration_min: Math.round(run.estimated_duration_hours * 60),
        });

        if (runError) {
          console.error(`Failed to create dispatch_run for run #${run.run_number}:`, runError);
        }
      }

      if (createdBatchIds.length === 0) {
        throw new Error(
          'No runs could be dispatched. Ensure at least one run has a vehicle assigned.'
        );
      }

      return createdBatchIds;
    },
    onSuccess: (batchIds) => {
      queryClient.invalidateQueries({ queryKey: preBatchKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['delivery-batches'] });
      queryClient.invalidateQueries({ queryKey: ['ready-consignments'] });
      queryClient.invalidateQueries({ queryKey: ['requisitions'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dispatch-runs'] });
      toast.success(
        `${batchIds.length} dispatch run${batchIds.length !== 1 ? 's' : ''} queued successfully`
      );
    },
    onError: (error: Error) => {
      console.error('Error saving copilot plan:', error);
      toast.error(`Failed to dispatch plan: ${error.message}`);
    },
  });
}

// =====================================================
// HELPERS
// =====================================================

function getTimeFromWindow(timeWindow: string | null): string {
  switch (timeWindow) {
    case 'morning':   return '08:00:00';
    case 'afternoon': return '13:00:00';
    case 'evening':   return '18:00:00';
    case 'all_day':
    default:          return '06:00:00';
  }
}

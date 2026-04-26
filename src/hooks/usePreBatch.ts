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
} from '@/types/unified-workflow';

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
      // Note: start_location_id has no FK to warehouses (polymorphic column),
      // so we cannot use PostgREST embedded selects for it.
      // suggested_vehicle_id and converted_batch_id have proper FKs.
      let query = supabase
        .from('scheduler_pre_batches')
        .select(`
          *,
          suggested_vehicle:vehicles!suggested_vehicle_id(id, model, plate_number, capacity, max_weight),
          converted_batch:delivery_batches!converted_batch_id(id, name, status)
        `)
        .eq('workspace_id', workspaceId!)
        .order('created_at', { ascending: false });

      // Apply filters
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
    staleTime: 1000 * 60, // 1 minute
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

  return useQuery({
    queryKey: preBatchKeys.detail(id || ''),
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
        .single();

      if (error) throw error;
      return data as PreBatchWithRelations;
    },
    enabled: enabled && !!id,
    staleTime: 1000 * 60, // 1 minute
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

      // Normalize UUIDs to ensure we send SQL NULL, not the string "null"
      const normalizeUUID = (value: string | null | undefined): string | null => {
        if (!value || value === 'null' || value === 'undefined') return null;
        return value;
      };

      const normalizedPayload = {
        ...payload,
        start_location_id: normalizeUUID(payload.start_location_id) || '',
        suggested_vehicle_id: normalizeUUID(payload.suggested_vehicle_id),
      };

      // Validate required fields
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

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: UpdatePreBatchPayload;
    }) => {
      const { data, error } = await supabase
        .from('scheduler_pre_batches')
        .update(updates)
        .eq('id', id)
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

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduler_pre_batches')
        .delete()
        .eq('id', id);

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

interface ConvertPreBatchPayload {
  preBatchId: string;
  batchName: string;
  vehicleId: string;
  driverId?: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  slotAssignments: Record<string, any>;
  optimizedRoute?: any[];
  totalDistanceKm?: number;
  estimatedDurationMin?: number;
  notes?: string | null;
}

export function useConvertPreBatchToBatch() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (payload: ConvertPreBatchPayload) => {
      // 1. Fetch the pre-batch
      const { data: preBatch, error: fetchError } = await supabase
        .from('scheduler_pre_batches')
        .select('*')
        .eq('id', payload.preBatchId)
        .single();

      if (fetchError) throw fetchError;
      if (!preBatch) throw new Error('Pre-batch not found');

      // 2. Create the delivery batch
      // Normalize UUIDs to ensure we send SQL NULL, not the string "null"
      const normalizeUUID = (value: string | null | undefined): string | null => {
        if (!value || value === 'null' || value === 'undefined') return null;
        return value;
      };

      const driverId = normalizeUUID(payload.driverId);
      const vehicleId = normalizeUUID(payload.vehicleId);
      const warehouseId = normalizeUUID(preBatch.start_location_id);
      const preBatchId = normalizeUUID(payload.preBatchId);

      // Validate required UUIDs
      if (!vehicleId) {
        throw new Error('Vehicle ID is required');
      }
      if (!warehouseId) {
        throw new Error('Warehouse ID is required');
      }
      if (!preBatchId) {
        throw new Error('Pre-batch ID is required');
      }

      const { data: batch, error: createError } = await supabase
        .from('delivery_batches')
        .insert({
          name: payload.batchName,
          workspace_id: preBatch.workspace_id,
          warehouse_id: warehouseId,
          facility_ids: preBatch.facility_order,
          scheduled_date: preBatch.planned_date,
          scheduled_time: getTimeFromWindow(preBatch.time_window),
          vehicle_id: vehicleId,
          driver_id: driverId,
          status: driverId ? 'assigned' : 'planned',
          priority: payload.priority,
          pre_batch_id: preBatchId,
          slot_assignments: payload.slotAssignments,
          // NOT NULL fields - provide defaults if missing
          optimized_route: payload.optimizedRoute || [],
          total_distance: payload.totalDistanceKm || 0,
          estimated_duration: payload.estimatedDurationMin || 0,
          medication_type: 'Mixed', // Default medication type
          total_quantity: preBatch.facility_order.length || 1, // Number of facilities as proxy
          notes: payload.notes || preBatch.notes || null,
        })
        .select()
        .single();

      if (createError) throw createError;

      // 3. Update pre-batch status to 'converted'
      const { error: updateError } = await supabase
        .from('scheduler_pre_batches')
        .update({
          status: 'converted',
          converted_batch_id: batch.id,
        })
        .eq('id', payload.preBatchId);

      if (updateError) throw updateError;

      // 4. Update requisition statuses from 'ready_for_dispatch' to 'assigned_to_batch'
      // so they no longer appear in "Available Facility Orders"
      const facilityIds = preBatch.facility_order as string[] | null;
      const requisitionMap = preBatch.facility_requisition_map as Record<string, string[]> | null;

      if (requisitionMap) {
        // Collect all requisition IDs from the facility-requisition map
        const allRequisitionIds = Object.values(requisitionMap).flat();
        if (allRequisitionIds.length > 0) {
          const { error: reqError } = await supabase
            .from('requisitions')
            .update({
              status: 'assigned_to_batch',
              batch_id: batch.id,
              assigned_to_batch_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .in('id', allRequisitionIds);

          if (reqError) {
            console.error('Failed to update requisition statuses:', reqError);
            // Non-blocking: batch was created successfully, log but don't throw
          }
        }
      } else if (facilityIds && facilityIds.length > 0) {
        // Fallback: update all ready_for_dispatch requisitions for these facilities
        const { error: reqError } = await supabase
          .from('requisitions')
          .update({
            status: 'assigned_to_batch',
            batch_id: batch.id,
            assigned_to_batch_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .in('facility_id', facilityIds)
          .eq('status', 'ready_for_dispatch');

        if (reqError) {
          console.error('Failed to update requisition statuses:', reqError);
        }
      }

      return batch;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: preBatchKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['delivery-batches'] });
      queryClient.invalidateQueries({ queryKey: ['ready-consignments'] });
      queryClient.invalidateQueries({ queryKey: ['requisitions'] });
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

      const stats = {
        total: data?.length || 0,
        draft: 0,
        ready: 0,
        converted: 0,
        cancelled: 0,
      };

      data?.forEach((item) => {
        if (item.status in stats) {
          stats[item.status as keyof typeof stats]++;
        }
      });

      return stats;
    },
    enabled: !!workspaceId,
    staleTime: 1000 * 30, // 30 seconds
  });
}

// =====================================================
// HELPERS
// =====================================================

function getTimeFromWindow(timeWindow: string | null): string {
  switch (timeWindow) {
    case 'morning':
      return '08:00:00';
    case 'afternoon':
      return '13:00:00';
    case 'evening':
      return '18:00:00';
    case 'all_day':
    default:
      return '06:00:00';
  }
}

/**
 * =====================================================
 * Publish to FleetOps Hook
 * =====================================================
 * Publishes scheduler batches to delivery_batches table for dispatch
 *
 * RFC-012: Vehicle and driver assignment is NO LONGER required for publishing.
 * Storefront publishes batches with status 'planned' (no assignment).
 * FleetOps is responsible for vehicle/driver assignment during batch planning.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SchedulerBatch } from '@/types/scheduler';
import { schedulerBatchesKeys } from './useSchedulerBatches';

interface PublishResult {
  scheduler_batch_id: string;
  delivery_batch_id: string;
  batch_code: string;
}

interface PublishError {
  scheduler_batch_id: string;
  error_message: string;
}

interface PublishResponse {
  success: boolean;
  published_batches: PublishResult[];
  errors: PublishError[];
}

/**
 * Publish scheduler batches to FleetOps (delivery_batches table)
 */
export function usePublishToFleetOps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scheduler_batch_ids: string[]): Promise<PublishResponse> => {
      const published_batches: PublishResult[] = [];
      const errors: PublishError[] = [];

      // Fetch all scheduler batches to publish
      const { data: schedulerBatches, error: fetchError } = await supabase
        .from('scheduler_batches')
        .select('*')
        .in('id', scheduler_batch_ids);

      if (fetchError) {
        throw new Error(`Failed to fetch batches: ${fetchError.message}`);
      }

      if (!schedulerBatches || schedulerBatches.length === 0) {
        throw new Error('No batches found to publish');
      }

      // Validate batches are ready to publish
      for (const batch of schedulerBatches as SchedulerBatch[]) {
        // RFC-012: Vehicle and driver are NO LONGER required for publishing
        // These are FleetOps responsibilities during batch planning
        // Storefront only validates facilities are present

        if (!batch.facility_ids || batch.facility_ids.length === 0) {
          errors.push({
            scheduler_batch_id: batch.id,
            error_message: 'Batch must have at least one facility',
          });
          continue;
        }

        // Check if already published
        if (batch.status === 'published') {
          errors.push({
            scheduler_batch_id: batch.id,
            error_message: 'Batch already published',
          });
          continue;
        }

        try {
          // Create delivery batch in FleetOps
          // RFC-012: driver_id and vehicle_id are null - FleetOps will assign during batch planning
          const { data: deliveryBatch, error: createError } = await supabase
            .from('delivery_batches')
            .insert([
              {
                name: batch.name || batch.batch_code,
                warehouse_id: batch.warehouse_id,
                scheduled_date: batch.planned_date,
                scheduled_time: batch.time_window,
                driver_id: null, // RFC-012: FleetOps responsibility
                vehicle_id: null, // RFC-012: FleetOps responsibility
                facility_ids: batch.facility_ids,
                optimized_route: batch.optimized_route || {},
                total_distance: batch.total_distance_km || 0,
                estimated_duration: batch.estimated_duration_min || 0,
                status: 'planned', // Set to planned in FleetOps, awaiting vehicle/driver
                priority: batch.priority,
                medication_type: null, // Can be enhanced later
                total_quantity: batch.total_consignments,
                payload_utilization_pct: batch.capacity_utilization_pct,
              },
            ])
            .select()
            .single();

          if (createError) {
            errors.push({
              scheduler_batch_id: batch.id,
              error_message: createError.message,
            });
            continue;
          }

          // Update scheduler batch to mark as published
          const { error: updateError } = await supabase
            .from('scheduler_batches')
            .update({
              status: 'published',
              published_batch_id: deliveryBatch.id,
              published_at: new Date().toISOString(),
            })
            .eq('id', batch.id);

          if (updateError) {
            // Rollback delivery batch creation
            await supabase.from('delivery_batches').delete().eq('id', deliveryBatch.id);

            errors.push({
              scheduler_batch_id: batch.id,
              error_message: `Failed to update scheduler batch: ${updateError.message}`,
            });
            continue;
          }

          // Success
          published_batches.push({
            scheduler_batch_id: batch.id,
            delivery_batch_id: deliveryBatch.id,
            batch_code: batch.batch_code,
          });
        } catch (error) {
          errors.push({
            scheduler_batch_id: batch.id,
            error_message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        success: errors.length === 0,
        published_batches,
        errors,
      };
    },

    onSuccess: (result) => {
      // Invalidate scheduler batches cache
      queryClient.invalidateQueries({ queryKey: schedulerBatchesKeys.lists() });

      // Invalidate delivery batches cache (FleetOps)
      queryClient.invalidateQueries({ queryKey: ['delivery-batches'] });

      // Show appropriate toast message
      if (result.success) {
        toast.success(
          `✅ ${result.published_batches.length} batch${result.published_batches.length > 1 ? 'es' : ''} published to FleetOps successfully!`,
          {
            description: 'Visible in FleetOps Tactical Map',
            duration: 5000,
          }
        );
      } else {
        const successCount = result.published_batches.length;
        const errorCount = result.errors.length;

        if (successCount > 0) {
          toast.warning(
            `⚠️ ${successCount} batch${successCount > 1 ? 'es' : ''} published, ${errorCount} failed`,
            {
              description: result.errors.map((e) => e.error_message).join(', '),
              duration: 7000,
            }
          );
        } else {
          toast.error('Failed to publish batches', {
            description: result.errors.map((e) => e.error_message).join(', '),
            duration: 7000,
          });
        }
      }
    },

    onError: (error: Error) => {
      toast.error('Failed to publish to FleetOps', {
        description: error.message,
        duration: 5000,
      });
    },
  });
}

/**
 * Publish a scheduler_pre_batch to FleetOps (delivery_batches table).
 *
 * Unlike usePublishToFleetOps (which targets the legacy scheduler_batches table),
 * this hook reads from scheduler_pre_batches — the data source used by the
 * storefront scheduler page.  It creates a delivery_batches row and writes the
 * resulting id back to scheduler_pre_batches.converted_batch_id so the status
 * mapping in mapPreBatchToSchedulerBatch can transition the row to 'published'.
 */
export function usePublishPreBatchToFleetOps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preBatchIds: string[]): Promise<PublishResponse> => {
      const published_batches: PublishResult[] = [];
      const errors: PublishError[] = [];

      const { data: preBatches, error: fetchError } = await supabase
        .from('scheduler_pre_batches')
        .select('*')
        .in('id', preBatchIds);

      if (fetchError) throw new Error(`Failed to fetch pre-batches: ${fetchError.message}`);
      if (!preBatches || preBatches.length === 0) throw new Error('No pre-batches found to publish');

      for (const pb of preBatches) {
        if (!pb.facility_order || pb.facility_order.length === 0) {
          errors.push({ scheduler_batch_id: pb.id, error_message: 'Pre-batch must have at least one facility' });
          continue;
        }

        if (pb.converted_batch_id) {
          errors.push({ scheduler_batch_id: pb.id, error_message: 'Pre-batch already published to FleetOps' });
          continue;
        }

        try {
          const scheduledTime =
            pb.time_window === 'morning' ? '08:00:00'
            : pb.time_window === 'afternoon' ? '13:00:00'
            : pb.time_window === 'evening' ? '18:00:00'
            : '06:00:00';

          const { data: deliveryBatch, error: createError } = await supabase
            .from('delivery_batches')
            .insert([{
              name: pb.schedule_title,
              workspace_id: pb.workspace_id,
              warehouse_id: pb.start_location_id,
              facility_ids: pb.facility_order,
              scheduled_date: pb.planned_date,
              scheduled_time: scheduledTime,
              vehicle_ids: (pb as any).suggested_vehicle_ids?.length
                ? (pb as any).suggested_vehicle_ids
                : pb.suggested_vehicle_id ? [pb.suggested_vehicle_id] : [],
              vehicle_id: (pb as any).suggested_vehicle_ids?.[0] ?? pb.suggested_vehicle_id ?? null,
              driver_id: null,
              status: 'planned',
              priority: 'medium',
              pre_batch_id: pb.id,
              optimized_route: [],
              total_distance: 0,
              estimated_duration: 0,
              medication_type: 'Mixed',
              total_quantity: pb.facility_order.length || 1,
              notes: pb.notes ?? null,
            }])
            .select()
            .single();

          if (createError) {
            errors.push({ scheduler_batch_id: pb.id, error_message: createError.message });
            continue;
          }

          const { error: updateError } = await supabase
            .from('scheduler_pre_batches')
            .update({ converted_batch_id: deliveryBatch.id })
            .eq('id', pb.id);

          if (updateError) {
            await supabase.from('delivery_batches').delete().eq('id', deliveryBatch.id);
            errors.push({ scheduler_batch_id: pb.id, error_message: `Failed to link delivery batch: ${updateError.message}` });
            continue;
          }

          published_batches.push({
            scheduler_batch_id: pb.id,
            delivery_batch_id: deliveryBatch.id,
            batch_code: pb.id.slice(0, 8).toUpperCase(),
          });
        } catch (error) {
          errors.push({ scheduler_batch_id: pb.id, error_message: error instanceof Error ? error.message : 'Unknown error' });
        }
      }

      return { success: errors.length === 0, published_batches, errors };
    },

    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['pre-batches'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-batches'] });

      if (result.success) {
        toast.success(
          `${result.published_batches.length} batch${result.published_batches.length > 1 ? 'es' : ''} published to FleetOps`,
          { description: 'Visible in FleetOps batch list', duration: 5000 }
        );
      } else {
        const successCount = result.published_batches.length;
        const errorCount = result.errors.length;
        if (successCount > 0) {
          toast.warning(`${successCount} published, ${errorCount} failed`, {
            description: result.errors.map(e => e.error_message).join(', '),
            duration: 7000,
          });
        } else {
          toast.error('Failed to publish batches', {
            description: result.errors.map(e => e.error_message).join(', '),
            duration: 7000,
          });
        }
      }
    },

    onError: (error: Error) => {
      toast.error('Failed to publish to FleetOps', { description: error.message, duration: 5000 });
    },
  });
}

/**
 * Unpublish a batch (move back from FleetOps to Scheduler)
 * Use with caution - only for batches not yet dispatched
 */
export function useUnpublishBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scheduler_batch_id: string) => {
      // Get scheduler batch
      const { data: schedulerBatch, error: fetchError } = await supabase
        .from('scheduler_batches')
        .select('*, published_batch_id')
        .eq('id', scheduler_batch_id)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch batch: ${fetchError.message}`);
      }

      if (!schedulerBatch.published_batch_id) {
        throw new Error('Batch not published');
      }

      // Check if delivery batch is still in 'planned' status
      const { data: deliveryBatch, error: deliveryError } = await supabase
        .from('delivery_batches')
        .select('status')
        .eq('id', schedulerBatch.published_batch_id)
        .single();

      if (deliveryError) {
        throw new Error('Delivery batch not found');
      }

      if (deliveryBatch.status !== 'planned') {
        throw new Error(`Cannot unpublish batch in status: ${deliveryBatch.status}`);
      }

      // Delete delivery batch
      const { error: deleteError } = await supabase
        .from('delivery_batches')
        .delete()
        .eq('id', schedulerBatch.published_batch_id);

      if (deleteError) {
        throw new Error(`Failed to delete delivery batch: ${deleteError.message}`);
      }

      // Update scheduler batch status
      const { error: updateError } = await supabase
        .from('scheduler_batches')
        .update({
          status: 'scheduled',
          published_batch_id: null,
          published_at: null,
        })
        .eq('id', scheduler_batch_id);

      if (updateError) {
        throw new Error(`Failed to update scheduler batch: ${updateError.message}`);
      }

      return schedulerBatch;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schedulerBatchesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['delivery-batches'] });
      toast.success('Batch unpublished successfully');
    },

    onError: (error: Error) => {
      toast.error('Failed to unpublish batch', {
        description: error.message,
      });
    },
  });
}

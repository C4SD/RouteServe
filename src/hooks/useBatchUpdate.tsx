import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DeliveryBatch } from '@/types';

export function useBatchUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ batchId, updates }: { batchId: string; updates: Partial<DeliveryBatch> & Record<string, any> }) => {
      const dbUpdates: any = {};

      // Map frontend fields to database fields
      if (updates.status) dbUpdates.status = updates.status;
      if (updates.driverId !== undefined) dbUpdates.driver_id = updates.driverId;
      if (updates.vehicleIds !== undefined) {
        dbUpdates.vehicle_ids = updates.vehicleIds;
        // keep vehicle_id in sync with first element for backward compat
        dbUpdates.vehicle_id = updates.vehicleIds[0] ?? null;
      } else if (updates.vehicleId !== undefined) {
        dbUpdates.vehicle_id = updates.vehicleId;
      }
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.priority) dbUpdates.priority = updates.priority;
      if (updates.actualStartTime) dbUpdates.actual_start_time = updates.actualStartTime;
      if (updates.actualEndTime) dbUpdates.actual_end_time = updates.actualEndTime;
      // Route optimization fields
      if (updates.optimized_route !== undefined) dbUpdates.optimized_route = updates.optimized_route;
      if (updates.facility_ids !== undefined) dbUpdates.facility_ids = updates.facility_ids;
      if (updates.total_distance !== undefined) dbUpdates.total_distance = updates.total_distance;
      if (updates.estimated_duration !== undefined) dbUpdates.estimated_duration = updates.estimated_duration;

      const { error } = await supabase
        .from('delivery_batches')
        .update(dbUpdates)
        .eq('id', batchId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-batches'] });
      toast.success('Batch updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update batch', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

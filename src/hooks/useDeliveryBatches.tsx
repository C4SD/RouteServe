import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DeliveryBatch, Facility } from '@/types';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { fetchProgramsForBatches } from '@/hooks/useBatchPrograms';

/**
 * Check if a batch has integrity based on RFC-012 requirements.
 * A batch has integrity if it has: vehicle(s), facilities, warehouse, and no slot overflow.
 */
function checkBatchHasIntegrity(
  batch: {
    vehicleIds?: string[];
    vehicleId?: string;
    facilities: Facility[];
    warehouseId?: string;
  },
  vehicleTotalSlots?: number
): boolean {
  const hasVehicle = (batch.vehicleIds && batch.vehicleIds.length > 0) || Boolean(batch.vehicleId);
  const hasFacilities = batch.facilities.length > 0;
  const hasWarehouse = Boolean(batch.warehouseId);

  // If vehicle has slot config, check for overflow
  const facilityCount = batch.facilities.length;
  const noSlotOverflow = vehicleTotalSlots === undefined || facilityCount <= vehicleTotalSlots;

  return hasVehicle && hasFacilities && hasWarehouse && noSlotOverflow;
}

export function useDeliveryBatches() {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['delivery-batches', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      // First, fetch all delivery batches with warehouse info
      // Use !warehouse_id to disambiguate: delivery_batches has two FKs to warehouses
      // (warehouse_id and dispatch_node_id), so PostgREST needs an explicit hint.
      const { data: batchesData, error: batchesError } = await supabase
        .from('delivery_batches')
        .select(`
          *,
          warehouse:warehouses!warehouse_id(name)
        `)
        .eq('workspace_id', workspaceId!)
        .order('scheduled_date', { ascending: false });

      if (batchesError) throw batchesError;

      // Collect all unique facility IDs from all batches
      const allFacilityIds = new Set<string>();
      batchesData.forEach(b => {
        if (b.facility_ids && Array.isArray(b.facility_ids)) {
          b.facility_ids.forEach((id: string) => allFacilityIds.add(id));
        }
      });

      // Fetch all facilities in one query if there are any
      let facilitiesMap: Record<string, Facility> = {};
      if (allFacilityIds.size > 0) {
        const { data: facilitiesData, error: facilitiesError } = await supabase
          .from('facilities')
          .select('*')
          .in('id', Array.from(allFacilityIds));

        if (facilitiesError) throw facilitiesError;

        // Create a map for quick lookup
        facilitiesData?.forEach(f => {
          facilitiesMap[f.id] = {
            id: f.id,
            name: f.name,
            address: f.address,
            lat: Number(f.lat),
            lng: Number(f.lng),
            type: f.type,
            phone: f.phone || undefined,
            contactPerson: f.contact_person || undefined,
            capacity: f.capacity || undefined,
            operatingHours: f.operating_hours || undefined,
            warehouse_code: f.warehouse_code || '',
            state: f.state || 'kano',
          };
        });
      }

      // Fetch distinct programs per batch from requisitions + invoices
      const batchIds = batchesData.map(b => b.id);
      const programsMap = await fetchProgramsForBatches(batchIds);

      // Map batches with their facilities
      return batchesData.map(b => {
        // Get facilities for this batch in the order they appear in facility_ids
        const batchFacilities: Facility[] = [];
        if (b.facility_ids && Array.isArray(b.facility_ids)) {
          b.facility_ids.forEach((id: string) => {
            if (facilitiesMap[id]) {
              batchFacilities.push(facilitiesMap[id]);
            }
          });
        }

        // Resolve vehicle_ids: prefer the array column, fall back to legacy vehicle_id
        const vehicleIds: string[] =
          (b as any).vehicle_ids?.length > 0
            ? (b as any).vehicle_ids
            : b.vehicle_id
            ? [b.vehicle_id]
            : [];

        // Build batch object for integrity check
        const batchData = {
          vehicleIds,
          vehicleId: vehicleIds[0],
          facilities: batchFacilities,
          warehouseId: b.warehouse_id,
        };

        return {
          id: b.id,
          name: b.name,
          facilities: batchFacilities,
          warehouseId: b.warehouse_id,
          warehouseName: b.warehouse?.name || '',
          driverId: b.driver_id || undefined,
          vehicleIds: vehicleIds.length > 0 ? vehicleIds : undefined,
          vehicleId: vehicleIds[0] || undefined,
          scheduledDate: b.scheduled_date,
          scheduledTime: b.scheduled_time,
          status: b.status as 'planned' | 'assigned' | 'in-progress' | 'completed' | 'cancelled',
          priority: b.priority as 'low' | 'medium' | 'high' | 'urgent',
          totalDistance: Number(b.total_distance),
          estimatedDuration: b.estimated_duration,
          actualStartTime: b.actual_start_time || undefined,
          actualEndTime: b.actual_end_time || undefined,
          medicationType: b.medication_type,
          totalQuantity: b.total_quantity,
          optimizedRoute: b.optimized_route
            ? (b.optimized_route as any[]).map((p: any) =>
                Array.isArray(p) ? p : [p.lng, p.lat]
              ) as [number, number][]
            : null,
          notes: b.notes || undefined,
          createdAt: b.created_at,
          // RFC-012: Batch integrity indicator
          hasIntegrity: checkBatchHasIntegrity(batchData),
          programs: programsMap[b.id] ?? [],
        };
      }) as DeliveryBatch[];
    }
  });
}

export function useCreateDeliveryBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batch: Omit<DeliveryBatch, 'id' | 'createdAt'>) => {
      const { data, error } = await supabase
        .from('delivery_batches')
        .insert({
          name: batch.name,
          warehouse_id: batch.warehouseId,
          driver_id: batch.driverId,
          vehicle_ids: batch.vehicleIds ?? (batch.vehicleId ? [batch.vehicleId] : []),
          vehicle_id: batch.vehicleIds?.[0] ?? batch.vehicleId ?? null,
          scheduled_date: batch.scheduledDate,
          scheduled_time: batch.scheduledTime,
          status: batch.status,
          priority: batch.priority,
          total_distance: batch.totalDistance,
          estimated_duration: batch.estimatedDuration,
          actual_start_time: batch.actualStartTime,
          actual_end_time: batch.actualEndTime,
          // NOTE: medication_type and total_quantity removed per RFC-012
          // These are derived from requisitions, not set at batch creation
          optimized_route: batch.optimizedRoute,
          facility_ids: batch.facilities.map(f => f.id),
          notes: batch.notes
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-batches'] });
      toast.success('Delivery batch created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create batch: ${error.message}`);
    }
  });
}

export function useDeleteDeliveryBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batchId: string) => {
      const { error } = await supabase
        .from('delivery_batches')
        .delete()
        .eq('id', batchId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-batches'] });
      toast.success('Batch deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete batch: ${error.message}`);
    }
  });
}

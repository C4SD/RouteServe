/**
 * =====================================================
 * useReadyConsignments Hook
 * =====================================================
 * Fetches requisitions with status='ready_for_dispatch'
 * and groups them by facility for the unified workflow.
 *
 * Returns FacilityCandidate[] with actual requisition_ids,
 * slot_demand, and weight_kg from packaging data.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { FacilityCandidate } from '@/components/unified-workflow/schedule/SourceOfTruthColumn';

export function useReadyConsignments() {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['ready-consignments', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      // Fetch requisitions ready for dispatch with their packaging and facility data
      const { data: requisitions, error } = await supabase
        .from('requisitions')
        .select(`
          id,
          facility_id,
          facilities!inner (
            id,
            name,
            warehouse_code,
            lga,
            service_zone,
            lat,
            lng
          ),
          requisition_packaging (
            rounded_slot_demand,
            total_weight_kg,
            total_volume_m3
          )
        `)
        .eq('workspace_id', workspaceId!)
        .eq('status', 'ready_for_dispatch')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching ready consignments:', error);
        throw error;
      }

      if (!requisitions || requisitions.length === 0) {
        return [];
      }

      // Group requisitions by facility_id
      const facilityMap = new Map<string, {
        facility: any;
        requisition_ids: string[];
        total_slot_demand: number;
        total_weight_kg: number;
        total_volume_m3: number;
      }>();

      requisitions.forEach((req: any) => {
        const facilityId = req.facility_id;
        const packaging = req.requisition_packaging?.[0];

        if (!facilityMap.has(facilityId)) {
          facilityMap.set(facilityId, {
            facility: req.facilities,
            requisition_ids: [],
            total_slot_demand: 0,
            total_weight_kg: 0,
            total_volume_m3: 0,
          });
        }

        const entry = facilityMap.get(facilityId)!;
        entry.requisition_ids.push(req.id);

        // Aggregate packaging data
        if (packaging) {
          entry.total_slot_demand += packaging.rounded_slot_demand || 0;
          entry.total_weight_kg += packaging.total_weight_kg || 0;
          entry.total_volume_m3 += packaging.total_volume_m3 || 0;
        } else {
          // Fallback: if no packaging data, assume 1 slot per requisition
          entry.total_slot_demand += 1;
        }
      });

      // Transform to FacilityCandidate[]
      const candidates: FacilityCandidate[] = Array.from(facilityMap.entries()).map(
        ([facilityId, entry]) => ({
          id: facilityId,
          name: entry.facility.name,
          code: entry.facility.warehouse_code,
          lga: entry.facility.lga,
          zone: entry.facility.service_zone,
          lat: entry.facility.lat,
          lng: entry.facility.lng,
          requisition_ids: entry.requisition_ids,
          slot_demand: Math.ceil(entry.total_slot_demand),
          weight_kg: entry.total_weight_kg,
          volume_m3: entry.total_volume_m3,
        })
      );

      return candidates;
    },
  });
}

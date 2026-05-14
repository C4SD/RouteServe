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
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          id,
          facility_id,
          status,
          total_weight_kg,
          total_volume_m3,
          facilities!inner (
            id,
            name,
            warehouse_code,
            lga,
            service_zone,
            lat,
            lng
          ),
          invoice_packaging (
            total_packages
          )
        `)
        .eq('workspace_id', workspaceId!)
        .in('status', ['ready', 'packaged'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!invoices || invoices.length === 0) return [];

      // Group by facility
      const facilityMap = new Map<string, {
        facility: any;
        invoice_ids: string[];
        total_slot_demand: number;
        total_weight_kg: number;
        total_volume_m3: number;
      }>();

      for (const inv of invoices) {
        if (!facilityMap.has(inv.facility_id)) {
          facilityMap.set(inv.facility_id, {
            facility: inv.facilities,
            invoice_ids: [],
            total_slot_demand: 0,
            total_weight_kg: 0,
            total_volume_m3: 0,
          });
        }
        const entry = facilityMap.get(inv.facility_id)!;
        entry.invoice_ids.push(inv.id);

        const pkgRow = Array.isArray(inv.invoice_packaging)
          ? inv.invoice_packaging[0]
          : inv.invoice_packaging;
        entry.total_slot_demand += pkgRow?.total_packages ?? 1;
        if (inv.total_weight_kg) entry.total_weight_kg += Number(inv.total_weight_kg);
        if (inv.total_volume_m3) entry.total_volume_m3 += Number(inv.total_volume_m3);
      }

      return Array.from(facilityMap.entries()).map(([facilityId, entry]) => ({
        id: facilityId,
        name: entry.facility.name,
        code: entry.facility.warehouse_code,
        lga: entry.facility.lga,
        zone: entry.facility.service_zone,
        lat: entry.facility.lat,
        lng: entry.facility.lng,
        requisition_ids: entry.invoice_ids,
        slot_demand: Math.max(1, Math.ceil(entry.total_slot_demand)),
        weight_kg: entry.total_weight_kg || undefined,
        volume_m3: entry.total_volume_m3 || undefined,
      } satisfies FacilityCandidate));
    },
  });
}

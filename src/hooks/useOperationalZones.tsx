import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  OperationalZone,
  CreateZoneInput,
  UpdateZoneInput,
  ZoneSummary
} from '@/types/zones';
import { toast } from 'sonner';

export function useOperationalZones(options?: { enabled?: boolean }) {
  const { workspaceId } = useWorkspace();

  const query = useQuery({
    queryKey: ['operational-zones', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zones' as any)
        .select('*')
        .eq('workspace_id', workspaceId!)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      return data as unknown as OperationalZone[];
    },
    enabled: (options?.enabled ?? true) && !!workspaceId,
  });

  // Expose `zones` and `loading` aliases for backward-compatible destructuring
  return Object.assign(query, {
    zones: query.data ?? [] as OperationalZone[],
    loading: query.isLoading,
  });
}

export function useOperationalZone(zoneId: string | null) {
  return useQuery({
    queryKey: ['operational-zone', zoneId],
    queryFn: async () => {
      if (!zoneId) return null;
      
      const { data, error } = await supabase
        .from('zones' as any)
        .select('*')
        .eq('id', zoneId)
        .single();

      if (error) throw error;
      return data as unknown as OperationalZone;
    },
    enabled: !!zoneId,
  });
}

export function useZoneMetrics() {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['zone-metrics', workspaceId],
    queryFn: async () => {
      const { data: zones, error: zonesError } = await supabase
        .from('zones' as any)
        .select('*')
        .eq('workspace_id', workspaceId!);

      if (zonesError) throw zonesError;

      const { count: totalFacilities } = await supabase
        .from('facilities')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId!)
        .is('deleted_at', null);

      let totalLGAs = 0;
      try {
        const { count } = await supabase
          .from('admin_units')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId!)
          .eq('admin_level', 6)
          .eq('is_active', true);
        totalLGAs = count ?? 0;
      } catch {
        // fallback if query fails
      }

      return {
        totalZones: zones?.length || 0,
        activeZones: zones?.filter((z: any) => z.is_active).length || 0,
        totalFacilities: totalFacilities || 0,
        totalLGAs,
      };
    },
    enabled: !!workspaceId,
  });
}

export function useZoneSummary(zoneId: string | null) {
  return useQuery({
    queryKey: ['zone-summary', zoneId],
    queryFn: async () => {
      if (!zoneId) return null;

      // Helper to safely run a count query — returns 0 if the column doesn't exist (400)
      const safeCount = async (query: Promise<{ count: number | null; error: any }>) => {
        const res = await query;
        if (res.error) return 0;
        return res.count || 0;
      };

      const [facilityCount, fleetCount, lgaCount] = await Promise.all([
        safeCount(
          supabase
            .from('facilities')
            .select('id', { count: 'exact', head: true })
            .eq('zone_id', zoneId)
            .is('deleted_at', null)
        ),
        safeCount(
          supabase
            .from('fleets' as any)
            .select('id', { count: 'exact', head: true })
            .eq('zone_id', zoneId)
        ),
        safeCount(
          supabase
            .from('admin_units')
            .select('id', { count: 'exact', head: true })
            .eq('zone_id', zoneId)
            .eq('admin_level', 6) // LGA level
            .eq('is_active', true)
        ),
      ]);

      return {
        warehouse_count: 0, // warehouses table has no zone_id column
        lga_count: lgaCount,
        facility_count: facilityCount,
        fleet_count: fleetCount,
        active_dispatches: 0,
      } as ZoneSummary;
    },
    enabled: !!zoneId,
  });
}

export function useCreateZone() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (input: CreateZoneInput) => {
      if (!workspaceId) throw new Error('No workspace selected');

      const { data, error } = await supabase
        .from('zones' as any)
        .insert([{
          name: input.name,
          code: input.code,
          description: input.description,
          region_center: input.region_center,
          zone_manager_id: input.zone_manager_id,
          is_active: input.is_active ?? true,
          metadata: input.metadata ?? {},
          workspace_id: workspaceId,
        }])
        .select()
        .single();

      if (error) throw error;
      return data as unknown as OperationalZone;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational-zones'] });
      queryClient.invalidateQueries({ queryKey: ['zone-metrics'] });
      toast.success('Zone created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create zone: ${error.message}`);
    },
  });
}

export function useUpdateZone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateZoneInput) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from('zones' as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as OperationalZone;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['operational-zones'] });
      queryClient.invalidateQueries({ queryKey: ['operational-zone', data.id] });
      queryClient.invalidateQueries({ queryKey: ['zone-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['zone-summary', data.id] });
      toast.success('Zone updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update zone: ${error.message}`);
    },
  });
}

export function useDeleteZone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (zoneId: string) => {
      const { error } = await supabase
        .from('zones' as any)
        .delete()
        .eq('id', zoneId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational-zones'] });
      queryClient.invalidateQueries({ queryKey: ['zone-metrics'] });
      toast.success('Zone deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete zone: ${error.message}`);
    },
  });
}

export function useReassignWarehouseToZone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ warehouseId, zoneId }: { warehouseId: string; zoneId: string }) => {
      const { data, error } = await supabase.rpc('reassign_warehouse_to_zone' as any, {
        warehouse_uuid: warehouseId,
        new_zone_uuid: zoneId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      queryClient.invalidateQueries({ queryKey: ['zone-metrics'] });
      toast.success('Warehouse reassigned to zone successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to reassign warehouse: ${error.message}`);
    },
  });
}

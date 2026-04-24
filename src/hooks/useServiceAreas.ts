import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  ServiceArea,
  ServiceAreaFacility,
  CreateServiceAreaInput,
  UpdateServiceAreaInput,
} from '@/types/service-areas';
import { toast } from 'sonner';

export interface ServiceAreaFilters {
  zone_id?: string;
  warehouse_id?: string;
  service_type?: string;
  is_active?: boolean;
  search?: string;
}

/**
 * Fetch all service areas with optional filters, resolving related names separately
 * to avoid PostgREST schema cache issues with embedded selects.
 */
export function useServiceAreas(filters?: ServiceAreaFilters) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['service-areas', workspaceId, filters],
    enabled: !!workspaceId,
    queryFn: async () => {
      let query = supabase
        .from('service_areas')
        .select('*')
        .eq('workspace_id', workspaceId!)
        .order('name', { ascending: true });

      if (filters?.zone_id) {
        query = query.eq('zone_id', filters.zone_id);
      }
      if (filters?.warehouse_id) {
        query = query.eq('warehouse_id', filters.warehouse_id);
      }
      if (filters?.service_type) {
        query = query.eq('service_type', filters.service_type);
      }
      if (filters?.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }
      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw new Error(`Failed to fetch service areas: ${error.message}`);

      const serviceAreas = (data || []) as unknown as ServiceArea[];
      if (serviceAreas.length === 0) return serviceAreas;

      // Collect unique FK IDs
      const zoneIds = [...new Set(serviceAreas.map(sa => sa.zone_id).filter(Boolean))];
      const whIds = [...new Set(serviceAreas.map(sa => sa.warehouse_id).filter(Boolean))];
      const saIds = serviceAreas.map(sa => sa.id);

      // Batch-fetch related data in parallel
      const [zonesRes, whRes, facRes] = await Promise.all([
        zoneIds.length > 0
          ? supabase.from('zones').select('id, name, code').in('id', zoneIds)
          : { data: [] },
        whIds.length > 0
          ? supabase.from('warehouses').select('id, name, lat, lng').in('id', whIds)
          : { data: [] },
        supabase.from('service_area_facilities').select('service_area_id').in('service_area_id', saIds),
      ]);

      const zoneMap = new Map((zonesRes.data || []).map(z => [z.id, z]));
      const whMap = new Map((whRes.data || []).map(w => [w.id, w]));

      const countMap: Record<string, number> = {};
      (facRes.data || []).forEach(f => {
        countMap[f.service_area_id] = (countMap[f.service_area_id] || 0) + 1;
      });

      serviceAreas.forEach(sa => {
        sa.zones = zoneMap.get(sa.zone_id) || null;
        sa.warehouses = whMap.get(sa.warehouse_id) || null;
        sa.facility_count = countMap[sa.id] || 0;
      });

      return serviceAreas;
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch a single service area by ID
 */
export function useServiceArea(id: string | null | undefined) {
  return useQuery({
    queryKey: ['service-area', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('service_areas')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw new Error(`Failed to fetch service area: ${error.message}`);

      const sa = data as unknown as ServiceArea;

      const [zoneRes, whRes] = await Promise.all([
        sa.zone_id
          ? supabase.from('zones').select('id, name, code').eq('id', sa.zone_id).single()
          : { data: null },
        sa.warehouse_id
          ? supabase.from('warehouses').select('id, name, lat, lng').eq('id', sa.warehouse_id).single()
          : { data: null },
      ]);

      sa.zones = zoneRes.data || null;
      sa.warehouses = whRes.data || null;

      return sa;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch facilities assigned to a service area
 */
export function useServiceAreaFacilities(serviceAreaId: string | null | undefined) {
  return useQuery({
    queryKey: ['service-area-facilities', serviceAreaId],
    queryFn: async () => {
      if (!serviceAreaId) return [];

      const { data, error } = await supabase
        .from('service_area_facilities')
        .select('*')
        .eq('service_area_id', serviceAreaId);

      if (error) throw new Error(`Failed to fetch service area facilities: ${error.message}`);

      const saFacilities = (data || []) as unknown as ServiceAreaFacility[];
      if (saFacilities.length === 0) return saFacilities;

      const facilityIds = [...new Set(saFacilities.map(f => f.facility_id))];
      const CHUNK_SIZE = 100;
      const chunks = Array.from({ length: Math.ceil(facilityIds.length / CHUNK_SIZE) }, (_, i) =>
        facilityIds.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
      );
      const facilityResults = await Promise.all(
        chunks.map(chunk =>
          supabase.from('facilities').select('id, name, lat, lng, type, level_of_care, lga').in('id', chunk)
        )
      );
      const facilities = facilityResults.flatMap(r => r.data || []);

      const facilityMap = new Map((facilities || []).map(f => [f.id, f]));
      saFacilities.forEach(saf => {
        saf.facilities = facilityMap.get(saf.facility_id) || null;
      });

      return saFacilities;
    },
    enabled: !!serviceAreaId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Create a new service area with facility assignments
 */
export function useCreateServiceArea() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (input: CreateServiceAreaInput) => {
      if (!workspaceId) throw new Error('No workspace selected');

      const { facility_ids, ...serviceAreaData } = input;

      // Insert service area
      const { data: sa, error: saError } = await supabase
        .from('service_areas')
        .insert([{ ...serviceAreaData, workspace_id: workspaceId }])
        .select()
        .single();

      if (saError) throw saError;

      // Bulk insert facility assignments
      if (facility_ids.length > 0) {
        const assignments = facility_ids.map(fid => ({
          service_area_id: sa.id,
          facility_id: fid,
        }));

        const { error: facError } = await supabase
          .from('service_area_facilities')
          .insert(assignments);

        if (facError) throw facError;
      }

      return sa as unknown as ServiceArea;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-areas'] });
      queryClient.invalidateQueries({ queryKey: ['service-area-facilities'] });
      toast.success('Service area created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create service area: ${error.message}`);
    },
  });
}

/**
 * Update a service area
 */
export function useUpdateServiceArea() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateServiceAreaInput) => {
      const { id, ...updates } = input;

      const { data, error } = await supabase
        .from('service_areas')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as ServiceArea;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['service-areas'] });
      queryClient.invalidateQueries({ queryKey: ['service-area', data.id] });
      toast.success('Service area updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update service area: ${error.message}`);
    },
  });
}

/**
 * Delete a service area (cascades to facility assignments)
 */
export function useDeleteServiceArea() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('service_areas')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-areas'] });
      queryClient.invalidateQueries({ queryKey: ['service-area-facilities'] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast.success('Service area deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete service area: ${error.message}`);
    },
  });
}

/**
 * Assign facilities to a service area (replace all assignments)
 */
export function useAssignFacilitiesToServiceArea() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ serviceAreaId, facilityIds }: { serviceAreaId: string; facilityIds: string[] }) => {
      // Remove existing assignments
      const { error: deleteError } = await supabase
        .from('service_area_facilities')
        .delete()
        .eq('service_area_id', serviceAreaId);

      if (deleteError) throw deleteError;

      // Insert new assignments
      if (facilityIds.length > 0) {
        const assignments = facilityIds.map(fid => ({
          service_area_id: serviceAreaId,
          facility_id: fid,
        }));

        const { error: insertError } = await supabase
          .from('service_area_facilities')
          .insert(assignments);

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-areas'] });
      queryClient.invalidateQueries({ queryKey: ['service-area-facilities'] });
      toast.success('Facility assignments updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to assign facilities: ${error.message}`);
    },
  });
}

/**
 * Aggregate metrics across all service areas
 */
export function useServiceAreaMetrics() {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['service-area-metrics', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const [areasResult, facilityCountResult, routesResult] = await Promise.all([
        supabase.from('service_areas').select('id, priority, max_distance_km, is_active').eq('workspace_id', workspaceId!),
        supabase.from('service_area_facilities').select('*', { count: 'exact', head: true }),
        supabase.from('routes').select('total_distance_km, is_sandbox').eq('workspace_id', workspaceId!).eq('is_sandbox', false),
      ]);

      if (areasResult.error) throw areasResult.error;

      const areas = areasResult.data;
      const facilityCount = facilityCountResult.count;
      const routes = routesResult.data || [];

      const activeAreas = areas?.filter(a => a.is_active) || [];
      const criticalCount = areas?.filter(a => a.priority === 'critical').length || 0;

      // Use actual route distances; fall back to max_distance_km configs
      const routeDistances = routes
        .map(r => r.total_distance_km)
        .filter(Boolean) as number[];
      const configDistances = areas
        ?.map(a => a.max_distance_km)
        .filter(Boolean) as number[];

      const distances = routeDistances.length > 0 ? routeDistances : configDistances;
      const avgDistance = distances.length > 0
        ? distances.reduce((s, d) => s + d, 0) / distances.length
        : 0;

      return {
        totalServiceAreas: areas?.length || 0,
        activeServiceAreas: activeAreas.length,
        facilitiesCovered: facilityCount || 0,
        criticalCount,
        avgDistance: Math.round(avgDistance * 10) / 10,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

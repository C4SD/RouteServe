import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  Route,
  RouteFacility,
  CreateRouteInput,
  RoutePolicyMetadata,
} from '@/types/routes';
import { useServicePolicyDetail } from '@/hooks/useServicePolicies';
import { toast } from 'sonner';

export interface RouteFilters {
  zone_id?: string;
  service_area_id?: string;
  status?: string;
  is_sandbox?: boolean;
  search?: string;
}

/**
 * Fetch all routes with optional filters, resolving related names separately
 * to avoid PostgREST schema cache issues with embedded selects.
 */
export function useRoutes(filters?: RouteFilters) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['routes', workspaceId, filters],
    enabled: !!workspaceId,
    queryFn: async () => {
      let query = supabase
        .from('routes')
        .select('*')
        .eq('workspace_id', workspaceId!)
        .order('created_at', { ascending: false });

      if (filters?.zone_id) {
        query = query.eq('zone_id', filters.zone_id);
      }
      if (filters?.service_area_id) {
        query = query.eq('service_area_id', filters.service_area_id);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.is_sandbox !== undefined) {
        query = query.eq('is_sandbox', filters.is_sandbox);
      }
      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw new Error(`Failed to fetch routes: ${error.message}`);

      const routes = (data || []) as unknown as Route[];
      if (routes.length === 0) return routes;

      // Collect unique FK IDs
      const zoneIds = [...new Set(routes.map(r => r.zone_id).filter(Boolean))];
      const saIds = [...new Set(routes.map(r => r.service_area_id).filter(Boolean))];
      const whIds = [...new Set(routes.map(r => r.warehouse_id).filter(Boolean))];
      const routeIds = routes.map(r => r.id);

      // Batch-fetch related data in parallel
      const [zonesRes, saRes, whRes, facRes] = await Promise.all([
        zoneIds.length > 0
          ? supabase.from('zones').select('id, name').in('id', zoneIds)
          : { data: [] },
        saIds.length > 0
          ? supabase.from('service_areas').select('id, name').in('id', saIds)
          : { data: [] },
        whIds.length > 0
          ? supabase.from('warehouses').select('id, name, lat, lng').in('id', whIds)
          : { data: [] },
        supabase.from('route_facilities').select('route_id').in('route_id', routeIds),
      ]);

      // Build lookup maps
      const zoneMap = new Map((zonesRes.data || []).map(z => [z.id, z]));
      const saMap = new Map((saRes.data || []).map(s => [s.id, s]));
      const whMap = new Map((whRes.data || []).map(w => [w.id, w]));

      const facCountMap: Record<string, number> = {};
      (facRes.data || []).forEach(f => {
        facCountMap[f.route_id] = (facCountMap[f.route_id] || 0) + 1;
      });

      // Enrich routes
      routes.forEach(r => {
        r.zones = zoneMap.get(r.zone_id) || null;
        r.service_areas = saMap.get(r.service_area_id) || null;
        r.warehouses = whMap.get(r.warehouse_id) || null;
        r.facility_count = facCountMap[r.id] || 0;
        // Extract policy metadata from JSON for service_policy routes
        if (r.creation_mode === 'service_policy' && r.metadata?.service_policy_id) {
          r.policy_metadata = r.metadata as RoutePolicyMetadata;
        }
      });

      return routes;
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch a single route by ID with full details
 */
export function useRoute(id: string | null | undefined) {
  return useQuery({
    queryKey: ['route', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw new Error(`Failed to fetch route: ${error.message}`);

      const route = data as unknown as Route;

      // Resolve related names in parallel
      const [zoneRes, saRes, whRes] = await Promise.all([
        route.zone_id
          ? supabase.from('zones').select('id, name').eq('id', route.zone_id).single()
          : { data: null },
        route.service_area_id
          ? supabase.from('service_areas').select('id, name').eq('id', route.service_area_id).single()
          : { data: null },
        route.warehouse_id
          ? supabase.from('warehouses').select('id, name, lat, lng').eq('id', route.warehouse_id).single()
          : { data: null },
      ]);

      route.zones = zoneRes.data || null;
      route.service_areas = saRes.data || null;
      route.warehouses = whRes.data || null;
      if (route.creation_mode === 'service_policy' && route.metadata?.service_policy_id) {
        route.policy_metadata = route.metadata as RoutePolicyMetadata;
      }

      return route;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch ordered facilities for a route
 */
export function useRouteFacilities(routeId: string | null | undefined) {
  return useQuery({
    queryKey: ['route-facilities', routeId],
    queryFn: async () => {
      if (!routeId) return [];

      const { data, error } = await supabase
        .from('route_facilities')
        .select('*')
        .eq('route_id', routeId)
        .order('sequence_order', { ascending: true });

      if (error) throw new Error(`Failed to fetch route facilities: ${error.message}`);

      const routeFacilities = (data || []) as unknown as RouteFacility[];
      if (routeFacilities.length === 0) return routeFacilities;

      // Fetch facility details separately
      const facilityIds = [...new Set(routeFacilities.map(rf => rf.facility_id))];
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
      routeFacilities.forEach(rf => {
        rf.facilities = facilityMap.get(rf.facility_id) || null;
      });

      return routeFacilities;
    },
    enabled: !!routeId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Create a new route with facility sequence
 */
export function useCreateRoute() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (input: CreateRouteInput) => {
      if (!workspaceId) throw new Error('No workspace selected');

      const { facility_ids, facility_distances, total_distance_km, estimated_duration_min, optimized_geometry, metadata, ...routeData } = input;
      const routePayload = {
        ...routeData,
        ...(total_distance_km != null && { total_distance_km }),
        ...(estimated_duration_min != null && { estimated_duration_min }),
        ...(optimized_geometry != null && { optimized_geometry }),
        ...(metadata != null && { metadata }),
        workspace_id: workspaceId,
      };

      // Insert route
      const { data: route, error: routeError } = await supabase
        .from('routes')
        .insert([routePayload])
        .select()
        .single();

      if (routeError) throw routeError;

      // Insert route facilities with sequence order
      if (facility_ids.length > 0) {
        const routeFacilities = facility_ids.map((fid, idx) => ({
          route_id: route.id,
          facility_id: fid,
          sequence_order: idx + 1,
          ...(facility_distances?.[idx] != null && { distance_from_previous_km: facility_distances[idx] }),
        }));

        const { error: facError } = await supabase
          .from('route_facilities')
          .insert(routeFacilities);

        if (facError) throw facError;
      }

      return route as unknown as Route;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['route-facilities'] });
      queryClient.invalidateQueries({ queryKey: ['route-metrics'] });
      toast.success('Route created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create route: ${error.message}`);
    },
  });
}

/**
 * Update a route (will fail for locked routes via DB trigger)
 */
export function useUpdateRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Route> }) => {
      const { data: result, error } = await supabase
        .from('routes')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result as unknown as Route;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['route', data.id] });
      toast.success('Route updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update route: ${error.message}`);
    },
  });
}

/**
 * Lock a route (makes it immutable)
 */
export function useLockRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('routes')
        .update({
          status: 'locked',
          locked_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Route;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['route', data.id] });
      toast.success('Route locked successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to lock route: ${error.message}`);
    },
  });
}

/**
 * Delete a route (will fail for locked routes via DB trigger)
 */
export function useDeleteRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('routes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['route-facilities'] });
      queryClient.invalidateQueries({ queryKey: ['route-metrics'] });
      toast.success('Route deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete route: ${error.message}`);
    },
  });
}

/**
 * Detect whether a service_policy route is out of sync with its source policy cluster.
 * Returns mismatch details only for routes created from a Service Policy.
 */
export function useRoutePolicySync(route: Route | null) {
  const isServicePolicy = route?.creation_mode === 'service_policy';
  const policyId = isServicePolicy ? (route?.metadata?.service_policy_id as string | null) : null;
  const clusterCode = isServicePolicy ? (route?.metadata?.cluster_code as string | null) : null;

  const policyDetailQuery = useServicePolicyDetail(policyId ?? null);
  const routeFacilitiesQuery = useRouteFacilities(isServicePolicy ? (route?.id ?? null) : null);

  const syncResult = useMemo(() => {
    if (!isServicePolicy) return { isOutOfSync: false, added: [] as string[], removed: [] as string[] };
    if (!policyDetailQuery.data || !routeFacilitiesQuery.data) return null;

    const cluster = policyDetailQuery.data.clusters.find(c => c.code === clusterCode);
    if (!cluster) return { isOutOfSync: false, added: [] as string[], removed: [] as string[] };

    const currentFacilityIds = new Set(
      (cluster.facilities ?? []).map(pcf => pcf.facility_id),
    );
    const routeFacilityIds = new Set(
      routeFacilitiesQuery.data.map(rf => rf.facility_id),
    );

    const added = [...currentFacilityIds].filter(id => !routeFacilityIds.has(id));
    const removed = [...routeFacilityIds].filter(id => !currentFacilityIds.has(id));

    return { isOutOfSync: added.length > 0 || removed.length > 0, added, removed };
  }, [isServicePolicy, policyDetailQuery.data, routeFacilitiesQuery.data, clusterCode]);

  return {
    isServicePolicy,
    syncResult,
    isLoading: policyDetailQuery.isLoading || routeFacilitiesQuery.isLoading,
    policyName: policyDetailQuery.data?.policy?.name ?? null,
    clusterCode,
  };
}

/**
 * Aggregate metrics across all routes
 */
export function useRouteMetrics() {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['route-metrics', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data: routes, error } = await supabase
        .from('routes')
        .select('id, status, total_distance_km, is_sandbox')
        .eq('workspace_id', workspaceId!);

      if (error) throw error;

      const production = routes?.filter(r => !r.is_sandbox) || [];
      const sandbox = routes?.filter(r => r.is_sandbox) || [];
      const activeRoutes = production.filter(r => r.status === 'active');
      const lockedRoutes = production.filter(r => r.status === 'locked');
      const distances = production
        .map(r => r.total_distance_km)
        .filter(Boolean) as number[];
      const totalDistance = distances.reduce((s, d) => s + d, 0);

      return {
        totalRoutes: production.length,
        activeRoutes: activeRoutes.length,
        lockedRoutes: lockedRoutes.length,
        sandboxRoutes: sandbox.length,
        totalDistanceKm: Math.round(totalDistance * 10) / 10,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

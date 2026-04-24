import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';
import {
  ServicePolicy,
  PolicyCluster,
  PolicyClusterFacility,
  CreateServicePolicyInput,
  ClusterDraft,
  ClusterAnomaly,
  PolicyConstraints,
  ClusteringMode,
} from '@/types/service-policies';

// ─── Fetch ────────────────────────────────────────────────────────────────────

export function useServicePolicies(serviceAreaId: string | null | undefined) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['service-policies', serviceAreaId],
    enabled: !!serviceAreaId && !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_policies')
        .select('*')
        .eq('service_area_id', serviceAreaId!)
        .eq('workspace_id', workspaceId!)
        .order('created_at', { ascending: false });

      if (error) throw new Error(`Failed to fetch service policies: ${error.message}`);

      const policies = (data || []) as unknown as ServicePolicy[];
      if (policies.length === 0) return policies;

      const policyIds = policies.map(p => p.id);

      // Count clusters + facilities per policy
      const [clusterRes, facilityRes] = await Promise.all([
        supabase
          .from('policy_clusters')
          .select('id, service_policy_id, facility_count')
          .in('service_policy_id', policyIds),
        supabase
          .from('policy_clusters')
          .select('service_policy_id, facility_count')
          .in('service_policy_id', policyIds),
      ]);

      const clusterCounts: Record<string, number> = {};
      const facilityCounts: Record<string, number> = {};
      (clusterRes.data || []).forEach(c => {
        clusterCounts[c.service_policy_id] = (clusterCounts[c.service_policy_id] || 0) + 1;
        facilityCounts[c.service_policy_id] = (facilityCounts[c.service_policy_id] || 0) + (c.facility_count || 0);
      });

      policies.forEach(p => {
        p.cluster_count = clusterCounts[p.id] || 0;
        p.facility_count = facilityCounts[p.id] || 0;
      });

      return policies;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useServicePolicyDetail(policyId: string | null | undefined) {
  return useQuery({
    queryKey: ['service-policy', policyId],
    enabled: !!policyId,
    queryFn: async () => {
      if (!policyId) return null;

      const { data: policyData, error: policyError } = await supabase
        .from('service_policies')
        .select('*')
        .eq('id', policyId)
        .single();

      if (policyError) throw new Error(policyError.message);

      const policy = policyData as unknown as ServicePolicy;

      // Fetch clusters
      const { data: clustersData, error: clustersError } = await supabase
        .from('policy_clusters')
        .select('*')
        .eq('service_policy_id', policyId)
        .order('sort_order', { ascending: true });

      if (clustersError) throw new Error(clustersError.message);

      const clusters = (clustersData || []) as unknown as PolicyCluster[];

      if (clusters.length === 0) return { policy, clusters: [] };

      const clusterIds = clusters.map(c => c.id);

      // Fetch cluster → facility assignments
      const { data: pcfData, error: pcfError } = await supabase
        .from('policy_cluster_facilities')
        .select('*')
        .in('cluster_id', clusterIds);

      if (pcfError) throw new Error(pcfError.message);

      const pcfs = (pcfData || []) as unknown as PolicyClusterFacility[];

      // Fetch facility details in chunks to avoid URL length limits
      const facilityIds = [...new Set(pcfs.map(f => f.facility_id))];
      const CHUNK_SIZE = 100;
      const chunks: string[][] = [];
      for (let i = 0; i < facilityIds.length; i += CHUNK_SIZE) {
        chunks.push(facilityIds.slice(i, i + CHUNK_SIZE));
      }
      const chunkResults = await Promise.all(
        chunks.map(ids =>
          supabase.from('facilities').select('id, name, lat, lng, type, level_of_care, lga').in('id', ids)
        )
      );
      const facilitiesRes = { data: chunkResults.flatMap(r => r.data || []) };

      const facMap = new Map((facilitiesRes.data || []).map(f => [f.id, f]));
      pcfs.forEach(pcf => {
        pcf.facilities = facMap.get(pcf.facility_id) || null;
      });

      // Group pcfs by cluster
      const pcfByCluster: Record<string, PolicyClusterFacility[]> = {};
      pcfs.forEach(pcf => {
        if (!pcfByCluster[pcf.cluster_id]) pcfByCluster[pcf.cluster_id] = [];
        pcfByCluster[pcf.cluster_id].push(pcf);
      });

      clusters.forEach(c => {
        c.facilities = pcfByCluster[c.id] || [];
      });

      return { policy, clusters };
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useAllServicePolicies() {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['service-policies-all', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_policies')
        .select(`
          *,
          service_areas(
            id, name, zone_id, warehouse_id,
            service_type, priority, delivery_frequency,
            description, max_distance_km, sla_hours, is_active,
            metadata, created_by, updated_by, created_at, updated_at,
            zones:zone_id(id, name, code),
            warehouses:warehouse_id(id, name, lat, lng)
          )
        `)
        .eq('workspace_id', workspaceId!)
        .order('created_at', { ascending: false });

      if (error) throw new Error(`Failed to fetch service policies: ${error.message}`);

      const policies = (data || []) as any[];
      if (policies.length === 0) return policies;

      const policyIds = policies.map((p: any) => p.id);

      const { data: clusterData } = await supabase
        .from('policy_clusters')
        .select('service_policy_id, facility_count')
        .in('service_policy_id', policyIds);

      const clusterCounts: Record<string, number> = {};
      const facilityCounts: Record<string, number> = {};
      (clusterData || []).forEach((c: any) => {
        clusterCounts[c.service_policy_id] = (clusterCounts[c.service_policy_id] || 0) + 1;
        facilityCounts[c.service_policy_id] = (facilityCounts[c.service_policy_id] || 0) + (c.facility_count || 0);
      });

      return policies.map((p: any) => ({
        ...p,
        cluster_count: clusterCounts[p.id] || 0,
        facility_count: facilityCounts[p.id] || 0,
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ─── Create ───────────────────────────────────────────────────────────────────

export function useCreateServicePolicy() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (input: CreateServicePolicyInput) => {
      if (!workspaceId) throw new Error('No workspace selected');

      const { clusters, ...policyData } = input;

      // Insert policy
      const { data: policy, error: policyError } = await supabase
        .from('service_policies')
        .insert([{
          ...policyData,
          workspace_id: workspaceId,
          code: policyData.code || null,
        }])
        .select()
        .single();

      if (policyError) throw policyError;

      const policyId = (policy as any).id as string;

      // Batch insert all clusters in one request
      const { data: clusterRows, error: clustersError } = await supabase
        .from('policy_clusters')
        .insert(
          clusters.map((cl, i) => ({
            service_policy_id: policyId,
            code: cl.code,
            name: cl.name || null,
            facility_count: cl.facility_ids.length,
            sort_order: i,
          }))
        )
        .select('id, sort_order');

      if (clustersError) throw clustersError;

      // Map sort_order → cluster id
      const clusterIdByOrder = new Map(
        (clusterRows || []).map((r: any) => [r.sort_order as number, r.id as string])
      );

      // Build all facility assignments
      const allAssignments: { cluster_id: string; facility_id: string }[] = [];
      clusters.forEach((cl, i) => {
        const clusterId = clusterIdByOrder.get(i);
        if (!clusterId) return;
        cl.facility_ids.forEach(fid => {
          allAssignments.push({ cluster_id: clusterId, facility_id: fid });
        });
      });

      // Batch insert all facility assignments (chunked to avoid payload limits)
      const BATCH_SIZE = 500;
      for (let i = 0; i < allAssignments.length; i += BATCH_SIZE) {
        const { error: pcfError } = await supabase
          .from('policy_cluster_facilities')
          .insert(allAssignments.slice(i, i + BATCH_SIZE));
        if (pcfError) throw pcfError;
      }

      return policy as unknown as ServicePolicy;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['service-policies', data.service_area_id] });
      toast.success('Service policy created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create service policy: ${error.message}`);
    },
  });
}

export function useDeleteServicePolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('service_policies')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-policies'] });
      toast.success('Service policy deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete policy: ${error.message}`);
    },
  });
}

// ─── Client-side Clustering Engine ───────────────────────────────────────────

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface FacilityForCluster {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  lga: string | null;
}

interface ClusterEngineInput {
  facilities: FacilityForCluster[];
  mode: ClusteringMode;
  constraints: PolicyConstraints;
  warehouseLat: number | null;
  warehouseLng: number | null;
}

function nextClusterCode(index: number): string {
  const letter = String.fromCharCode(65 + Math.floor(index / 26));
  const num = (index % 26) + 1;
  return `Z${num}`;
}

export function runClusteringEngine(input: ClusterEngineInput): ClusterDraft[] {
  const { facilities, mode, constraints, warehouseLat, warehouseLng } = input;
  const maxPerCluster = constraints.max_facilities_per_cluster;

  const withGeo = facilities.filter(f => f.lat != null && f.lng != null);
  const noGeo = facilities.filter(f => f.lat == null || f.lng == null);

  let groups: Array<FacilityForCluster[]> = [];

  if (mode === 'lga') {
    // Group by LGA
    const lgaMap = new Map<string, FacilityForCluster[]>();
    withGeo.forEach(f => {
      const key = f.lga || 'Unknown';
      if (!lgaMap.has(key)) lgaMap.set(key, []);
      lgaMap.get(key)!.push(f);
    });

    lgaMap.forEach(facs => {
      if (maxPerCluster && facs.length > maxPerCluster) {
        // Split oversized LGA group
        for (let i = 0; i < facs.length; i += maxPerCluster) {
          groups.push(facs.slice(i, i + maxPerCluster));
        }
      } else {
        groups.push(facs);
      }
    });

  } else if (mode === 'proximity') {
    const radiusKm = constraints.radius_km ?? 15;
    const visited = new Set<string>();

    // Sort by distance to warehouse if available
    const sorted = [...withGeo].sort((a, b) => {
      if (!warehouseLat || !warehouseLng) return 0;
      return haversine(warehouseLat, warehouseLng, a.lat!, a.lng!) -
             haversine(warehouseLat, warehouseLng, b.lat!, b.lng!);
    });

    for (const seed of sorted) {
      if (visited.has(seed.id)) continue;
      const group: FacilityForCluster[] = [seed];
      visited.add(seed.id);

      for (const candidate of sorted) {
        if (visited.has(candidate.id)) continue;
        if (maxPerCluster && group.length >= maxPerCluster) break;
        const dist = haversine(seed.lat!, seed.lng!, candidate.lat!, candidate.lng!);
        if (dist <= radiusKm) {
          group.push(candidate);
          visited.add(candidate.id);
        }
      }
      groups.push(group);
    }

  } else {
    // manual — return single group of all facilities (user will split manually)
    if (withGeo.length > 0) groups.push(withGeo);
  }

  // Place no-geo facilities into last cluster
  if (noGeo.length > 0) {
    if (groups.length === 0) groups.push([]);
    groups[groups.length - 1].push(...noGeo);
  }

  // Build ClusterDraft with Z1, Z2 codes
  return groups.map((facs, idx) => ({
    code: `Z${idx + 1}`,
    facilityIds: facs.map(f => f.id),
  }));
}

// ─── Anomaly Detection ───────────────────────────────────────────────────────

export function detectAnomalies(
  clusters: ClusterDraft[],
  facilityMap: Map<string, FacilityForCluster>,
  warehouseLat: number | null,
  warehouseLng: number | null,
  maxPerCluster = 30,
): ClusterAnomaly[] {
  const anomalies: ClusterAnomaly[] = [];

  clusters.forEach(cluster => {
    // Too large
    if (cluster.facilityIds.length > maxPerCluster) {
      anomalies.push({
        clusterCode: cluster.code,
        type: 'too_large',
        message: `${cluster.code} has ${cluster.facilityIds.length} facilities (max: ${maxPerCluster})`,
      });
    }

    // Outlier: facility far from cluster centroid
    const facs = cluster.facilityIds
      .map(id => facilityMap.get(id))
      .filter((f): f is FacilityForCluster => !!f && f.lat != null && f.lng != null);

    if (facs.length < 2) return;

    const centLat = facs.reduce((s, f) => s + f.lat!, 0) / facs.length;
    const centLng = facs.reduce((s, f) => s + f.lng!, 0) / facs.length;
    const distances = facs.map(f => haversine(centLat, centLng, f.lat!, f.lng!));
    const avg = distances.reduce((s, d) => s + d, 0) / distances.length;
    const stdDev = Math.sqrt(distances.reduce((s, d) => s + (d - avg) ** 2, 0) / distances.length);

    facs.forEach((f, i) => {
      if (distances[i] > avg + 2 * stdDev && distances[i] > 5) {
        anomalies.push({
          clusterCode: cluster.code,
          type: 'outlier_facility',
          message: `${f.name} is far from ${cluster.code} centroid (${distances[i].toFixed(1)} km)`,
        });
      }
    });
  });

  return anomalies;
}

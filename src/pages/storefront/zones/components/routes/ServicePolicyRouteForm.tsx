import React, { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Plus,
  TriangleAlert,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useServiceAreas } from '@/hooks/useServiceAreas';
import { useServicePolicies, useServicePolicyDetail } from '@/hooks/useServicePolicies';
import { useCreateRoute } from '@/hooks/useRoutes';
import { useFacilities } from '@/hooks/useFacilities';
import { computeDistanceMatrix, type GeoPoint } from '@/lib/algorithms/distanceMatrix';
import { calculateDistance } from '@/lib/routeOptimization';
import { solveTSP } from '@/lib/algorithms/tsp';
import { getRoadRoute } from '@/lib/geoapify';
import { MAP_CONFIG, getMapLibreStyle } from '@/lib/mapConfig';
import { useTheme } from 'next-themes';
import type { OptimizationAlgorithm } from '@/types/routes';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'context' | 'cluster' | 'optimize' | 'save';

const STEP_LABELS: { num: number; key: Step; label: string }[] = [
  { num: 1, key: 'context', label: 'Service Policy' },
  { num: 2, key: 'cluster', label: 'Cluster' },
  { num: 3, key: 'optimize', label: 'Optimize' },
  { num: 4, key: 'save', label: 'Save' },
];

const ALGORITHMS: {
  id: OptimizationAlgorithm;
  label: string;
  description: string;
}[] = [
  {
    id: 'NEAREST_NEIGHBOR',
    label: 'Fast — Nearest Neighbor',
    description: 'Greedy algorithm. Instant results, good baseline.',
  },
  {
    id: 'TWO_OPT',
    label: 'Balanced — 2-opt',
    description: 'Improves greedy with edge-swap passes. Better route quality.',
  },
  {
    id: 'OSRM',
    label: 'Advanced — Road Routing',
    description: 'Uses real road network via Geoapify. Most accurate.',
  },
];

const ALGO_STORED_LABELS: Record<OptimizationAlgorithm, string> = {
  NEAREST_NEIGHBOR: 'nearest_neighbor',
  TWO_OPT: 'two_opt',
  OSRM: 'osrm',
};

// ─── Nearest Neighbor only (no 2-opt improvement) ────────────────────────────

function nearestNeighborOnly(
  distMatrix: number[][],
  start: number,
): { order: number[]; totalDistance: number } {
  const n = distMatrix.length;
  const visited = new Set<number>([start]);
  const order = [start];
  let totalDistance = 0;

  while (order.length < n) {
    const current = order[order.length - 1];
    let best = -1;
    let bestDist = Infinity;
    for (let j = 0; j < n; j++) {
      if (!visited.has(j) && distMatrix[current][j] < bestDist) {
        best = j;
        bestDist = distMatrix[current][j];
      }
    }
    if (best === -1) break;
    order.push(best);
    visited.add(best);
    totalDistance += bestDist;
  }

  return { order, totalDistance };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ServicePolicyRouteFormProps {
  onSuccess: () => void;
}

export function ServicePolicyRouteForm({ onSuccess }: ServicePolicyRouteFormProps) {
  const { theme } = useTheme();

  // ── Step state ──
  const [step, setStep] = useState<Step>('context');

  // ── Step 1: context ──
  const [serviceAreaId, setServiceAreaId] = useState('');
  const [policyId, setPolicyId] = useState('');

  // ── Step 2: cluster ──
  const [clusterId, setClusterId] = useState('');
  const [clusterCode, setClusterCode] = useState('');

  // ── Step 3: optimize ──
  const [algorithm, setAlgorithm] = useState<OptimizationAlgorithm>('TWO_OPT');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedOrder, setOptimizedOrder] = useState<string[] | null>(null);
  const [totalDistanceKm, setTotalDistanceKm] = useState<number | null>(null);
  const [estimatedDurationMin, setEstimatedDurationMin] = useState<number | null>(null);
  const [roadGeometry, setRoadGeometry] = useState<Array<[number, number]> | null>(null);
  const [extraFacilityIds, setExtraFacilityIds] = useState<string[]>([]);
  const [showAddFacility, setShowAddFacility] = useState(false);
  const [facilitySearch, setFacilitySearch] = useState('');

  // ── Step 4: save ──
  const [routeName, setRouteName] = useState('');

  // ── Map ──
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // ── Hooks ──
  const serviceAreasQuery = useServiceAreas();
  const serviceAreas = serviceAreasQuery.data;
  const policiesQuery = useServicePolicies(serviceAreaId || null);
  const policyDetailQuery = useServicePolicyDetail(policyId || null);
  const createMutation = useCreateRoute();

  // For adding extra facilities (loaded when user opens the add-facility panel)
  const allFacilitiesQuery = useFacilities({}, undefined, 300);

  // ── Derived ──
  const selectedSA = useMemo(
    () => serviceAreas?.find(sa => sa.id === serviceAreaId) ?? null,
    [serviceAreas, serviceAreaId],
  );

  const selectedPolicy = useMemo(
    () => policiesQuery.data?.find(p => p.id === policyId) ?? null,
    [policiesQuery.data, policyId],
  );

  const selectedCluster = useMemo(
    () => policyDetailQuery.data?.clusters.find(c => c.id === clusterId) ?? null,
    [policyDetailQuery.data, clusterId],
  );

  // Facilities from the selected cluster
  const clusterFacilities = useMemo(() => {
    if (!selectedCluster?.facilities) return [];
    return selectedCluster.facilities
      .filter(pcf => pcf.facilities != null)
      .map(pcf => pcf.facilities!);
  }, [selectedCluster]);

  // Extra facilities: those not already in cluster
  const clusterFacilityIds = useMemo(
    () => new Set(clusterFacilities.map(f => f.id)),
    [clusterFacilities],
  );

  const filteredExtraFacilities = useMemo(() => {
    const q = facilitySearch.trim().toLowerCase();
    return (allFacilitiesQuery.data?.facilities ?? [])
      .filter((f: any) => !clusterFacilityIds.has(f.id))
      .filter((f: any) =>
        !q ||
        f.name?.toLowerCase().includes(q) ||
        f.lga?.toLowerCase().includes(q),
      );
  }, [allFacilitiesQuery.data, clusterFacilityIds, facilitySearch]);

  // All facilities (cluster + extras)
  const allFacilities = useMemo(() => {
    const extras = (allFacilitiesQuery.data?.facilities ?? []).filter((f: any) =>
      extraFacilityIds.includes(f.id),
    );
    return [...clusterFacilities, ...extras];
  }, [clusterFacilities, extraFacilityIds, allFacilitiesQuery.data]);

  // Warehouse coords from service area
  const warehouseCoords = useMemo(() => {
    if (selectedSA?.warehouses?.lat != null && selectedSA?.warehouses?.lng != null) {
      return { lat: selectedSA.warehouses.lat, lng: selectedSA.warehouses.lng };
    }
    return null;
  }, [selectedSA]);

  // Auto-name suggestion when cluster is selected
  useEffect(() => {
    if (selectedSA && selectedPolicy && selectedCluster && !routeName) {
      setRouteName(`${selectedSA.name} — ${selectedPolicy.name} / ${selectedCluster.code}`);
    }
  }, [selectedSA, selectedPolicy, selectedCluster]);

  // ── Map lifecycle ──
  useEffect(() => {
    if (step !== 'optimize') return;
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getMapLibreStyle(theme),
      center: [MAP_CONFIG.defaultCenter[1], MAP_CONFIG.defaultCenter[0]],
      zoom: MAP_CONFIG.defaultZoom,
    });
    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    mapRef.current.on('load', () => {
      const m = mapRef.current;
      if (!m) return;
      m.addSource('route-line', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      m.addLayer({
        id: 'route-line-layer',
        type: 'line',
        source: 'route-line',
        paint: { 'line-color': '#3b82f6', 'line-width': 3, 'line-opacity': 0.85 },
      });
    });

    return () => {
      markersRef.current.forEach(mk => mk.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [step, theme]);

  // Update map markers when facilities or order changes
  useEffect(() => {
    if (step !== 'optimize') return;
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(mk => mk.remove());
    markersRef.current = [];

    const orderedIds = optimizedOrder ?? allFacilities.map(f => f.id);
    const bounds = new maplibregl.LngLatBounds();
    let hasPoints = false;

    orderedIds.forEach((facId, idx) => {
      const f = allFacilities.find(af => af.id === facId);
      if (!f || f.lat == null || f.lng == null) return;

      hasPoints = true;
      const isExtra = extraFacilityIds.includes(f.id);
      const el = document.createElement('div');
      el.style.cssText = `
        width: 22px; height: 22px; border-radius: 9999px;
        background: ${isExtra ? '#f97316' : 'hsl(var(--primary))'};
        border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center;
        font-size: 9px; font-weight: 700; color: white; cursor: default;
      `;
      el.textContent = String(idx + 1);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([f.lng, f.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 16, closeButton: false }).setHTML(
            `<div style="font-size:12px"><strong>${idx + 1}. ${f.name}</strong>${isExtra ? '<br/><span style="color:#f97316">⚠ Outside policy</span>' : ''}</div>`,
          ),
        )
        .addTo(map);

      markersRef.current.push(marker);
      bounds.extend([f.lng, f.lat]);
    });

    if (hasPoints) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 300 });
    }
  }, [step, allFacilities, optimizedOrder, extraFacilityIds]);

  // Update route line on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource('route-line')) return;

    let coordinates: Array<[number, number]> = [];

    if (roadGeometry && roadGeometry.length > 0) {
      coordinates = roadGeometry;
    } else if (optimizedOrder && optimizedOrder.length > 1) {
      const orderedFacs = optimizedOrder
        .map(id => allFacilities.find(f => f.id === id))
        .filter((f): f is NonNullable<typeof f> => f != null && f.lat != null && f.lng != null);
      coordinates = orderedFacs.map(f => [f.lng!, f.lat!]);
    }

    (map.getSource('route-line') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features:
        coordinates.length > 1
          ? [
              {
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates },
              },
            ]
          : [],
    });
  }, [optimizedOrder, roadGeometry, allFacilities, step]);

  // ── Step navigation ──
  const getCurrentStepNum = (s: Step) =>
    STEP_LABELS.find(sl => sl.key === s)?.num ?? 1;

  const canProceed = (): boolean => {
    switch (step) {
      case 'context':
        return !!serviceAreaId && !!policyId;
      case 'cluster':
        return !!clusterId;
      case 'optimize':
        return optimizedOrder != null && optimizedOrder.length > 0;
      case 'save':
        return !!routeName.trim();
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step === 'context') setStep('cluster');
    else if (step === 'cluster') setStep('optimize');
    else if (step === 'optimize') setStep('save');
  };

  const handleBack = () => {
    if (step === 'cluster') setStep('context');
    else if (step === 'optimize') {
      setStep('cluster');
      setOptimizedOrder(null);
      setTotalDistanceKm(null);
      setEstimatedDurationMin(null);
      setRoadGeometry(null);
    } else if (step === 'save') setStep('optimize');
  };

  // ── Optimization ──
  const handleOptimize = async () => {
    if (allFacilities.length < 2) return;
    setIsOptimizing(true);
    setOptimizedOrder(null);
    setTotalDistanceKm(null);
    setEstimatedDurationMin(null);
    setRoadGeometry(null);

    try {
      const points: GeoPoint[] = allFacilities
        .filter(f => f.lat != null && f.lng != null)
        .map(f => ({ id: f.id, lat: f.lat!, lng: f.lng! }));

      const distMatrix = computeDistanceMatrix(points);

      let order: number[];
      let rawDistance: number;

      if (algorithm === 'NEAREST_NEIGHBOR') {
        const result = nearestNeighborOnly(distMatrix, 0);
        order = result.order;
        rawDistance = result.totalDistance;
      } else {
        // TWO_OPT and OSRM both start with solveTSP (NN + 2-opt)
        const result = solveTSP(distMatrix, 0);
        order = result.order;
        rawDistance = result.totalDistance;
      }

      const orderedIds = order.map(idx => points[idx].id);
      const distKm = Math.round(rawDistance * 10) / 10;

      setOptimizedOrder(orderedIds);
      setTotalDistanceKm(distKm);
      setIsOptimizing(false);

      if (algorithm === 'OSRM') {
        const orderedPoints = order.map(idx => points[idx]);
        const road = await getRoadRoute(orderedPoints);
        if (road) {
          setRoadGeometry(road.geometry);
          setTotalDistanceKm(road.roadDistanceKm);
          setEstimatedDurationMin(road.roadTimeMinutes);
        }
      } else {
        // Estimate duration: assume avg 30 km/h in field
        setEstimatedDurationMin(Math.round((distKm / 30) * 60));
      }
    } catch (err) {
      console.error('[ServicePolicyRouteForm] Optimization failed:', err);
      setIsOptimizing(false);
    }
  };

  // ── Save ──
  const handleSave = async () => {
    if (!optimizedOrder || !selectedSA) return;

    const facilityMap = new Map(allFacilities.map(f => [f.id, f]));

    const distances: (number | null)[] = optimizedOrder.map((id, idx) => {
      const f = facilityMap.get(id);
      if (!f || f.lat == null || f.lng == null) return null;
      if (idx === 0) {
        if (warehouseCoords) {
          return Math.round(calculateDistance(warehouseCoords.lat, warehouseCoords.lng, f.lat, f.lng) * 10) / 10;
        }
        return null;
      }
      const prev = facilityMap.get(optimizedOrder[idx - 1]);
      if (!prev || prev.lat == null || prev.lng == null) return null;
      return Math.round(calculateDistance(prev.lat, prev.lng, f.lat, f.lng) * 10) / 10;
    });

    await createMutation.mutateAsync({
      name: routeName.trim(),
      zone_id: selectedSA.zone_id,
      service_area_id: serviceAreaId,
      warehouse_id: selectedSA.warehouse_id,
      creation_mode: 'service_policy',
      facility_ids: optimizedOrder,
      facility_distances: distances,
      algorithm_used: ALGO_STORED_LABELS[algorithm],
      total_distance_km: totalDistanceKm ?? undefined,
      estimated_duration_min: estimatedDurationMin ?? undefined,
      optimized_geometry: roadGeometry
        ? { type: 'LineString', coordinates: roadGeometry }
        : undefined,
      metadata: {
        service_policy_id: policyId,
        service_policy_name: selectedPolicy?.name ?? '',
        cluster_id: clusterId,
        cluster_code: clusterCode,
        extra_facility_ids: extraFacilityIds,
      },
    });

    onSuccess();
  };

  const currentStepNum = getCurrentStepNum(step);

  // ── Renderers ──

  const renderContextStep = () => (
    <div className="p-6 space-y-8">
      {/* Service Area */}
      <div>
        <Label className="text-base font-semibold">Select Service Area</Label>
        <p className="text-sm text-muted-foreground mb-3">
          Choose the service area this route belongs to.
        </p>
        {serviceAreasQuery.isLoading ? (
          <div className="flex items-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading service areas…
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {(serviceAreas || []).filter(sa => sa.is_active).map(sa => (
              <Card
                key={sa.id}
                onClick={() => {
                  setServiceAreaId(sa.id);
                  setPolicyId('');
                  setClusterId('');
                  setClusterCode('');
                }}
                className={cn(
                  'cursor-pointer transition-all hover:shadow-md',
                  serviceAreaId === sa.id && 'ring-2 ring-primary bg-primary/5',
                )}
              >
                <CardContent className="p-4">
                  <p className="font-medium">{sa.name}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {sa.service_type?.toUpperCase() ?? 'N/A'}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {sa.facility_count ?? 0} facilities
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Service Policy */}
      {serviceAreaId && (
        <div className="border-t pt-6">
          <Label className="text-base font-semibold">Select Service Policy</Label>
          <p className="text-sm text-muted-foreground mb-3">
            Choose a policy that defines the facility clusters for this service area.
          </p>
          {policiesQuery.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading policies…
            </div>
          ) : policiesQuery.data && policiesQuery.data.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {policiesQuery.data
                .filter(p => p.status !== 'archived')
                .map(policy => (
                <Card
                  key={policy.id}
                  onClick={() => {
                    setPolicyId(policy.id);
                    setClusterId('');
                    setClusterCode('');
                  }}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md',
                    policyId === policy.id && 'ring-2 ring-primary bg-primary/5',
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{policy.name}</p>
                        {policy.code && (
                          <p className="text-xs text-muted-foreground mt-0.5">{policy.code}</p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          policy.status === 'active' && 'border-green-300 text-green-700',
                        )}
                      >
                        {policy.status}
                      </Badge>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {policy.cluster_count ?? 0} clusters
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {policy.facility_count ?? 0} facilities
                      </Badge>
                      <Badge variant="outline" className="text-xs capitalize">
                        {policy.clustering_mode}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No active policies for this service area.{' '}
              <span className="text-foreground">Create a Service Policy first.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderClusterStep = () => {
    const clusters = policyDetailQuery.data?.clusters ?? [];
    const isLoading = policyDetailQuery.isLoading;

    return (
      <div className="p-6 space-y-4">
        <div>
          <Label className="text-base font-semibold">Select Cluster</Label>
          <p className="text-sm text-muted-foreground mb-4">
            Each cluster is a group of facilities defined by{' '}
            <span className="font-medium">{selectedPolicy?.name}</span>. Choose the cluster to
            optimize into a route.
          </p>

          {isLoading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading clusters…
            </div>
          ) : clusters.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              This policy has no clusters yet.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {clusters.map(cluster => (
                <Card
                  key={cluster.id}
                  onClick={() => {
                    setClusterId(cluster.id);
                    setClusterCode(cluster.code);
                    // Reset optimization when cluster changes
                    setOptimizedOrder(null);
                    setTotalDistanceKm(null);
                    setEstimatedDurationMin(null);
                    setRoadGeometry(null);
                    setExtraFacilityIds([]);
                  }}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md',
                    clusterId === cluster.id && 'ring-2 ring-primary bg-primary/5',
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xl font-bold text-primary">{cluster.code}</p>
                        {cluster.name && (
                          <p className="text-sm text-muted-foreground mt-0.5">{cluster.name}</p>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-sm">
                        {cluster.facility_count} facilities
                      </Badge>
                    </div>
                    {cluster.facility_count === 0 && (
                      <p className="text-xs text-amber-600 mt-2">Empty cluster</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderOptimizeStep = () => {
    const orderedFacilities = optimizedOrder
      ? optimizedOrder.map(id => allFacilities.find(f => f.id === id)).filter(Boolean)
      : allFacilities;

    return (
      <div className="flex flex-col h-[calc(90vh-300px)] min-h-[480px]">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_320px] gap-4 p-4 flex-1 min-h-0">
          {/* Map */}
          <div className="flex flex-col border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b bg-background flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Route Preview</span>
              {extraFacilityIds.length > 0 && (
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 ml-auto">
                  +{extraFacilityIds.length} outside policy
                </Badge>
              )}
            </div>
            <div ref={mapContainerRef} className="flex-1 min-h-0" />
          </div>

          {/* Facility sequence */}
          <div className="flex flex-col border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b bg-background">
              <p className="text-sm font-semibold">
                {optimizedOrder ? 'Optimized Sequence' : 'Cluster Facilities'}
                <Badge variant="secondary" className="ml-2">
                  {allFacilities.length}
                </Badge>
              </p>
            </div>
            <ScrollArea className="flex-1 min-h-0 p-3">
              <div className="space-y-1.5">
                {(optimizedOrder ? orderedFacilities : allFacilities).map((f, idx) => {
                  if (!f) return null;
                  const isExtra = extraFacilityIds.includes(f.id);
                  return (
                    <div
                      key={f.id}
                      className={cn(
                        'flex items-center gap-2.5 p-2.5 rounded-md text-sm',
                        isExtra ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200' : 'bg-muted/50',
                      )}
                    >
                      <span className="text-xs font-mono text-muted-foreground w-5 shrink-0 text-right">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{(f as any).lga ?? 'Unknown LGA'}</p>
                      </div>
                      {isExtra && (
                        <TriangleAlert className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Right panel: algorithm + controls */}
          <div className="flex flex-col border rounded-lg overflow-hidden bg-muted/30">
            <div className="px-4 py-3 border-b bg-background">
              <p className="text-sm font-semibold">Optimization</p>
            </div>
            <ScrollArea className="flex-1 min-h-0 p-4">
              <div className="space-y-5">
                {/* Algorithm selection */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Algorithm
                  </p>
                  {ALGORITHMS.map(algo => (
                    <button
                      key={algo.id}
                      onClick={() => setAlgorithm(algo.id)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border text-sm transition-all',
                        algorithm === algo.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'hover:bg-muted',
                      )}
                    >
                      <p className="font-medium">{algo.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{algo.description}</p>
                    </button>
                  ))}
                </div>

                {/* Run button */}
                <Button
                  onClick={handleOptimize}
                  disabled={isOptimizing || allFacilities.length < 2}
                  className="w-full"
                >
                  {isOptimizing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Optimizing…
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      {optimizedOrder ? 'Re-run' : 'Run Optimization'}
                    </>
                  )}
                </Button>

                {/* Results */}
                {optimizedOrder && (
                  <div className="space-y-2 pt-1 border-t">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Results
                    </p>
                    <div className="text-sm space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Distance</span>
                        <span className="font-semibold text-green-600">{totalDistanceKm} km</span>
                      </div>
                      {estimatedDurationMin != null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Est. Time</span>
                          <span className="font-medium">
                            {Math.floor(estimatedDurationMin / 60)}h {estimatedDurationMin % 60}m
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Facilities</span>
                        <span className="font-medium">{optimizedOrder.length}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Add extra facility */}
                <div className="border-t pt-3">
                  <button
                    onClick={() => setShowAddFacility(!showAddFacility)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add facility outside policy
                  </button>
                  {showAddFacility && (
                    <div className="mt-2 space-y-2">
                      <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 p-2 text-xs text-amber-700 dark:text-amber-400">
                        <TriangleAlert className="inline h-3 w-3 mr-1" />
                        These facilities are outside the policy cluster.
                      </div>
                      <Input
                        placeholder="Search facilities…"
                        value={facilitySearch}
                        onChange={e => setFacilitySearch(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <ScrollArea className="h-36">
                        <div className="space-y-1">
                          {filteredExtraFacilities.slice(0, 50).map((f: any) => (
                            <button
                              key={f.id}
                              onClick={() => {
                                setExtraFacilityIds(prev =>
                                  prev.includes(f.id)
                                    ? prev.filter(id => id !== f.id)
                                    : [...prev, f.id],
                                );
                                setOptimizedOrder(null); // force re-run
                              }}
                              className={cn(
                                'w-full text-left px-2 py-1.5 rounded text-xs transition-colors',
                                extraFacilityIds.includes(f.id)
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'hover:bg-muted',
                              )}
                            >
                              <p className="font-medium truncate">{f.name}</p>
                              <p className="text-muted-foreground">{f.lga ?? '—'}</p>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    );
  };

  const renderSaveStep = () => (
    <div className="p-6 space-y-6">
      <div>
        <Label htmlFor="route-name" className="text-base font-semibold">
          Route Name
        </Label>
        <p className="text-sm text-muted-foreground mb-2">
          Give this route a descriptive name.
        </p>
        <Input
          id="route-name"
          placeholder="e.g., Central SA — Z1 Optimized"
          value={routeName}
          onChange={e => setRouteName(e.target.value)}
          className="h-10"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Route Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Service Area</span>
              <span className="font-medium">{selectedSA?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Policy</span>
              <span className="font-medium">{selectedPolicy?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cluster</span>
              <Badge variant="outline">{clusterCode}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Source</span>
              <Badge variant="secondary">Service Policy</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Optimization Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Algorithm</span>
              <Badge variant="outline" className="text-xs">
                {ALGORITHMS.find(a => a.id === algorithm)?.label ?? algorithm}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Facilities</span>
              <span className="font-medium">{optimizedOrder?.length ?? 0}</span>
            </div>
            {totalDistanceKm != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Distance</span>
                <span className="font-medium text-green-600">{totalDistanceKm} km</span>
              </div>
            )}
            {estimatedDurationMin != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Est. Time</span>
                <span className="font-medium">
                  {Math.floor(estimatedDurationMin / 60)}h {estimatedDurationMin % 60}m
                </span>
              </div>
            )}
            {extraFacilityIds.length > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Extra facilities</span>
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                  +{extraFacilityIds.length} outside policy
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Step indicator */}
      <div className="px-6 py-4 border-b bg-background">
        <div className="flex items-center gap-2">
          {STEP_LABELS.map((stepInfo, idx) => (
            <React.Fragment key={stepInfo.num}>
              <div
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                  currentStepNum === stepInfo.num
                    ? 'bg-primary text-primary-foreground'
                    : currentStepNum > stepInfo.num
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {currentStepNum > stepInfo.num ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span>{stepInfo.num}</span>
                )}
                <span className="hidden sm:inline">{stepInfo.label}</span>
              </div>
              {idx < STEP_LABELS.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 rounded transition-colors',
                    currentStepNum > stepInfo.num ? 'bg-primary' : 'bg-muted',
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </div>
        <Progress value={(currentStepNum / 4) * 100} className="h-1 mt-3" />
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {step === 'context' && renderContextStep()}
        {step === 'cluster' && renderClusterStep()}
        {step === 'optimize' && renderOptimizeStep()}
        {step === 'save' && renderSaveStep()}
      </div>

      {/* Footer */}
      <div className="border-t bg-muted/30 px-6 py-4 flex justify-between items-center">
        <Button variant="outline" onClick={handleBack} disabled={step === 'context'}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {step === 'optimize' && !optimizedOrder && (
          <p className="text-xs text-muted-foreground">
            Run optimization to continue
          </p>
        )}

        <Button
          onClick={step === 'save' ? handleSave : handleNext}
          disabled={
            step === 'save' ? createMutation.isPending : !canProceed()
          }
        >
          {step === 'save' ? (
            createMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )
          ) : null}
          {step === 'save' ? 'Create Route' : 'Next'}
          {step !== 'save' && <ChevronRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

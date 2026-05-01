import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { tw } from '@/lib/colors';
import { useTheme } from 'next-themes';
import {
  ArrowLeft,
  Search,
  MapPin,
  Zap,
  Check,
  Loader2,
  X,
  TrendingUp,
  Ruler,
  Building2,
  Settings2,
  ChevronDown,
  ChevronUp,
  Fuel,
  Clock,
  Layers,
  Route,
  Radar,
  Split,
  Brain,
} from 'lucide-react';
import { MapOverlayControls } from '@/components/map/MapOverlayControls';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useOperationalZones } from '@/hooks/useOperationalZones';
import { useFacilities } from '@/hooks/useFacilities';
import { useCreateRoute } from '@/hooks/useRoutes';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useWorkspaceSettings } from '@/hooks/settings/useWorkspaceSettings';
import { calculateDistance } from '@/lib/routeOptimization';
import { computeDistanceMatrix, type GeoPoint } from '@/lib/algorithms/distanceMatrix';
import { solveTSP } from '@/lib/algorithms/tsp';
import { getRoadRoute, getAlternativeRoadRoutes, type RoadRouteResult, type AlternativeRoadRoute } from '@/lib/geoapify';
import { getMapLibreStyle } from '@/lib/mapConfig';
import { RouteComparisonPanel } from './RouteComparisonPanel';
import type { Facility } from '@/types';
import type { ComparisonRoute } from '@/types/routes';

// ─── Optimization Config (shared module) ───
import {
  type OptimizationConfig,
  OPTIMIZATION_CRITERIA,
  DEFAULT_OPTIMIZATION_CONFIG as DEFAULT_CONFIG,
  SERVICE_TIME_HOURS,
  AVG_SPEED_KMH,
  ROUTE_COLORS,
  ROUTE_TYPE_LABELS,
  ALGORITHM_COLOR_OFFSET,
  type CardinalPath,
  solveWithConfig,
} from '@/lib/algorithms/routeOptimizer';

interface SandboxRouteBuilderProps {
  onClose: () => void;
}

type TetherMode = 'cardinal' | 'route' | 'alternatives';

export function SandboxRouteBuilder({ onClose }: SandboxRouteBuilderProps) {
  const [zoneId, setZoneId] = useState('');
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([]);
  const [routeName, setRouteName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [optimizedOrder, setOptimizedOrder] = useState<string[] | null>(null);
  const [optimizedDistance, setOptimizedDistance] = useState<number | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [tetherMode, setTetherMode] = useState<TetherMode>('cardinal');
  const [sortInsightsBy, setSortInsightsBy] = useState<'name' | 'distance'>('distance');
  const [optConfig, setOptConfig] = useState<OptimizationConfig>({ ...DEFAULT_CONFIG });
  const [showOptSettings, setShowOptSettings] = useState(false);
  const [optimizedTime, setOptimizedTime] = useState<number | null>(null);
  const [algorithmLabel, setAlgorithmLabel] = useState<string | null>(null);
  const [roadRoute, setRoadRoute] = useState<RoadRouteResult | null>(null);
  const [isFetchingRoad, setIsFetchingRoad] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [focusSelected, setFocusSelected] = useState(false);

  // Multi-route comparison state
  const [comparisonRoutes, setComparisonRoutes] = useState<ComparisonRoute[]>([]);
  const [selectedComparisonId, setSelectedComparisonId] = useState<string | null>(null);
  const [isFetchingAlternatives, setIsFetchingAlternatives] = useState(false);
  const [isAdvancedPlanning, setIsAdvancedPlanning] = useState(false);
  const [comparisonMode, setComparisonMode] = useState<'alternatives' | 'advanced' | null>(null);

  // Pre-optimization waypoint road: road route through all selected facilities in current order
  const [waypointRoad, setWaypointRoad] = useState<RoadRouteResult | null>(null);
  const [waypointAlternatives, setWaypointAlternatives] = useState<AlternativeRoadRoute[]>([]);
  const waypointRoadKeyRef = useRef<string>(''); // track which facility set we last fetched for

  // Per-facility road paths cache: facilityId → array of alternative paths from zone center
  const [cardinalRoads, setCardinalRoads] = useState<Record<string, CardinalPath[]>>({});
  const cardinalFetchingRef = useRef<Set<string>>(new Set());

  const { theme } = useTheme();
  const { workspaceId } = useWorkspace();
  const { data: wsSettings } = useWorkspaceSettings(workspaceId);
  const waitingTimeMin = wsSettings?.settings?.waiting_time_sla_minutes ?? SERVICE_TIME_HOURS * 60;
  const { zones } = useOperationalZones();
  const selectedZone = zones?.find((z) => z.id === zoneId);
  const zoneCenter = selectedZone?.region_center ?? null;

  // Sandbox builder should not depend on operational hierarchy (service areas, service_zone naming, etc.).
  // Load facilities broadly once a zone is selected so the user can prototype routes even if
  // facilities are not yet assigned to zones/service areas.
  const facilitiesQuery = useFacilities(zoneId ? {} : undefined, undefined, 1000);
  const facilitiesLoading = facilitiesQuery.isLoading;
  const facilitiesError = facilitiesQuery.error as Error | null;
  const createMutation = useCreateRoute();

  const facilities = (facilitiesQuery.data?.facilities as unknown as Facility[]) ?? [];

  const visitIndexByFacilityId = useMemo(() => {
    const order = optimizedOrder || selectedFacilityIds;
    const map = new Map<string, number>();
    order.forEach((id, idx) => map.set(id, idx + 1));
    return map;
  }, [optimizedOrder, selectedFacilityIds]);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const infoMarkersRef = useRef<maplibregl.Marker[]>([]);

  // Reset selections when zone changes
  useEffect(() => {
    setSelectedFacilityIds([]);
    setOptimizedOrder(null);
    setOptimizedDistance(null);
    setSearchQuery('');
    setTetherMode('cardinal');
    setRoadRoute(null);
    setWaypointRoad(null);
    setWaypointAlternatives([]);
    waypointRoadKeyRef.current = '';
    setCardinalRoads({});
    cardinalFetchingRef.current.clear();
    setComparisonRoutes([]);
    setSelectedComparisonId(null);
    setComparisonMode(null);
  }, [zoneId]);

  // Fetch all alternative road paths for each newly selected facility (zone center → facility)
  useEffect(() => {
    if (!zoneCenter || selectedFacilityIds.length === 0) return;

    const needFetch = selectedFacilityIds.filter(id => {
      if (cardinalRoads[id]) return false;
      if (cardinalFetchingRef.current.has(id)) return false;
      const f = facilities.find(fac => fac.id === id);
      return f && f.lat && f.lng;
    });

    if (needFetch.length === 0) return;

    // Mark as fetching immediately
    needFetch.forEach(id => cardinalFetchingRef.current.add(id));

    // Fetch in parallel (batch of up to 6 at a time)
    const batch = needFetch.slice(0, 6);
    Promise.all(
      batch.map(async (facId) => {
        const f = facilities.find(fac => fac.id === facId);
        if (!f || !f.lat || !f.lng) return null;

        try {
          const waypoints = [
            { lat: zoneCenter.lat, lng: zoneCenter.lng },
            { lat: f.lat, lng: f.lng },
          ];
          const alternatives = await getAlternativeRoadRoutes(waypoints);
          if (alternatives.length > 0) {
            const paths: CardinalPath[] = alternatives.map(alt => ({
              routeType: alt.routeType,
              geometry: alt.geometry,
              distanceKm: alt.roadDistanceKm,
              timeMinutes: alt.roadTimeMinutes,
            }));
            return { facId, paths };
          }
        } catch (err) {
          console.error(`[SandboxRouteBuilder] Cardinal road fetch failed for ${facId}:`, err);
        }
        return null;
      })
    ).then(results => {
      const newRoads: Record<string, CardinalPath[]> = {};
      let hasNew = false;
      for (const r of results) {
        if (!r) continue;
        hasNew = true;
        newRoads[r.facId] = r.paths;
      }
      if (hasNew) {
        setCardinalRoads(prev => {
          const next: Record<string, CardinalPath[]> = { ...prev };
          for (const [k, v] of Object.entries(newRoads)) next[k] = v;
          return next;
        });
      }
      batch.forEach(id => cardinalFetchingRef.current.delete(id));
    });
  }, [selectedFacilityIds, zoneCenter, facilities, cardinalRoads]);

  // Fetch road routes through all selected facilities in current order (for waypoint/route mode before optimization)
  useEffect(() => {
    if (!zoneCenter || selectedFacilityIds.length < 1) {
      setWaypointRoad(null);
      setWaypointAlternatives([]);
      waypointRoadKeyRef.current = '';
      return;
    }
    // If we already have an optimized roadRoute, no need for waypoint preview
    if (roadRoute) return;

    // Build a key from the current facility selection to avoid re-fetching the same set
    const key = selectedFacilityIds.join(',');
    if (key === waypointRoadKeyRef.current) return;
    waypointRoadKeyRef.current = key;

    const orderedFacilities = selectedFacilityIds
      .map(id => facilities.find(f => f.id === id))
      .filter((f): f is Facility => !!f && !!f.lat && !!f.lng);

    if (orderedFacilities.length < 1) return;

    const waypoints = [
      { lat: zoneCenter.lat, lng: zoneCenter.lng },
      ...orderedFacilities.map(f => ({ lat: f.lat!, lng: f.lng! })),
      { lat: zoneCenter.lat, lng: zoneCenter.lng }, // round trip
    ];

    // Fetch all alternative road routes (Geoapify + OSRM fallback)
    getAlternativeRoadRoutes(waypoints)
      .then(alternatives => {
        if (waypointRoadKeyRef.current !== key) return;
        if (alternatives.length > 0) {
          // Use the first (balanced/fastest) as the primary waypoint road
          setWaypointRoad(alternatives[0]);
          setWaypointAlternatives(alternatives);
        }
      })
      .catch(err => {
        console.error('[SandboxRouteBuilder] Waypoint road fetch failed:', err);
      });
  }, [selectedFacilityIds, zoneCenter, facilities, roadRoute]);

  // Filter facilities by search
  const filteredFacilities = useMemo(() => {
    if (!searchQuery.trim()) return facilities;
    const q = searchQuery.toLowerCase();
    return facilities.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.lga?.toLowerCase().includes(q) ||
        f.level_of_care?.toLowerCase().includes(q) ||
        f.warehouse_code?.toLowerCase().includes(q)
    );
  }, [facilities, searchQuery]);

  // Compute per-facility distances from zone center
  const facilityDistances = useMemo(() => {
    if (!zoneCenter) return new Map<string, number>();
    const map = new Map<string, number>();
    facilities.forEach((f) => {
      if (f.lat && f.lng) {
        const dist = calculateDistance(zoneCenter.lat, zoneCenter.lng, f.lat, f.lng);
        map.set(f.id, Math.round(dist * 10) / 10);
      }
    });
    return map;
  }, [facilities, zoneCenter]);

  // Insights for selected facilities
  const insights = useMemo(() => {
    const selected = facilities.filter((f) => selectedFacilityIds.includes(f.id));
    const distances = selected
      .map((f) => facilityDistances.get(f.id))
      .filter((d): d is number => d !== undefined);

    if (distances.length === 0) {
      return { count: 0, totalDistance: 0, avgDistance: 0, minDistance: 0, maxDistance: 0 };
    }

    const totalDistance = distances.reduce((sum, d) => sum + d, 0);
    return {
      count: distances.length,
      totalDistance: Math.round(totalDistance * 10) / 10,
      avgDistance: Math.round((totalDistance / distances.length) * 10) / 10,
      minDistance: Math.round(Math.min(...distances) * 10) / 10,
      maxDistance: Math.round(Math.max(...distances) * 10) / 10,
    };
  }, [facilities, selectedFacilityIds, facilityDistances]);

  // Sorted insight rows with inter-facility distances
  const insightRows = useMemo(() => {
    // Use optimized order if available, otherwise selection order
    const orderedIds = optimizedOrder || selectedFacilityIds;
    const selected = orderedIds
      .map((id) => facilities.find((f) => f.id === id))
      .filter((f): f is Facility => !!f);

    const rows = selected.map((f, idx) => {
      // Distance from zone center (origin)
      const distFromOrigin = facilityDistances.get(f.id) ?? 0;

      // Distance from previous facility in route order
      let distFromPrevious: number | null = null;
      if (idx > 0) {
        const prevFac = selected[idx - 1];
        if (prevFac && prevFac.lat && prevFac.lng && f.lat && f.lng) {
          distFromPrevious = Math.round(
            calculateDistance(prevFac.lat, prevFac.lng, f.lat, f.lng) * 10
          ) / 10;
        }
      } else if (f.lat && f.lng && zoneCenter) {
        // First facility: distance from origin
        distFromPrevious = Math.round(
          calculateDistance(zoneCenter.lat, zoneCenter.lng, f.lat, f.lng) * 10
        ) / 10;
      }

      return {
        id: f.id,
        name: f.name,
        lga: f.lga || 'Unknown',
        distance: distFromOrigin,
        distFromPrevious,
        sequenceIndex: idx,
      };
    });

    if (sortInsightsBy === 'distance') {
      // When optimized, keep the optimized order; otherwise sort by origin distance
      if (!optimizedOrder) {
        rows.sort((a, b) => a.distance - b.distance);
      }
    } else {
      rows.sort((a, b) => a.name.localeCompare(b.name));
    }
    return rows;
  }, [facilities, selectedFacilityIds, optimizedOrder, facilityDistances, sortInsightsBy, zoneCenter]);

  // Toggle facility selection
  const toggleFacility = useCallback(
    (id: string) => {
      setSelectedFacilityIds((prev) =>
        prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
      );
      setOptimizedOrder(null);
      setOptimizedDistance(null);
      setRoadRoute(null);
      setComparisonRoutes([]);
      setSelectedComparisonId(null);
      setComparisonMode(null);
    },
    []
  );

  const handleSelectAll = () => {
    const allIds = filteredFacilities.map((f) => f.id);
    setSelectedFacilityIds(allIds);
    setOptimizedOrder(null);
    setOptimizedDistance(null);
    setRoadRoute(null);
  };

  const handleClearAll = () => {
    setSelectedFacilityIds([]);
    setOptimizedOrder(null);
    setOptimizedDistance(null);
    setRoadRoute(null);
  };

  // Optimize route with config
  const handleOptimize = () => {
    const selected = facilities
      .filter((f) => selectedFacilityIds.includes(f.id))
      .filter((f) => typeof f.lat === 'number' && typeof f.lng === 'number');

    if (selected.length < 2) return;
    if (!zoneCenter) return;

    setIsOptimizing(true);
    setRoadRoute(null);
    setTimeout(async () => {
      try {
        const points: GeoPoint[] = selected.map((f) => ({ id: f.id, lat: f.lat, lng: f.lng }));

        // Solve TSP with depot (zone center) as starting point
        const { orderedIds, algorithmLabel: label } = solveWithConfig(
          zoneCenter, points, optConfig, waitingTimeMin
        );

        // Compute haversine distance for the full route: depot → facilities → depot
        const orderedFacilities = orderedIds.map(id => points.find(p => p.id === id)!);
        let haversineDistance = 0;
        let prev = { lat: zoneCenter.lat, lng: zoneCenter.lng };
        for (const f of orderedFacilities) {
          haversineDistance += calculateDistance(prev.lat, prev.lng, f.lat, f.lng);
          prev = f;
        }
        haversineDistance += calculateDistance(prev.lat, prev.lng, zoneCenter.lat, zoneCenter.lng);

        const estTime = haversineDistance / AVG_SPEED_KMH + (selected.length * waitingTimeMin) / 60;

        setOptimizedOrder(orderedIds);
        setOptimizedDistance(Math.round(haversineDistance * 10) / 10);
        setOptimizedTime(Math.round(estTime * 10) / 10);
        setAlgorithmLabel(label);
        setSelectedFacilityIds(orderedIds);
        setIsOptimizing(false);
        // Auto-switch to route tether mode to show the optimized path
        setTetherMode('route');

        // Fetch real road route from Geoapify (async, non-blocking)
        setIsFetchingRoad(true);
        const waypoints = [
          { lat: zoneCenter.lat, lng: zoneCenter.lng },
          ...orderedFacilities,
          { lat: zoneCenter.lat, lng: zoneCenter.lng }, // round trip
        ];

        try {
          const road = await getRoadRoute(waypoints);
          if (road) {
            setRoadRoute(road);
            setOptimizedDistance(road.roadDistanceKm);
            const totalMinutes = road.roadTimeMinutes + selected.length * waitingTimeMin;
            setOptimizedTime(Math.round((totalMinutes / 60) * 10) / 10);
          }
        } catch (roadErr) {
          console.error('Road route fetch failed:', roadErr);
        }
        setIsFetchingRoad(false);
      } catch (err) {
        console.error('Route optimization failed:', err);
        setIsOptimizing(false);
        setIsFetchingRoad(false);
      }
    }, 10);
  };

  // Show alternative road paths for the current optimized facility order
  const handleShowAlternatives = async () => {
    if (!zoneCenter || !optimizedOrder || optimizedOrder.length < 2) return;

    setIsFetchingAlternatives(true);
    setComparisonMode('alternatives');
    setComparisonRoutes([]);
    setSelectedComparisonId(null);

    try {
      const orderedFacilities = optimizedOrder
        .map(id => facilities.find(f => f.id === id))
        .filter((f): f is Facility => !!f && !!f.lat && !!f.lng);

      const waypoints = [
        { lat: zoneCenter.lat, lng: zoneCenter.lng },
        ...orderedFacilities.map(f => ({ lat: f.lat!, lng: f.lng! })),
        { lat: zoneCenter.lat, lng: zoneCenter.lng },
      ];

      const alternatives = await getAlternativeRoadRoutes(waypoints);

      const routes: ComparisonRoute[] = alternatives.map((alt, idx) => ({
        id: `alt-${alt.routeType}-${idx}`,
        routeType: alt.routeType,
        routeTypeLabel: alt.label,
        algorithmLabel: algorithmLabel || 'Optimized',
        color: ROUTE_COLORS[alt.routeType],
        distanceKm: alt.roadDistanceKm,
        timeMinutes: alt.roadTimeMinutes,
        geometry: alt.geometry,
        snappedWaypoints: alt.snappedWaypoints,
        facilityOrder: optimizedOrder,
      }));

      setComparisonRoutes(routes);
      // Auto-select the current (balanced) route
      const balanced = routes.find(r => r.routeType === 'balanced');
      if (balanced) setSelectedComparisonId(balanced.id);
    } catch (err) {
      console.error('Failed to fetch alternative routes:', err);
    }
    setIsFetchingAlternatives(false);
  };

  // Advanced Planning: run all 4 algorithms × 3 road types
  const handleAdvancedPlanning = async () => {
    const selected = facilities
      .filter(f => selectedFacilityIds.includes(f.id))
      .filter(f => typeof f.lat === 'number' && typeof f.lng === 'number');

    if (selected.length < 2 || !zoneCenter) return;

    setIsAdvancedPlanning(true);
    setComparisonMode('advanced');
    setComparisonRoutes([]);
    setSelectedComparisonId(null);
    setTetherMode('route');

    try {
      const points: GeoPoint[] = selected.map(f => ({ id: f.id, lat: f.lat, lng: f.lng }));

      // Run all 4 optimization strategies
      const configs: { config: OptimizationConfig; label: string }[] = [
        { config: { shortestDistance: true, fuelEfficiency: false, timeOptimized: false, clusterPriority: false }, label: 'Shortest Distance' },
        { config: { shortestDistance: false, fuelEfficiency: true, timeOptimized: false, clusterPriority: false }, label: 'Fuel Efficient' },
        { config: { shortestDistance: false, fuelEfficiency: false, timeOptimized: true, clusterPriority: false }, label: 'Time Optimized' },
        { config: { shortestDistance: false, fuelEfficiency: false, timeOptimized: false, clusterPriority: true }, label: 'Cluster Priority' },
      ];

      // Deduplicate identical orderings
      const uniqueOrderings = new Map<string, { orderedIds: string[]; algorithmLabel: string }>();
      for (const { config, label } of configs) {
        const result = solveWithConfig(zoneCenter, points, config, waitingTimeMin);
        const key = result.orderedIds.join(',');
        if (!uniqueOrderings.has(key)) {
          uniqueOrderings.set(key, { orderedIds: result.orderedIds, algorithmLabel: label });
        }
      }

      // Fetch alternative road routes for each unique ordering in parallel
      const allRoutes: ComparisonRoute[] = [];
      const promises = [...uniqueOrderings.entries()].map(async ([, { orderedIds, algorithmLabel: algLabel }]) => {
        const orderedFacilities = orderedIds
          .map(id => points.find(p => p.id === id))
          .filter((p): p is GeoPoint => !!p);

        const waypoints = [
          { lat: zoneCenter.lat, lng: zoneCenter.lng },
          ...orderedFacilities.map(f => ({ lat: f.lat, lng: f.lng })),
          { lat: zoneCenter.lat, lng: zoneCenter.lng },
        ];

        const alternatives = await getAlternativeRoadRoutes(waypoints);
        const colors = ALGORITHM_COLOR_OFFSET[algLabel] || ALGORITHM_COLOR_OFFSET['Shortest Distance'];

        return alternatives.map((alt, idx) => ({
          id: `adv-${algLabel}-${alt.routeType}-${idx}`,
          routeType: alt.routeType,
          routeTypeLabel: alt.label,
          algorithmLabel: algLabel,
          color: colors[idx % colors.length],
          distanceKm: alt.roadDistanceKm,
          timeMinutes: alt.roadTimeMinutes,
          geometry: alt.geometry,
          snappedWaypoints: alt.snappedWaypoints,
          facilityOrder: orderedIds,
        }));
      });

      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === 'fulfilled') {
          allRoutes.push(...result.value);
        }
      }

      // Sort by distance
      allRoutes.sort((a, b) => a.distanceKm - b.distanceKm);
      setComparisonRoutes(allRoutes);

      // Auto-select the shortest
      if (allRoutes.length > 0) {
        setSelectedComparisonId(allRoutes[0].id);
        // Also update the main optimization state to match the best route
        const best = allRoutes[0];
        setOptimizedOrder(best.facilityOrder);
        setSelectedFacilityIds(best.facilityOrder);
        setOptimizedDistance(best.distanceKm);
        setOptimizedTime(Math.round((best.timeMinutes / 60) * 10) / 10);
        setAlgorithmLabel(best.algorithmLabel);
        setRoadRoute({
          roadDistanceKm: best.distanceKm,
          roadTimeMinutes: best.timeMinutes,
          geometry: best.geometry,
          snappedWaypoints: best.snappedWaypoints,
        });
      }
    } catch (err) {
      console.error('Advanced planning failed:', err);
    }
    setIsAdvancedPlanning(false);
  };

  // When user selects a comparison route, update the main route state
  const handleSelectComparison = (id: string) => {
    setSelectedComparisonId(id);
    const route = comparisonRoutes.find(r => r.id === id);
    if (!route) return;

    setOptimizedOrder(route.facilityOrder);
    setSelectedFacilityIds(route.facilityOrder);
    setOptimizedDistance(route.distanceKm);
    setOptimizedTime(Math.round((route.timeMinutes / 60) * 10) / 10);
    setRoadRoute({
      roadDistanceKm: route.distanceKm,
      roadTimeMinutes: route.timeMinutes,
      geometry: route.geometry,
      snappedWaypoints: route.snappedWaypoints,
    });
  };

  const handleDismissComparison = () => {
    setComparisonRoutes([]);
    setSelectedComparisonId(null);
    setComparisonMode(null);
  };

  const toggleOptCriteria = (key: keyof OptimizationConfig) => {
    setOptConfig((prev) => ({ ...prev, [key]: !prev[key] }));
    // Clear previous optimization when config changes
    setOptimizedOrder(null);
    setOptimizedDistance(null);
    setOptimizedTime(null);
    setAlgorithmLabel(null);
    setRoadRoute(null);
    setComparisonRoutes([]);
    setSelectedComparisonId(null);
    setComparisonMode(null);
  };

  // Save route
  const handleSave = async () => {
    if (!zoneId || !routeName.trim() || selectedFacilityIds.length === 0) return;
    await createMutation.mutateAsync({
      name: routeName,
      zone_id: zoneId,
      service_area_id: '',
      warehouse_id: '',
      creation_mode: 'sandbox',
      facility_ids: optimizedOrder || selectedFacilityIds,
      is_sandbox: true,
      algorithm_used: optimizedOrder ? (algorithmLabel || 'nearest_neighbor_2opt') : undefined,
      total_distance_km: optimizedDistance ?? undefined,
      estimated_duration_min: optimizedTime ? Math.round(optimizedTime * 60) : undefined,
      optimized_geometry: roadRoute ? {
        type: 'LineString',
        coordinates: roadRoute.geometry,
      } : undefined,
    });
    onClose();
  };

  // ─── Map Initialization ───
  useEffect(() => {
    if (!mapContainerRef.current || !zoneId) return;

    const center: [number, number] = zoneCenter
      ? [zoneCenter.lng, zoneCenter.lat]
      : [8.52, 12.0];

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getMapLibreStyle(theme as 'light' | 'dark' | 'system' | undefined),
      center,
      zoom: 10,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    // Add line source and layer for tethers
    map.on('load', () => {
      map.addSource('tethers', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      // Connector lines: thin dashed lines from facility markers to road
      map.addSource('connectors', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'connector-lines',
        type: 'line',
        source: 'connectors',
        paint: {
          'line-color': tw.emerald[500],
          'line-width': 1.5,
          'line-opacity': 0.6,
          'line-dasharray': [3, 3],
        },
      });
      map.addLayer({
        id: 'tether-lines',
        type: 'line',
        source: 'tethers',
        paint: {
          'line-color': tw.blue[500],
          'line-width': 3,
          'line-opacity': 0.8,
        },
      });

      // Alternative routes layer (rendered below main route)
      map.addSource('alt-routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'alt-route-lines',
        type: 'line',
        source: 'alt-routes',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'width'],
          'line-opacity': ['get', 'opacity'],
        },
      }, 'connector-lines'); // insert below connectors

      // Show route info popup on click
      map.on('click', 'alt-route-lines', (e) => {
        const props = e.features?.[0]?.properties;
        if (!props?.routeLabel) return;

        const timeStr = props.timeMinutes < 60
          ? `${props.timeMinutes} min`
          : `${(props.timeMinutes / 60).toFixed(1)} hrs`;

        new maplibregl.Popup({ closeButton: false, maxWidth: '200px' })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-size:12px;line-height:1.4">
              <strong style="color:${props.color || '#333'}">${props.routeLabel}</strong><br/>
              ${props.distanceKm} km &middot; ${timeStr}
            </div>
          `)
          .addTo(map);
      });

      // Click-to-reveal on tether lines (main route)
      map.on('click', 'tether-lines', (e) => {
        const props = e.features?.[0]?.properties;
        if (!props?.routeLabel) return;

        const timeStr = props.timeMinutes < 60
          ? `${props.timeMinutes} min`
          : `${(props.timeMinutes / 60).toFixed(1)} hrs`;

        new maplibregl.Popup({ closeButton: false, maxWidth: '200px' })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-size:12px;line-height:1.4">
              <strong style="color:${props.color || '#333'}">${props.routeLabel}</strong><br/>
              ${props.distanceKm} km &middot; ${timeStr}
            </div>
          `)
          .addTo(map);
      });

      // Pointer cursor on hover over route lines
      for (const layerId of ['alt-route-lines', 'tether-lines']) {
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      }
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      infoMarkersRef.current.forEach((m) => m.remove());
      infoMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [zoneId, theme]);

  // ─── Update markers & tethers ───
  useEffect(() => {
    if (!mapRef.current || !zoneId) return;
    const map = mapRef.current;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    // Zone center marker
    if (zoneCenter) {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="
          width: 40px; height: 40px;
          background: ${tw.blue[500]};
          border: 3px solid white;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 0 6px rgba(59,130,246,0.25), 0 2px 8px rgba(0,0,0,0.3);
          font-size: 18px; color: white; font-weight: bold;
        ">Z</div>
      `;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([zoneCenter.lng, zoneCenter.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(
            `<strong>${selectedZone?.name || 'Zone Center'}</strong><div style="font-size:12px;color:${tw.gray[500]};">Zone Center</div>`
          )
        )
        .addTo(map);
      markersRef.current.set('zone-center', marker);
    }

    // Facility markers
    facilities.forEach((f) => {
      if (!f.lat || !f.lng) return;
      const isSelected = selectedFacilityIds.includes(f.id);
      // In focus mode, skip unselected facilities
      if (focusSelected && !isSelected) return;
      const visitIndex = visitIndexByFacilityId.get(f.id);

      const el = document.createElement('div');
      el.style.cursor = 'pointer';
      el.style.width = '26px';
      el.style.height = '26px';
      el.innerHTML = `
        <div data-marker-inner="true" style="
          width: 26px; height: 26px;
          background: ${isSelected ? tw.emerald[500] : tw.gray[500]};
          border: 2px solid ${isSelected ? tw.emerald[600] : tw.gray[400]};
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
          color: white; font-size: 11px; font-weight: 700;
          transition: transform 120ms ease, opacity 120ms ease;
          transform-origin: center;
          opacity: ${isSelected ? 1 : 0.35};
        ">${visitIndex ?? ''}</div>
      `;

      const inner = el.querySelector('[data-marker-inner="true"]') as HTMLDivElement | null;

      el.addEventListener('mouseenter', () => {
        if (inner) inner.style.transform = 'scale(1.08)';
      });
      el.addEventListener('mouseleave', () => {
        if (inner) inner.style.transform = 'scale(1)';
      });

      const popup = new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML(
        `<div style="padding:4px;min-width:140px;">
          <strong>${f.name}</strong>
          <div style="font-size:12px;color:${tw.gray[500]};">${f.lga || 'Unknown LGA'} &middot; ${f.level_of_care || 'N/A'}</div>
          ${isSelected ? `<div style="font-size:11px;color:${tw.emerald[500]};margin-top:4px;">Stop #${visitIndex ?? ''}</div>` : ''}
        </div>`
      );

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([f.lng, f.lat])
        .setPopup(popup)
        .addTo(map);

      // Click should show info (popup) only — selection is controlled from the facility list.
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        marker.togglePopup();
        if (inner) inner.style.transform = 'scale(1.12)';
        window.setTimeout(() => {
          if (inner) inner.style.transform = 'scale(1)';
        }, 120);
      });

      markersRef.current.set(f.id, marker);
    });

    // Update tether lines
    if (zoneCenter && map.getSource('tethers')) {
      let features: Array<{
        type: 'Feature';
        properties: Record<string, unknown>;
        geometry: { type: 'LineString'; coordinates: [number, number][] };
      }> = [];

      if (tetherMode === 'route') {
        // Waypoint mode: show complete round trip via road geometry only — NO straight-line fallback
        if (roadRoute && roadRoute.geometry.length > 0) {
          features = [
            {
              type: 'Feature',
              properties: { mode: 'route', routeLabel: 'Optimized Route', distanceKm: roadRoute.roadDistanceKm, timeMinutes: roadRoute.roadTimeMinutes, color: ROUTE_COLORS.balanced },
              geometry: {
                type: 'LineString',
                coordinates: roadRoute.geometry,
              },
            },
          ];

          // Draw connector lines from each facility marker to its snapped position on the road
          if (roadRoute.snappedWaypoints.length > 0) {
            const orderedIds = optimizedOrder || selectedFacilityIds;
            const orderedFacilities = orderedIds
              .map((id) => facilities.find((f) => f.id === id))
              .filter((f): f is Facility => !!f && !!f.lat && !!f.lng);

            const connectorFeatures: typeof features = [];

            connectorFeatures.push({
              type: 'Feature',
              properties: { mode: 'connector' },
              geometry: {
                type: 'LineString',
                coordinates: [
                  [zoneCenter.lng, zoneCenter.lat],
                  roadRoute.snappedWaypoints[0],
                ],
              },
            });

            orderedFacilities.forEach((f, idx) => {
              const snappedIdx = idx + 1;
              if (snappedIdx < roadRoute.snappedWaypoints.length) {
                connectorFeatures.push({
                  type: 'Feature',
                  properties: { mode: 'connector' },
                  geometry: {
                    type: 'LineString',
                    coordinates: [
                      [f.lng, f.lat],
                      roadRoute.snappedWaypoints[snappedIdx],
                    ],
                  },
                });
              }
            });

            if (map.getSource('connectors')) {
              (map.getSource('connectors') as maplibregl.GeoJSONSource).setData({
                type: 'FeatureCollection',
                features: connectorFeatures,
              });
            }
          }
        } else if (waypointRoad && waypointRoad.geometry.length > 0) {
          // Pre-optimization: use waypoint road geometry (real roads through selection order)
          features = [
            {
              type: 'Feature',
              properties: { mode: 'route', routeLabel: 'Fastest', distanceKm: waypointRoad.roadDistanceKm, timeMinutes: waypointRoad.roadTimeMinutes, color: ROUTE_COLORS.balanced },
              geometry: {
                type: 'LineString',
                coordinates: waypointRoad.geometry,
              },
            },
          ];

          // Draw connector lines from each facility to its snapped road position
          if (waypointRoad.snappedWaypoints.length > 0) {
            const orderedFacilities = selectedFacilityIds
              .map((id) => facilities.find((f) => f.id === id))
              .filter((f): f is Facility => !!f && !!f.lat && !!f.lng);

            const connectorFeatures: typeof features = [];

            connectorFeatures.push({
              type: 'Feature',
              properties: { mode: 'connector' },
              geometry: {
                type: 'LineString',
                coordinates: [
                  [zoneCenter.lng, zoneCenter.lat],
                  waypointRoad.snappedWaypoints[0],
                ],
              },
            });

            orderedFacilities.forEach((f, idx) => {
              const snappedIdx = idx + 1;
              if (snappedIdx < waypointRoad.snappedWaypoints.length) {
                connectorFeatures.push({
                  type: 'Feature',
                  properties: { mode: 'connector' },
                  geometry: {
                    type: 'LineString',
                    coordinates: [
                      [f.lng, f.lat],
                      waypointRoad.snappedWaypoints[snappedIdx],
                    ],
                  },
                });
              }
            });

            if (map.getSource('connectors')) {
              (map.getSource('connectors') as maplibregl.GeoJSONSource).setData({
                type: 'FeatureCollection',
                features: connectorFeatures,
              });
            }
          }
        }
        // No else — if road geometry hasn't loaded yet, show nothing (no straight lines)

        // Clear alt-routes layer in route mode (only one route shown)
        if (map.getSource('alt-routes')) {
          (map.getSource('alt-routes') as maplibregl.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features: [],
          });
        }
      } else if (tetherMode === 'alternatives') {
        // Alternatives mode: show ONLY the selected comparison route, or all if none selected
        if (comparisonRoutes.length > 0 && map.getSource('alt-routes')) {
          const routesToShow = selectedComparisonId
            ? comparisonRoutes.filter(r => r.id === selectedComparisonId)
            : comparisonRoutes;

          const altFeatures = routesToShow
            .filter(r => r.geometry.length > 0)
            .map(r => ({
              type: 'Feature' as const,
              properties: {
                id: r.id,
                color: r.color,
                width: 4,
                opacity: 0.9,
                routeLabel: r.routeTypeLabel,
                distanceKm: r.distanceKm,
                timeMinutes: r.timeMinutes,
              },
              geometry: {
                type: 'LineString' as const,
                coordinates: r.geometry,
              },
            }));

          (map.getSource('alt-routes') as maplibregl.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features: altFeatures,
          });
        } else if (waypointAlternatives.length > 0 && map.getSource('alt-routes')) {
          // Pre-optimization alternatives (waypoint road alternatives)
          const altFeatures = waypointAlternatives.map((alt, idx) => {
            const color = ROUTE_COLORS[alt.routeType] || '#3b82f6';
            const label = ROUTE_TYPE_LABELS[alt.routeType] || alt.label;
            return {
              type: 'Feature' as const,
              properties: {
                color,
                width: idx === 0 ? 4 : 3,
                opacity: idx === 0 ? 0.9 : 0.7,
                routeLabel: label,
                distanceKm: alt.roadDistanceKm,
                timeMinutes: alt.roadTimeMinutes,
              },
              geometry: {
                type: 'LineString' as const,
                coordinates: alt.geometry,
              },
            };
          });

          (map.getSource('alt-routes') as maplibregl.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features: altFeatures,
          });
        }

        // Show the selected route in the main tether layer (with connectors)
        const activeRoute = selectedComparisonId
          ? comparisonRoutes.find(r => r.id === selectedComparisonId)
          : null;

        if (activeRoute && activeRoute.geometry.length > 0) {
          features = [
            {
              type: 'Feature',
              properties: { mode: 'route', routeLabel: activeRoute.routeTypeLabel, distanceKm: activeRoute.distanceKm, timeMinutes: activeRoute.timeMinutes, color: activeRoute.color },
              geometry: {
                type: 'LineString',
                coordinates: activeRoute.geometry,
              },
            },
          ];

          // Connectors for the selected route
          if (activeRoute.snappedWaypoints.length > 0) {
            const orderedIds = activeRoute.facilityOrder;
            const orderedFacilities = orderedIds
              .map((id) => facilities.find((f) => f.id === id))
              .filter((f): f is Facility => !!f && !!f.lat && !!f.lng);

            const connectorFeatures: typeof features = [];

            connectorFeatures.push({
              type: 'Feature',
              properties: { mode: 'connector' },
              geometry: {
                type: 'LineString',
                coordinates: [
                  [zoneCenter.lng, zoneCenter.lat],
                  activeRoute.snappedWaypoints[0],
                ],
              },
            });

            orderedFacilities.forEach((f, idx) => {
              const snappedIdx = idx + 1;
              if (snappedIdx < activeRoute.snappedWaypoints.length) {
                connectorFeatures.push({
                  type: 'Feature',
                  properties: { mode: 'connector' },
                  geometry: {
                    type: 'LineString',
                    coordinates: [
                      [f.lng, f.lat],
                      activeRoute.snappedWaypoints[snappedIdx],
                    ],
                  },
                });
              }
            });

            if (map.getSource('connectors')) {
              (map.getSource('connectors') as maplibregl.GeoJSONSource).setData({
                type: 'FeatureCollection',
                features: connectorFeatures,
              });
            }
          }
        } else if (roadRoute && roadRoute.geometry.length > 0) {
          // Fallback to the main roadRoute if no comparison selection
          features = [
            {
              type: 'Feature',
              properties: { mode: 'route', routeLabel: 'Optimized Route', distanceKm: roadRoute.roadDistanceKm, timeMinutes: roadRoute.roadTimeMinutes, color: ROUTE_COLORS.balanced },
              geometry: {
                type: 'LineString',
                coordinates: roadRoute.geometry,
              },
            },
          ];
        }
      } else {
        // Cardinal mode: zone center → each selected facility via road paths
        // Before optimization: show ALL paths (primary + alternatives) for full visibility
        // After optimization: show only primary path to reduce noise
        const isOptimized = !!optimizedOrder;
        const connectorFeatures: typeof features = [];
        const tetherPathFeatures: typeof features = [];
        const altPathFeatures: Array<{
          type: 'Feature';
          properties: Record<string, unknown>;
          geometry: { type: 'LineString'; coordinates: [number, number][] };
        }> = [];

        const selectedFacs = facilities.filter(
          (f) => selectedFacilityIds.includes(f.id) && f.lat && f.lng
        );

        for (const f of selectedFacs) {
          const paths = cardinalRoads[f.id];
          if (paths && paths.length > 0) {
            // Primary path always goes into tethers layer
            const primary = paths[0];
            const primaryColor = ROUTE_COLORS[primary.routeType] || '#3b82f6';
            const primaryLabel = ROUTE_TYPE_LABELS[primary.routeType] || primary.routeType;
            tetherPathFeatures.push({
              type: 'Feature',
              properties: {
                mode: 'route',
                routeLabel: `${f.name}: ${primaryLabel}`,
                distanceKm: primary.distanceKm,
                timeMinutes: primary.timeMinutes,
                color: primaryColor,
              },
              geometry: {
                type: 'LineString',
                coordinates: primary.geometry,
              },
            });

            // Alternative paths go into alt-routes layer (only before optimization)
            if (!isOptimized) {
              for (let i = 1; i < paths.length; i++) {
                const alt = paths[i];
                const color = ROUTE_COLORS[alt.routeType] || '#22c55e';
                altPathFeatures.push({
                  type: 'Feature' as const,
                  properties: {
                    color,
                    width: 3,
                    opacity: 0.6,
                    routeLabel: `${f.name}: ${ROUTE_TYPE_LABELS[alt.routeType] || alt.routeType}`,
                    distanceKm: alt.distanceKm,
                    timeMinutes: alt.timeMinutes,
                  },
                  geometry: {
                    type: 'LineString' as const,
                    coordinates: alt.geometry,
                  },
                });
              }
            }

            // Connectors: facility → road end, zone center → road start
            connectorFeatures.push({
              type: 'Feature' as const,
              properties: { mode: 'connector' },
              geometry: {
                type: 'LineString' as const,
                coordinates: [
                  [f.lng, f.lat],
                  primary.geometry[primary.geometry.length - 1],
                ],
              },
            });
            connectorFeatures.push({
              type: 'Feature' as const,
              properties: { mode: 'connector' },
              geometry: {
                type: 'LineString' as const,
                coordinates: [
                  [zoneCenter.lng, zoneCenter.lat],
                  primary.geometry[0],
                ],
              },
            });
          }
          // No straight-line fallback — skip facilities whose road geometry hasn't loaded yet
        }

        features = tetherPathFeatures;

        if (map.getSource('connectors')) {
          (map.getSource('connectors') as maplibregl.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features: connectorFeatures,
          });
        }

        if (map.getSource('alt-routes')) {
          (map.getSource('alt-routes') as maplibregl.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features: altPathFeatures,
          });
        }
      }

      (map.getSource('tethers') as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features,
      });

      // Clean up previous info markers (no longer auto-shown; popups used instead)
      infoMarkersRef.current.forEach(m => m.remove());
      infoMarkersRef.current = [];
    }

    // Fit bounds
    const points: [number, number][] = [];
    if (zoneCenter) points.push([zoneCenter.lng, zoneCenter.lat]);
    const facilitySet = focusSelected
      ? facilities.filter((f) => selectedFacilityIds.includes(f.id))
      : facilities;
    facilitySet.forEach((f) => {
      if (f.lat && f.lng) points.push([f.lng, f.lat]);
    });
    if (points.length >= 2) {
      const bounds = new maplibregl.LngLatBounds(points[0], points[0]);
      points.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, { padding: 50, maxZoom: 13 });
    }
  }, [facilities, selectedFacilityIds, zoneCenter, zoneId, toggleFacility, selectedZone?.name, tetherMode, optimizedOrder, roadRoute, waypointRoad, waypointAlternatives, focusSelected, cardinalRoads, comparisonRoutes, selectedComparisonId]);

  const canSave = zoneId && routeName.trim() && selectedFacilityIds.length > 0;

  return (
    <div className="h-[calc(100vh-220px)] flex flex-col gap-4 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium shrink-0">Zone</Label>
          <Select
            value={zoneId}
            onValueChange={(v) => setZoneId(v)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select zone" />
            </SelectTrigger>
            <SelectContent>
              {zones?.map((z) => (
                <SelectItem key={z.id} value={z.id}>
                  {z.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Label className="text-sm font-medium shrink-0">Route Name</Label>
          <Input
            placeholder="e.g., SB-Central-01"
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
            className="max-w-[250px]"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!canSave || createMutation.isPending}>
            {createMutation.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-1 h-4 w-4" />
            )}
            Create Sandbox Route
          </Button>
        </div>
      </div>

      {/* Sandbox banner */}
      <div className="rounded-lg border-2 border-dashed border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20 px-4 py-2">
        <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">
          Sandbox Mode — Routes will not be saved to production
        </p>
      </div>

      {!zoneId ? (
        <div className="flex-1 min-h-0 flex items-center justify-center text-muted-foreground">
          <div className="text-center space-y-2">
            <MapPin className="mx-auto h-10 w-10 opacity-40" />
            <p className="text-lg font-medium">Select a zone to begin</p>
            <p className="text-sm">Choose an operational zone from the dropdown above</p>
          </div>
        </div>
      ) : (
        /* 3-column layout */
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr_2fr] gap-4 flex-1 min-h-0">
          {/* Left: Map */}
          <div className={
            isMapFullscreen
              ? 'fixed inset-0 z-50 bg-background'
              : 'rounded-lg border overflow-hidden min-h-0 relative'
          }>
            <div className="absolute left-3 top-3 z-10">
              <ToggleGroup
                type="single"
                value={tetherMode}
                onValueChange={(v) => {
                  if (!v) return;
                  const mode = v as TetherMode;
                  setTetherMode(mode);
                  // Auto-fetch alternative paths when switching to alternatives mode
                  if (mode === 'alternatives' && optimizedOrder && optimizedOrder.length >= 2 && comparisonRoutes.length === 0) {
                    handleShowAlternatives();
                  }
                }}
                className="bg-background border rounded-md p-1 shadow-sm"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem value="cardinal" className="px-2" aria-label="Cardinal: origin to each facility">
                      <Radar className="h-4 w-4" />
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Cardinal — Route from origin to each facility</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem value="route" className="px-2" aria-label="Waypoint: complete round trip">
                      <Route className="h-4 w-4" />
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Waypoint — Complete trip & return to origin</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem
                      value="alternatives"
                      className="px-2"
                      aria-label="Alternatives: compare multiple routes"
                      disabled={!optimizedOrder || optimizedOrder.length < 2 || isFetchingAlternatives}
                    >
                      {isFetchingAlternatives ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Split className="h-4 w-4" />
                      )}
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Alternatives — Compare multiple routes</TooltipContent>
                </Tooltip>
              </ToggleGroup>
            </div>
            <MapOverlayControls
              isFullscreen={isMapFullscreen}
              onToggleFullscreen={() => {
                setIsMapFullscreen((v) => !v);
                setTimeout(() => mapRef.current?.resize(), 100);
              }}
              isFocusMode={focusSelected}
              onToggleFocusMode={() => setFocusSelected((v) => !v)}
              hasSelection={selectedFacilityIds.length > 0}
              className="absolute right-[10px] top-[79px] z-10"
            />
            <div ref={mapContainerRef} className="h-full w-full" />
          </div>

          {/* Middle: Facility List */}
          <div className="flex flex-col border rounded-lg min-h-0">
            <div className="p-3 border-b space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  Facilities
                  {!facilitiesLoading && (
                    <span className="ml-1 text-muted-foreground font-normal">
                      ({facilities.length})
                    </span>
                  )}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {selectedFacilityIds.length} selected
                </Badge>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search facilities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={handleSelectAll}>
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={handleClearAll}
                  disabled={selectedFacilityIds.length === 0}
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="p-2 space-y-1">
                {facilitiesLoading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Loading facilities...
                  </div>
                ) : facilitiesError ? (
                  <div className="flex items-center justify-center py-8 text-destructive text-center px-3">
                    <p className="text-sm">Error loading facilities: {facilitiesError.message}</p>
                  </div>
                ) : filteredFacilities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Building2 className="mx-auto h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">No facilities found</p>
                  </div>
                ) : (
                  filteredFacilities.map((f) => {
                    const isSelected = selectedFacilityIds.includes(f.id);
                    const dist = facilityDistances.get(f.id);
                    return (
                      <div
                        key={f.id}
                        className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-sm ${
                          isSelected
                            ? 'bg-primary/5 border border-primary/30'
                            : 'hover:bg-muted/50 border border-transparent'
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleFacility(f.id)}
                          className="shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{f.name}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span>{f.lga || 'Unknown LGA'}</span>
                            {f.level_of_care && (
                              <>
                                <span>&middot;</span>
                                <span>{f.level_of_care}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {dist !== undefined && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {dist} km
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right: Insights */}
          <div className="flex flex-col border rounded-lg min-h-0">
            <div className="p-3 border-b">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" />
                Route Insights
              </h3>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3 space-y-4">
                {selectedFacilityIds.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Ruler className="mx-auto h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">Select facilities to see insights</p>
                  </div>
                ) : (
                  <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 gap-2">
                      <Card>
                        <CardContent className="p-3 text-center">
                          <p className="text-2xl font-bold">{insights.count}</p>
                          <p className="text-xs text-muted-foreground">Facilities</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-3 text-center">
                          <p className="text-2xl font-bold">{insights.totalDistance}</p>
                          <p className="text-xs text-muted-foreground">Total km (straight-line)</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-3 text-center">
                          <p className="text-2xl font-bold">{insights.avgDistance}</p>
                          <p className="text-xs text-muted-foreground">Avg km</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-3 text-center">
                          <p className="text-2xl font-bold">
                            {insights.minDistance} - {insights.maxDistance}
                          </p>
                          <p className="text-xs text-muted-foreground">Min - Max km</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Optimization Settings */}
                    <Card>
                      <CardHeader className="p-3 pb-0">
                        <button
                          className="flex items-center justify-between w-full text-left"
                          onClick={() => setShowOptSettings((v) => !v)}
                        >
                          <CardTitle className="text-sm flex items-center gap-1.5">
                            <Settings2 className="h-4 w-4" />
                            Optimization Settings
                          </CardTitle>
                          {showOptSettings ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      </CardHeader>
                      {showOptSettings && (
                        <CardContent className="p-3 pt-2 space-y-2">
                          {OPTIMIZATION_CRITERIA.map((criterion) => {
                            const Icon = criterion.icon;
                            const isChecked = optConfig[criterion.key];
                            return (
                              <div
                                key={criterion.key}
                                className={`flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                                  isChecked ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50 border border-transparent'
                                }`}
                                onClick={() => toggleOptCriteria(criterion.key)}
                              >
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={() => toggleOptCriteria(criterion.key)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-0.5 shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-sm font-medium">{criterion.label}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {criterion.description}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </CardContent>
                      )}
                    </Card>

                    {/* Optimize button */}
                    <Button
                      className="w-full"
                      onClick={handleOptimize}
                      disabled={
                        isOptimizing ||
                        selectedFacilityIds.length < 2 ||
                        !Object.values(optConfig).some(Boolean)
                      }
                    >
                      {isOptimizing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="mr-2 h-4 w-4" />
                      )}
                      Optimize Route
                    </Button>

                    {/* Advanced Planning button */}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleAdvancedPlanning}
                      disabled={
                        isAdvancedPlanning ||
                        isFetchingAlternatives ||
                        selectedFacilityIds.length < 2
                      }
                    >
                      {isAdvancedPlanning ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Brain className="mr-2 h-4 w-4" />
                      )}
                      Advanced Planning
                    </Button>

                    {/* Route Comparison Panel */}
                    {comparisonRoutes.length > 0 && (
                      <RouteComparisonPanel
                        routes={comparisonRoutes}
                        selectedId={selectedComparisonId}
                        onSelect={handleSelectComparison}
                        onDismiss={handleDismissComparison}
                        title={comparisonMode === 'advanced' ? 'Advanced Planning' : 'Alternative Routes'}
                        grouped={comparisonMode === 'advanced'}
                      />
                    )}

                    {optimizedDistance !== null && (
                      <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {roadRoute ? 'Road Distance' : 'Optimized Distance'}
                            </span>
                            <span className="text-lg font-bold text-green-600">
                              {optimizedDistance} km
                            </span>
                          </div>
                          {isFetchingRoad && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Fetching road route...
                            </div>
                          )}
                          {optimizedTime !== null && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Est. Time</span>
                              <span className="text-sm font-medium">
                                {Math.floor(optimizedTime)}h {Math.round((optimizedTime % 1) * 60)}m
                              </span>
                            </div>
                          )}
                          {roadRoute && (
                            <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                              Road route
                            </Badge>
                          )}
                          {!roadRoute && !isFetchingRoad && optimizedDistance !== null && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Straight-line estimate
                            </Badge>
                          )}
                          {algorithmLabel && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {algorithmLabel.split(' + ').map((l) => (
                                <Badge key={l} variant="secondary" className="text-xs">
                                  {l}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Per-facility distances */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                          Facility Distances
                        </h4>
                        <div className="flex gap-1">
                          <Button
                            variant={sortInsightsBy === 'distance' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="text-xs h-6 px-2"
                            onClick={() => setSortInsightsBy('distance')}
                          >
                            {optimizedOrder ? 'Route' : 'Distance'}
                          </Button>
                          <Button
                            variant={sortInsightsBy === 'name' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="text-xs h-6 px-2"
                            onClick={() => setSortInsightsBy('name')}
                          >
                            Name
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-0">
                        {insightRows.map((row, idx) => {
                          const visitIdx = visitIndexByFacilityId.get(row.id);
                          return (
                          <div key={row.id}>
                            {/* Inter-facility distance connector */}
                            {idx > 0 && row.distFromPrevious != null && (
                              <div className="flex items-center gap-2 py-1.5 px-2">
                                <div className="w-5 flex justify-center shrink-0">
                                  <div className="w-px h-6 bg-muted-foreground/30" />
                                </div>
                                <div className="flex-1 flex items-center gap-1.5">
                                  <div className="h-px flex-1 bg-muted-foreground/20" />
                                  <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">
                                    {row.distFromPrevious} km between
                                  </span>
                                  <div className="h-px flex-1 bg-muted-foreground/20" />
                                </div>
                              </div>
                            )}
                            {/* First facility: show distance from origin */}
                            {idx === 0 && row.distFromPrevious != null && (
                              <div className="flex items-center gap-2 py-1.5 px-2">
                                <div className="w-5 flex justify-center shrink-0">
                                  <div className="w-px h-4 bg-blue-400/50" />
                                </div>
                                <span className="text-[10px] text-blue-500 font-medium">
                                  {row.distFromPrevious} km from origin
                                </span>
                              </div>
                            )}
                            {/* Facility row */}
                            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30 text-sm">
                              {visitIdx != null && (
                                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold shrink-0">
                                  {visitIdx}
                                </span>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="truncate font-medium">{row.name}</p>
                                <p className="text-xs text-muted-foreground">{row.lga}</p>
                              </div>
                              <Badge variant="outline" className="shrink-0 text-xs">
                                {row.distance} km
                              </Badge>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Optimization panel for batch route tab.
 * Allows running TSP algorithms on batch facilities and applying results.
 * Includes Optimization Settings, Optimize Route, Advanced Planning,
 * Route Comparison, and Vehicle Suggestion — matching SandboxRouteBuilder.
 */

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Zap,
  Loader2,
  Check,
  ArrowRight,
  Settings2,
  ChevronDown,
  ChevronUp,
  Brain,
  Truck,
} from 'lucide-react';
import {
  solveWithConfig,
  OPTIMIZATION_CRITERIA,
  DEFAULT_OPTIMIZATION_CONFIG,
  AVG_SPEED_KMH,
  SERVICE_TIME_HOURS,
  ROUTE_COLORS,
  ALGORITHM_COLOR_OFFSET,
  type OptimizationConfig,
} from '@/lib/algorithms/routeOptimizer';
import { type GeoPoint } from '@/lib/algorithms/distanceMatrix';
import { calculateDistance } from '@/lib/routeOptimization';
import {
  getRoadRoute,
  getAlternativeRoadRoutes,
  type RoadRouteResult,
} from '@/lib/geoapify';
import { RouteComparisonPanel } from '@/pages/storefront/zones/components/routes/RouteComparisonPanel';
import { VehicleSuggestionCard } from '@/components/unified-workflow/shared/VehicleSuggestionCard';
import { useBatchUpdate } from '@/hooks/useBatchUpdate';
import { useVehicles } from '@/hooks/useVehicles';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useWorkspaceSettings } from '@/hooks/settings/useWorkspaceSettings';
import type { DeliveryBatch } from '@/types';
import type { ComparisonRoute } from '@/types/routes';

interface BatchOptimizationPanelProps {
  batch: DeliveryBatch;
  depot: { lat: number; lng: number; name: string } | null;
}

export function BatchOptimizationPanel({ batch, depot }: BatchOptimizationPanelProps) {
  const [config, setConfig] = useState<OptimizationConfig>({ ...DEFAULT_OPTIMIZATION_CONFIG });
  const [showOptSettings, setShowOptSettings] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isFetchingRoad, setIsFetchingRoad] = useState(false);
  const [result, setResult] = useState<{
    orderedIds: string[];
    label: string;
    haversineKm: number;
    roadRoute: RoadRouteResult | null;
  } | null>(null);

  // Advanced Planning state
  const [isAdvancedPlanning, setIsAdvancedPlanning] = useState(false);
  const [comparisonRoutes, setComparisonRoutes] = useState<ComparisonRoute[]>([]);
  const [selectedComparisonId, setSelectedComparisonId] = useState<string | null>(null);

  // Vehicle Suggestion state
  const [suggestedVehicleId, setSuggestedVehicleId] = useState<string | null>(null);

  const batchUpdate = useBatchUpdate();
  const { data: vehicles = [] } = useVehicles();
  const { workspaceId } = useWorkspace();
  const { data: wsSettings } = useWorkspaceSettings(workspaceId);
  const waitingTimeMin = wsSettings?.settings?.waiting_time_sla_minutes ?? SERVICE_TIME_HOURS * 60;

  // Current route distance (haversine)
  const currentDistanceKm = useMemo(() => {
    if (!depot) return batch.totalDistance;
    let total = 0;
    let prev = { lat: depot.lat, lng: depot.lng };
    for (const f of batch.facilities) {
      if (f.lat && f.lng) {
        total += calculateDistance(prev.lat, prev.lng, f.lat, f.lng);
        prev = { lat: f.lat, lng: f.lng };
      }
    }
    total += calculateDistance(prev.lat, prev.lng, depot.lat, depot.lng);
    return Math.round(total * 10) / 10;
  }, [batch.facilities, depot, batch.totalDistance]);

  const validFacilities = useMemo(
    () => batch.facilities.filter(f => typeof f.lat === 'number' && typeof f.lng === 'number'),
    [batch.facilities]
  );

  // Vehicle suggestions: rank available vehicles by capacity fit
  const vehicleSuggestions = useMemo(() => {
    const facilityCount = validFacilities.length;
    if (facilityCount === 0) return [];

    const available = vehicles.filter(v => v.status === 'available');
    if (available.length === 0) return [];

    return available
      .map(v => {
        const capacitySlots = v.capacity > 0 ? Math.floor(v.capacity) : 10;
        const utilization = Math.min(Math.round((facilityCount / capacitySlots) * 100), 100);
        return {
          vehicle_id: v.id,
          vehicle_model: `${v.model} (${v.plateNumber})`,
          total_slots: capacitySlots,
          utilization_pct: utilization,
          capacity: v.capacity,
          maxWeight: v.maxWeight,
        };
      })
      .filter(s => s.utilization_pct <= 100)
      .sort((a, b) => {
        // Prefer 70-90% utilization (target 80%)
        const aScore = Math.abs(a.utilization_pct - 80);
        const bScore = Math.abs(b.utilization_pct - 80);
        return aScore - bScore;
      })
      .slice(0, 3);
  }, [vehicles, validFacilities]);

  const toggleOptCriteria = (key: keyof OptimizationConfig) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
    setResult(null);
    setComparisonRoutes([]);
    setSelectedComparisonId(null);
  };

  const handleOptimize = async () => {
    if (!depot || validFacilities.length < 2) return;
    if (!Object.values(config).some(Boolean)) return;

    setIsOptimizing(true);
    setResult(null);
    setComparisonRoutes([]);
    setSelectedComparisonId(null);

    try {
      const points: GeoPoint[] = validFacilities.map(f => ({
        id: f.id,
        lat: f.lat,
        lng: f.lng,
      }));

      const { orderedIds, algorithmLabel } = solveWithConfig(depot, points, config, waitingTimeMin);

      // Calculate haversine distance for optimized order
      const orderedFacs = orderedIds
        .map(id => points.find(p => p.id === id))
        .filter((p): p is GeoPoint => !!p);

      let haversineKm = 0;
      let prev = { lat: depot.lat, lng: depot.lng };
      for (const f of orderedFacs) {
        haversineKm += calculateDistance(prev.lat, prev.lng, f.lat, f.lng);
        prev = f;
      }
      haversineKm += calculateDistance(prev.lat, prev.lng, depot.lat, depot.lng);
      haversineKm = Math.round(haversineKm * 10) / 10;

      setResult({ orderedIds, label: algorithmLabel, haversineKm, roadRoute: null });
      setIsOptimizing(false);

      // Fetch real road route (non-blocking)
      setIsFetchingRoad(true);
      try {
        const waypoints = [depot, ...orderedFacs, depot];
        const road = await getRoadRoute(waypoints);
        if (road) {
          setResult(prev => (prev ? { ...prev, roadRoute: road } : null));
        }
      } catch (err) {
        console.error('Road route fetch failed:', err);
      }
      setIsFetchingRoad(false);
    } catch (err) {
      console.error('Optimization failed:', err);
      setIsOptimizing(false);
    }
  };

  // Advanced Planning: run all 4 algorithms × 3 road types
  const handleAdvancedPlanning = async () => {
    if (!depot || validFacilities.length < 2) return;

    setIsAdvancedPlanning(true);
    setComparisonRoutes([]);
    setSelectedComparisonId(null);
    setResult(null);

    try {
      const points: GeoPoint[] = validFacilities.map(f => ({
        id: f.id,
        lat: f.lat,
        lng: f.lng,
      }));

      const configs: { config: OptimizationConfig; label: string }[] = [
        { config: { shortestDistance: true, fuelEfficiency: false, timeOptimized: false, clusterPriority: false }, label: 'Shortest Distance' },
        { config: { shortestDistance: false, fuelEfficiency: true, timeOptimized: false, clusterPriority: false }, label: 'Fuel Efficient' },
        { config: { shortestDistance: false, fuelEfficiency: false, timeOptimized: true, clusterPriority: false }, label: 'Time Optimized' },
        { config: { shortestDistance: false, fuelEfficiency: false, timeOptimized: false, clusterPriority: true }, label: 'Cluster Priority' },
      ];

      // Deduplicate identical orderings
      const uniqueOrderings = new Map<string, { orderedIds: string[]; algorithmLabel: string }>();
      for (const { config: cfg, label } of configs) {
        const res = solveWithConfig(depot, points, cfg, waitingTimeMin);
        const key = res.orderedIds.join(',');
        if (!uniqueOrderings.has(key)) {
          uniqueOrderings.set(key, { orderedIds: res.orderedIds, algorithmLabel: label });
        }
      }

      // Fetch alternative road routes for each unique ordering in parallel
      const allRoutes: ComparisonRoute[] = [];
      const promises = [...uniqueOrderings.entries()].map(async ([, { orderedIds, algorithmLabel: algLabel }]) => {
        const orderedFacilities = orderedIds
          .map(id => points.find(p => p.id === id))
          .filter((p): p is GeoPoint => !!p);

        const waypoints = [
          { lat: depot.lat, lng: depot.lng },
          ...orderedFacilities.map(f => ({ lat: f.lat, lng: f.lng })),
          { lat: depot.lat, lng: depot.lng },
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
      for (const res of results) {
        if (res.status === 'fulfilled') {
          allRoutes.push(...res.value);
        }
      }

      // Sort by distance
      allRoutes.sort((a, b) => a.distanceKm - b.distanceKm);
      setComparisonRoutes(allRoutes);

      // Auto-select the shortest
      if (allRoutes.length > 0) {
        setSelectedComparisonId(allRoutes[0].id);
        const best = allRoutes[0];
        setResult({
          orderedIds: best.facilityOrder,
          label: best.algorithmLabel,
          haversineKm: best.distanceKm,
          roadRoute: {
            roadDistanceKm: best.distanceKm,
            roadTimeMinutes: best.timeMinutes,
            geometry: best.geometry,
            snappedWaypoints: best.snappedWaypoints,
          },
        });
      }
    } catch (err) {
      console.error('Advanced planning failed:', err);
    }
    setIsAdvancedPlanning(false);
  };

  const handleSelectComparison = (id: string) => {
    setSelectedComparisonId(id);
    const route = comparisonRoutes.find(r => r.id === id);
    if (!route) return;

    setResult({
      orderedIds: route.facilityOrder,
      label: route.algorithmLabel,
      haversineKm: route.distanceKm,
      roadRoute: {
        roadDistanceKm: route.distanceKm,
        roadTimeMinutes: route.timeMinutes,
        geometry: route.geometry,
        snappedWaypoints: route.snappedWaypoints,
      },
    });
  };

  const handleDismissComparison = () => {
    setComparisonRoutes([]);
    setSelectedComparisonId(null);
  };

  const handleApply = () => {
    if (!result) return;

    const updates: Record<string, unknown> = {
      facility_ids: result.orderedIds,
    };

    if (result.roadRoute) {
      updates.optimized_route = result.roadRoute.geometry;
      updates.total_distance = result.roadRoute.roadDistanceKm;
      updates.estimated_duration =
        result.roadRoute.roadTimeMinutes + validFacilities.length * waitingTimeMin;
    } else {
      updates.total_distance = result.haversineKm;
      updates.estimated_duration =
        (result.haversineKm / AVG_SPEED_KMH) * 60 +
        validFacilities.length * waitingTimeMin;
    }

    if (suggestedVehicleId) {
      updates.vehicle_id = suggestedVehicleId;
    }

    batchUpdate.mutate(
      { batchId: batch.id, updates },
      { onSuccess: () => setResult(null) }
    );
  };

  const savings = result
    ? Math.round((currentDistanceKm - (result.roadRoute?.roadDistanceKm ?? result.haversineKm)) * 10) / 10
    : 0;

  if (batch.status === 'completed' || batch.status === 'cancelled') return null;

  return (
    <div className="space-y-3">
      {/* Optimization Settings (collapsible) */}
      <Card>
        <CardHeader className="p-3 pb-0">
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={() => setShowOptSettings(v => !v)}
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
            {OPTIMIZATION_CRITERIA.map(criterion => {
              const Icon = criterion.icon;
              const isChecked = config[criterion.key];
              return (
                <div
                  key={criterion.key}
                  className={`flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                    isChecked
                      ? 'bg-primary/5 border border-primary/20'
                      : 'hover:bg-muted/50 border border-transparent'
                  }`}
                  onClick={() => toggleOptCriteria(criterion.key)}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggleOptCriteria(criterion.key)}
                    onClick={e => e.stopPropagation()}
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

      {/* Optimize Route button */}
      <Button
        size="sm"
        className="w-full"
        onClick={handleOptimize}
        disabled={
          isOptimizing ||
          validFacilities.length < 2 ||
          !depot ||
          !Object.values(config).some(Boolean)
        }
      >
        {isOptimizing ? (
          <>
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            Optimizing...
          </>
        ) : (
          <>
            <Zap className="h-3.5 w-3.5 mr-1.5" />
            Optimize Route
          </>
        )}
      </Button>

      {/* Advanced Planning button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={handleAdvancedPlanning}
        disabled={isAdvancedPlanning || isOptimizing || validFacilities.length < 2 || !depot}
      >
        {isAdvancedPlanning ? (
          <>
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            Planning...
          </>
        ) : (
          <>
            <Brain className="h-3.5 w-3.5 mr-1.5" />
            Advanced Planning
          </>
        )}
      </Button>

      {/* Route Comparison Panel */}
      {comparisonRoutes.length > 0 && (
        <RouteComparisonPanel
          routes={comparisonRoutes}
          selectedId={selectedComparisonId}
          onSelect={handleSelectComparison}
          onDismiss={handleDismissComparison}
          title="Advanced Planning"
          grouped
        />
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {result.label}
              </Badge>
              {isFetchingRoad && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Fetching road data...
                </span>
              )}
            </div>

            {/* Before / After comparison */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center p-2 rounded bg-muted/50">
                <p className="text-muted-foreground">Current</p>
                <p className="font-medium">{currentDistanceKm} km</p>
              </div>
              <div className="flex items-center justify-center">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <p className="text-muted-foreground">Optimized</p>
                <p className="font-medium">
                  {result.roadRoute
                    ? `${result.roadRoute.roadDistanceKm} km`
                    : `${result.haversineKm} km`}
                </p>
              </div>
            </div>

            {savings > 0 && (
              <p className="text-xs text-emerald-600 text-center font-medium">
                Saves {savings} km ({Math.round((savings / currentDistanceKm) * 100)}%)
              </p>
            )}

            <Button
              size="sm"
              variant="default"
              className="w-full"
              onClick={handleApply}
              disabled={batchUpdate.isPending}
            >
              {batchUpdate.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5 mr-1.5" />
              )}
              Apply Optimized Route
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Vehicle Suggestion */}
      <Card>
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Truck className="h-4 w-4" />
            Vehicle Suggestion
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-2 space-y-2">
          {vehicleSuggestions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {vehicles.length === 0
                ? 'No vehicles found — add vehicles in VLMS'
                : 'No available vehicles match this batch'}
            </p>
          ) : (
            vehicleSuggestions.map(suggestion => (
              <VehicleSuggestionCard
                key={suggestion.vehicle_id}
                vehicleId={suggestion.vehicle_id}
                vehicleModel={suggestion.vehicle_model}
                totalSlots={suggestion.total_slots}
                utilizationPct={suggestion.utilization_pct}
                isSelected={suggestedVehicleId === suggestion.vehicle_id}
                onSelect={() =>
                  setSuggestedVehicleId(
                    suggestedVehicleId === suggestion.vehicle_id ? null : suggestion.vehicle_id
                  )
                }
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

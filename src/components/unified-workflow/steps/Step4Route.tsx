/**
 * =====================================================
 * Step 6: Route Optimization — Manual Scheduling
 * =====================================================
 * Route optimization is now run-scoped, not schedule-scoped.
 *
 * Each dispatch run generated in Step 5 has its own:
 *  - route
 *  - timing
 *  - optimization mode
 *  - map view
 *
 * Layout:
 *   [Left: Generated Runs]
 *   [Center: Selected Run Map]
 *   [Right: Optimization Settings + Route Metrics]
 */

import * as React from 'react';
import {
  Route,
  Map as MapIconLucide,
  Play,
  RefreshCw,
  Clock,
  MapPin,
  CheckCircle,
  Settings,
  Truck,
  Fuel,
  Calendar,
  ArrowRight,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import type { WorkingSetItem, AiOptimizationOptions } from '@/types/unified-workflow';
import type { RoutePoint } from '@/types/scheduler';
import type { DispatchRunProjection, ExecutionWaveProjection } from '@/types/unified-workflow';
import { BatchRouteMap } from '@/components/batches/BatchRouteMap';
import type { Facility } from '@/types';

export interface FacilityWithCoords {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
}

type OptimizationMode = 'shortest_distance' | 'fastest_route' | 'efficiency' | 'priority_complex';

interface Step4RouteProps {
  facilities: WorkingSetItem[];
  facilitiesWithCoords?: FacilityWithCoords[];
  startLocation?: { id: string; name: string; lat?: number; lng?: number } | null;
  startLocationName: string | null;
  optimizedRoute: RoutePoint[];
  routeGeometry?: Array<[number, number]> | null;
  totalDistanceKm: number | null;
  estimatedDurationMin: number | null;
  isOptimizing: boolean;
  optimizationOptions?: AiOptimizationOptions;
  onOptimizationOptionsChange?: (options: Partial<AiOptimizationOptions>) => void;
  onOptimize: () => Promise<void>;
  // Execution waves from Batch step (run-scoped routing)
  executionWaves?: ExecutionWaveProjection[];
}

const OPTIMIZATION_MODES: { value: OptimizationMode; label: string; description: string }[] = [
  {
    value: 'shortest_distance',
    label: 'Shortest Distance',
    description: 'Minimize total travel distance (km)',
  },
  {
    value: 'fastest_route',
    label: 'Fastest Route',
    description: 'Minimize total travel time',
  },
  {
    value: 'efficiency',
    label: 'Efficiency',
    description: 'Optimize fuel, stop density, and timing balance',
  },
  {
    value: 'priority_complex',
    label: 'Priority Complex',
    description: 'Prioritize emergency / high-priority facilities first',
  },
];

export function Step4Route({
  facilities,
  facilitiesWithCoords = [],
  startLocation,
  startLocationName,
  optimizedRoute,
  routeGeometry,
  totalDistanceKm,
  estimatedDurationMin,
  isOptimizing,
  optimizationOptions = {
    shortest_distance: true,
    fastest_route: false,
    efficiency: false,
    priority_complex: false,
  },
  onOptimizationOptionsChange,
  onOptimize,
  executionWaves = [],
}: Step4RouteProps) {
  const [isMapFullscreen, setIsMapFullscreen] = React.useState(false);

  // Selected run for optimization
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);
  const [selectedOptMode, setSelectedOptMode] = React.useState<OptimizationMode>('shortest_distance');
  // Selected stop in the sequence (for tact-map focus + per-stop metrics)
  const [selectedStopIndex, setSelectedStopIndex] = React.useState<number | null>(null);

  // Derive all runs from waves
  const allRuns = React.useMemo(
    () => executionWaves.flatMap(w => w.runs),
    [executionWaves],
  );

  const selectedRun = React.useMemo(
    () => (selectedRunId ? allRuns.find(r => r.id === selectedRunId) ?? null : null),
    [selectedRunId, allRuns],
  );

  // Facilities to show on map — selected run's facilities, or all if no run selected
  const displayFacilities = React.useMemo(() => {
    if (selectedRun) {
      return facilities.filter(f => selectedRun.facility_ids.includes(f.facility_id));
    }
    return facilities;
  }, [selectedRun, facilities]);

  // Create facility coordinate lookup
  const facilityMap = React.useMemo(() => {
    const m = new Map<string, FacilityWithCoords>();
    facilitiesWithCoords.forEach(f => m.set(f.id, f));
    return m;
  }, [facilitiesWithCoords]);

  const hasRoute = optimizedRoute.length > 0;

  // Ordered stop list (respects optimized order when available)
  const orderedStops = React.useMemo(() => {
    if (selectedRun) return displayFacilities;
    if (hasRoute && optimizedRoute.length > 0) {
      return optimizedRoute
        .map(pt => facilities.find(f => f.facility_id === pt.facility_id))
        .filter((f): f is WorkingSetItem => !!f);
    }
    return facilities;
  }, [selectedRun, displayFacilities, hasRoute, optimizedRoute, facilities]);

  const selectedStop = selectedStopIndex !== null ? (orderedStops[selectedStopIndex] ?? null) : null;

  // Format helpers
  const durationLabel = React.useMemo(() => {
    if (!estimatedDurationMin) return '—';
    const h = Math.floor(estimatedDurationMin / 60);
    const m = estimatedDurationMin % 60;
    return h === 0 ? `${m} min` : m === 0 ? `${h} hr` : `${h} hr ${m} min`;
  }, [estimatedDurationMin]);

  // Estimated fuel (rough: 0.25L/km for a van)
  const fuelEstimate = totalDistanceKm ? (totalDistanceKm * 0.25).toFixed(0) : null;

  // ETA return label
  const etaReturnLabel = React.useMemo(() => {
    if (!selectedRun) return null;
    return selectedRun.return_time;
  }, [selectedRun]);

  // Convert facilities for BatchRouteMap
  const mapFacilities = React.useMemo<Facility[]>(() => {
    return displayFacilities
      .map(item => {
        const coords = facilityMap.get(item.facility_id);
        if (!coords?.lat || !coords?.lng) return null;
        return {
          id: item.facility_id,
          name: item.facility_name,
          address: '',
          lat: coords.lat,
          lng: coords.lng,
          warehouse_code: '',
          state: '',
        } as Facility;
      })
      .filter(Boolean) as Facility[];
  }, [displayFacilities, facilityMap]);

  // Convert startLocation to depot format for BatchRouteMap
  const depot = React.useMemo(() => {
    if (!startLocation?.lat || !startLocation?.lng) return null;
    return { lat: startLocation.lat, lng: startLocation.lng, name: startLocation.name ?? 'Warehouse' };
  }, [startLocation]);

  // Sync optimization mode with options
  const handleModeChange = (mode: OptimizationMode) => {
    setSelectedOptMode(mode);
    if (!onOptimizationOptionsChange) return;
    onOptimizationOptionsChange({
      shortest_distance: mode === 'shortest_distance',
      fastest_route:     mode === 'fastest_route',
      efficiency:        mode === 'efficiency',
      priority_complex:  mode === 'priority_complex',
    });
  };

  const hasWaves = allRuns.length > 0;

  return (
    <div className="flex flex-col min-h-[65vh]">
      {/* Optimization mode bar */}
      {onOptimizationOptionsChange && (
        <div className="px-6 py-3 border-b bg-muted/20 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground flex-shrink-0">
            <Settings className="h-3.5 w-3.5 inline mr-1" />
            Optimization Mode
          </span>
          {OPTIMIZATION_MODES.map(m => (
            <button
              key={m.value}
              onClick={() => handleModeChange(m.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                selectedOptMode === m.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:border-primary/50',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[240px_1fr_300px] gap-0 overflow-hidden">
        {/* ----------------------------------------
            Left: Generated Runs
        ---------------------------------------- */}
        <div className="border-r flex flex-col min-h-0">
          <div className="px-4 py-3 border-b bg-muted/30 flex-shrink-0">
            <h3 className="text-sm font-medium">Generated Runs</h3>
            <p className="text-xs text-muted-foreground">
              {hasWaves ? `${allRuns.length} dispatch runs across ${executionWaves.length} waves` : 'No runs yet — assign vehicles in Batch step'}
            </p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {!hasWaves && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-center">
                  <Route className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">No runs generated</p>
                  <p className="text-xs mt-1">Go back to Batch step and assign vehicles</p>
                </div>
              )}

              {executionWaves.map(wave => (
                <div key={wave.id} className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
                    {wave.label}
                  </p>
                  {wave.runs.map(run => (
                    <RunCard
                      key={run.id}
                      run={run}
                      isSelected={selectedRunId === run.id}
                      onSelect={() => setSelectedRunId(prev => prev === run.id ? null : run.id)}
                    />
                  ))}
                </div>
              ))}

              {/* Fall back to all-facilities if no waves */}
              {!hasWaves && facilities.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
                    All Facilities
                  </p>
                  {facilities.map((f, idx) => (
                    <div key={f.facility_id} className="flex items-center gap-2 px-3 py-2 rounded-md border bg-card text-xs">
                      <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center font-medium text-muted-foreground">
                        {idx + 1}
                      </span>
                      <span className="flex-1 truncate">{f.facility_name}</span>
                      <Badge variant="outline" className="text-[10px] px-1">{f.slot_demand}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ----------------------------------------
            Center col — Row 1: Runs/Waves  |  Row 2: Tact Map
        ---------------------------------------- */}
        <div className="flex flex-col min-h-0">

          {/* ── Row 1: Runs / Waves ── */}
          <div className="flex flex-col border-b" style={{ height: '220px' }}>
            <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-xs font-semibold">Runs</h3>
                <p className="text-[10px] text-muted-foreground">
                  {hasWaves
                    ? `${allRuns.length} run${allRuns.length !== 1 ? 's' : ''} across ${executionWaves.length} wave${executionWaves.length !== 1 ? 's' : ''}`
                    : 'No runs — assign vehicles in Batch step'}
                </p>
              </div>
              {selectedRun && (
                <Button
                  onClick={onOptimize}
                  disabled={isOptimizing || displayFacilities.length === 0}
                  size="sm"
                  className="h-7 text-xs"
                >
                  {isOptimizing ? (
                    <><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Optimizing…</>
                  ) : hasRoute ? (
                    <><RefreshCw className="h-3 w-3 mr-1" />Re-optimize Run</>
                  ) : (
                    <><Play className="h-3 w-3 mr-1" />Optimize Run</>
                  )}
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {!hasWaves && (
                  <div className="flex flex-col items-center justify-center py-6 text-muted-foreground text-center">
                    <Route className="h-7 w-7 mb-1.5 opacity-30" />
                    <p className="text-xs">No runs generated</p>
                    <p className="text-[10px] mt-0.5">Go back to Batch step and assign vehicles</p>
                  </div>
                )}

                {executionWaves.map(wave => (
                  <div key={wave.id} className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
                      {wave.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {wave.runs.map(run => (
                        <RunCard
                          key={run.id}
                          run={run}
                          isSelected={selectedRunId === run.id}
                          onSelect={() => setSelectedRunId(prev => prev === run.id ? null : run.id)}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {!hasWaves && facilities.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
                      All Facilities
                    </p>
                    {facilities.map((f, idx) => (
                      <div key={f.facility_id} className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-card text-xs">
                        <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center font-medium text-muted-foreground text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="flex-1 truncate">{f.facility_name}</span>
                        <Badge variant="outline" className="text-[10px] px-1">{f.slot_demand}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* ── Row 2: Route Preview ── */}
          <div className="flex flex-col flex-1 min-h-0">
            {/* Route Preview sub-header */}
            <div className="px-3 py-1.5 border-b bg-muted/20 flex items-center gap-2 flex-shrink-0">
              <MapIconLucide className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              {selectedRun ? (
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <p className="text-xs font-medium truncate">
                    Run {selectedRun.run_index} · {selectedRun.vehicle_label}
                  </p>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {selectedRun.departure_time} → {selectedRun.return_time} · {selectedRun.facility_ids.length} stops
                  </span>
                </div>
              ) : (
                <p className="text-xs font-medium">Route Preview</p>
              )}
            </div>

            {/* Map canvas */}
            <div
              className={cn(
                'flex-1 relative',
                isMapFullscreen ? 'fixed inset-0 z-50' : '',
              )}
              style={{ minHeight: '260px' }}
            >
              {facilities.length === 0 ? (
                <div className="h-full flex items-center justify-center bg-muted">
                  <div className="text-center text-muted-foreground">
                    <Route className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No facilities to display</p>
                  </div>
                </div>
              ) : (
                <BatchRouteMap
                  facilities={mapFacilities}
                  warehouse={depot}
                  enableControls
                  isFullscreen={isMapFullscreen}
                  onToggleFullscreen={() => setIsMapFullscreen(prev => !prev)}
                />
              )}

              {!selectedRun && hasWaves && facilities.length > 0 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
                  <div className="flex items-center gap-1.5 bg-background/90 border rounded-full px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
                    <MapPin className="h-3 w-3" />
                    Select a run above to optimize its route
                  </div>
                </div>
              )}

              {!hasWaves && facilities.length > 0 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                  <Button onClick={onOptimize} disabled={isOptimizing} size="sm" className="shadow-lg">
                    {isOptimizing ? (
                      <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />Optimizing…</>
                    ) : hasRoute ? (
                      <><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Re-optimize Route</>
                    ) : (
                      <><Play className="h-3.5 w-3.5 mr-1.5" />Optimize Route</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ----------------------------------------
            Right: Route Metrics
        ---------------------------------------- */}
        <div className="border-l flex flex-col min-h-0">
          <div className="px-4 py-3 border-b bg-muted/30 flex-shrink-0">
            <h3 className="text-sm font-medium">Route Metrics</h3>
            <p className="text-xs text-muted-foreground">
              {selectedRun ? `Run ${selectedRun.run_index}` : 'Select a run'}
            </p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Metrics grid */}
              <div className="grid grid-cols-2 gap-2">
                <MetricTile
                  icon={<Route className="h-4 w-4" />}
                  label="Distance"
                  value={totalDistanceKm ? `${totalDistanceKm.toFixed(1)} km` : '—'}
                  active={hasRoute}
                />
                <MetricTile
                  icon={<Clock className="h-4 w-4" />}
                  label="Duration"
                  value={durationLabel}
                  active={hasRoute}
                />
                <MetricTile
                  icon={<ArrowRight className="h-4 w-4" />}
                  label="ETA Return"
                  value={etaReturnLabel ?? (selectedRun?.return_time ?? '—')}
                  active={!!selectedRun}
                />
                <MetricTile
                  icon={<Fuel className="h-4 w-4" />}
                  label="Fuel Est."
                  value={fuelEstimate ? `${fuelEstimate} L` : '—'}
                  active={!!fuelEstimate}
                />
              </div>

              {hasRoute && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                  <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  Route optimized
                </div>
              )}

              <Separator />

              {/* Per-stop details when a stop is focused */}
              {selectedStop && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    Stop {selectedStopIndex! + 1} — {selectedStop.facility_name}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-background rounded p-2">
                      <p className="text-muted-foreground">Slots</p>
                      <p className="font-semibold">{selectedStop.slot_demand ?? '—'}</p>
                    </div>
                    <div className="bg-background rounded p-2">
                      <p className="text-muted-foreground">Weight</p>
                      <p className="font-semibold">
                        {selectedStop.weight_kg ? `${selectedStop.weight_kg} kg` : '—'}
                      </p>
                    </div>
                    {selectedStop.lga && (
                      <div className="col-span-2 bg-background rounded p-2">
                        <p className="text-muted-foreground">LGA</p>
                        <p className="font-semibold truncate">{selectedStop.lga}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Stop sequence — click any stop to focus the tact map */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium">
                    {selectedRun ? `Stop Sequence — Run ${selectedRun.run_index}` : 'Stop Sequence'}
                  </p>
                  {selectedStopIndex !== null && (
                    <button
                      onClick={() => setSelectedStopIndex(null)}
                      className="text-[10px] text-muted-foreground hover:text-foreground underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {/* Origin */}
                  <div className="flex items-center gap-2 p-2 rounded bg-primary/5 text-xs">
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center flex-shrink-0">S</span>
                    <span className="font-medium flex-1 truncate">{startLocationName || 'Warehouse'}</span>
                    <Badge variant="secondary" className="text-[10px] flex-shrink-0">Origin</Badge>
                  </div>

                  {orderedStops.map((f, idx) => (
                    <button
                      key={f.facility_id}
                      onClick={() => setSelectedStopIndex(prev => prev === idx ? null : idx)}
                      className={cn(
                        'w-full flex items-center gap-2 p-2 rounded border text-xs text-left transition-colors',
                        selectedStopIndex === idx
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                          : 'border-border hover:bg-muted/50',
                      )}
                    >
                      <span className={cn(
                        'w-5 h-5 rounded-full text-[10px] flex items-center justify-center flex-shrink-0',
                        selectedStopIndex === idx
                          ? 'bg-primary text-primary-foreground'
                          : hasRoute ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground',
                      )}>
                        {idx + 1}
                      </span>
                      <span className="flex-1 truncate">{f.facility_name}</span>
                      {f.slot_demand > 0 && (
                        <Badge
                          variant={selectedStopIndex === idx ? 'default' : 'outline'}
                          className="text-[10px] px-1 flex-shrink-0"
                        >
                          {f.slot_demand}
                        </Badge>
                      )}
                    </button>
                  ))}

                  {/* Return */}
                  <div className="flex items-center gap-2 p-2 rounded border border-dashed opacity-50 text-xs">
                    <span className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] flex items-center justify-center flex-shrink-0">R</span>
                    <span className="flex-1 truncate">{startLocationName || 'Warehouse'}</span>
                    <Badge variant="outline" className="text-[10px] flex-shrink-0">Return</Badge>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Sub-components
// =====================================================

function RunCard({
  run,
  isSelected,
  onSelect,
  compact = false,
}: {
  run: DispatchRunProjection;
  isSelected: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <button
        onClick={onSelect}
        title={`Run ${run.run_index} · ${run.vehicle_label ?? 'Unassigned'} · ${run.departure_time}→${run.return_time}`}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-left transition-colors text-xs',
          isSelected
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-border bg-card hover:bg-muted/50',
        )}
      >
        <span className={cn(
          'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
          isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
        )}>
          {run.run_index}
        </span>
        <span className="font-medium truncate max-w-[120px]">{run.vehicle_label ?? 'Unassigned'}</span>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {run.facility_ids.length}s
        </span>
        {isSelected && <CheckCircle className="h-3 w-3 text-primary flex-shrink-0" />}
      </button>
    );
  }

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-colors',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card hover:bg-muted/50',
      )}
    >
      <div className={cn(
        'mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
      )}>
        {run.run_index}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium truncate">{run.vehicle_label ?? 'Unassigned'}</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {run.departure_time} → {run.return_time}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {run.facility_ids.length} stops · {run.total_slots} slots
        </p>
      </div>
      {isSelected && <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />}
    </button>
  );
}

function MetricTile({
  icon,
  label,
  value,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div className={cn(
      'p-2.5 rounded-lg border text-center',
      active ? 'bg-primary/5 border-primary/20' : 'bg-muted/30',
    )}>
      <div className={cn('flex justify-center mb-1', active ? 'text-primary' : 'text-muted-foreground')}>
        {icon}
      </div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={cn('text-sm font-semibold', active ? '' : 'text-muted-foreground')}>{value}</p>
    </div>
  );
}

export default Step4Route;

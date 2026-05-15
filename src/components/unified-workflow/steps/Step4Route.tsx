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
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from 'next-themes';
import { getMapLibreStyle } from '@/lib/mapConfig';

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
  const { theme } = useTheme();
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<maplibregl.Map | null>(null);
  const markersRef = React.useRef<Map<string, maplibregl.Marker>>(new Map());

  // Selected run for optimization
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);
  const [selectedOptMode, setSelectedOptMode] = React.useState<OptimizationMode>('shortest_distance');

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

  // Map bounds
  const bounds = React.useMemo(() => {
    const points: [number, number][] = [];
    if (startLocation?.lat && startLocation?.lng) {
      points.push([startLocation.lng, startLocation.lat]);
    }
    displayFacilities.forEach(item => {
      const f = facilityMap.get(item.facility_id);
      if (f?.lat && f?.lng) points.push([f.lng, f.lat]);
    });

    if (points.length === 0) return { center: [8.52, 12.0] as [number, number], zoom: 10 };
    if (points.length === 1) return { center: points[0], zoom: 12 };

    const lngs = points.map(p => p[0]);
    const lats = points.map(p => p[1]);
    return {
      sw: [Math.min(...lngs) - 0.02, Math.min(...lats) - 0.02] as [number, number],
      ne: [Math.max(...lngs) + 0.02, Math.max(...lats) + 0.02] as [number, number],
    };
  }, [startLocation, displayFacilities, facilityMap]);

  // Initialize map
  React.useEffect(() => {
    if (!mapContainerRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getMapLibreStyle(theme as 'light' | 'dark' | 'system' | undefined),
      center: 'center' in bounds ? bounds.center : [(bounds.sw[0] + bounds.ne[0]) / 2, (bounds.sw[1] + bounds.ne[1]) / 2],
      zoom: 'zoom' in bounds ? bounds.zoom : 10,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;
    map.on('load', () => {
      if ('sw' in bounds && 'ne' in bounds) {
        map.fitBounds([bounds.sw, bounds.ne], { padding: 30, maxZoom: 14 });
      }
    });
    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [theme]);

  // Update markers and route
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const update = () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current.clear();

      const routeCoords: [number, number][] = [];
      if (startLocation?.lat && startLocation?.lng) {
        routeCoords.push([startLocation.lng, startLocation.lat]);
      }

      if (hasRoute && optimizedRoute.length > 0) {
        optimizedRoute.forEach(p => {
          if (p.lat && p.lng) routeCoords.push([p.lng, p.lat]);
        });
      } else {
        displayFacilities.forEach(item => {
          const f = facilityMap.get(item.facility_id);
          if (f?.lat && f?.lng) routeCoords.push([f.lng, f.lat]);
        });
      }

      const lineCoords = routeGeometry && routeGeometry.length >= 2 ? routeGeometry : routeCoords;

      if (lineCoords.length >= 2 && map.isStyleLoaded()) {
        if (map.getLayer('route-line')) map.removeLayer('route-line');
        if (map.getSource('route')) map.removeSource('route');

        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: lineCoords },
          },
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': hasRoute ? '#10b981' : '#6b7280',
            'line-width': 4,
            'line-opacity': 0.8,
          },
        });
      }

      // Start marker
      if (startLocation?.lat && startLocation?.lng) {
        const el = document.createElement('div');
        el.innerHTML = `<div style="width:34px;height:34px;background:#3b82f6;border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.3);font-size:15px;">🏭</div>`;
        const popup = new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(
          `<div style="padding:4px"><strong>${startLocation.name ?? 'Warehouse'}</strong><div style="font-size:11px;color:#666">Start Location</div></div>`,
        );
        markersRef.current.set(
          'start',
          new maplibregl.Marker({ element: el })
            .setLngLat([startLocation.lng, startLocation.lat])
            .setPopup(popup)
            .addTo(map),
        );
      }

      const displayOrder = hasRoute && optimizedRoute.length > 0
        ? optimizedRoute
            .map((pt, idx) => {
              const f = displayFacilities.find(x => x.facility_id === pt.facility_id);
              return f ? { ...f, displayIndex: idx } : null;
            })
            .filter((x): x is NonNullable<typeof x> => !!x)
        : displayFacilities.map((f, idx) => ({ ...f, displayIndex: idx }));

      displayOrder.forEach(item => {
        const coord = facilityMap.get(item.facility_id);
        if (!coord?.lat || !coord?.lng) return;
        const el = document.createElement('div');
        el.innerHTML = `<div style="width:28px;height:28px;background:${hasRoute ? '#10b981' : '#6b7280'};border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.25);color:white;font-size:11px;font-weight:600;">${item.displayIndex + 1}</div>`;
        const popup = new maplibregl.Popup({ offset: 20, closeButton: false }).setHTML(
          `<div style="padding:4px;min-width:110px"><div style="font-size:11px;color:${hasRoute ? '#10b981' : '#666'};font-weight:600">Stop ${item.displayIndex + 1}</div><strong style="font-size:12px">${item.facility_name}</strong><div style="font-size:10px;color:#666;margin-top:2px">${item.slot_demand ?? 0} slots</div></div>`,
        );
        markersRef.current.set(
          item.facility_id,
          new maplibregl.Marker({ element: el })
            .setLngLat([coord.lng, coord.lat])
            .setPopup(popup)
            .addTo(map),
        );
      });

      if ('sw' in bounds && 'ne' in bounds) {
        map.fitBounds([bounds.sw, bounds.ne], { padding: 30, maxZoom: 14, duration: 500 });
      }
    };

    if (map.isStyleLoaded()) update();
    else map.once('styledata', update);
  }, [startLocation, displayFacilities, facilityMap, bounds, hasRoute, optimizedRoute, routeGeometry]);

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

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[280px_1fr_260px] gap-0">
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
            Center: Selected Run Map
        ---------------------------------------- */}
        <div className="flex flex-col min-h-0">
          {/* Map header */}
          {selectedRun && (
            <div className="px-4 py-2.5 border-b bg-muted/20 flex items-center gap-3">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs font-medium">
                  Run {selectedRun.run_index} · {selectedRun.vehicle_label}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {selectedRun.departure_time} → {selectedRun.return_time} · {selectedRun.facility_ids.length} stops
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  onClick={onOptimize}
                  disabled={isOptimizing || displayFacilities.length === 0}
                  size="sm"
                  className="h-8 text-xs"
                >
                  {isOptimizing ? (
                    <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />Optimizing…</>
                  ) : hasRoute ? (
                    <><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Re-optimize Run</>
                  ) : (
                    <><Play className="h-3.5 w-3.5 mr-1.5" />Optimize Run</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Map */}
          <div className="flex-1 relative min-h-[300px]">
            {facilities.length === 0 ? (
              <div className="h-full flex items-center justify-center bg-muted">
                <div className="text-center text-muted-foreground">
                  <Route className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No facilities to display</p>
                </div>
              </div>
            ) : (
              <div ref={mapContainerRef} className="absolute inset-0" />
            )}

            {/* No run selected overlay */}
            {!selectedRun && hasWaves && facilities.length > 0 && (
              <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                <div className="text-center text-muted-foreground">
                  <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">Select a run to optimize its route</p>
                  <p className="text-xs mt-1">Click any run in the left panel</p>
                </div>
              </div>
            )}

            {/* No waves — show global optimize */}
            {!hasWaves && facilities.length > 0 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                <Button
                  onClick={onOptimize}
                  disabled={isOptimizing}
                  size="sm"
                  className="shadow-lg"
                >
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

              {/* Stop sequence for selected run */}
              <div>
                <p className="text-xs font-medium mb-2">
                  {selectedRun ? `Stop Sequence — Run ${selectedRun.run_index}` : 'Stop Sequence'}
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 p-2 rounded bg-primary/5 text-xs">
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">S</span>
                    <span className="font-medium flex-1 truncate">{startLocationName || 'Warehouse'}</span>
                    <Badge variant="secondary" className="text-[10px]">Origin</Badge>
                  </div>

                  {(selectedRun
                    ? displayFacilities
                    : hasRoute && optimizedRoute.length > 0
                      ? optimizedRoute
                          .map(pt => facilities.find(f => f.facility_id === pt.facility_id))
                          .filter((f): f is WorkingSetItem => !!f)
                      : facilities
                  ).map((f, idx) => (
                    <div key={f.facility_id} className="flex items-center gap-2 p-2 rounded border text-xs">
                      <span className={cn(
                        'w-5 h-5 rounded-full text-[10px] flex items-center justify-center',
                        hasRoute ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground',
                      )}>
                        {idx + 1}
                      </span>
                      <span className="flex-1 truncate">{f.facility_name}</span>
                      {f.slot_demand > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1">{f.slot_demand}</Badge>
                      )}
                    </div>
                  ))}

                  <div className="flex items-center gap-2 p-2 rounded border border-dashed opacity-50 text-xs">
                    <span className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] flex items-center justify-center">R</span>
                    <span className="flex-1 truncate">{startLocationName || 'Warehouse'}</span>
                    <Badge variant="outline" className="text-[10px]">Return</Badge>
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
}: {
  run: DispatchRunProjection;
  isSelected: boolean;
  onSelect: () => void;
}) {
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

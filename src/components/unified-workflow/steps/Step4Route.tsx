/**
 * =====================================================
 * Step 4: Route Optimization
 * =====================================================
 * Route preview and optimization step.
 */

import * as React from 'react';
import {
  Route,
  Map as MapIconLucide,
  Play,
  RefreshCw,
  Clock,
  MapPin,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { WorkingSetItem, AiOptimizationOptions } from '@/types/unified-workflow';
import type { RoutePoint } from '@/types/scheduler';
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

interface Step4RouteProps {
  facilities: WorkingSetItem[];
  facilitiesWithCoords?: FacilityWithCoords[];
  startLocation?: { id: string; name: string; lat?: number; lng?: number } | null;
  startLocationName: string | null;
  optimizedRoute: RoutePoint[];
  routeGeometry?: Array<[number, number]> | null; // [lng, lat] road path from routing API
  totalDistanceKm: number | null;
  estimatedDurationMin: number | null;
  isOptimizing: boolean;
  optimizationOptions?: AiOptimizationOptions;
  onOptimizationOptionsChange?: (options: Partial<AiOptimizationOptions>) => void;
  onOptimize: () => Promise<void>;
}

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
}: Step4RouteProps) {
  const { theme } = useTheme();
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<maplibregl.Map | null>(null);
  const markersRef = React.useRef<Map<string, maplibregl.Marker>>(new Map());
  const [showSettings, setShowSettings] = React.useState(true);

  const hasRoute = optimizedRoute.length > 0;

  // Create facility lookup map
  const facilityMap = React.useMemo(() => {
    const map = new Map<string, FacilityWithCoords>();
    facilitiesWithCoords.forEach(f => map.set(f.id, f));
    return map;
  }, [facilitiesWithCoords]);

  // Format duration
  const durationLabel = React.useMemo(() => {
    if (!estimatedDurationMin) return '-';
    const hours = Math.floor(estimatedDurationMin / 60);
    const mins = estimatedDurationMin % 60;
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} hr`;
    return `${hours} hr ${mins} min`;
  }, [estimatedDurationMin]);

  // Calculate map bounds
  const bounds = React.useMemo(() => {
    const points: [number, number][] = [];

    if (startLocation?.lat && startLocation?.lng) {
      points.push([startLocation.lng, startLocation.lat]);
    }

    facilities.forEach(item => {
      const facility = facilityMap.get(item.facility_id);
      if (facility?.lat && facility?.lng) {
        points.push([facility.lng, facility.lat]);
      }
    });

    if (points.length === 0) {
      return {
        center: [8.52, 12.00] as [number, number],
        zoom: 10,
      };
    }

    if (points.length === 1) {
      return {
        center: points[0],
        zoom: 12,
      };
    }

    const lngs = points.map(p => p[0]);
    const lats = points.map(p => p[1]);

    return {
      sw: [Math.min(...lngs) - 0.02, Math.min(...lats) - 0.02] as [number, number],
      ne: [Math.max(...lngs) + 0.02, Math.max(...lats) + 0.02] as [number, number],
    };
  }, [startLocation, facilities, facilityMap]);

  // Initialize map
  React.useEffect(() => {
    if (!mapContainerRef.current || facilities.length === 0) return;

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
        map.fitBounds([bounds.sw, bounds.ne], {
          padding: 30,
          maxZoom: 14,
        });
      }
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [theme, facilities.length]);

  // Update markers and route lines
  React.useEffect(() => {
    if (!mapRef.current || facilities.length === 0) return;

    const map = mapRef.current;

    const updateMarkersAndRoute = () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current.clear();

      // Build route line coordinates
      const routeCoordinates: [number, number][] = [];

      // Start from warehouse
      if (startLocation?.lat && startLocation?.lng) {
        routeCoordinates.push([startLocation.lng, startLocation.lat]);
      }

      // Use optimized route if available, otherwise use current facility order
      if (hasRoute && optimizedRoute.length > 0) {
        // Use optimized route sequence
        optimizedRoute.forEach(point => {
          if (point.lat && point.lng) {
            routeCoordinates.push([point.lng, point.lat]);
          }
        });
      } else {
        // Use current facility order
        facilities.forEach(item => {
          const facility = facilityMap.get(item.facility_id);
          if (facility?.lat && facility?.lng) {
            routeCoordinates.push([facility.lng, facility.lat]);
          }
        });
      }

      // Add route line to map (only if style is loaded)
      // Use actual road geometry when available, otherwise fall back to straight lines
      const lineCoordinates = routeGeometry && routeGeometry.length >= 2
        ? routeGeometry
        : routeCoordinates;

      if (lineCoordinates.length >= 2 && map.isStyleLoaded()) {
        // Remove existing route layer and source if they exist
        if (map.getLayer('route-line')) {
          map.removeLayer('route-line');
        }
        if (map.getSource('route')) {
          map.removeSource('route');
        }

        // Add route source and layer
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: lineCoordinates,
            },
          },
        });

        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': hasRoute ? '#10b981' : '#6b7280',
            'line-width': 4,
            'line-opacity': 0.8,
          },
        });
      }

      // Start location marker
      if (startLocation?.lat && startLocation?.lng) {
        const el = document.createElement('div');
        el.innerHTML = `
          <div style="
            width: 36px;
            height: 36px;
            background: #3b82f6;
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            font-size: 16px;
          ">🏭</div>
        `;

        const popup = new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(`
          <div style="padding: 4px;">
            <strong>${startLocation.name}</strong>
            <div style="font-size: 11px; color: #666;">Start Location</div>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([startLocation.lng, startLocation.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.set('start', marker);
      }

      // Facility markers - use optimized route order if available
      const displayOrder = hasRoute && optimizedRoute.length > 0
        ? optimizedRoute.map((point, idx) => {
            const facility = facilities.find(f => f.facility_id === point.facility_id);
            return facility ? { ...facility, displayIndex: idx } : null;
          }).filter((f): f is NonNullable<typeof f> => f !== null)
        : facilities.map((f, idx) => ({ ...f, displayIndex: idx }));

      displayOrder.forEach((item) => {
        const facility = facilityMap.get(item.facility_id);
        if (!facility?.lat || !facility?.lng) return;

        const el = document.createElement('div');
        el.innerHTML = `
          <div style="
            width: 30px;
            height: 30px;
            background: ${hasRoute ? '#10b981' : '#6b7280'};
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.25);
            color: white;
            font-size: 12px;
            font-weight: 600;
          ">${item.displayIndex + 1}</div>
        `;

        const popup = new maplibregl.Popup({ offset: 20, closeButton: false }).setHTML(`
          <div style="padding: 4px; min-width: 120px;">
            <div style="font-size: 11px; color: ${hasRoute ? '#10b981' : '#666'}; font-weight: 600;">Stop ${item.displayIndex + 1}</div>
            <strong style="font-size: 12px;">${item.facility_name}</strong>
            <div style="font-size: 10px; color: #666; margin-top: 2px;">
              ${item.slot_demand || 0} slots
            </div>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([facility.lng, facility.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.set(item.facility_id, marker);
      });

      if ('sw' in bounds && 'ne' in bounds) {
        map.fitBounds([bounds.sw, bounds.ne], {
          padding: 30,
          maxZoom: 14,
          duration: 500,
        });
      }
    };

    // Wait for style to load before adding layers
    if (map.isStyleLoaded()) {
      updateMarkersAndRoute();
    } else {
      map.once('styledata', updateMarkersAndRoute);
    }
  }, [startLocation, facilities, facilityMap, bounds, hasRoute, optimizedRoute, routeGeometry]);

  return (
    <div className="flex flex-col min-h-[65vh] p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Route Optimization</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Preview and optimize your delivery route
        </p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
        {/* Left: Map Preview */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapIconLucide className="h-4 w-4" />
              Route Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {facilities.length === 0 ? (
              <div className="h-full min-h-[300px] bg-muted rounded-lg flex items-center justify-center border border-dashed">
                <div className="text-center text-muted-foreground">
                  <Route className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No facilities to display</p>
                </div>
              </div>
            ) : (
              <div
                ref={mapContainerRef}
                className="h-full min-h-[300px] rounded-lg overflow-hidden border"
              />
            )}
          </CardContent>
        </Card>

        {/* Right: Route Details */}
        <div className="space-y-4">
          {/* Optimization Settings */}
          {onOptimizationOptionsChange && (
            <Card>
              <Collapsible open={showSettings} onOpenChange={setShowSettings}>
                <CardHeader className="pb-2">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between cursor-pointer">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Optimization Settings
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {Object.values(optimizationOptions).filter(Boolean).length} active
                      </Badge>
                    </div>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="shortest_distance"
                        checked={optimizationOptions.shortest_distance}
                        onCheckedChange={(checked) =>
                          onOptimizationOptionsChange({ shortest_distance: !!checked })
                        }
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <Label htmlFor="shortest_distance" className="text-sm cursor-pointer font-medium">
                          Shortest Distance
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Minimize total travel distance
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="fastest_route"
                        checked={optimizationOptions.fastest_route}
                        onCheckedChange={(checked) =>
                          onOptimizationOptionsChange({ fastest_route: !!checked })
                        }
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <Label htmlFor="fastest_route" className="text-sm cursor-pointer font-medium">
                          Fastest Route
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Minimize total travel time
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="efficiency"
                        checked={optimizationOptions.efficiency}
                        onCheckedChange={(checked) =>
                          onOptimizationOptionsChange({ efficiency: !!checked })
                        }
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <Label htmlFor="efficiency" className="text-sm cursor-pointer font-medium">
                          Efficiency
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Optimize fuel and resources
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="priority_complex"
                        checked={optimizationOptions.priority_complex}
                        onCheckedChange={(checked) =>
                          onOptimizationOptionsChange({ priority_complex: !!checked })
                        }
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <Label htmlFor="priority_complex" className="text-sm cursor-pointer font-medium">
                          Priority Complex
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Emergency facilities first
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )}

          {/* Optimize Button */}
          <Card>
            <CardContent className="pt-4">
              <Button
                onClick={onOptimize}
                disabled={isOptimizing || facilities.length === 0}
                className="w-full"
                size="lg"
              >
                {isOptimizing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Optimizing...
                  </>
                ) : hasRoute ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Re-optimize Route
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Optimize Route
                  </>
                )}
              </Button>

              {hasRoute && (
                <div className="flex items-center gap-2 mt-3 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>Route optimized successfully</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Route Stats */}
          {hasRoute && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Route Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Route className="h-4 w-4" />
                      <span className="text-xs">Total Distance</span>
                    </div>
                    <p className="text-xl font-semibold">
                      {totalDistanceKm?.toFixed(1)} km
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Clock className="h-4 w-4" />
                      <span className="text-xs">Est. Duration</span>
                    </div>
                    <p className="text-xl font-semibold">{durationLabel}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Route Sequence */}
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Stop Sequence
              </CardTitle>
              <CardDescription className="text-xs">
                {facilities.length} stops in optimized order
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {/* Start */}
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-primary/5">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                      S
                    </div>
                    <span className="text-sm font-medium">
                      {startLocationName || 'Start'}
                    </span>
                    <Badge variant="secondary" className="text-xs ml-auto">
                      Origin
                    </Badge>
                  </div>

                  {/* Stops - use optimized order if available */}
                  {(hasRoute && optimizedRoute.length > 0
                    ? optimizedRoute.map((point) => facilities.find(f => f.facility_id === point.facility_id)).filter(Boolean)
                    : facilities
                  ).map((facility, idx) => (
                    <div
                      key={facility!.facility_id}
                      className="flex items-center gap-3 p-2 rounded-lg border"
                    >
                      <div className={cn(
                        "w-6 h-6 rounded-full text-xs flex items-center justify-center",
                        hasRoute ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
                      )}>
                        {idx + 1}
                      </div>
                      <span className="text-sm truncate flex-1">
                        {facility!.facility_name}
                      </span>
                      {facility!.slot_demand > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {facility!.slot_demand}
                        </Badge>
                      )}
                    </div>
                  ))}

                  {/* Return */}
                  <div className="flex items-center gap-3 p-2 rounded-lg border border-dashed opacity-50">
                    <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center">
                      R
                    </div>
                    <span className="text-sm">
                      {startLocationName || 'Start'}
                    </span>
                    <Badge variant="outline" className="text-xs ml-auto">
                      Return
                    </Badge>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default Step4Route;

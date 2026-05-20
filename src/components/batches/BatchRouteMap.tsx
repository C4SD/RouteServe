import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { tw } from '@/lib/colors';
import { useTheme } from 'next-themes';
import { MAP_CONFIG, getMapLibreStyle } from '@/lib/mapConfig';
import { MapOverlayControls } from '@/components/map/MapOverlayControls';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Radar, Route, Split, Loader2 } from 'lucide-react';
import { useRoadRouteFetcher } from '@/hooks/useRoadRouteFetcher';
import { ROUTE_COLORS } from '@/lib/algorithms/routeOptimizer';
import type { TetherMode } from '@/lib/algorithms/routeOptimizer';
import type { Facility } from '@/types';

/** Minimal depot type — works with both Warehouse interfaces */
interface Depot {
  lat: number;
  lng: number;
  name: string;
}

interface BatchRouteMapProps {
  facilities: Facility[];
  warehouse?: Depot | null;
  optimizedRoute?: [number, number][];
  className?: string;
  enableControls?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function BatchRouteMap({
  facilities,
  warehouse,
  optimizedRoute,
  className = '',
  enableControls = false,
  isFullscreen = false,
  onToggleFullscreen,
}: BatchRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const { theme } = useTheme();
  const [tetherMode, setTetherMode] = useState<TetherMode>('route');

  // Build facility points for the road route fetcher
  const facilityPoints = useMemo(
    () =>
      facilities
        .filter(f => f.lat && f.lng)
        .map(f => ({ id: f.id, lat: f.lat, lng: f.lng })),
    [facilities]
  );

  const depot = useMemo(
    () => (warehouse ? { lat: warehouse.lat, lng: warehouse.lng } : null),
    [warehouse]
  );

  const orderedFacilityIds = useMemo(
    () => facilityPoints.map(f => f.id),
    [facilityPoints]
  );

  const {
    roadRoute,
    alternativeRoutes,
    cardinalPaths,
    isFetching,
    fetchAlternatives,
  } = useRoadRouteFetcher({
    depot,
    facilities: facilityPoints,
    orderedFacilityIds,
    tetherMode,
    enabled: enableControls && facilityPoints.length > 0,
  });

  // Calculate map bounds to fit all points
  const bounds = useMemo(() => {
    const points: [number, number][] = [];
    if (warehouse) points.push([warehouse.lng, warehouse.lat]);
    facilities.forEach(f => {
      if (f.lng && f.lat) points.push([f.lng, f.lat]);
    });
    if (points.length === 0) return null;
    const lngs = points.map(p => p[0]);
    const lats = points.map(p => p[1]);
    return {
      sw: [Math.min(...lngs), Math.min(...lats)] as [number, number],
      ne: [Math.max(...lngs), Math.max(...lats)] as [number, number],
    };
  }, [facilities, warehouse]);

  // Handle tether mode change
  const handleTetherModeChange = useCallback(
    (mode: string) => {
      if (!mode) return;
      setTetherMode(mode as TetherMode);
      if (mode === 'alternatives' && alternativeRoutes.length === 0) {
        fetchAlternatives();
      }
    },
    [alternativeRoutes.length, fetchAlternatives]
  );

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getMapLibreStyle(theme as 'light' | 'dark' | 'system' | undefined),
      center: bounds
        ? [(bounds.sw[0] + bounds.ne[0]) / 2, (bounds.sw[1] + bounds.ne[1]) / 2]
        : MAP_CONFIG.defaultCenter,
      zoom: 10,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-right'
    );

    mapRef.current = map;
    setMapLoaded(false);

    map.on('load', () => {
      setMapLoaded(true);

      // Add GeoJSON sources for route rendering
      map.addSource('tethers', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addSource('connectors', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addSource('alt-routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Alt routes layer (below main)
      map.addLayer({
        id: 'alt-route-lines',
        type: 'line',
        source: 'alt-routes',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'width'],
          'line-opacity': ['get', 'opacity'],
        },
      });
      // Connector lines (thin dashed)
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
      // Solid road route line (shown when real road route is available)
      map.addLayer({
        id: 'tether-lines',
        type: 'line',
        source: 'tethers',
        layout: { visibility: 'none' },
        paint: {
          'line-color': tw.blue[500],
          'line-width': 3,
          'line-opacity': 0.8,
        },
      });
      // Dashed fallback line (shown while road route is loading)
      map.addLayer({
        id: 'tether-lines-fallback',
        type: 'line',
        source: 'tethers',
        layout: { visibility: 'none' },
        paint: {
          'line-color': tw.blue[500],
          'line-width': 2,
          'line-opacity': 0.5,
          'line-dasharray': [2, 2],
        },
      });

      // Route info popup on click
      map.on('click', 'tether-lines', (e) => {
        const props = e.features?.[0]?.properties;
        if (!props?.routeLabel) return;
        const timeStr =
          props.timeMinutes < 60
            ? `${props.timeMinutes} min`
            : `${(props.timeMinutes / 60).toFixed(1)} hrs`;
        new maplibregl.Popup({ closeButton: false, maxWidth: '200px' })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-size:12px;line-height:1.4">
              <strong style="color:${props.color || '#333'}">${props.routeLabel}</strong><br/>
              ${props.distanceKm} km &middot; ${timeStr}
            </div>`
          )
          .addTo(map);
      });

      map.on('click', 'alt-route-lines', (e) => {
        const props = e.features?.[0]?.properties;
        if (!props?.routeLabel) return;
        const timeStr =
          props.timeMinutes < 60
            ? `${props.timeMinutes} min`
            : `${(props.timeMinutes / 60).toFixed(1)} hrs`;
        new maplibregl.Popup({ closeButton: false, maxWidth: '200px' })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-size:12px;line-height:1.4">
              <strong style="color:${props.color || '#333'}">${props.routeLabel}</strong><br/>
              ${props.distanceKm} km &middot; ${timeStr}
            </div>`
          )
          .addTo(map);
      });

      // Cursor hint on hover
      for (const id of ['tether-lines', 'tether-lines-fallback'] as const) {
        map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
      }
      map.on('mouseenter', 'alt-route-lines', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'alt-route-lines', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      setMapLoaded(false);
      map.remove();
      mapRef.current = null;
    };
  }, [theme]);

  // Fit bounds when data changes
  useEffect(() => {
    if (!mapRef.current || !bounds) return;
    mapRef.current.fitBounds([bounds.sw, bounds.ne], {
      padding: { top: 50, bottom: 50, left: 50, right: 50 },
      maxZoom: 14,
    });
  }, [bounds]);

  // Resize map on fullscreen toggle
  useEffect(() => {
    if (!mapRef.current) return;
    const timer = setTimeout(() => mapRef.current?.resize(), 100);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  // Add markers
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const addMarkers = () => {
      // Warehouse marker
      if (warehouse) {
        const el = document.createElement('div');
        el.innerHTML = `
          <div style="
            width: 32px; height: 32px;
            background: ${tw.blue[500]};
            border: 3px solid white;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            font-size: 14px;
          ">🏭</div>
        `;
        const popup = new maplibregl.Popup({ offset: 25 }).setHTML(
          `<div style="padding:4px;">
            <strong>${warehouse.name}</strong>
            <div style="font-size:12px;color:${tw.gray[500]};">Origin Warehouse</div>
          </div>`
        );
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([warehouse.lng, warehouse.lat])
          .setPopup(popup)
          .addTo(map);
        markersRef.current.push(marker);
      }

      // Facility markers with numbers
      facilities.forEach((facility, index) => {
        if (!facility.lng || !facility.lat) return;
        const el = document.createElement('div');
        el.innerHTML = `
          <div style="
            width: 28px; height: 28px;
            background: ${tw.emerald[500]};
            border: 2px solid white;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.25);
            color: white; font-weight: bold; font-size: 12px;
          ">${index + 1}</div>
        `;
        const popup = new maplibregl.Popup({ offset: 20 }).setHTML(
          `<div style="padding:4px;">
            <strong>${facility.name}</strong>
            <div style="font-size:12px;color:${tw.gray[500]};">${facility.address || 'No address'}</div>
            <div style="font-size:11px;color:${tw.gray[400]};margin-top:2px;">Stop #${index + 1}</div>
          </div>`
        );
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([facility.lng, facility.lat])
          .setPopup(popup)
          .addTo(map);
        markersRef.current.push(marker);
      });
    };

    if (mapLoaded) {
      addMarkers();
    } else {
      map.on('load', addMarkers);
    }
  }, [facilities, warehouse, mapLoaded]);

  // Update route layers based on tether mode + road data
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const tetherSource = map.getSource('tethers') as maplibregl.GeoJSONSource | undefined;
    const connectorSource = map.getSource('connectors') as maplibregl.GeoJSONSource | undefined;
    const altSource = map.getSource('alt-routes') as maplibregl.GeoJSONSource | undefined;

    if (!tetherSource || !connectorSource || !altSource) return;

    const tetherFeatures: GeoJSON.Feature[] = [];
    const connectorFeatures: GeoJSON.Feature[] = [];
    const altFeatures: GeoJSON.Feature[] = [];

    if (tetherMode === 'route') {
      // Show real road route if available, otherwise optimized or straight-line fallback
      if (roadRoute && roadRoute.geometry.length > 1) {
        tetherFeatures.push({
          type: 'Feature',
          properties: {
            routeLabel: 'Route',
            distanceKm: roadRoute.roadDistanceKm,
            timeMinutes: roadRoute.roadTimeMinutes,
            color: tw.blue[500],
          },
          geometry: {
            type: 'LineString',
            coordinates: roadRoute.geometry,
          },
        });

        // Connector lines from facility markers to snapped waypoints
        if (roadRoute.snappedWaypoints && warehouse) {
          const orderedFacs = facilityPoints;
          // snappedWaypoints: [depot, fac1, fac2, ..., depot(return)]
          // We skip index 0 (depot) and last (depot return)
          orderedFacs.forEach((fac, i) => {
            const snappedIdx = i + 1; // offset by 1 for depot
            if (snappedIdx < roadRoute.snappedWaypoints.length) {
              const snapped = roadRoute.snappedWaypoints[snappedIdx];
              connectorFeatures.push({
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: [
                    [fac.lng, fac.lat],
                    snapped,
                  ],
                },
              });
            }
          });
        }
      } else if (optimizedRoute && optimizedRoute.length > 1) {
        // Fall back to stored optimized route coordinates.
        // optimizedRoute is [lat, lng][] (Leaflet convention); flip to [lng, lat][] for GeoJSON.
        tetherFeatures.push({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: optimizedRoute.map(([lat, lng]) => [lng, lat] as [number, number]),
          },
        });
      } else {
        // Straight-line fallback — works with or without warehouse
        const coords: [number, number][] = [];
        if (warehouse) coords.push([warehouse.lng, warehouse.lat]);
        facilities.forEach(f => {
          if (f.lng && f.lat) coords.push([f.lng, f.lat]);
        });
        // Close the loop back to warehouse if present
        if (warehouse && coords.length > 2) {
          coords.push([warehouse.lng, warehouse.lat]);
        }
        if (coords.length > 1) {
          tetherFeatures.push({
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: coords },
          });
        }
      }

      // Toggle between solid road layer and dashed fallback layer
      const isRoad = !!(roadRoute && roadRoute.geometry.length > 1);
      if (map.getLayer('tether-lines')) {
        map.setLayoutProperty('tether-lines', 'visibility', isRoad ? 'visible' : 'none');
      }
      if (map.getLayer('tether-lines-fallback')) {
        map.setLayoutProperty('tether-lines-fallback', 'visibility', isRoad ? 'none' : 'visible');
      }
    } else if (tetherMode === 'cardinal' && warehouse) {
      // Cardinal mode: depot → each facility individually
      facilityPoints.forEach(fac => {
        const paths = cardinalPaths[fac.id];
        if (paths && paths.length > 0) {
          // Primary path
          const primary = paths[0];
          tetherFeatures.push({
            type: 'Feature',
            properties: {
              routeLabel: `→ ${facilities.find(f => f.id === fac.id)?.name || 'Facility'}`,
              distanceKm: primary.distanceKm,
              timeMinutes: primary.timeMinutes,
              color: tw.blue[500],
            },
            geometry: { type: 'LineString', coordinates: primary.geometry },
          });
          // Connector: facility marker → road start
          if (primary.geometry.length > 0) {
            const roadEnd = primary.geometry[primary.geometry.length - 1];
            connectorFeatures.push({
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: [[fac.lng, fac.lat], roadEnd],
              },
            });
          }
          // Alternative paths (show faintly)
          paths.slice(1).forEach(alt => {
            altFeatures.push({
              type: 'Feature',
              properties: {
                routeLabel: alt.routeType,
                distanceKm: alt.distanceKm,
                timeMinutes: alt.timeMinutes,
                color: ROUTE_COLORS[alt.routeType] || tw.gray[400],
                width: 1.5,
                opacity: 0.35,
              },
              geometry: { type: 'LineString', coordinates: alt.geometry },
            });
          });
        } else {
          // Straight-line fallback while loading
          tetherFeatures.push({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [
                [warehouse.lng, warehouse.lat],
                [fac.lng, fac.lat],
              ],
            },
          });
        }
      });

      // Cardinal mode uses solid road-style lines — show solid layer, hide fallback
      if (map.getLayer('tether-lines')) map.setLayoutProperty('tether-lines', 'visibility', 'visible');
      if (map.getLayer('tether-lines-fallback')) map.setLayoutProperty('tether-lines-fallback', 'visibility', 'none');
    } else if (tetherMode === 'alternatives') {
      // Show all alternative routes
      if (alternativeRoutes.length > 0) {
        alternativeRoutes.forEach(route => {
          altFeatures.push({
            type: 'Feature',
            properties: {
              routeLabel: route.routeTypeLabel,
              distanceKm: route.distanceKm,
              timeMinutes: route.timeMinutes,
              color: route.color || tw.blue[500],
              width: 3,
              opacity: 0.7,
            },
            geometry: { type: 'LineString', coordinates: route.geometry },
          });
        });
      } else if (roadRoute) {
        // Show main route while alternatives load
        tetherFeatures.push({
          type: 'Feature',
          properties: {
            routeLabel: 'Route',
            distanceKm: roadRoute.roadDistanceKm,
            timeMinutes: roadRoute.roadTimeMinutes,
            color: tw.blue[500],
          },
          geometry: { type: 'LineString', coordinates: roadRoute.geometry },
        });
      }
      // In alternatives mode, always show the solid layer (fallback has no role here)
      if (map.getLayer('tether-lines')) map.setLayoutProperty('tether-lines', 'visibility', 'visible');
      if (map.getLayer('tether-lines-fallback')) map.setLayoutProperty('tether-lines-fallback', 'visibility', 'none');
    }

    tetherSource.setData({ type: 'FeatureCollection', features: tetherFeatures });
    connectorSource.setData({ type: 'FeatureCollection', features: connectorFeatures });
    altSource.setData({ type: 'FeatureCollection', features: altFeatures });
  }, [
    mapLoaded,
    tetherMode,
    roadRoute,
    optimizedRoute,
    alternativeRoutes,
    cardinalPaths,
    facilities,
    facilityPoints,
    warehouse,
  ]);

  return (
    <div className={`relative w-full h-full min-h-[200px] ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full rounded-lg overflow-hidden" />

      {/* Tether mode toggle */}
      {enableControls && (
        <div className="absolute left-[10px] top-[10px] z-10">
          <ToggleGroup
            type="single"
            value={tetherMode}
            onValueChange={handleTetherModeChange}
            className="bg-white rounded shadow-md"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem value="cardinal" size="sm" className="h-8 w-8 p-0">
                  <Radar className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent side="bottom">Cardinal (depot → each facility)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem value="route" size="sm" className="h-8 w-8 p-0">
                  <Route className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent side="bottom">Waypoint route</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem value="alternatives" size="sm" className="h-8 w-8 p-0">
                  <Split className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent side="bottom">Alternative routes</TooltipContent>
            </Tooltip>
          </ToggleGroup>
        </div>
      )}

      {/* Fullscreen + focus controls */}
      {enableControls && onToggleFullscreen && (
        <MapOverlayControls
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
          isFocusMode={false}
          onToggleFocusMode={() => {}}
          hasSelection={false}
          className="absolute right-[10px] top-[79px] z-10"
        />
      )}

      {/* Loading indicator */}
      {isFetching && (
        <div className="absolute bottom-[10px] left-[10px] z-10 bg-white/90 rounded-md px-2 py-1 flex items-center gap-1.5 text-xs text-muted-foreground shadow">
          <Loader2 className="h-3 w-3 animate-spin" />
          Fetching road route...
        </div>
      )}

      {/* Road route metrics */}
      {enableControls && roadRoute && !isFetching && (
        <div className="absolute bottom-[10px] left-[10px] z-10 bg-white/90 rounded-md px-2 py-1 text-xs text-muted-foreground shadow">
          {roadRoute.roadDistanceKm} km &middot;{' '}
          {roadRoute.roadTimeMinutes < 60
            ? `${roadRoute.roadTimeMinutes} min`
            : `${(roadRoute.roadTimeMinutes / 60).toFixed(1)} hrs`}
        </div>
      )}

    </div>
  );
}

export default BatchRouteMap;

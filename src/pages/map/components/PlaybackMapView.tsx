/**
 * PlaybackMapView - Map container for Playback mode
 * Renders historical driver positions based on timeline
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { LiveMapKernel } from '@/maps-v3/core/LiveMapKernel';
import { DriverMarkerLayer } from '@/maps-v3/layers/DriverMarkerLayer';
import { RouteLineLayer } from '@/maps-v3/layers/RouteLineLayer';
import { DeliveryMarkerLayer } from '@/maps-v3/layers/DeliveryMarkerLayer';
import { useLiveMapStore } from '@/stores/liveMapStore';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlaybackEvent, MapFeatureCollection, DriverMarkerProperties, RouteLineProperties, DeliveryMarkerProperties } from '@/types/live-map';

interface PlaybackMapViewProps {
  events: PlaybackEvent[];
  currentPosition: [number, number] | null;
  currentStatus: string | null;
  facilities?: Array<{ id: string; name: string; position: [number, number] }>;
}

export function PlaybackMapView({
  events,
  currentPosition,
  currentStatus,
  facilities = [],
}: PlaybackMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const kernelRef = useRef<LiveMapKernel | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapBaseStyle, setMapBaseStyle] = useState<string>('osm');
  const [show3DBuildings, setShow3DBuildings] = useState(false);

  const playback = useLiveMapStore((s) => s.playback);
  const viewState = useLiveMapStore((s) => s.viewState);

  // Layer refs
  const layersRef = useRef<{
    driver: DriverMarkerLayer;
    route: RouteLineLayer;
    stops: DeliveryMarkerLayer;
  } | null>(null);

  // Initialize map kernel
  useEffect(() => {
    if (!containerRef.current) return;

    const kernel = new LiveMapKernel({
      onReady: () => {
        setMapReady(true);
        console.log('[PlaybackMapView] Map ready');
      },
      onError: (error) => {
        console.error('[PlaybackMapView] Map error:', error);
      },
    });

    // Create layers
    const layers = {
      driver: new DriverMarkerLayer(),
      route: new RouteLineLayer(),
      stops: new DeliveryMarkerLayer(),
    };

    // Register layers
    kernel.registerLayer('driver', layers.driver);
    kernel.registerLayer('route', layers.route);
    kernel.registerLayer('stops', layers.stops);

    const voyagerStyle = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
    const positronStyle = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
    const darkMatterStyle = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
    
    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || 'YOUR_MAPBOX_TOKEN';
    const mapboxStyle = `https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${mapboxToken}`;

    // Standard OpenStreetMap (Highly detailed roads, houses, landmarks)
    const osmStyle: any = {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          maxzoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }
      },
      layers: [{ id: 'osm-layer', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 22 }]
    };

    // Free Satellite style using Esri World Imagery
    const satelliteStyle: any = {
      version: 8,
      sources: {
        satellite: {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          maxzoom: 17,
          attribution: '&copy; Esri, Maxar, Earthstar Geographics'
        }
      },
      layers: [{ id: 'satellite-layer', type: 'raster', source: 'satellite', minzoom: 0, maxzoom: 22 }]
    };

    let styleToUse: any;
    switch (mapBaseStyle) {
      case 'satellite': styleToUse = satelliteStyle; break;
      case 'voyager': styleToUse = voyagerStyle; break;
      case 'light': styleToUse = positronStyle; break;
      case 'dark': styleToUse = darkMatterStyle; break;
      case 'mapbox': styleToUse = mapboxStyle; break;
      case 'osm':
      default: styleToUse = osmStyle; break;
    }

    // Initialize map
    kernel.init({
      container: containerRef.current,
      center: viewState.center,
      zoom: viewState.zoom,
      style: styleToUse,
    });

    kernelRef.current = kernel;
    layersRef.current = layers;

    return () => {
      kernel.destroy();
      kernelRef.current = null;
      layersRef.current = null;
      setMapReady(false);
    };
  }, [mapBaseStyle]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 3D Buildings Toggle ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !kernelRef.current) return;
    const map = kernelRef.current.getMap();
    if (!map) return;

    const toggle3D = () => {
      if (show3DBuildings) {
        if (!map.getLayer('3d-buildings') && map.getSource('composite')) {
          map.addLayer({
            'id': '3d-buildings',
            'source': 'composite',
            'source-layer': 'building',
            'filter': ['==', 'extrude', 'true'],
            'type': 'fill-extrusion',
            'minzoom': 15,
            'paint': {
              'fill-extrusion-color': '#e2e8f0',
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-base': ['get', 'min_height'],
              'fill-extrusion-opacity': 0.8
            }
          });
        }
      } else {
        if (map.getLayer('3d-buildings')) {
          map.removeLayer('3d-buildings');
        }
      }
    };

    if (!map.isStyleLoaded()) {
      map.once('style.load', toggle3D);
    } else {
      toggle3D();
    }
  }, [mapReady, show3DBuildings, mapBaseStyle]);

  // Permanent Resize Observer Fix for MapLibre
  useEffect(() => {
    if (!mapReady || !containerRef.current || !kernelRef.current) return;
    const map = kernelRef.current.getMap();
    if (!map) return;

    const observer = new ResizeObserver(() => {
      map.resize();
    });
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [mapReady]);

  // Update driver marker when position changes
  useEffect(() => {
    if (!mapReady || !layersRef.current) return;

    if (currentPosition && currentPosition[0] !== 0 && currentPosition[1] !== 0) {
      const driverEvent = events[0];
      const driverGeoJSON: MapFeatureCollection<DriverMarkerProperties> = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: currentPosition,
            },
            properties: {
              id: driverEvent?.driverId || 'playback-driver',
              name: driverEvent?.driverName || 'Driver',
              status: (currentStatus as any) || 'EN_ROUTE',
              heading: 0,
              isOnline: true,
              batchId: driverEvent?.batchId || null,
            },
          },
        ],
      };

      layersRef.current.driver.update(driverGeoJSON);

      // Center map on driver
      kernelRef.current?.flyTo(currentPosition, 14);
    }
  }, [mapReady, currentPosition, currentStatus, events]);

  // Build route from events
  useEffect(() => {
    if (!mapReady || !layersRef.current || events.length === 0) return;

    // Build route line from all event positions
    const coordinates: [number, number][] = [];
    for (const event of events) {
      if (event.location[0] !== 0 && event.location[1] !== 0) {
        coordinates.push(event.location);
      }
    }

    if (coordinates.length > 1) {
      const routeGeoJSON: MapFeatureCollection<RouteLineProperties> = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates,
            },
            properties: {
              id: events[0].batchId,
              batchId: events[0].batchId,
              driverId: events[0].driverId,
              progress: 100,
              status: 'COMPLETED',
            },
          },
        ],
      };

      layersRef.current.route.update(routeGeoJSON);
    }
  }, [mapReady, events]);

  // Update stop markers
  useEffect(() => {
    if (!mapReady || !layersRef.current) return;

    if (playback.showStopMarkers && facilities.length > 0) {
      const stopsGeoJSON: MapFeatureCollection<DeliveryMarkerProperties> = {
        type: 'FeatureCollection',
        features: facilities.map((facility, index) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: facility.position,
          },
          properties: {
            id: facility.id,
            name: facility.name,
            status: 'COMPLETED',
            progress: 100,
            stopsCount: facilities.length,
            currentStopIndex: index,
          },
        })),
      };

      layersRef.current.stops.update(stopsGeoJSON);
      layersRef.current.stops.setVisibility(true);
    } else {
      layersRef.current.stops.setVisibility(false);
    }
  }, [mapReady, playback.showStopMarkers, facilities]);

  return (
    <div className="relative w-full h-full min-h-[400px] flex-1">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* Current event indicator */}
      {currentStatus && (
        <div className="absolute top-4 left-4 bg-background/90 px-3 py-2 rounded-md shadow-sm">
          <span className="text-sm font-medium">Status: {currentStatus}</span>
        </div>
      )}

      {/* Right-side Controls Group — Positioned below native Navigation/Zoom Controls (~108px from top) */}
      {mapReady && (
        <div className="absolute right-2 z-10 flex flex-col gap-2" style={{ top: 108 }}>
          {/* Map Style Switcher (Cog) */}
          <div className="relative group">
            <button
              title="Map Settings"
              style={{
                background: '#fff',
                borderRadius: 4,
                boxShadow: '0 0 0 2px rgba(0,0,0,0.1)',
                border: 'none',
                width: 29,
                height: 29,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Settings style={{ width: 15, height: 15, color: '#333' }} />
            </button>
            
            {/* Map Style Dropdown */}
            <div className="absolute right-full mr-2 top-0 hidden group-hover:flex flex-col bg-card shadow-lg rounded-md border py-1 w-40 z-50">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30 border-b mb-1">Map Style</div>
              <button onClick={() => setMapBaseStyle('osm')} className={cn("text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors whitespace-nowrap", mapBaseStyle === 'osm' && "text-primary font-medium")}>OpenStreetMap</button>
              <button onClick={() => setMapBaseStyle('satellite')} className={cn("text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors whitespace-nowrap", mapBaseStyle === 'satellite' && "text-primary font-medium")}>Satellite (Esri)</button>
              <button onClick={() => setMapBaseStyle('voyager')} className={cn("text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors whitespace-nowrap", mapBaseStyle === 'voyager' && "text-primary font-medium")}>Carto Voyager</button>
              <button onClick={() => setMapBaseStyle('light')} className={cn("text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors whitespace-nowrap", mapBaseStyle === 'light' && "text-primary font-medium")}>Carto Light</button>
              <button onClick={() => setMapBaseStyle('dark')} className={cn("text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors whitespace-nowrap", mapBaseStyle === 'dark' && "text-primary font-medium")}>Carto Dark</button>
              <button onClick={() => setMapBaseStyle('mapbox')} className={cn("text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors whitespace-nowrap", mapBaseStyle === 'mapbox' && "text-primary font-medium")}>Mapbox Streets</button>
              <div className="border-t my-1"></div>
              <button onClick={() => setShow3DBuildings((p) => !p)} className={cn("text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors whitespace-nowrap", show3DBuildings && "text-primary font-medium")}>{show3DBuildings ? 'Disable 3D Buildings' : 'Enable 3D Buildings'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

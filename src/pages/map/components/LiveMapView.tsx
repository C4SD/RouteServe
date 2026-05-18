/**
 * LiveMapView - Main map container for Live tracking mode
 * Connects data hooks to map layers with real-time updates.
 * Includes sandbox-style tether/connector/alt-route layers, sandbox markers,
 * MapOverlayControls (fullscreen + focus mode), and tether mode switching.
 */

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { Route, Radar, Split, Loader2 } from 'lucide-react';
import { LiveMapKernel } from '@/maps-v3/core/LiveMapKernel';
import { DriverMarkerLayer } from '@/maps-v3/layers/DriverMarkerLayer';
import { VehicleMarkerLayer } from '@/maps-v3/layers/VehicleMarkerLayer';
import { RouteLineLayer } from '@/maps-v3/layers/RouteLineLayer';
import { DeliveryMarkerLayer } from '@/maps-v3/layers/DeliveryMarkerLayer';
import { FacilityMarkerLayer } from '@/maps-v3/layers/FacilityMarkerLayer';
import { WarehouseMarkerLayer } from '@/maps-v3/layers/WarehouseMarkerLayer';
import { ZoneMarkerLayer } from '@/maps-v3/layers/ZoneMarkerLayer';
import { TetherLineLayer } from '@/maps-v3/layers/TetherLineLayer';
import { ConnectorLineLayer } from '@/maps-v3/layers/ConnectorLineLayer';
import { AltRouteLayer } from '@/maps-v3/layers/AltRouteLayer';
import { BatchRouteMarkerLayer } from '@/maps-v3/layers/BatchRouteMarkerLayer';
import type { BatchRouteMarkerData } from '@/maps-v3/layers/BatchRouteMarkerLayer';
import { useLiveTrackingCtx } from '@/contexts/LiveTrackingContext';
import { useLiveMapStore } from '@/stores/liveMapStore';
import { useRoadRouteFetcher } from '@/hooks/useRoadRouteFetcher';
import { useTetherGeometry } from '@/hooks/useTetherGeometry';
import { useDebouncedCallback } from 'use-debounce';
import { useMapSettings } from '@/hooks/settings/useMapSettings';
import { searchAddress, type GeoapifyPlace } from '@/lib/geoapify';
import { MapOverlayControls } from '@/components/map/MapOverlayControls';
import { Search, X, MapPin, Copy, Check, Settings, Locate } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { MapMarkerPopup, type MarkerPopupData } from './MapMarkerPopup';
import type { TetherMode } from '@/lib/algorithms/routeOptimizer';

interface LiveMapViewProps {
  onEntitySelect?: (entityId: string, entityType: 'driver' | 'vehicle' | 'delivery' | 'facility') => void;
}

export function LiveMapView({ onEntitySelect }: LiveMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const kernelRef = useRef<LiveMapKernel | null>(null);
  const [mapReadyKey, setMapReadyKey] = useState(0);
  const mapReady = mapReadyKey > 0;
  const [mapError, setMapError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const initializedRef = useRef(false);
  const hasMapEverBeenReadyRef = useRef(false);
  const hasFittedBoundsRef = useRef(false);

  // Workspace map settings (center, zoom, basemap style, layer defaults)
  const { settings: mapSettings } = useMapSettings();
  const mapSettingsRef = useRef(mapSettings);
  useEffect(() => { mapSettingsRef.current = mapSettings; }, [mapSettings]);

  // Filter + tether state from store
  const filters = useLiveMapStore((s) => s.filters);
  const tetherState = useLiveMapStore((s) => s.tetherState);
  const setTetherMode = useLiveMapStore((s) => s.setTetherMode);
  const setActiveBatch = useLiveMapStore((s) => s.setActiveBatch);
  const setSelectedComparisonId = useLiveMapStore((s) => s.setSelectedComparisonId);
  const selectEntity = useLiveMapStore((s) => s.selectEntity);

  // Map overlay control state (local — not persisted)
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [mapBaseStyle, setMapBaseStyle] = useState<string>('default');
  const [show3DBuildings, setShow3DBuildings] = useState(false);

  // Layer refs
  const layersRef = useRef<{
    driver: DriverMarkerLayer;
    vehicle: VehicleMarkerLayer;
    route: RouteLineLayer;
    delivery: DeliveryMarkerLayer;
    facility: FacilityMarkerLayer;
    warehouse: WarehouseMarkerLayer;
    zone: ZoneMarkerLayer;
    tether: TetherLineLayer;
    connector: ConnectorLineLayer;
    altRoute: AltRouteLayer;
  } | null>(null);

  // Dynamic batch-route marker layer (registered/removed when a batch is selected)
  const batchRouteLayerRef = useRef<BatchRouteMarkerLayer | null>(null);

  // Popup ref for route-line clicks
  const routePopupRef = useRef<maplibregl.Popup | null>(null);

  // Get live tracking data
  const {
    driverGeoJSON,
    vehicleGeoJSON,
    routeGeoJSON,
    deliveryGeoJSON,
    facilityGeoJSON,
    warehouseGeoJSON,
    zoneGeoJSON,
    deliveries,
    facilities: allFacilities,
    warehouses: allWarehouses,
    isLoading,
    counts,
  } = useLiveTrackingCtx();

  const handleRecenterMap = useCallback(() => {
    const map = kernelRef.current?.getMap();
    if (!map) return;

    const bounds = new maplibregl.LngLatBounds();
    let hasValidCoordinates = false;

    // Helper to safely extend bounds
    const extendBounds = (lng?: number, lat?: number) => {
      if (typeof lng === 'number' && typeof lat === 'number' && !isNaN(lng) && !isNaN(lat)) {
        bounds.extend([lng, lat]);
        hasValidCoordinates = true;
      }
    };

    // 1. Add Facilities (if layer is enabled)
    if (filters.showFacilities && allFacilities) {
      allFacilities.forEach((f) => extendBounds(Number(f.lng), Number(f.lat)));
    }

    // 2. Add Drivers (if layer is enabled)
    if (filters.showDrivers && driverGeoJSON?.features) {
      driverGeoJSON.features.forEach((f: any) => {
        const [lng, lat] = f.geometry?.coordinates || [];
        extendBounds(lng, lat);
      });
    }

    // 3. Add Vehicles (if layer is enabled)
    if (filters.showVehicles && vehicleGeoJSON?.features) {
      vehicleGeoJSON.features.forEach((f: any) => {
        const [lng, lat] = f.geometry?.coordinates || [];
        extendBounds(lng, lat);
      });
    }

    // Fallback: If nothing is visible (all layers off), default to framing the facilities
    if (!hasValidCoordinates && allFacilities) {
      allFacilities.forEach((f) => extendBounds(Number(f.lng), Number(f.lat)));
    }

    if (hasValidCoordinates) {
      map.fitBounds(bounds, { padding: 80, duration: 1500, maxZoom: 14 });
    }
  }, [allFacilities, filters.showFacilities, filters.showDrivers, filters.showVehicles, driverGeoJSON, vehicleGeoJSON]);

  // Fit map to bounds of all facilities on initial load
  useEffect(() => {
    if (!mapReady || hasFittedBoundsRef.current || !allFacilities || allFacilities.length === 0) return;
    
    hasFittedBoundsRef.current = true;
    handleRecenterMap();
  }, [mapReady, allFacilities, handleRecenterMap]);

  // ── Derive depot + tether facilities from active batch ─────────────────────
  const { tetherDepot, tetherFacilities, tetherOrderedIds } = useMemo(() => {
    if (!tetherState.activeBatchId) {
      return { tetherDepot: null, tetherFacilities: [], tetherOrderedIds: [] };
    }

    const delivery = deliveries.find((d) => d.id === tetherState.activeBatchId);
    if (!delivery) {
      return { tetherDepot: null, tetherFacilities: [], tetherOrderedIds: [] };
    }

    // Depot = the batch's warehouse
    const warehouse = allWarehouses.find((w) => w.id === delivery.warehouseId);
    const depot = warehouse?.lat && warehouse?.lng
      ? { lat: Number(warehouse.lat), lng: Number(warehouse.lng) }
      : null;

    // Delivery facility IDs in order
    const orderedIds = delivery.facilities.map((f) => f.id);

    // Map to master facility objects (for lat/lng precision)
    const facilityMap = new Map(allFacilities.map((f) => [f.id, f]));
    const tetherFacs = orderedIds
      .map((id) => {
        const f = facilityMap.get(id);
        if (!f?.lat || !f?.lng) return null;
        return { id: f.id, name: f.name, lat: Number(f.lat), lng: Number(f.lng) };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    return { tetherDepot: depot, tetherFacilities: tetherFacs, tetherOrderedIds: orderedIds };
  }, [tetherState.activeBatchId, deliveries, allFacilities, allWarehouses]);

  // ── Auto-zoom to batch/route when selected ───────────────────────────────
  useEffect(() => {
    const map = kernelRef.current?.getMap();
    if (!map || !tetherState.activeBatchId) return;

    let hasValidCoordinates = false;
    const bounds = new maplibregl.LngLatBounds();

    if (tetherDepot && typeof tetherDepot.lng === 'number' && typeof tetherDepot.lat === 'number') {
      bounds.extend([tetherDepot.lng, tetherDepot.lat]);
      hasValidCoordinates = true;
    }

    tetherFacilities.forEach((f) => {
      if (typeof f.lng === 'number' && typeof f.lat === 'number') {
        bounds.extend([f.lng, f.lat]);
        hasValidCoordinates = true;
      }
    });

    if (hasValidCoordinates) {
      map.fitBounds(bounds, { padding: 80, duration: 1500, maxZoom: 14 });
    }
  }, [tetherState.activeBatchId, tetherDepot, tetherFacilities]);

  // ── Road route fetcher (cardinal/route/alternatives) ──────────────────────
  const { roadRoute, alternativeRoutes, cardinalPaths, isFetching: isFetchingRoad, fetchAlternatives } =
    useRoadRouteFetcher({
      depot: tetherDepot,
      facilities: tetherFacilities,
      orderedFacilityIds: tetherOrderedIds,
      tetherMode: tetherState.mode,
      enabled: !!tetherState.activeBatchId && tetherFacilities.length > 0,
    });

  // ── Compute tether GeoJSON from road data ─────────────────────────────────
  const tetherGeometry = useTetherGeometry(
    tetherDepot,
    tetherFacilities,
    tetherOrderedIds,
    tetherState.mode,
    roadRoute,
    cardinalPaths,
    alternativeRoutes,
    tetherState.selectedComparisonId,
    false, // live map doesn't run TSP optimization; order comes from batch
  );

  // ── Debounced layer updaters ───────────────────────────────────────────────
  const updateDriverLayer = useDebouncedCallback((data) => {
    const layer = layersRef.current?.driver;
    if (layer?.isAttached()) layer.update(data);
  }, 300);

  const updateVehicleLayer = useDebouncedCallback((data) => {
    const layer = layersRef.current?.vehicle;
    if (layer?.isAttached()) layer.update(data);
  }, 300);

  const updateRouteLayer = useDebouncedCallback((data) => {
    const layer = layersRef.current?.route;
    if (layer?.isAttached()) layer.update(data);
  }, 500);

  const updateDeliveryLayer = useDebouncedCallback((data) => {
    const layer = layersRef.current?.delivery;
    if (layer?.isAttached()) layer.update(data);
  }, 300);

  const updateFacilityLayer = useDebouncedCallback((data) => {
    const layer = layersRef.current?.facility;
    if (layer?.isAttached()) layer.update(data);
  }, 500);

  const updateWarehouseLayer = useDebouncedCallback((data) => {
    const layer = layersRef.current?.warehouse;
    if (layer?.isAttached()) layer.update(data);
  }, 500);

  const updateZoneLayer = useDebouncedCallback((data) => {
    const layer = layersRef.current?.zone;
    if (layer?.isAttached()) layer.update(data);
  }, 500);

  const updateTetherLayers = useDebouncedCallback((geometry: typeof tetherGeometry) => {
    if (!layersRef.current) return;
    const { tether, connector, altRoute } = layersRef.current;
    if (tether?.isAttached()) tether.update(geometry.tetherFeatures);
    if (connector?.isAttached()) connector.update(geometry.connectorFeatures);
    if (altRoute?.isAttached()) altRoute.update(geometry.altRouteFeatures);
  }, 300);

  // ── Map initialization ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const s = mapSettingsRef.current;

    const kernel = new LiveMapKernel({
      onReady: () => {
        console.log('[LiveMapView] Map ready');
        hasMapEverBeenReadyRef.current = true;
        setMapError(null);
        setMapReadyKey((k) => k + 1);

        // Force a layout recalculation shortly after initialization.
        // This fixes the bug where MapLibre locks to a 300px fallback height.
        setTimeout(() => kernel.getMap()?.resize(), 150);
      },
      onError: (error) => {
        // MapLibre emits many runtime/network errors that don't necessarily
        // mean the map failed to initialize. Only block the UI when the map
        // has never reached a ready state in this lifecycle.
        if (!hasMapEverBeenReadyRef.current) {
          console.error('[LiveMapView] Fatal map init error:', error);
          setMapError(error.message || 'Map failed to load');
          return;
        }

        console.warn('[LiveMapView] Non-fatal map runtime error:', error);
      },
    });

    // Create layers
    const layers = {
      driver: new DriverMarkerLayer(),
      vehicle: new VehicleMarkerLayer(),
      route: new RouteLineLayer(),
      delivery: new DeliveryMarkerLayer(),
      facility: new FacilityMarkerLayer(),
      warehouse: new WarehouseMarkerLayer(),
      zone: new ZoneMarkerLayer(),
      tether: new TetherLineLayer(),
      connector: new ConnectorLineLayer(),
      altRoute: new AltRouteLayer(),
    };

    // Registration order matters for GL layer stacking:
    // zone → facility → warehouse → connector → altRoute → tether → route → delivery → driver → vehicle
    kernel.registerLayer('zone', layers.zone);
    kernel.registerLayer('facility', layers.facility);
    kernel.registerLayer('warehouse', layers.warehouse);
    kernel.registerLayer('connector', layers.connector);
    kernel.registerLayer('alt-route', layers.altRoute);
    kernel.registerLayer('tether', layers.tether);
    kernel.registerLayer('route', layers.route);
    kernel.registerLayer('delivery', layers.delivery);
    kernel.registerLayer('driver', layers.driver);
    kernel.registerLayer('vehicle', layers.vehicle);

    // Apply default layer visibility from workspace settings
    layers.zone.setVisibility(s.layers.showZones);
    layers.facility.setVisibility(s.layers.showFacilities);
    layers.route.setVisibility(s.layers.showRoutes);

    const voyagerStyle = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
    const positronStyle = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
    const darkMatterStyle = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
    
    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || 'YOUR_MAPBOX_TOKEN';
    const mapboxStyle = `https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${mapboxToken}`;

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

    // Workspace settings fallback resolution
    let fallbackStyle: any = s.resolvedStyle;
    
    if (fallbackStyle === 'streets' || fallbackStyle === 'auto' || fallbackStyle === 'osm') {
      fallbackStyle = osmStyle;
    } else if (fallbackStyle === 'light') {
      fallbackStyle = positronStyle;
    } else if (fallbackStyle === 'dark') {
      fallbackStyle = darkMatterStyle;
    } 
    else if (typeof fallbackStyle === 'string' && fallbackStyle.includes('{z}')) {
      fallbackStyle = {
        version: 8,
        sources: {
          'raster-tiles': { type: 'raster', tiles: [fallbackStyle], tileSize: 256, maxzoom: 18, attribution: '&copy; OpenStreetMap contributors' }
        },
        layers: [{ id: 'raster-layer', type: 'raster', source: 'raster-tiles', minzoom: 0, maxzoom: 22 }]
      };
    } 
    else if (!fallbackStyle || (typeof fallbackStyle === 'object' && Object.keys(fallbackStyle).length === 0)) {
      fallbackStyle = osmStyle;
    }
    
    let styleToUse: any;
    switch (mapBaseStyle) {
      case 'osm': styleToUse = osmStyle; break;
      case 'satellite': styleToUse = satelliteStyle; break;
      case 'voyager': styleToUse = voyagerStyle; break;
      case 'light': styleToUse = positronStyle; break;
      case 'dark': styleToUse = darkMatterStyle; break;
      case 'mapbox': styleToUse = import.meta.env.VITE_MAPBOX_TOKEN ? mapboxStyle : osmStyle; break;
      case 'default':
      default: styleToUse = fallbackStyle; break;
    }

    // Failsafe: Ensure valid [lng, lat] coordinate array for MapLibre
    let safeCenter = s.center;
    if (!Array.isArray(safeCenter) || safeCenter.length !== 2 || isNaN(safeCenter[0]) || isNaN(safeCenter[1])) {
      safeCenter = [8.6753, 9.0820]; // Default to center of Nigeria
    }

    // Initialize map with workspace-configured center, zoom and basemap
    kernel.init({
      container: containerRef.current,
      center: safeCenter as [number, number],
      zoom: s.zoom || 6,
      style: styleToUse,
    });

    kernelRef.current = kernel;
    layersRef.current = layers;

    return () => {
      kernel.destroy();
      kernelRef.current = null;
      layersRef.current = null;
      batchRouteLayerRef.current = null;
      initializedRef.current = false;
      hasMapEverBeenReadyRef.current = false;
      setMapReadyKey(0);
    };
  }, [retryKey, mapBaseStyle]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 3D Buildings Toggle ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !kernelRef.current) return;
    const map = kernelRef.current.getMap();
    if (!map) return;

    const toggle3D = () => {
      if (show3DBuildings) {
        // Mapbox composite source contains the 3D 'building' vector layer
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

  // ── Permanent Resize Observer Fix ──────────────────────────────────────────
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

  // ── Popup position tracking: reproject on map move ────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const map = kernelRef.current?.getMap();
    if (!map) return;

    const reprojectPopup = () => {
      const lngLat = markerPopupLngLatRef.current;
      if (!lngLat) return;
      const pt = map.project(lngLat);
      setMarkerPopupScreenPos({ x: pt.x, y: pt.y });
    };

    map.on('move', reprojectPopup);
    map.on('zoom', reprojectPopup);
    return () => {
      map.off('move', reprojectPopup);
      map.off('zoom', reprojectPopup);
    };
  }, [mapReady]);

  // ── Close popup when clicking empty map canvas ─────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const map = kernelRef.current?.getMap();
    if (!map) return;

    const handleMapCanvasClick = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['facility-markers', 'warehouse-markers'],
      });
      if (features.length === 0) {
        setMarkerPopup(null);
        markerPopupLngLatRef.current = null;
        setMarkerPopupScreenPos(null);
      }
    };

    map.on('click', handleMapCanvasClick);
    return () => { map.off('click', handleMapCanvasClick); };
  }, [mapReady]);

  // ── Live data → layers ────────────────────────────────────────────────────
  useEffect(() => { if (mapReady) updateDriverLayer(driverGeoJSON); }, [driverGeoJSON, mapReady, updateDriverLayer]);
  useEffect(() => { if (mapReady) updateVehicleLayer(vehicleGeoJSON); }, [vehicleGeoJSON, mapReady, updateVehicleLayer]);
  useEffect(() => { if (mapReady) updateRouteLayer(routeGeoJSON); }, [routeGeoJSON, mapReady, updateRouteLayer]);
  useEffect(() => { if (mapReady) updateDeliveryLayer(deliveryGeoJSON); }, [deliveryGeoJSON, mapReady, updateDeliveryLayer]);
  useEffect(() => { if (mapReady) updateFacilityLayer(facilityGeoJSON); }, [facilityGeoJSON, mapReady, updateFacilityLayer]);
  useEffect(() => { if (mapReady) updateWarehouseLayer(warehouseGeoJSON); }, [warehouseGeoJSON, mapReady, updateWarehouseLayer]);
  useEffect(() => { if (mapReady) updateZoneLayer(zoneGeoJSON); }, [zoneGeoJSON, mapReady, updateZoneLayer]);

  // ── Tether geometry → layers ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    updateTetherLayers(tetherGeometry);
  }, [tetherGeometry, mapReady, updateTetherLayers]);

  // ── Dynamic BatchRouteMarkerLayer ──────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !kernelRef.current) return;
    const kernel = kernelRef.current;

    if (tetherState.activeBatchId) {
      // Register if not yet registered
      if (!batchRouteLayerRef.current) {
        const layer = new BatchRouteMarkerLayer();
        kernel.registerLayer('batch-route', layer);
        batchRouteLayerRef.current = layer;
      }
    } else {
      // Remove layer when no batch selected
      if (batchRouteLayerRef.current) {
        kernel.removeLayer('batch-route');
        batchRouteLayerRef.current = null;
      }
      // Also clear tether layers
      if (layersRef.current) {
        const { tether, connector, altRoute } = layersRef.current;
        const empty = { type: 'FeatureCollection' as const, features: [] };
        if (tether?.isAttached()) tether.update(empty as any);
        if (connector?.isAttached()) connector.update(empty as any);
        if (altRoute?.isAttached()) altRoute.update(empty as any);
      }
    }
  }, [tetherState.activeBatchId, mapReady]);

  // ── Update BatchRouteMarkerLayer data ─────────────────────────────────────
  useEffect(() => {
    const layer = batchRouteLayerRef.current;
    if (!layer?.isAttached()) return;

    const delivery = deliveries.find((d) => d.id === tetherState.activeBatchId);
    const orderedIds = delivery?.facilities.map((f) => f.id) ?? [];

    const data: BatchRouteMarkerData = {
      facilities: tetherFacilities.map((f, idx) => ({
        id: f.id,
        name: f.name,
        lat: f.lat,
        lng: f.lng,
        isSelected: true,
        visitIndex: orderedIds.indexOf(f.id) + 1 || idx + 1,
      })),
      depot: tetherDepot
        ? {
            lat: tetherDepot.lat,
            lng: tetherDepot.lng,
            name: allWarehouses.find((w) =>
              delivery && w.id === delivery.warehouseId
            )?.name ?? 'Warehouse',
          }
        : null,
      focusMode: isFocusMode,
    };

    layer.updateBatch(data);
  }, [tetherFacilities, tetherDepot, deliveries, tetherState.activeBatchId, allWarehouses, isFocusMode]);

  // ── Layer visibility from filters ─────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !layersRef.current) return;
    layersRef.current.driver.setVisibility(filters.showDrivers);
    layersRef.current.vehicle.setVisibility(filters.showVehicles);
    layersRef.current.route.setVisibility(filters.showRoutes);
    layersRef.current.delivery.setVisibility(filters.showDeliveries);
    layersRef.current.facility.setVisibility(filters.showFacilities);
    layersRef.current.warehouse.setVisibility(filters.showWarehouses);
    layersRef.current.zone.setVisibility(filters.showZones);
  }, [filters, mapReady]);

  // ── Entity click events ────────────────────────────────────────────────────
  const handleEntityClick = useCallback(
    (entityId: string, entityType: 'driver' | 'vehicle' | 'delivery' | 'facility') => {
      selectEntity(entityId, entityType);
      onEntitySelect?.(entityId, entityType);
    },
    [selectEntity, onEntitySelect]
  );

  // ── Route popup helper ────────────────────────────────────────────────────
  const showRoutePopup = useCallback(
    (detail: { distanceKm?: number; timeMinutes?: number; routeLabel?: string; color?: string; lngLat: maplibregl.LngLat }) => {
      routePopupRef.current?.remove();
      const map = kernelRef.current?.getMap();
      if (!map) return;

      const { distanceKm, timeMinutes, routeLabel, color, lngLat } = detail;
      if (!distanceKm && !routeLabel) return;

      const timeStr = timeMinutes != null
        ? timeMinutes < 60
          ? `${Math.round(timeMinutes)} min`
          : `${(timeMinutes / 60).toFixed(1)} hrs`
        : '';

      const popup = new maplibregl.Popup({ closeButton: false, maxWidth: '200px' })
        .setLngLat(lngLat)
        .setHTML(`
          <div style="font-size:12px;line-height:1.4">
            ${routeLabel ? `<strong style="color:${color || '#333'}">${routeLabel}</strong><br/>` : ''}
            ${distanceKm != null ? `${distanceKm.toFixed(1)} km` : ''}${timeStr ? ` &middot; ${timeStr}` : ''}
          </div>
        `)
        .addTo(map);

      routePopupRef.current = popup;
    },
    []
  );

  // ── Custom event listeners ─────────────────────────────────────────────────
  useEffect(() => {
    const handleDriverClick = (e: CustomEvent) => handleEntityClick(e.detail.driverId, 'driver');
    const handleVehicleClick = (e: CustomEvent) => handleEntityClick(e.detail.vehicleId, 'vehicle');
    const handleDeliveryClick = (e: CustomEvent) => handleEntityClick(e.detail.facilityId, 'delivery');
    const handleRouteClick = (e: CustomEvent) => {
      handleEntityClick(e.detail.batchId, 'delivery');
      // Activate tether mode for this batch
      setActiveBatch(e.detail.batchId);
    };
    const handleFacilityClick = (e: CustomEvent) => {
      handleEntityClick(e.detail.facilityId, 'facility');
      const { properties, lngLat } = e.detail;
      if (lngLat && properties) {
        const popupData: MarkerPopupData = {
          type: 'facility',
          id: properties.id,
          name: properties.name,
          subtype: properties.type ?? null,
          lga: properties.lga ?? null,
          lat: lngLat.lat,
          lng: lngLat.lng,
        };
        setMarkerPopup(popupData);
        const coords: [number, number] = [lngLat.lng, lngLat.lat];
        markerPopupLngLatRef.current = coords;
        const map = kernelRef.current?.getMap();
        if (map) {
          const pt = map.project(coords);
          setMarkerPopupScreenPos({ x: pt.x, y: pt.y });
        }
      }
    };

    const handleWarehouseMarkerClick = (e: CustomEvent) => {
      const { properties, lngLat } = e.detail;
      if (lngLat && properties) {
        handleEntityClick(properties.id, 'warehouse');
        const popupData: MarkerPopupData = {
          type: 'warehouse',
          id: properties.id,
          name: properties.name,
          code: properties.code ?? null,
          isActive: properties.isActive,
          lat: lngLat.lat,
          lng: lngLat.lng,
        };
        setMarkerPopup(popupData);
        const coords: [number, number] = [lngLat.lng, lngLat.lat];
        markerPopupLngLatRef.current = coords;
        const map = kernelRef.current?.getMap();
        if (map) {
          const pt = map.project(coords);
          setMarkerPopupScreenPos({ x: pt.x, y: pt.y });
        }
      }
    };

    const handleTetherClick = (e: CustomEvent) => showRoutePopup(e.detail);
    const handleAltRouteClick = (e: CustomEvent) => {
      showRoutePopup(e.detail);
      // Select this comparison route
      if (e.detail.id) setSelectedComparisonId(e.detail.id);
    };

    window.addEventListener('driver-marker-click', handleDriverClick as EventListener);
    window.addEventListener('vehicle-marker-click', handleVehicleClick as EventListener);
    window.addEventListener('delivery-marker-click', handleDeliveryClick as EventListener);
    window.addEventListener('route-line-click', handleRouteClick as EventListener);
    window.addEventListener('facility-marker-click', handleFacilityClick as EventListener);
    window.addEventListener('warehouse-marker-click', handleWarehouseMarkerClick as EventListener);
    window.addEventListener('tether-line-click', handleTetherClick as EventListener);
    window.addEventListener('alt-route-line-click', handleAltRouteClick as EventListener);

    return () => {
      window.removeEventListener('driver-marker-click', handleDriverClick as EventListener);
      window.removeEventListener('vehicle-marker-click', handleVehicleClick as EventListener);
      window.removeEventListener('delivery-marker-click', handleDeliveryClick as EventListener);
      window.removeEventListener('route-line-click', handleRouteClick as EventListener);
      window.removeEventListener('facility-marker-click', handleFacilityClick as EventListener);
      window.removeEventListener('warehouse-marker-click', handleWarehouseMarkerClick as EventListener);
      window.removeEventListener('tether-line-click', handleTetherClick as EventListener);
      window.removeEventListener('alt-route-line-click', handleAltRouteClick as EventListener);
    };
  }, [handleEntityClick, setActiveBatch, setSelectedComparisonId, showRoutePopup]);

  // ── Fullscreen toggle ─────────────────────────────────────────────────────
  const handleToggleFullscreen = useCallback(() => {
    setIsMapFullscreen((prev) => {
      const next = !prev;
      // Apply / remove fullscreen class on the container div
      if (containerRef.current) {
        const wrapper = containerRef.current.closest('.live-map-wrapper') as HTMLElement | null;
        if (wrapper) {
          wrapper.style.position = next ? 'fixed' : '';
          wrapper.style.inset = next ? '0' : '';
          wrapper.style.zIndex = next ? '9999' : '';
        }
      }
      // Resize map to fill new dimensions
      setTimeout(() => kernelRef.current?.getMap()?.resize(), 0);
      return next;
    });
  }, []);

  // ── Location search state ──────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeoapifyPlace[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [pinnedPlace, setPinnedPlace] = useState<GeoapifyPlace | null>(null);
  const [coordsCopied, setCoordsCopied] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Map marker popup state ─────────────────────────────────────────────────
  const [markerPopup, setMarkerPopup] = useState<MarkerPopupData | null>(null);
  const markerPopupLngLatRef = useRef<[number, number] | null>(null);
  const [markerPopupScreenPos, setMarkerPopupScreenPos] = useState<{ x: number; y: number } | null>(null);

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    if (!value) {
      setSearchResults([]);
      setSearchOpen(false);
      setPinnedPlace(null);
      return;
    }
    if (value.length < 2) return;
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      const places = await searchAddress(value);
      setSearchResults(places);
      setSearching(false);
      setSearchOpen(places.length > 0);
    }, 450);
  };

  const handleSearchSelect = (place: GeoapifyPlace) => {
    setSearchQuery(place.formatted);
    setSearchResults([]);
    setSearchOpen(false);
    setPinnedPlace(place);
    kernelRef.current?.flyTo([place.lon, place.lat], 14);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
    setPinnedPlace(null);
    setCoordsCopied(false);
  };

  const copyPinnedCoords = async () => {
    if (!pinnedPlace) return;
    const coords = `${pinnedPlace.lat.toFixed(6)}, ${pinnedPlace.lon.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(coords);
      setCoordsCopied(true);
      setTimeout(() => setCoordsCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div className="live-map-wrapper relative w-full h-full min-h-[400px] flex-1">
      {/* Map canvas */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* Error overlay */}
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80 z-20">
          <div className="bg-card border rounded-lg px-6 py-4 shadow-lg max-w-sm text-center space-y-2">
            <p className="text-sm font-medium text-destructive">Map failed to load</p>
            <p className="text-xs text-muted-foreground">{mapError}</p>
            <button
              className="text-xs text-primary underline"
              onClick={() => { setMapError(null); setRetryKey((k) => k + 1); }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {!mapReady && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-card/80 backdrop-blur-sm border rounded-md px-4 py-2 shadow text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading map…
          </div>
        </div>
      )}

      {/* Location search bar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 w-80 max-w-[calc(100%-2rem)]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            placeholder="Search locations..."
            className="pl-8 pr-8 bg-card/95 backdrop-blur-sm shadow-md border-border/80 h-9 text-sm"
          />
          {searching && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          {!searching && searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {searchOpen && searchResults.length > 0 && (
          <div className="absolute top-full mt-1 w-full bg-card border rounded-md shadow-lg max-h-60 overflow-auto z-20">
            {searchResults.map((place, i) => (
              <button
                key={i}
                className="flex items-start gap-2 w-full px-3 py-2.5 hover:bg-muted transition-colors text-left"
                onMouseDown={() => handleSearchSelect(place)}
              >
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{place.address_line1 || place.formatted}</p>
                  {place.address_line2 && (
                    <p className="text-xs text-muted-foreground truncate">{place.address_line2}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pinned place badge with coordinate copy */}
      {pinnedPlace && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10 bg-card/95 backdrop-blur-sm border rounded-xl px-3 py-2 shadow-lg flex flex-col gap-1.5 min-w-0" style={{ maxWidth: 'calc(100% - 2rem)', width: 320 }}>
          {/* Address row */}
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-primary shrink-0" />
            <span className="text-xs font-medium truncate flex-1">{pinnedPlace.address_line1 || pinnedPlace.formatted}</span>
            <button onClick={clearSearch} className="text-muted-foreground hover:text-foreground transition-colors ml-1 shrink-0">
              <X className="h-3 w-3" />
            </button>
          </div>
          {/* Coordinates row with copy */}
          <button
            onClick={copyPinnedCoords}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group rounded px-1 py-0.5 -mx-1 hover:bg-muted w-full"
            title="Copy coordinates"
          >
            <span className="font-mono tabular-nums flex-1 text-left">
              {pinnedPlace.lat.toFixed(6)}, {pinnedPlace.lon.toFixed(6)}
            </span>
            {coordsCopied ? (
              <Check className="h-3 w-3 text-green-500 shrink-0" />
            ) : (
              <Copy className="h-3 w-3 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
        </div>
      )}

      {/* Right-side Controls Group — Positioned below native Navigation/Zoom Controls (~108px from top) */}
      {mapReady && (
        <div className="absolute right-2 z-10 flex flex-col gap-2" style={{ top: 108 }}>
          <MapOverlayControls
            isFullscreen={isMapFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            isFocusMode={isFocusMode}
            onToggleFocusMode={() => setIsFocusMode((p) => !p)}
            hasSelection={!!tetherState.activeBatchId}
          />

          {/* Recenter Map Button */}
          <button
            title="Recenter Map"
            onClick={handleRecenterMap}
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
            <Locate style={{ width: 15, height: 15, color: '#333' }} />
          </button>

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
              <button onClick={() => setMapBaseStyle('default')} className={cn("text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors whitespace-nowrap", mapBaseStyle === 'default' && "text-primary font-medium")}>Workspace Default</button>
              <button onClick={() => setMapBaseStyle('osm')} className={cn("text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors whitespace-nowrap", mapBaseStyle === 'osm' && "text-primary font-medium")}>OpenStreetMap</button>
              <button onClick={() => setMapBaseStyle('satellite')} className={cn("text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors whitespace-nowrap", mapBaseStyle === 'satellite' && "text-primary font-medium")}>Satellite (Esri)</button>
              <button onClick={() => setMapBaseStyle('voyager')} className={cn("text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors whitespace-nowrap", mapBaseStyle === 'voyager' && "text-primary font-medium")}>Carto Voyager</button>
              <button onClick={() => setMapBaseStyle('light')} className={cn("text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors whitespace-nowrap", mapBaseStyle === 'light' && "text-primary font-medium")}>Carto Light</button>
              <button onClick={() => setMapBaseStyle('dark')} className={cn("text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors whitespace-nowrap", mapBaseStyle === 'dark' && "text-primary font-medium")}>Carto Dark</button>
              <div className="border-t my-1"></div>
              <button onClick={() => setShow3DBuildings((p) => !p)} className={cn("text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors whitespace-nowrap", show3DBuildings && "text-primary font-medium")}>{show3DBuildings ? 'Disable 3D Buildings' : 'Enable 3D Buildings'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Tether mode controls — shown only when a batch is selected */}
      {mapReady && tetherState.activeBatchId && (
        <div className="absolute bottom-16 right-2 z-10 flex flex-col gap-1">
          {isFetchingRoad && (
            <div
              style={{
                background: '#fff',
                borderRadius: 4,
                boxShadow: '0 0 0 2px rgba(0,0,0,0.1)',
                padding: '4px 8px',
                fontSize: 11,
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Loader2 style={{ width: 10, height: 10 }} className="animate-spin" />
              Fetching roads…
            </div>
          )}

          <div
            style={{
              background: '#fff',
              borderRadius: 4,
              boxShadow: '0 0 0 2px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}
          >
            {(
              [
                { mode: 'route' as TetherMode, Icon: Route, label: 'Route' },
                { mode: 'cardinal' as TetherMode, Icon: Radar, label: 'Cardinal' },
                { mode: 'alternatives' as TetherMode, Icon: Split, label: 'Alternatives' },
              ] as const
            ).map(({ mode, Icon, label }, idx, arr) => (
              <button
                key={mode}
                title={label}
                onClick={() => {
                  setTetherMode(mode);
                  if (mode === 'alternatives') fetchAlternatives();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 29,
                  height: 29,
                  padding: 0,
                  border: 'none',
                  background: tetherState.mode === mode ? '#0096ff' : 'transparent',
                  cursor: 'pointer',
                  outline: 'none',
                  borderTop: idx > 0 ? '1px solid #ddd' : 'none',
                  boxSizing: 'border-box',
                }}
              >
                <Icon
                  style={{
                    width: 14,
                    height: 14,
                    color: tetherState.mode === mode ? '#fff' : '#333',
                  }}
                />
              </button>
            ))}
          </div>

          {/* Dismiss button */}
          <button
            title="Deselect batch"
            onClick={() => {
              setActiveBatch(null);
              routePopupRef.current?.remove();
            }}
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
            <X style={{ width: 13, height: 13, color: '#666' }} />
          </button>
        </div>
      )}

      {/* Map marker popup card */}
      {markerPopup && markerPopupScreenPos && (
        <MapMarkerPopup
          data={markerPopup}
          screenPos={markerPopupScreenPos}
          onClose={() => {
            setMarkerPopup(null);
            markerPopupLngLatRef.current = null;
            setMarkerPopupScreenPos(null);
          }}
        />
      )}

      {/* Loading data indicator */}
      {isLoading && (
        <div className="absolute top-4 left-4 bg-card border px-3 py-2 rounded-md shadow-md">
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      )}

      {/* Stats badge */}
      {mapReady && (
        <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur-sm border px-3 py-1.5 rounded-md shadow-md flex flex-wrap gap-x-3 gap-y-0.5 text-xs max-w-xs">
          {([
            { key: 'showFacilities', label: 'Facilities', count: counts.facilities },
            { key: 'showWarehouses', label: 'Warehouses', count: counts.warehouses },
            { key: 'showZones',      label: 'Zones',      count: counts.zones },
            { key: 'showDrivers',    label: 'Drivers',    count: counts.drivers, extra: counts.activeDrivers > 0 ? `${counts.activeDrivers} active` : undefined },
            { key: 'showVehicles',   label: 'Vehicles',   count: counts.vehicles },
            { key: 'showDeliveries', label: 'Deliveries', count: counts.deliveries },
          ] as const).map(({ key, label, count, extra }) => {
            const visible = filters[key];
            return (
              <span key={key} className={visible ? 'text-foreground' : 'text-muted-foreground/50 line-through'}>
                <span className="font-medium">{count}</span> {label}
                {extra && visible && <span className="text-green-600 ml-1">({extra})</span>}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

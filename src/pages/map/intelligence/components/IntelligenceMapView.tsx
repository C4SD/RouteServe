/**
 * IntelligenceMapView - Unified map for the Map Intelligence page
 *
 * Renders all layers simultaneously:
 *   Planning layers: zone polygons, route geometries, service area hulls
 *   Live tracking layers: drivers, vehicles, deliveries, facilities, warehouses, zones
 *   Tether layers: tether line, connector, alt-route (batch route visualization)
 *
 * Layer visibility is controlled per-mode:
 *   track     – live tracking layers ON, planning layers as subtle background
 *   analytics – planning layers prominent, tracking layers dimmed/hidden
 *   playback  – handled externally via PlaybackMap; this view is hidden
 */

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { Route, Radar, Split, Loader2, Search, X, MapPin, Layers, Globe, Map as MapIcon } from 'lucide-react';
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
import { ZonePolygonLayer } from '@/maps-v3/layers/ZonePolygonLayer';
import { RouteGeometryLayer } from '@/maps-v3/layers/RouteGeometryLayer';
import { ServiceAreaPolygonLayer } from '@/maps-v3/layers/ServiceAreaPolygonLayer';
import type { BatchRouteMarkerData } from '@/maps-v3/layers/BatchRouteMarkerLayer';
import { useLiveTrackingCtx } from '@/contexts/LiveTrackingContext';
import { useLiveMapStore } from '@/stores/liveMapStore';
import { useRoadRouteFetcher } from '@/hooks/useRoadRouteFetcher';
import { useTetherGeometry } from '@/hooks/useTetherGeometry';
import { useDebouncedCallback } from 'use-debounce';
import { getMapLibreStyle } from '@/lib/mapConfig';
import { useMapSettings } from '@/hooks/settings/useMapSettings';
import { searchAddress, type GeoapifyPlace } from '@/lib/geoapify';
import { MapOverlayControls } from '@/components/map/MapOverlayControls';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { TetherMode } from '@/lib/algorithms/routeOptimizer';
import type { ZonePolygonData } from '@/maps-v3/layers/ZonePolygonLayer';
import type { RouteGeometryData } from '@/maps-v3/layers/RouteGeometryLayer';
import type { ServiceAreaHullData } from '@/maps-v3/layers/ServiceAreaPolygonLayer';
import type { BoundaryFeature, ZoningEditMode } from '../hooks/useGeospatialZoning';
import type { AssignedLgaMap } from '@/services/zoningService';
import type { OperationalZone } from '@/types/zones';
import { zoneColor } from '@/services/zoningService';

export type IntelligenceMode = 'track' | 'analytics' | 'zoning';

interface IntelligenceMapViewProps {
  mode: IntelligenceMode;
  onEntitySelect?: (entityId: string, entityType: 'driver' | 'vehicle' | 'delivery' | 'facility') => void;
  /** Planning layer data from useIntelligencePlanningData */
  zonePolygons?: ZonePolygonData[];
  routeGeometries?: RouteGeometryData[];
  serviceAreaHulls?: ServiceAreaHullData[];
  /** Layer visibility overrides from sidebar toggles */
  showZonePolygons?: boolean;
  showRouteGeometry?: boolean;
  showServiceAreas?: boolean;
  /** Zoning mode props */
  zoningProps?: {
    stateFeatures: BoundaryFeature[];
    lgaFeatures: BoundaryFeature[];
    selectedLgaIds: string[];
    assignedMap: AssignedLgaMap;
    zones: OperationalZone[];
    editMode: ZoningEditMode;
    editingZoneId: string | null;
    onToggleLga: (id: string) => void;
    onToggleState: (id: string) => void;
  };
}

export function IntelligenceMapView({
  mode,
  onEntitySelect,
  zonePolygons = [],
  routeGeometries = [],
  serviceAreaHulls = [],
  showZonePolygons = true,
  showRouteGeometry = true,
  showServiceAreas = true,
  zoningProps,
}: IntelligenceMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const kernelRef = useRef<LiveMapKernel | null>(null);
  const [mapReadyKey, setMapReadyKey] = useState(0);
  const mapReady = mapReadyKey > 0;
  const [mapError, setMapError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const initializedRef = useRef(false);
  const hasMapEverBeenReadyRef = useRef(false);

  const { settings: mapSettings } = useMapSettings();
  const mapSettingsRef = useRef(mapSettings);
  useEffect(() => { mapSettingsRef.current = mapSettings; }, [mapSettings]);

  const filters = useLiveMapStore((s) => s.filters);
  const tetherState = useLiveMapStore((s) => s.tetherState);
  const setTetherMode = useLiveMapStore((s) => s.setTetherMode);
  const setActiveBatch = useLiveMapStore((s) => s.setActiveBatch);
  const setSelectedComparisonId = useLiveMapStore((s) => s.setSelectedComparisonId);
  const selectEntity = useLiveMapStore((s) => s.selectEntity);

  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [mapBaseStyle, setMapBaseStyle] = useState<'street' | 'satellite'>('street');

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
    // Planning layers
    zonePolygon: ZonePolygonLayer;
    routeGeometry: RouteGeometryLayer;
    serviceArea: ServiceAreaPolygonLayer;
  } | null>(null);

  const batchRouteLayerRef = useRef<BatchRouteMarkerLayer | null>(null);
  const routePopupRef = useRef<maplibregl.Popup | null>(null);

  // Live tracking data
  const {
    driverGeoJSON, vehicleGeoJSON, routeGeoJSON, deliveryGeoJSON,
    facilityGeoJSON, warehouseGeoJSON, zoneGeoJSON,
    deliveries, facilities: allFacilities, warehouses: allWarehouses,
    isLoading, counts,
  } = useLiveTrackingCtx();

  // Tether geometry (Track mode only)
  const { tetherDepot, tetherFacilities, tetherOrderedIds } = useMemo(() => {
    if (mode !== 'track' || !tetherState.activeBatchId) {
      return { tetherDepot: null, tetherFacilities: [], tetherOrderedIds: [] };
    }
    const delivery = deliveries.find((d) => d.id === tetherState.activeBatchId);
    if (!delivery) return { tetherDepot: null, tetherFacilities: [], tetherOrderedIds: [] };
    const warehouse = allWarehouses.find((w) => w.id === delivery.warehouseId);
    const depot = warehouse?.lat && warehouse?.lng
      ? { lat: Number(warehouse.lat), lng: Number(warehouse.lng) }
      : null;
    const orderedIds = delivery.facilities.map((f) => f.id);
    const facilityMap = new Map(allFacilities.map((f) => [f.id, f]));
    const tetherFacs = orderedIds
      .map((id) => {
        const f = facilityMap.get(id);
        if (!f?.lat || !f?.lng) return null;
        return { id: f.id, name: f.name, lat: Number(f.lat), lng: Number(f.lng) };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);
    return { tetherDepot: depot, tetherFacilities: tetherFacs, tetherOrderedIds: orderedIds };
  }, [tetherState.activeBatchId, deliveries, allFacilities, allWarehouses, mode]);

  const { roadRoute, alternativeRoutes, cardinalPaths, isFetching: isFetchingRoad, fetchAlternatives } =
    useRoadRouteFetcher({
      depot: tetherDepot,
      facilities: tetherFacilities,
      orderedFacilityIds: tetherOrderedIds,
      tetherMode: tetherState.mode,
      enabled: mode === 'track' && !!tetherState.activeBatchId && tetherFacilities.length > 0,
    });

  const tetherGeometry = useTetherGeometry(
    tetherDepot, tetherFacilities, tetherOrderedIds,
    tetherState.mode, roadRoute, cardinalPaths, alternativeRoutes,
    tetherState.selectedComparisonId, false,
  );

  // ── Debounced layer updaters ──────────────────────────────────────────────
  const updateDriverLayer = useDebouncedCallback((d) => { if (layersRef.current?.driver?.isAttached()) layersRef.current.driver.update(d); }, 300);
  const updateVehicleLayer = useDebouncedCallback((d) => { if (layersRef.current?.vehicle?.isAttached()) layersRef.current.vehicle.update(d); }, 300);
  const updateRouteLayer = useDebouncedCallback((d) => { if (layersRef.current?.route?.isAttached()) layersRef.current.route.update(d); }, 500);
  const updateDeliveryLayer = useDebouncedCallback((d) => { if (layersRef.current?.delivery?.isAttached()) layersRef.current.delivery.update(d); }, 300);
  const updateFacilityLayer = useDebouncedCallback((d) => { if (layersRef.current?.facility?.isAttached()) layersRef.current.facility.update(d); }, 500);
  const updateWarehouseLayer = useDebouncedCallback((d) => { if (layersRef.current?.warehouse?.isAttached()) layersRef.current.warehouse.update(d); }, 500);
  const updateZoneLayer = useDebouncedCallback((d) => { if (layersRef.current?.zone?.isAttached()) layersRef.current.zone.update(d); }, 500);
  const updateTetherLayers = useDebouncedCallback((geometry: typeof tetherGeometry) => {
    if (!layersRef.current) return;
    const { tether, connector, altRoute } = layersRef.current;
    if (tether?.isAttached()) tether.update(geometry.tetherFeatures);
    if (connector?.isAttached()) connector.update(geometry.connectorFeatures);
    if (altRoute?.isAttached()) altRoute.update(geometry.altRouteFeatures);
  }, 300);

  // Planning layer updaters (debounced)
  const updateZonePolygonLayer = useDebouncedCallback((d: ZonePolygonData[]) => {
    if (layersRef.current?.zonePolygon?.isAttached()) layersRef.current.zonePolygon.update(d);
  }, 500);
  const updateRouteGeometryLayer = useDebouncedCallback((d: RouteGeometryData[]) => {
    if (layersRef.current?.routeGeometry?.isAttached()) layersRef.current.routeGeometry.update(d);
  }, 500);
  const updateServiceAreaLayer = useDebouncedCallback((d: ServiceAreaHullData[]) => {
    if (layersRef.current?.serviceArea?.isAttached()) layersRef.current.serviceArea.update(d);
  }, 500);

  // ── Map initialization ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const s = mapSettingsRef.current;
    const kernel = new LiveMapKernel({
      onReady: () => {
        hasMapEverBeenReadyRef.current = true;
        setMapError(null);
        setMapReadyKey((k) => k + 1);

        // Force a layout recalculation shortly after initialization
        setTimeout(() => kernel.getMap()?.resize(), 150);
      },
      onError: (error) => {
        if (!hasMapEverBeenReadyRef.current) {
          setMapError(error.message || 'Map failed to load');
          return;
        }
        console.warn('[IntelligenceMapView] Non-fatal error:', error);
      },
    });

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
      zonePolygon: new ZonePolygonLayer(),
      routeGeometry: new RouteGeometryLayer(),
      serviceArea: new ServiceAreaPolygonLayer(),
    };

    // Planning layers first (bottom), then live tracking (top)
    kernel.registerLayer('zone-polygon', layers.zonePolygon);
    kernel.registerLayer('service-area', layers.serviceArea);
    kernel.registerLayer('route-geometry', layers.routeGeometry);
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

    // Apply workspace layer defaults
    layers.zone.setVisibility(s.layers.showZones);
    layers.facility.setVisibility(s.layers.showFacilities);
    layers.route.setVisibility(s.layers.showRoutes);

    // Option 1: A colorful "Google Maps-like" street style
    const voyagerStyle = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

    // Option 2: A free Satellite style using Esri World Imagery
    const satelliteStyle: any = {
      version: 8,
      sources: {
        satellite: {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: '&copy; Esri, Maxar, Earthstar Geographics'
        }
      },
      layers: [{ id: 'satellite-layer', type: 'raster', source: 'satellite', minzoom: 0, maxzoom: 22 }]
    };

    let fallbackStyle = getMapLibreStyle('system');
    if (!fallbackStyle || (typeof fallbackStyle === 'object' && Object.keys(fallbackStyle).length === 0)) {
      fallbackStyle = voyagerStyle;
    }
    
    const styleToUse = mapBaseStyle === 'satellite' ? satelliteStyle : fallbackStyle;

    kernel.init({
      container: containerRef.current,
      center: s.center,
      zoom: s.zoom,
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

  // ── Zoning boundary layers ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !kernelRef.current) return;
    const map = kernelRef.current.getMap();
    if (!map) return;

    if (mode !== 'zoning') {
      // Clean up boundary layers if present
      ['boundary-lga-base', 'boundary-lga-assigned', 'boundary-lga-selected',
        'boundary-lga-hover', 'boundary-lga-outline', 'boundary-state-outline'].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      ['zoning-lga-source', 'zoning-state-source'].forEach((id) => {
        if (map.getSource(id)) map.removeSource(id);
      });
      return;
    }

    const zp = zoningProps;
    if (!zp) return;

    const lgaCollection = { type: 'FeatureCollection' as const, features: zp.lgaFeatures };
    const stateCollection = { type: 'FeatureCollection' as const, features: zp.stateFeatures };

    // Add or update LGA source
    if (!map.getSource('zoning-lga-source')) {
      map.addSource('zoning-lga-source', { type: 'geojson', data: lgaCollection });
    } else {
      (map.getSource('zoning-lga-source') as maplibregl.GeoJSONSource).setData(lgaCollection);
    }

    // Add or update state source
    if (!map.getSource('zoning-state-source')) {
      map.addSource('zoning-state-source', { type: 'geojson', data: stateCollection });
    } else {
      (map.getSource('zoning-state-source') as maplibregl.GeoJSONSource).setData(stateCollection);
    }

    // Layer 1: base LGA fill
    if (!map.getLayer('boundary-lga-base')) {
      map.addLayer({
        id: 'boundary-lga-base',
        type: 'fill',
        source: 'zoning-lga-source',
        paint: { 'fill-color': '#1e293b', 'fill-opacity': 0.04 },
      });
    }

    // Build assigned color expression using zone colors
    const assignedColorExpr: any[] = ['case'];
    for (const zone of zp.zones) {
      const boundaryIds = Object.entries(zp.assignedMap)
        .filter(([, zid]) => zid === zone.id)
        .map(([bid]) => bid);
      if (boundaryIds.length > 0) {
        assignedColorExpr.push(['in', ['get', 'id'], ['literal', boundaryIds]], zoneColor(zone));
      }
    }
    assignedColorExpr.push('transparent');

    // Layer 2: assigned zone fills
    if (!map.getLayer('boundary-lga-assigned')) {
      map.addLayer({
        id: 'boundary-lga-assigned',
        type: 'fill',
        source: 'zoning-lga-source',
        paint: {
          'fill-color': assignedColorExpr as any,
          'fill-opacity': 0.45,
        },
      });
    } else {
      map.setPaintProperty('boundary-lga-assigned', 'fill-color', assignedColorExpr);
    }

    // Layer 3: selected LGA highlight
    const selectedIds = zp.selectedLgaIds;
    if (!map.getLayer('boundary-lga-selected')) {
      map.addLayer({
        id: 'boundary-lga-selected',
        type: 'fill',
        source: 'zoning-lga-source',
        filter: selectedIds.length > 0 ? ['in', ['get', 'id'], ['literal', selectedIds]] : ['==', 1, 0],
        paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.55 },
      });
    } else {
      map.setFilter(
        'boundary-lga-selected',
        selectedIds.length > 0 ? ['in', ['get', 'id'], ['literal', selectedIds]] : ['==', 1, 0],
      );
    }

    // Layer 4: hover — driven by featureState (set separately via mousemove)
    if (!map.getLayer('boundary-lga-hover')) {
      map.addLayer({
        id: 'boundary-lga-hover',
        type: 'fill',
        source: 'zoning-lga-source',
        paint: {
          'fill-color': '#60a5fa',
          'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.3, 0],
        },
      });
    }

    // Layer 5: LGA outlines
    if (!map.getLayer('boundary-lga-outline')) {
      map.addLayer({
        id: 'boundary-lga-outline',
        type: 'line',
        source: 'zoning-lga-source',
        paint: { 'line-color': '#334155', 'line-width': 0.5 },
      });
    }

    // Layer 6: state outlines
    if (!map.getLayer('boundary-state-outline')) {
      map.addLayer({
        id: 'boundary-state-outline',
        type: 'line',
        source: 'zoning-state-source',
        paint: { 'line-color': '#94a3b8', 'line-width': 1.5 },
      });
    }
  }, [mapReady, mode, zoningProps]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update assigned fill colors when assignedMap/zones/selection changes (without re-adding layers)
  useEffect(() => {
    if (!mapReady || mode !== 'zoning' || !zoningProps) return;
    const map = kernelRef.current?.getMap();
    if (!map || !map.getLayer('boundary-lga-assigned')) return;

    const assignedColorExpr: any[] = ['case'];
    for (const zone of zoningProps.zones) {
      const boundaryIds = Object.entries(zoningProps.assignedMap)
        .filter(([, zid]) => zid === zone.id)
        .map(([bid]) => bid);
      if (boundaryIds.length > 0) {
        assignedColorExpr.push(['in', ['get', 'id'], ['literal', boundaryIds]], zoneColor(zone));
      }
    }
    assignedColorExpr.push('transparent');
    map.setPaintProperty('boundary-lga-assigned', 'fill-color', assignedColorExpr);

    const selectedIds = zoningProps.selectedLgaIds;
    if (map.getLayer('boundary-lga-selected')) {
      map.setFilter(
        'boundary-lga-selected',
        selectedIds.length > 0 ? ['in', ['get', 'id'], ['literal', selectedIds]] : ['==', 1, 0],
      );
    }
  }, [mapReady, mode, zoningProps?.assignedMap, zoningProps?.zones, zoningProps?.selectedLgaIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Zoning click + hover handlers
  useEffect(() => {
    if (!mapReady || mode !== 'zoning' || !zoningProps) return;
    const map = kernelRef.current?.getMap();
    if (!map) return;

    let hoveredLgaId: string | number | null = null;

    const onLgaClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      if (!e.features?.length) return;
      const feat = e.features[0];
      const id = feat.properties?.id as string;
      if (!id) return;

      if (e.originalEvent?.shiftKey) {
        // Shift-click: find parent state and delegate
        const parentId = feat.properties?.parent_id as string;
        if (parentId) zoningProps.onToggleState(parentId);
      } else {
        zoningProps.onToggleLga(id);
      }
    };

    const onStateClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      if (!e.features?.length) return;
      const id = e.features[0].properties?.id as string;
      if (id) zoningProps.onToggleState(id);
    };

    const onLgaMousemove = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      if (!e.features?.length) return;
      map.getCanvas().style.cursor = 'pointer';
      const feat = e.features[0];
      const fid = feat.id;
      if (hoveredLgaId !== null && hoveredLgaId !== fid) {
        map.setFeatureState({ source: 'zoning-lga-source', id: hoveredLgaId }, { hover: false });
      }
      hoveredLgaId = fid ?? null;
      if (fid != null) {
        map.setFeatureState({ source: 'zoning-lga-source', id: fid }, { hover: true });
      }
    };

    const onLgaMouseleave = () => {
      map.getCanvas().style.cursor = '';
      if (hoveredLgaId !== null) {
        map.setFeatureState({ source: 'zoning-lga-source', id: hoveredLgaId }, { hover: false });
        hoveredLgaId = null;
      }
    };

    map.on('click', 'boundary-lga-base', onLgaClick);
    map.on('click', 'boundary-state-outline', onStateClick);
    map.on('mousemove', 'boundary-lga-base', onLgaMousemove);
    map.on('mouseleave', 'boundary-lga-base', onLgaMouseleave);

    return () => {
      map.off('click', 'boundary-lga-base', onLgaClick);
      map.off('click', 'boundary-state-outline', onStateClick);
      map.off('mousemove', 'boundary-lga-base', onLgaMousemove);
      map.off('mouseleave', 'boundary-lga-base', onLgaMouseleave);
      map.getCanvas().style.cursor = '';
    };
  }, [mapReady, mode, zoningProps?.onToggleLga, zoningProps?.onToggleState]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Live data → layers (Track mode) ──────────────────────────────────────
  useEffect(() => { if (mapReady) updateDriverLayer(driverGeoJSON); }, [driverGeoJSON, mapReady, updateDriverLayer]);
  useEffect(() => { if (mapReady) updateVehicleLayer(vehicleGeoJSON); }, [vehicleGeoJSON, mapReady, updateVehicleLayer]);
  useEffect(() => { if (mapReady) updateRouteLayer(routeGeoJSON); }, [routeGeoJSON, mapReady, updateRouteLayer]);
  useEffect(() => { if (mapReady) updateDeliveryLayer(deliveryGeoJSON); }, [deliveryGeoJSON, mapReady, updateDeliveryLayer]);
  useEffect(() => { if (mapReady) updateFacilityLayer(facilityGeoJSON); }, [facilityGeoJSON, mapReady, updateFacilityLayer]);
  useEffect(() => { if (mapReady) updateWarehouseLayer(warehouseGeoJSON); }, [warehouseGeoJSON, mapReady, updateWarehouseLayer]);
  useEffect(() => { if (mapReady) updateZoneLayer(zoneGeoJSON); }, [zoneGeoJSON, mapReady, updateZoneLayer]);
  useEffect(() => { if (mapReady) updateTetherLayers(tetherGeometry); }, [tetherGeometry, mapReady, updateTetherLayers]);

  // ── Planning data → layers ────────────────────────────────────────────────
  useEffect(() => { if (mapReady) updateZonePolygonLayer(zonePolygons); }, [zonePolygons, mapReady, updateZonePolygonLayer]);
  useEffect(() => { if (mapReady) updateRouteGeometryLayer(routeGeometries); }, [routeGeometries, mapReady, updateRouteGeometryLayer]);
  useEffect(() => { if (mapReady) updateServiceAreaLayer(serviceAreaHulls); }, [serviceAreaHulls, mapReady, updateServiceAreaLayer]);

  // ── Planning layer visibility ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !layersRef.current) return;
    layersRef.current.zonePolygon.setVisibility(showZonePolygons);
    layersRef.current.routeGeometry.setVisibility(showRouteGeometry);
    layersRef.current.serviceArea.setVisibility(showServiceAreas);
  }, [showZonePolygons, showRouteGeometry, showServiceAreas, mapReady]);

  // ── BatchRouteMarkerLayer (dynamic) ──────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !kernelRef.current) return;
    const kernel = kernelRef.current;
    if (tetherState.activeBatchId) {
      if (!batchRouteLayerRef.current) {
        const layer = new BatchRouteMarkerLayer();
        kernel.registerLayer('batch-route', layer);
        batchRouteLayerRef.current = layer;
      }
    } else {
      if (batchRouteLayerRef.current) {
        kernel.removeLayer('batch-route');
        batchRouteLayerRef.current = null;
      }
      if (layersRef.current) {
        const { tether, connector, altRoute } = layersRef.current;
        const empty = { type: 'FeatureCollection' as const, features: [] };
        if (tether?.isAttached()) tether.update(empty as any);
        if (connector?.isAttached()) connector.update(empty as any);
        if (altRoute?.isAttached()) altRoute.update(empty as any);
      }
    }
  }, [tetherState.activeBatchId, mapReady]);

  useEffect(() => {
    const layer = batchRouteLayerRef.current;
    if (!layer?.isAttached()) return;
    const delivery = deliveries.find((d) => d.id === tetherState.activeBatchId);
    const orderedIds = delivery?.facilities.map((f) => f.id) ?? [];
    const data: BatchRouteMarkerData = {
      facilities: tetherFacilities.map((f, idx) => ({
        id: f.id, name: f.name, lat: f.lat, lng: f.lng,
        isSelected: true,
        visitIndex: orderedIds.indexOf(f.id) + 1 || idx + 1,
      })),
      depot: tetherDepot
        ? { lat: tetherDepot.lat, lng: tetherDepot.lng, name: allWarehouses.find((w) => delivery && w.id === delivery.warehouseId)?.name ?? 'Warehouse' }
        : null,
      focusMode: isFocusMode,
    };
    layer.updateBatch(data);
  }, [tetherFacilities, tetherDepot, deliveries, tetherState.activeBatchId, allWarehouses, isFocusMode]);

  // ── Layer visibility (filters) ────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !layersRef.current) return;
    const isTrack = mode === 'track';
    layersRef.current.driver.setVisibility(isTrack && filters.showDrivers);
    layersRef.current.vehicle.setVisibility(isTrack && filters.showVehicles);
    layersRef.current.route.setVisibility(isTrack && filters.showRoutes);
    layersRef.current.delivery.setVisibility(isTrack && filters.showDeliveries);
    layersRef.current.facility.setVisibility(filters.showFacilities);
    layersRef.current.warehouse.setVisibility(filters.showWarehouses);
    layersRef.current.zone.setVisibility(filters.showZones);
  }, [filters, mapReady, mode]);

  // ── Entity click events ───────────────────────────────────────────────────
  const handleEntityClick = useCallback(
    (entityId: string, entityType: 'driver' | 'vehicle' | 'delivery' | 'facility') => {
      selectEntity(entityId, entityType);
      onEntitySelect?.(entityId, entityType);
    },
    [selectEntity, onEntitySelect]
  );

  const showRoutePopup = useCallback(
    (detail: { distanceKm?: number; timeMinutes?: number; routeLabel?: string; color?: string; lngLat: maplibregl.LngLat }) => {
      routePopupRef.current?.remove();
      const map = kernelRef.current?.getMap();
      if (!map) return;
      const { distanceKm, timeMinutes, routeLabel, color, lngLat } = detail;
      if (!distanceKm && !routeLabel) return;
      const timeStr = timeMinutes != null
        ? timeMinutes < 60 ? `${Math.round(timeMinutes)} min` : `${(timeMinutes / 60).toFixed(1)} hrs`
        : '';
      const popup = new maplibregl.Popup({ closeButton: false, maxWidth: '200px' })
        .setLngLat(lngLat)
        .setHTML(`<div class="text-xs leading-snug text-foreground">
          ${routeLabel ? `<strong style="color:${color || 'inherit'}; font-weight: 600;">${routeLabel}</strong><br/>` : ''}
          <span class="text-muted-foreground">${distanceKm != null ? `${distanceKm.toFixed(1)} km` : ''}${timeStr ? ` &middot; ${timeStr}` : ''}</span>
        </div>`)
        .addTo(map);
      routePopupRef.current = popup;
    },
    []
  );

  useEffect(() => {
    const onDriver = (e: CustomEvent) => handleEntityClick(e.detail.driverId, 'driver');
    const onVehicle = (e: CustomEvent) => handleEntityClick(e.detail.vehicleId, 'vehicle');
    const onDelivery = (e: CustomEvent) => handleEntityClick(e.detail.facilityId, 'delivery');
    const onRoute = (e: CustomEvent) => { handleEntityClick(e.detail.batchId, 'delivery'); setActiveBatch(e.detail.batchId); };
    const onFacility = (e: CustomEvent) => handleEntityClick(e.detail.facilityId, 'facility');
    const onTether = (e: CustomEvent) => showRoutePopup(e.detail);
    const onAltRoute = (e: CustomEvent) => { showRoutePopup(e.detail); if (e.detail.id) setSelectedComparisonId(e.detail.id); };
    const onPlanRoute = (e: CustomEvent) => {
      const map = kernelRef.current?.getMap();
      if (!map || !e.detail.lngLat) return;
      new maplibregl.Popup({ closeButton: true, maxWidth: '240px' })
        .setLngLat(e.detail.lngLat)
        .setHTML(`<div class="text-xs font-semibold py-0.5 text-foreground">${e.detail.routeName ?? 'Route'}</div>`)
        .addTo(map);
    };

    window.addEventListener('driver-marker-click', onDriver as EventListener);
    window.addEventListener('vehicle-marker-click', onVehicle as EventListener);
    window.addEventListener('delivery-marker-click', onDelivery as EventListener);
    window.addEventListener('route-line-click', onRoute as EventListener);
    window.addEventListener('facility-marker-click', onFacility as EventListener);
    window.addEventListener('tether-line-click', onTether as EventListener);
    window.addEventListener('alt-route-line-click', onAltRoute as EventListener);
    window.addEventListener('plan-route-click', onPlanRoute as EventListener);

    return () => {
      window.removeEventListener('driver-marker-click', onDriver as EventListener);
      window.removeEventListener('vehicle-marker-click', onVehicle as EventListener);
      window.removeEventListener('delivery-marker-click', onDelivery as EventListener);
      window.removeEventListener('route-line-click', onRoute as EventListener);
      window.removeEventListener('facility-marker-click', onFacility as EventListener);
      window.removeEventListener('tether-line-click', onTether as EventListener);
      window.removeEventListener('alt-route-line-click', onAltRoute as EventListener);
      window.removeEventListener('plan-route-click', onPlanRoute as EventListener);
    };
  }, [handleEntityClick, setActiveBatch, setSelectedComparisonId, showRoutePopup]);

  // ── Fullscreen ─────────────────────────────────────────────────────────────
  const handleToggleFullscreen = useCallback(() => {
    setIsMapFullscreen((prev) => {
      const next = !prev;
      if (containerRef.current) {
        const wrapper = containerRef.current.closest('.intel-map-wrapper') as HTMLElement | null;
        if (wrapper) {
          wrapper.style.position = next ? 'fixed' : '';
          wrapper.style.inset = next ? '0' : '';
          wrapper.style.zIndex = next ? '9999' : '';
        }
      }
      setTimeout(() => kernelRef.current?.getMap()?.resize(), 0);
      return next;
    });
  }, []);

  // ── Location search ────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeoapifyPlace[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [pinnedPlace, setPinnedPlace] = useState<GeoapifyPlace | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    if (!value) { setSearchResults([]); setSearchOpen(false); setPinnedPlace(null); return; }
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

  const clearSearch = () => { setSearchQuery(''); setSearchResults([]); setSearchOpen(false); setPinnedPlace(null); };

  return (
    <TooltipProvider delayDuration={300}>
    <div className="intel-map-wrapper relative w-full h-full min-h-[400px] flex-1">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* Error overlay */}
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80 z-20">
          <div className="bg-card border rounded-lg px-6 py-4 shadow-lg max-w-sm text-center space-y-2">
            <p className="text-sm font-medium text-destructive">Map failed to load</p>
            <p className="text-xs text-muted-foreground">{mapError}</p>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => { setMapError(null); setRetryKey((k) => k + 1); }}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Loading */}
      {!mapReady && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-card/80 backdrop-blur-sm border rounded-md px-4 py-2 shadow text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading map…
          </div>
        </div>
      )}

      {/* Location search */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 w-80 max-w-[calc(100%-2rem)]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            placeholder="Search locations..."
            className="pl-8 pr-8 bg-card/95 backdrop-blur-sm shadow-md border-border/80 h-9 text-sm"
          />
          {searching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {!searching && searchQuery && (
            <Button variant="ghost" size="icon" onClick={clearSearch} className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {searchOpen && searchResults.length > 0 && (
          <div className="absolute top-full mt-1 w-full bg-card border rounded-md shadow-lg max-h-60 overflow-auto z-20">
            {searchResults.map((place, i) => (
              <button key={i} className="flex items-start gap-2 w-full px-3 py-2.5 hover:bg-muted transition-colors text-left" onMouseDown={() => handleSearchSelect(place)}>
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{place.address_line1 || place.formatted}</p>
                  {place.address_line2 && <p className="text-xs text-muted-foreground truncate">{place.address_line2}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pinned place badge */}
      {pinnedPlace && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10 bg-card/95 backdrop-blur-sm border rounded-full px-3 py-1 shadow-md flex items-center gap-1.5 text-xs">
          <MapPin className="h-3 w-3 text-primary" />
          <span className="font-medium truncate max-w-48">{pinnedPlace.address_line1 || pinnedPlace.formatted}</span>
          <button onClick={clearSearch} className="ml-1 rounded-full p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Map controls */}
      {mapReady && (
        <div className="absolute right-2 z-10" style={{ top: 108 }}>
          <MapOverlayControls
            isFullscreen={isMapFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            isFocusMode={isFocusMode}
            onToggleFocusMode={() => setIsFocusMode((p) => !p)}
            hasSelection={!!tetherState.activeBatchId}
          />
        </div>
      )}

      {/* Map Style Toggle */}
      {mapReady && (
        <div className="absolute right-2 z-10" style={{ top: 146 }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setMapBaseStyle((p) => (p === 'street' ? 'satellite' : 'street'))}
                className="h-[29px] w-[29px] bg-background shadow-sm border-border/50"
              >
                {mapBaseStyle === 'street' ? (
                  <Globe className="h-[15px] w-[15px] text-foreground" />
                ) : (
                  <MapIcon className="h-[15px] w-[15px] text-foreground" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Toggle Satellite View</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Tether mode controls (Track mode only) */}
      {mapReady && mode === 'track' && tetherState.activeBatchId && (
        <div className="absolute bottom-16 right-2 z-10 flex flex-col gap-2">
          {isFetchingRoad && (
            <div className="bg-background rounded-md shadow-sm border border-border/50 px-2 py-1 text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Fetching roads…
            </div>
          )}
          <div className="bg-background rounded-md shadow-sm border border-border/50 overflow-hidden flex flex-col">
            {([
              { mode: 'route' as TetherMode, Icon: Route, label: 'Route' },
              { mode: 'cardinal' as TetherMode, Icon: Radar, label: 'Cardinal' },
              { mode: 'alternatives' as TetherMode, Icon: Split, label: 'Alternatives' },
            ] as const).map(({ mode: m, Icon, label }, idx) => (
              <Tooltip key={m}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => { setTetherMode(m); if (m === 'alternatives') fetchAlternatives(); }}
                    className={cn(
                      "flex items-center justify-center w-[29px] h-[29px] transition-colors focus:outline-none",
                      tetherState.mode === m ? "bg-primary text-primary-foreground" : "bg-transparent text-foreground hover:bg-muted",
                      idx > 0 && "border-t border-border/50"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => { setActiveBatch(null); routePopupRef.current?.remove(); }}
                className="h-[29px] w-[29px] bg-background shadow-sm border-border/50"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Deselect batch</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Stats badge */}
      {mapReady && (
        <div className="absolute bottom-4 left-4 bg-card border px-3 py-2 rounded-md shadow-md space-x-3 text-xs">
          {mode === 'track' && (
            <>
              {filters.showDrivers && <span><span className="font-medium">{counts.drivers}</span> Drivers{counts.activeDrivers > 0 && <span className="text-green-600 ml-1">({counts.activeDrivers} active)</span>}</span>}
              {filters.showVehicles && <span><span className="font-medium">{counts.vehicles}</span> Vehicles</span>}
              {filters.showDeliveries && <span><span className="font-medium">{counts.deliveries}</span> Deliveries</span>}
            </>
          )}
          {filters.showFacilities && <span><span className="font-medium">{counts.facilities}</span> Facilities</span>}
          {filters.showWarehouses && <span><span className="font-medium">{counts.warehouses}</span> Warehouses</span>}
          {filters.showZones && <span><span className="font-medium">{counts.zones}</span> Zones</span>}
          {mode === 'analytics' && (
            <span className="text-muted-foreground italic flex items-center gap-1">
              <Layers className="h-3 w-3" /> Planning view
            </span>
          )}
          {mode === 'zoning' && (
            <span className="text-muted-foreground italic flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {zoningProps?.selectedLgaIds.length
                ? `${zoningProps.selectedLgaIds.length} LGA${zoningProps.selectedLgaIds.length !== 1 ? 's' : ''} selected`
                : 'Zoning mode'}
            </span>
          )}
        </div>
      )}

      {/* Loading data indicator */}
      {isLoading && mode === 'track' && (
        <div className="absolute top-4 left-4 bg-card border px-3 py-2 rounded-md shadow-md">
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}

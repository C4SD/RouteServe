import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Layers, Map as MapIcon, Maximize2, Minimize2,
  Warehouse, Building2, Crosshair, ZoomIn, ZoomOut,
  LocateFixed,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RoutePolylinesLayer } from '@/components/map/layers/RoutePolylinesLayer';
import { ServiceAreasLayer } from '@/components/map/layers/ServiceAreasLayer';
import { ZoneBoundariesLayer, type ZoneBoundaryData } from '@/components/map/layers/ZoneBoundariesLayer';
import { MapInsightsOverlay, type RouteInsightsData } from '@/components/map/overlays/MapInsightsOverlay';
import { useRoutes } from '@/hooks/useRoutes';
import { useServiceAreas } from '@/hooks/useServiceAreas';
import { useOperationalZones } from '@/hooks/useOperationalZones';
import { useFacilities } from '@/hooks/useFacilities';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { computeConvexHull } from '@/lib/algorithms/convexHull';
import { calculateDistance } from '@/lib/routeOptimization';
import { getRoadRoute } from '@/lib/geoapify';
import { cn } from '@/lib/utils';
import type { Route } from '@/types/routes';
import type { FacilityClickPayload } from '@/components/map/layers/RoutePolylinesLayer';
import type { ServiceAreaPolygon } from '@/components/map/layers/ServiceAreasLayer';

// Default center: Kano, Nigeria
const DEFAULT_CENTER: [number, number] = [12.0, 8.52];
const DEFAULT_ZOOM = 10;

// Facility icon factory
function createFacilityIcon(type?: string, isSelected = false): L.DivIcon {
  const colorMap: Record<string, string> = {
    hospital: '#ef4444',
    clinic: '#3b82f6',
    pharmacy: '#22c55e',
    health_center: '#a855f7',
    warehouse: '#0078A0',
  };
  const color = colorMap[type || ''] || '#6b7280';
  const size = isSelected ? 16 : 12;
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);cursor:pointer;${isSelected ? 'outline:2px solid ' + color + ';outline-offset:2px;' : ''}"></div>`,
  });
}

// Warehouse icon
function createWarehouseIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#0078A0,#006080);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;cursor:pointer;">
      <div style="width:8px;height:8px;border-radius:50%;background:white;"></div>
    </div>`,
  });
}

interface RouteMapViewProps {
  onRouteClick?: (route: Route) => void;
}

export function RouteMapView({ onRouteClick }: RouteMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const facilityMarkersRef = useRef<L.Marker[]>([]);
  const warehouseMarkersRef = useRef<L.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [showServiceAreas, setShowServiceAreas] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [showFacilities, setShowFacilities] = useState(true);
  const [showWarehouses, setShowWarehouses] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<FacilityClickPayload | null>(null);
  const [selectedRouteInsights, setSelectedRouteInsights] = useState<RouteInsightsData | null>(null);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number; zoom: number } | null>(null);

  const { workspaceId } = useWorkspace();
  const { data: routes } = useRoutes();
  const { data: serviceAreas } = useServiceAreas();
  const { data: operationalZones } = useOperationalZones();
  const { data: facilitiesData } = useFacilities();
  const facilities = facilitiesData?.facilities ?? [];

  // Fetch warehouses for map display
  const { data: warehousesList } = useQuery({
    queryKey: ['warehouses-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name, lat, lng')
        .not('lat', 'is', null)
        .not('lng', 'is', null);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
    // Invalidate map size after transition
    setTimeout(() => mapRef.current?.invalidateSize(), 100);
  }, []);

  // ── Route facilities batch query (two-step to avoid RLS-dependent embedded joins) ──
  const routeIds = useMemo(() => (routes || []).map(r => r.id), [routes]);

  const { data: routeFacilityLinks } = useQuery({
    queryKey: ['route-facility-links', routeIds],
    queryFn: async () => {
      if (routeIds.length === 0) return [];
      const { data, error } = await supabase
        .from('route_facilities')
        .select('route_id, sequence_order, facility_id')
        .in('route_id', routeIds)
        .order('sequence_order', { ascending: true });
      if (error) {
        console.error('[RouteMapView] route_facilities query failed:', error.message, error.code);
        throw error;
      }
      if (!data?.length) {
        console.warn('[RouteMapView] route_facilities returned no rows for', routeIds.length, 'routes — route lines will not draw');
      }
      return (data || []) as Array<{ route_id: string; sequence_order: number; facility_id: string }>;
    },
    enabled: routeIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const routeFacilityIds = useMemo(
    () => [...new Set((routeFacilityLinks || []).map(rf => rf.facility_id))],
    [routeFacilityLinks]
  );

  const { data: routeFacilityDetails } = useQuery({
    queryKey: ['route-facility-details', routeFacilityIds],
    queryFn: async () => {
      if (routeFacilityIds.length === 0) return [];
      const CHUNK = 200;
      const chunks = Array.from({ length: Math.ceil(routeFacilityIds.length / CHUNK) }, (_, i) =>
        routeFacilityIds.slice(i * CHUNK, (i + 1) * CHUNK)
      );
      const results = await Promise.all(
        chunks.map(chunk =>
          supabase
            .from('facilities')
            .select('id, name, lat, lng, type, lga')
            .in('id', chunk)
            .eq('workspace_id', workspaceId!)
        )
      );
      return results.flatMap(r => r.data || []) as Array<{
        id: string; name: string; lat: number; lng: number; type: string; lga: string | null;
      }>;
    },
    enabled: routeFacilityIds.length > 0 && !!workspaceId,
    staleTime: 1000 * 60 * 5,
  });

  const allRouteFacilities = useMemo(() => {
    const facilityMap = new Map((routeFacilityDetails || []).map(f => [f.id, f]));
    return (routeFacilityLinks || []).map(rf => ({
      route_id: rf.route_id,
      sequence_order: rf.sequence_order,
      facilities: facilityMap.get(rf.facility_id) ?? null,
    }));
  }, [routeFacilityLinks, routeFacilityDetails]);

  // ── Service area facilities batch query ──
  const serviceAreaIds = useMemo(() => (serviceAreas || []).map(sa => sa.id), [serviceAreas]);

  const { data: allSAFacilities } = useQuery({
    queryKey: ['service-area-facilities-batch', serviceAreaIds],
    queryFn: async () => {
      if (serviceAreaIds.length === 0) return [];
      const { data, error } = await supabase
        .from('service_area_facilities')
        .select(`
          service_area_id,
          facilities:facility_id (name, lat, lng)
        `)
        .in('service_area_id', serviceAreaIds);

      if (error) throw error;
      return data as Array<{
        service_area_id: string;
        facilities: { name: string; lat: number; lng: number } | null;
      }>;
    },
    enabled: serviceAreaIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  // ── Initialize map ──
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    setMapReady(true);
    // Ensure the map recalculates its size after CSS is fully applied (fixes 0-size on prod)
    requestAnimationFrame(() => map.invalidateSize());

    // Track coordinates and zoom
    const updateCoords = () => {
      const center = map.getCenter();
      setCoordinates({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
    };
    map.on('moveend', updateCoords);
    map.on('zoomend', updateCoords);
    updateCoords();

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // ── Group route facilities by route_id ──
  const facilitiesByRoute = useMemo(() => {
    const m = new Map<string, Array<{ lat: number; lng: number; name: string; sequence_order: number; type?: string; lga?: string }>>();
    (allRouteFacilities || []).forEach(rf => {
      if (!rf.facilities || rf.facilities.lat == null || rf.facilities.lng == null) return;
      const list = m.get(rf.route_id) || [];
      list.push({
        lat: rf.facilities.lat,
        lng: rf.facilities.lng,
        name: rf.facilities.name,
        sequence_order: rf.sequence_order,
        type: rf.facilities.type,
        lga: rf.facilities.lga ?? undefined,
      });
      m.set(rf.route_id, list);
    });
    return m;
  }, [allRouteFacilities]);

  // ── On-the-fly road geometry fetching for routes that lack it ──
  const [fetchedGeometries, setFetchedGeometries] = useState<
    Record<string, { type: string; coordinates: Array<[number, number]> }>
  >({});
  const handledRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!routes || routes.length === 0) return;

    const routesNeedingGeometry = routes.filter(route => {
      if (route.optimized_geometry) return false;
      if (handledRef.current.has(route.id)) return false;

      const wh = route.warehouses;
      if (!wh || wh.lat == null || wh.lng == null) return false;

      const facilities = facilitiesByRoute.get(route.id) || [];
      return facilities.length >= 1;
    });

    if (routesNeedingGeometry.length === 0) return;

    // Mark all as handled immediately to prevent re-fetching
    routesNeedingGeometry.forEach(r => handledRef.current.add(r.id));

    // Fetch road geometry for each route in parallel (max 3)
    const batch = routesNeedingGeometry.slice(0, 3);

    Promise.all(
      batch.map(async (route) => {
        const wh = route.warehouses!;
        const facilities = facilitiesByRoute.get(route.id) || [];
        const sorted = [...facilities].sort((a, b) => a.sequence_order - b.sequence_order);

        const waypoints = [
          { lat: wh.lat!, lng: wh.lng! },
          ...sorted.map(f => ({ lat: f.lat, lng: f.lng })),
          { lat: wh.lat!, lng: wh.lng! },
        ];

        try {
          const road = await getRoadRoute(waypoints);
          if (road && road.geometry.length > 0) {
            const geometry = { type: 'LineString' as const, coordinates: road.geometry };
            return { routeId: route.id, geometry, road };
          }
        } catch (err) {
          console.error(`[RouteMapView] Road route fetch failed for ${route.id}:`, err);
        }
        return null;
      })
    ).then(results => {
      const newGeometries: Record<string, { type: string; coordinates: Array<[number, number]> }> = {};
      let hasNew = false;

      for (const r of results) {
        if (!r) continue;
        hasNew = true;
        newGeometries[r.routeId] = r.geometry;

        // Persist to DB (fire-and-forget)
        supabase
          .from('routes')
          .update({
            optimized_geometry: r.geometry,
            total_distance_km: r.road.roadDistanceKm,
            estimated_duration_min: r.road.roadTimeMinutes,
          })
          .eq('id', r.routeId)
          .then(({ error }) => {
            if (error) console.error(`[RouteMapView] Failed to persist geometry for ${r.routeId}:`, error);
          });
      }

      if (hasNew) {
        setFetchedGeometries(prev => ({ ...prev, ...newGeometries }));
      }
    });
  }, [routes, facilitiesByRoute]); // no fetchedGeometries dep — use handledRef instead

  const routePolylineData = useMemo(() => (routes || []).map((route) => ({
    id: route.id,
    name: route.name,
    status: route.status,
    is_sandbox: route.is_sandbox,
    warehouse: route.warehouses
      ? { lat: route.warehouses.lat, lng: route.warehouses.lng, name: route.warehouses.name }
      : null,
    facilities: facilitiesByRoute.get(route.id) || [],
    optimized_geometry: (route.optimized_geometry as { type: string; coordinates: Array<[number, number]> } | null)
      || fetchedGeometries[route.id]
      || null,
  })), [routes, facilitiesByRoute, fetchedGeometries]);

  // ── Group SA facilities by service_area_id ──
  const facilitiesBySA = useMemo(() => {
    const m = new Map<string, Array<{ lat: number; lng: number; name: string }>>();
    (allSAFacilities || []).forEach(saf => {
      if (!saf.facilities || saf.facilities.lat == null || saf.facilities.lng == null) return;
      const list = m.get(saf.service_area_id) || [];
      list.push({ lat: saf.facilities.lat, lng: saf.facilities.lng, name: saf.facilities.name });
      m.set(saf.service_area_id, list);
    });
    return m;
  }, [allSAFacilities]);

  // ── Build SA spoke-line data ──
  const serviceAreaLayerData = useMemo(() => (serviceAreas || []).map(sa => ({
    id: sa.id,
    name: sa.name,
    service_type: sa.service_type,
    color: (sa.metadata as Record<string, any>)?.color as string | undefined,
    warehouse: sa.warehouses && sa.warehouses.lat != null && sa.warehouses.lng != null
      ? { lat: sa.warehouses.lat, lng: sa.warehouses.lng, name: sa.warehouses.name }
      : null,
    facilities: facilitiesBySA.get(sa.id) || [],
  })), [serviceAreas, facilitiesBySA]);

  // ── Compute SA convex hulls ──
  const serviceAreaPolygons: ServiceAreaPolygon[] = useMemo(() => {
    return (serviceAreas || [])
      .map(sa => {
        const facilities = facilitiesBySA.get(sa.id) || [];
        const points = [...facilities];
        if (sa.warehouses?.lat != null && sa.warehouses?.lng != null) {
          points.push({ lat: sa.warehouses.lat, lng: sa.warehouses.lng, name: sa.warehouses.name });
        }
        return {
          id: sa.id,
          name: sa.name,
          color: (sa.metadata as Record<string, any>)?.color as string | undefined,
          hull: computeConvexHull(points),
          facilityCount: facilities.length,
        };
      })
      .filter(sa => sa.hull.length >= 3);
  }, [serviceAreas, facilitiesBySA]);

  // ── Extract zone boundaries from metadata.geometry ──
  const zoneBoundaries: ZoneBoundaryData[] = useMemo(() => {
    return (operationalZones || [])
      .filter(z => z.metadata?.geometry?.coordinates)
      .map(z => ({
        id: z.id,
        name: z.name,
        code: z.code,
        geometry: z.metadata.geometry as GeoJSON.Polygon,
        color: z.metadata.color as string | undefined,
      }));
  }, [operationalZones]);

  // ── Facility markers on map ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Clear previous facility markers
    facilityMarkersRef.current.forEach(m => m.remove());
    facilityMarkersRef.current = [];

    if (!showFacilities) return;

    facilities.forEach((f: any) => {
      if (typeof f.lat !== 'number' || typeof f.lng !== 'number') return;
      if (f.lat === 0 && f.lng === 0) return;

      const marker = L.marker([f.lat, f.lng], { icon: createFacilityIcon(f.type) })
        .bindPopup(`
          <div style="min-width:180px">
            <strong>${f.name}</strong><br/>
            <span style="color:#666;font-size:12px">${f.type || 'Facility'} ${f.level_of_care ? '&middot; ' + f.level_of_care : ''}</span><br/>
            <span style="font-size:11px;color:#888">${f.lga || ''} ${f.ward ? '&middot; ' + f.ward : ''}</span><br/>
            <span style="font-size:11px;color:#999">${f.lat.toFixed(6)}, ${f.lng.toFixed(6)}</span>
          </div>
        `)
        .addTo(map);

      marker.on('click', () => {
        setSelectedFacility({
          facilityName: f.name,
          facilityType: f.type,
          facilityLga: f.lga,
          lat: f.lat,
          lng: f.lng,
        });
        setSelectedRouteInsights(null);
      });

      facilityMarkersRef.current.push(marker);
    });
  }, [mapReady, facilities, showFacilities]);

  // ── Warehouse markers on map ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    warehouseMarkersRef.current.forEach(m => m.remove());
    warehouseMarkersRef.current = [];

    if (!showWarehouses || !warehousesList) return;

    warehousesList.forEach((wh: any) => {
      if (typeof wh.lat !== 'number' || typeof wh.lng !== 'number') return;

      const marker = L.marker([wh.lat, wh.lng], { icon: createWarehouseIcon(), zIndexOffset: 1000 })
        .bindPopup(`
          <div style="min-width:150px">
            <strong>${wh.name}</strong><br/>
            <span style="color:#0078A0;font-size:12px">${wh.type || 'Warehouse'}</span><br/>
            <span style="font-size:11px;color:#999">${wh.lat.toFixed(6)}, ${wh.lng.toFixed(6)}</span>
          </div>
        `)
        .addTo(map);

      warehouseMarkersRef.current.push(marker);
    });
  }, [mapReady, warehousesList, showWarehouses]);

  // ── Handlers ──
  const handleFacilityClick = useCallback((payload: FacilityClickPayload) => {
    setSelectedFacility(payload);
    setSelectedRouteInsights(null);
  }, []);

  const handleRouteClick = useCallback((routeId: string) => {
    const route = routes?.find(r => r.id === routeId);
    if (!route) return;

    const routeFacilities = facilitiesByRoute.get(route.id) || [];
    const wh = route.warehouses;

    let totalDist: number | null = route.total_distance_km;
    if (totalDist == null && routeFacilities.length > 0 && wh?.lat != null && wh?.lng != null) {
      const sorted = [...routeFacilities].sort((a, b) => a.sequence_order - b.sequence_order);
      let dist = calculateDistance(wh.lat, wh.lng, sorted[0].lat, sorted[0].lng);
      for (let i = 1; i < sorted.length; i++) {
        dist += calculateDistance(sorted[i - 1].lat, sorted[i - 1].lng, sorted[i].lat, sorted[i].lng);
      }
      totalDist = Math.round(dist * 10) / 10;
    }

    setSelectedRouteInsights({
      routeId: route.id,
      routeName: route.name,
      status: route.status,
      isSandbox: route.is_sandbox,
      facilityCount: routeFacilities.length,
      totalDistanceKm: totalDist,
      estimatedDurationMin: route.estimated_duration_min,
      warehouseName: wh?.name || 'Unknown',
      warehouseLat: wh?.lat ?? 0,
      warehouseLng: wh?.lng ?? 0,
      facilities: routeFacilities.map(f => ({ lat: f.lat, lng: f.lng, name: f.name })),
    });
    setSelectedFacility(null);

    if (route && onRouteClick) onRouteClick(route);
  }, [routes, facilitiesByRoute, onRouteClick]);

  const handleCloseInsights = () => {
    setSelectedFacility(null);
    setSelectedRouteInsights(null);
  };

  const handleLocate = () => {
    const map = mapRef.current;
    if (!map) return;
    // Fit to all facility and warehouse markers
    const bounds = L.latLngBounds([]);
    facilityMarkersRef.current.forEach(m => bounds.extend(m.getLatLng()));
    warehouseMarkersRef.current.forEach(m => bounds.extend(m.getLatLng()));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
  };

  return (
    <Card className={cn(
      isFullscreen && 'fixed inset-0 z-50 rounded-none border-none m-0'
    )}>
      <CardContent className="p-0 h-full">
        <div className={cn('relative', isFullscreen ? 'h-full' : '')}>
          <div
            ref={mapContainerRef}
            className={cn(
              'w-full rounded-lg overflow-hidden',
              isFullscreen ? 'h-full rounded-none' : 'h-[600px]'
            )}
          />

          {/* ── Layer toggles (top-left) ── */}
          <div className="absolute top-3 left-12 z-[1000] flex flex-wrap gap-1.5">
            <Button
              variant={showZones ? 'default' : 'outline'}
              size="sm"
              className="h-8 gap-1.5 shadow-md bg-background/95 backdrop-blur-sm"
              onClick={() => setShowZones(prev => !prev)}
            >
              <MapIcon className="h-3.5 w-3.5" />
              Zones
            </Button>
            <Button
              variant={showServiceAreas ? 'default' : 'outline'}
              size="sm"
              className="h-8 gap-1.5 shadow-md bg-background/95 backdrop-blur-sm"
              onClick={() => setShowServiceAreas(prev => !prev)}
            >
              <Layers className="h-3.5 w-3.5" />
              Areas
            </Button>
            <Button
              variant={showFacilities ? 'default' : 'outline'}
              size="sm"
              className="h-8 gap-1.5 shadow-md bg-background/95 backdrop-blur-sm"
              onClick={() => setShowFacilities(prev => !prev)}
            >
              <Building2 className="h-3.5 w-3.5" />
              Facilities
            </Button>
            <Button
              variant={showWarehouses ? 'default' : 'outline'}
              size="sm"
              className="h-8 gap-1.5 shadow-md bg-background/95 backdrop-blur-sm"
              onClick={() => setShowWarehouses(prev => !prev)}
            >
              <Warehouse className="h-3.5 w-3.5" />
              Warehouses
            </Button>
          </div>

          {/* ── Map controls (top-right) ── */}
          <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1.5">
            {/* Fullscreen toggle */}
            <div
              style={{
                background: '#fff',
                borderRadius: 4,
                boxShadow: '0 0 0 2px rgba(0,0,0,0.1)',
                overflow: 'hidden',
              }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleFullscreen}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 29,
                      height: 29,
                      padding: 0,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                    aria-label={isFullscreen ? 'Exit fullscreen' : 'Expand map'}
                  >
                    {isFullscreen ? (
                      <Minimize2 style={{ width: 15, height: 15, color: '#333' }} />
                    ) : (
                      <Maximize2 style={{ width: 15, height: 15, color: '#333' }} />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {isFullscreen ? 'Exit fullscreen' : 'Expand map'}
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Zoom controls */}
            <div
              style={{
                background: '#fff',
                borderRadius: 4,
                boxShadow: '0 0 0 2px rgba(0,0,0,0.1)',
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => mapRef.current?.zoomIn()}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 29, height: 29, border: 'none', background: 'transparent', cursor: 'pointer',
                }}
                aria-label="Zoom in"
              >
                <ZoomIn style={{ width: 15, height: 15, color: '#333' }} />
              </button>
              <div style={{ borderTop: '1px solid #ddd' }} />
              <button
                onClick={() => mapRef.current?.zoomOut()}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 29, height: 29, border: 'none', background: 'transparent', cursor: 'pointer',
                }}
                aria-label="Zoom out"
              >
                <ZoomOut style={{ width: 15, height: 15, color: '#333' }} />
              </button>
            </div>

            {/* Locate / fit bounds */}
            <div
              style={{
                background: '#fff',
                borderRadius: 4,
                boxShadow: '0 0 0 2px rgba(0,0,0,0.1)',
                overflow: 'hidden',
              }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleLocate}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 29, height: 29, border: 'none', background: 'transparent', cursor: 'pointer',
                    }}
                    aria-label="Fit to data"
                  >
                    <LocateFixed style={{ width: 15, height: 15, color: '#333' }} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">Fit to data</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* ── Coordinate HUD (bottom-left) ── */}
          {coordinates && (
            <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-background/90 backdrop-blur-sm shadow text-xs font-mono text-muted-foreground">
              <Crosshair className="h-3 w-3" />
              <span>{coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}</span>
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                z{coordinates.zoom.toFixed(0)}
              </Badge>
            </div>
          )}

          {/* ── Insights overlay ── */}
          {(selectedFacility || selectedRouteInsights) && (
            <div className={cn(
              'absolute z-[1000] w-72',
              isFullscreen ? 'top-14 right-3' : 'top-14 right-3'
            )}>
              <MapInsightsOverlay
                selectedFacility={selectedFacility}
                selectedRoute={selectedRouteInsights}
                onClose={handleCloseInsights}
              />
            </div>
          )}

          {/* Zone boundaries layer (bottom-most) */}
          {mapReady && mapRef.current && showZones && zoneBoundaries.length > 0 && (
            <ZoneBoundariesLayer
              map={mapRef.current}
              zones={zoneBoundaries}
            />
          )}

          {/* Service areas layer */}
          {mapReady && mapRef.current && showServiceAreas && serviceAreaLayerData.length > 0 && (
            <ServiceAreasLayer
              map={mapRef.current}
              serviceAreas={serviceAreaLayerData}
              serviceAreaPolygons={serviceAreaPolygons}
            />
          )}

          {/* Route polylines layer (top-most) */}
          {mapReady && mapRef.current && routePolylineData.length > 0 && (
            <RoutePolylinesLayer
              map={mapRef.current}
              routes={routePolylineData}
              onRouteClick={handleRouteClick}
              onFacilityClick={handleFacilityClick}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

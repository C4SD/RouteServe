/**
 * useIntelligencePlanningData
 * Aggregates planning data for the Intelligence Map:
 * - Zone boundaries (polygons)
 * - Route geometries (polylines)
 * - Service area hulls (convex polygons)
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoutes } from '@/hooks/useRoutes';
import { useServiceAreas } from '@/hooks/useServiceAreas';
import { useOperationalZones } from '@/hooks/useOperationalZones';
import { supabase } from '@/integrations/supabase/client';
import { computeConvexHull } from '@/lib/algorithms/convexHull';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { ZonePolygonData } from '@/maps-v3/layers/ZonePolygonLayer';
import type { RouteGeometryData } from '@/maps-v3/layers/RouteGeometryLayer';
import type { ServiceAreaHullData } from '@/maps-v3/layers/ServiceAreaPolygonLayer';

export function useIntelligencePlanningData() {
  const { workspaceId } = useWorkspace();

  const { data: routes } = useRoutes();
  const { data: serviceAreas } = useServiceAreas();
  const { data: zones } = useOperationalZones();

  const routeIds = useMemo(() => (routes || []).map((r) => r.id), [routes]);
  const saIds = useMemo(() => (serviceAreas || []).map((sa) => sa.id), [serviceAreas]);

  // Route facilities for geometry (needed for routes without optimized_geometry)
  const { data: allRouteFacilities } = useQuery({
    queryKey: ['intel-route-facilities', routeIds],
    queryFn: async () => {
      if (routeIds.length === 0) return [];
      const { data, error } = await supabase
        .from('route_facilities')
        .select('route_id, sequence_order, facilities:facility_id (name, lat, lng)')
        .in('route_id', routeIds)
        .order('sequence_order', { ascending: true });
      if (error) throw error;
      return data as Array<{
        route_id: string;
        sequence_order: number;
        facilities: { name: string; lat: number; lng: number } | null;
      }>;
    },
    enabled: routeIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  // Service area facilities for convex hull computation
  const { data: allSAFacilities } = useQuery({
    queryKey: ['intel-sa-facilities', saIds],
    queryFn: async () => {
      if (saIds.length === 0) return [];
      const { data, error } = await supabase
        .from('service_area_facilities')
        .select('service_area_id, facilities:facility_id (name, lat, lng)')
        .in('service_area_id', saIds);
      if (error) throw error;
      return data as Array<{
        service_area_id: string;
        facilities: { name: string; lat: number; lng: number } | null;
      }>;
    },
    enabled: saIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  // Warehouse data for SA depot markers
  const { data: warehousesList } = useQuery({
    queryKey: ['intel-warehouses', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name, lat, lng')
        .eq('workspace_id', workspaceId!)
        .not('lat', 'is', null)
        .not('lng', 'is', null);
      if (error) throw error;
      return data || [];
    },
    enabled: !!workspaceId,
    staleTime: 1000 * 60 * 5,
  });

  // ── Zone boundaries ─────────────────────────────────────────────────────────
  const zonePolygons: ZonePolygonData[] = useMemo(() => {
    return (zones || [])
      .filter((z: any) => z.metadata?.geometry?.coordinates)
      .map((z: any) => ({
        id: z.id,
        name: z.name,
        code: z.code ?? null,
        geometry: z.metadata.geometry as GeoJSON.Polygon,
        color: z.metadata?.color as string | undefined,
      }));
  }, [zones]);

  // ── Route geometries ────────────────────────────────────────────────────────
  const routeGeometries: RouteGeometryData[] = useMemo(() => {
    return (routes || [])
      .filter((r) => r.optimized_geometry != null)
      .map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        isSandbox: !!r.is_sandbox,
        geometry: r.optimized_geometry as { type: string; coordinates: [number, number][] },
      }));
  }, [routes]);

  // ── Service area hulls ──────────────────────────────────────────────────────
  const facilitiesBySA = useMemo(() => {
    const m = new Map<string, Array<{ lat: number; lng: number; name: string }>>();
    (allSAFacilities || []).forEach((saf) => {
      if (!saf.facilities || saf.facilities.lat == null || saf.facilities.lng == null) return;
      const list = m.get(saf.service_area_id) || [];
      list.push({ lat: saf.facilities.lat, lng: saf.facilities.lng, name: saf.facilities.name });
      m.set(saf.service_area_id, list);
    });
    return m;
  }, [allSAFacilities]);

  const whMap = useMemo(() => {
    const m = new Map<string, { lat: number; lng: number }>();
    (warehousesList || []).forEach((w: any) => m.set(w.id, { lat: w.lat, lng: w.lng }));
    return m;
  }, [warehousesList]);

  const serviceAreaHulls: ServiceAreaHullData[] = useMemo(() => {
    return (serviceAreas || [])
      .map((sa: any) => {
        const facilities = facilitiesBySA.get(sa.id) || [];
        const points = [...facilities];
        const depot = sa.warehouse_id ? whMap.get(sa.warehouse_id) : null;
        if (depot) points.push({ lat: depot.lat, lng: depot.lng, name: 'Depot' });

        const hull = computeConvexHull(points);
        return {
          id: sa.id,
          name: sa.name,
          color: (sa.metadata as any)?.color as string | undefined,
          hull,
          depot: depot ?? null,
        };
      })
      .filter((sa) => sa.hull.length >= 3);
  }, [serviceAreas, facilitiesBySA, whMap]);

  // ── Summary stats for Analytics tab ────────────────────────────────────────
  const stats = useMemo(() => ({
    totalZones: (zones || []).length,
    zonesWithBoundary: zonePolygons.length,
    totalRoutes: (routes || []).length,
    routesWithGeometry: routeGeometries.length,
    sandboxRoutes: (routes || []).filter((r) => r.is_sandbox).length,
    activeRoutes: (routes || []).filter((r) => r.status === 'active').length,
    totalServiceAreas: (serviceAreas || []).length,
    serviceAreasWithHull: serviceAreaHulls.length,
  }), [zones, zonePolygons, routes, routeGeometries, serviceAreas, serviceAreaHulls]);

  return {
    zonePolygons,
    routeGeometries,
    serviceAreaHulls,
    routes: routes || [],
    serviceAreas: serviceAreas || [],
    stats,
  };
}

declare namespace GeoJSON {
  interface Polygon { type: 'Polygon'; coordinates: number[][][]; }
}

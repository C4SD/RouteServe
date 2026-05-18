import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { calculateDistance } from '@/lib/routeOptimization';

/** Find the closest point in a polyline to a given target (Leaflet [lat, lng] coords). */
function findNearestPoint(
  target: [number, number],
  polyline: [number, number][]
): [number, number] | null {
  if (polyline.length === 0) return null;
  let nearest = polyline[0];
  let minDist = Infinity;
  for (const pt of polyline) {
    const d = (pt[0] - target[0]) ** 2 + (pt[1] - target[1]) ** 2;
    if (d < minDist) {
      minDist = d;
      nearest = pt;
    }
  }
  return nearest;
}

export interface RoutePolylineData {
  id: string;
  name: string;
  status: string;
  is_sandbox: boolean;
  warehouse: { lat: number | null; lng: number | null; name: string } | null;
  facilities: Array<{
    lat: number;
    lng: number;
    name: string;
    sequence_order: number;
    type?: string;
    lga?: string;
  }>;
  optimized_geometry?: {
    type: string;
    coordinates: Array<[number, number]>; // [lng, lat] pairs
  } | null;
}

export interface FacilityClickPayload {
  facilityName: string;
  facilityType?: string;
  facilityLga?: string;
  lat: number;
  lng: number;
  // Route-specific context — present when clicked from a route polyline, absent for global facility markers
  sequenceOrder?: number;
  totalFacilities?: number;
  routeId?: string;
  routeName?: string;
  warehouseName?: string;
  warehouseLat?: number;
  warehouseLng?: number;
  distanceToWarehouseKm?: number | null;
  distanceToPreviousKm?: number | null;
  distanceToNextKm?: number | null;
}

interface RoutePolylinesLayerProps {
  map: L.Map | null;
  routes: RoutePolylineData[];
  selectedRouteId?: string | null;
  onRouteClick?: (routeId: string) => void;
  onFacilityClick?: (payload: FacilityClickPayload) => void;
}

const STATUS_STYLES: Record<string, { dashArray: string; color: string }> = {
  draft: { dashArray: '8, 8', color: '#eab308' },
  active: { dashArray: '', color: '#22c55e' },
  locked: { dashArray: '', color: '#a855f7' },
  archived: { dashArray: '4, 8', color: '#6b7280' },
};

const ROUTE_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#8b5cf6',
];

/**
 * RoutePolylinesLayer - Renders route polylines with numbered facility markers
 * Color-coded by route, style varies by status (draft=dashed, active=solid, sandbox=dotted)
 */
export function RoutePolylinesLayer({
  map,
  routes,
  selectedRouteId,
  onRouteClick,
  onFacilityClick,
}: RoutePolylinesLayerProps) {
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!map) return;

    const renderRoutes = () => {
      if (!layerRef.current) return;
      layerRef.current.clearLayers();

      routes.forEach((route, index) => {
        if (!layerRef.current) return;

        const hasRoadGeometry = !!(route.optimized_geometry?.coordinates?.length);
        const hasWarehouseCoords = route.warehouse?.lat != null && route.warehouse?.lng != null;
        const sortedFacilities = [...route.facilities].sort(
          (a, b) => a.sequence_order - b.sequence_order
        );

        // Need at least road geometry, or a renderable straight-line path
        const canRenderRoad = hasRoadGeometry;
        const canRenderStraight = sortedFacilities.length >= 1 && (hasWarehouseCoords || sortedFacilities.length >= 2);
        if (!canRenderRoad && !canRenderStraight) return;

        const isSelected = selectedRouteId === route.id;
        const baseColor = ROUTE_COLORS[index % ROUTE_COLORS.length];
        const statusStyle = route.is_sandbox
          ? { dashArray: '4, 4', color: '#f59e0b' }
          : STATUS_STYLES[route.status] || STATUS_STYLES.draft;

        // Build coordinate list: road geometry takes priority; fall back to straight lines
        const coords: [number, number][] = hasRoadGeometry
          ? route.optimized_geometry!.coordinates.map(
              (c: [number, number]) => [c[1], c[0]] as [number, number] // [lng,lat] → [lat,lng] for Leaflet
            )
          : hasWarehouseCoords
          ? [
              [route.warehouse!.lat!, route.warehouse!.lng!],
              ...sortedFacilities.map(f => [f.lat, f.lng] as [number, number]),
            ]
          : sortedFacilities.map(f => [f.lat, f.lng] as [number, number]);

        // Route polyline — solid when road geometry, dashed when straight-line
        const polyline = L.polyline(coords, {
          color: isSelected ? baseColor : statusStyle.color,
          weight: isSelected ? 5 : 3,
          opacity: isSelected ? 1 : 0.7,
          dashArray: hasRoadGeometry ? '' : statusStyle.dashArray,
        });

        polyline.bindPopup(`
          <strong>${route.name}</strong><br/>
          <span style="font-size:12px">Status: ${route.status}${route.is_sandbox ? ' (Sandbox)' : ''}</span><br/>
          <span style="font-size:12px">Facilities: ${route.facilities.length}</span>
        `);

        if (onRouteClick) {
          polyline.on('click', () => onRouteClick(route.id));
        }

        try {
          polyline.addTo(layerRef.current);

          // When road geometry is available, draw thin connector lines from each stop
          // to the nearest point on the road (stops may be off-road)
          if (hasRoadGeometry) {
            // Connector from warehouse to nearest road point (only if warehouse has coords)
            if (hasWarehouseCoords) {
              const whCoord: [number, number] = [route.warehouse!.lat!, route.warehouse!.lng!];
              const nearestToWh = findNearestPoint(whCoord, coords);
              if (nearestToWh) {
                L.polyline([whCoord, nearestToWh], {
                  color: statusStyle.color,
                  weight: 1,
                  opacity: 0.5,
                  dashArray: '3, 3',
                }).addTo(layerRef.current!);
              }
            }

            // Connector from each facility to nearest road point
            sortedFacilities.forEach(f => {
              const facCoord: [number, number] = [f.lat, f.lng];
              const nearestPt = findNearestPoint(facCoord, coords);
              if (nearestPt) {
                L.polyline([facCoord, nearestPt], {
                  color: '#10b981',
                  weight: 1,
                  opacity: 0.5,
                  dashArray: '3, 3',
                }).addTo(layerRef.current!);
              }
            });
          }
        } catch (e) {
          console.error('[RoutePolylinesLayer] Failed to add polyline:', e);
        }

        // Numbered facility markers along the route
        sortedFacilities.forEach((facility, idx) => {
          if (!layerRef.current) return;

          const marker = L.circleMarker(
            [facility.lat, facility.lng],
            {
              radius: isSelected ? 8 : 6,
              fillColor: isSelected ? baseColor : statusStyle.color,
              color: '#fff',
              weight: 2,
              fillOpacity: 0.9,
            }
          );

          // Create a number label using divIcon
          const label = L.marker([facility.lat, facility.lng], {
            icon: L.divIcon({
              className: 'route-facility-label',
              html: `<div style="
                background:${isSelected ? baseColor : statusStyle.color};
                color:white;
                border-radius:50%;
                width:20px;height:20px;
                display:flex;align-items:center;justify-content:center;
                font-size:10px;font-weight:bold;
                border:2px solid white;
                box-shadow:0 1px 3px rgba(0,0,0,0.3);
                cursor:pointer;
              ">${facility.sequence_order}</div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            }),
          });

          marker.bindPopup(`
            <strong>#${facility.sequence_order}: ${facility.name}</strong><br/>
            <span style="font-size:12px">Route: ${route.name}</span>
          `);

          // Facility click handler (only if warehouse coords available for distance calc)
          if (onFacilityClick && hasWarehouseCoords) {
            const handleClick = (e: L.LeafletEvent) => {
              L.DomEvent.stopPropagation(e as any);
              const prev = sortedFacilities[idx - 1] || null;
              const next = sortedFacilities[idx + 1] || null;

              onFacilityClick({
                facilityName: facility.name,
                facilityType: facility.type,
                facilityLga: facility.lga,
                lat: facility.lat,
                lng: facility.lng,
                sequenceOrder: facility.sequence_order,
                totalFacilities: sortedFacilities.length,
                routeId: route.id,
                routeName: route.name,
                warehouseName: route.warehouse!.name,
                warehouseLat: route.warehouse!.lat!,
                warehouseLng: route.warehouse!.lng!,
                distanceToWarehouseKm: calculateDistance(
                  facility.lat, facility.lng,
                  route.warehouse!.lat!, route.warehouse!.lng!
                ),
                distanceToPreviousKm: prev
                  ? calculateDistance(facility.lat, facility.lng, prev.lat, prev.lng)
                  : null,
                distanceToNextKm: next
                  ? calculateDistance(facility.lat, facility.lng, next.lat, next.lng)
                  : null,
              });
            };

            marker.on('click', handleClick);
            label.on('click', handleClick);
          }

          try {
            marker.addTo(layerRef.current!);
            label.addTo(layerRef.current!);
          } catch (e) {
            console.error('[RoutePolylinesLayer] Failed to add marker:', e);
          }
        });

        // Warehouse pin — only if warehouse has valid coordinates
        if (hasWarehouseCoords) {
          const whMarker = L.circleMarker(
            [route.warehouse!.lat!, route.warehouse!.lng!],
            {
              radius: isSelected ? 12 : 9,
              fillColor: '#1e293b',
              color: '#fff',
              weight: 3,
              fillOpacity: 0.9,
            }
          );

          whMarker.bindPopup(`
            <strong>${route.warehouse!.name}</strong><br/>
            <span style="font-size:12px">Origin for: ${route.name}</span>
          `);

          try {
            whMarker.addTo(layerRef.current);
          } catch (e) {
            console.error('[RoutePolylinesLayer] Failed to add warehouse marker:', e);
          }
        }
      });
    };

    if (!layerRef.current) {
      try {
        layerRef.current = L.layerGroup().addTo(map);
      } catch (e) {
        console.error('[RoutePolylinesLayer] Failed to initialize layer:', e);
        return;
      }
    }

    renderRoutes();

    return () => {
      layerRef.current?.clearLayers();
    };
  }, [map, routes, selectedRouteId, onRouteClick, onFacilityClick]);

  useEffect(() => {
    return () => {
      if (layerRef.current) {
        layerRef.current.clearLayers();
        layerRef.current.remove();
        layerRef.current = null;
      }
    };
  }, []);

  return null;
}

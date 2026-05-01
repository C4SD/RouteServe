import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { RouteOptimization, Warehouse } from '@/types';
import { MapUtils } from '@/lib/mapUtils';

interface RoutesLayerProps {
  map: L.Map | null;
  routes: RouteOptimization[];
  warehouses: Warehouse[];
}

export function RoutesLayer({ map, routes, warehouses }: RoutesLayerProps) {
  const layerRef = useRef<L.LayerGroup | null>(null);
  const linesRef = useRef<L.Polyline[]>([]);

  useEffect(() => {
    if (!MapUtils.isMapReady(map)) return;

    const handleZoom = () => {
      if (!layerRef.current) return;
      renderRoutes();
    };

    const renderRoutes = () => {
      if (!layerRef.current) return;
      layerRef.current.clearLayers();
      linesRef.current = [];

      routes.forEach((route, index) => {
        if (!layerRef.current || route.facilities.length === 0) return;

        const warehouse = warehouses.find(w => w.id === route.warehouseId);
        if (!warehouse) return;

        const routeCoords: [number, number][] = [[warehouse.lat, warehouse.lng]];
        route.facilities.forEach(facility => {
          routeCoords.push([facility.lat, facility.lng]);
        });

        const colors = ['hsl(195 100% 28%)', 'hsl(180 100% 25%)', 'hsl(140 60% 40%)'];
        const color = colors[index % colors.length];

        const polyline = L.polyline(routeCoords, {
          color: color,
          weight: 3,
          opacity: 0.8,
          dashArray: '10, 10'
        });

        try {
          polyline.addTo(layerRef.current);
          linesRef.current.push(polyline);
        } catch (e) {
          console.error('[RoutesLayer] Failed to add polyline:', e);
        }
      });
    };

    if (!layerRef.current) {
      try {
        layerRef.current = L.layerGroup().addTo(map);
      } catch (e) {
        console.error('[RoutesLayer] Failed to initialize layer:', e);
        return;
      }
    }

    map.on('zoomend', handleZoom);
    handleZoom(); // Initial check

    return () => {
      map.off('zoomend', handleZoom);
      layerRef.current?.clearLayers();
    };
  }, [map, routes, warehouses]);

  // Cleanup on unmount
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

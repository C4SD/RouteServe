/**
 * DashboardMapLibre.tsx
 *
 * Lightweight MapLibre-based map for the FleetOps dashboard.
 * Replaces the Leaflet-based UnifiedMapContainer for consistent
 * zoom/pan behavior with the rest of the BIKO ecosystem.
 *
 * Shows: batch route lines, facility markers, warehouse markers.
 * Supports: batch selection, click handlers, theme-aware basemap.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from 'next-themes';
import { getMapLibreStyle } from '@/lib/mapConfig';
import { DEFAULT_MAP_CENTER } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Facility, Warehouse, DeliveryBatch } from '@/types';

interface DashboardMapLibreProps {
  facilities?: Facility[];
  warehouses?: Warehouse[];
  batches?: DeliveryBatch[];
  selectedBatchId?: string | null;
  onBatchClick?: (batchId: string) => void;
  className?: string;
}

const BATCH_STATUS_COLORS: Record<string, string> = {
  planned: '#6b7280',
  assigned: '#f59e0b',
  'in-progress': '#10b981',
  completed: '#059669',
};

export function DashboardMapLibre({
  facilities = [],
  warehouses = [],
  batches = [],
  selectedBatchId = null,
  onBatchClick,
  className,
}: DashboardMapLibreProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const { theme } = useTheme();

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapLibreStyle(theme as 'light' | 'dark' | 'system' | undefined),
      center: DEFAULT_MAP_CENTER,
      zoom: 7,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      // Force a layout recalculation shortly after init.
      // Fixes the bug where MapLibre locks to a 300px fallback height
      // before the parent flex/grid layout has fully settled.
      setTimeout(() => map.resize(), 150);
      setMapLoaded(true);
    });

    // The OpenFreeMap positron style references icons (e.g. circle-11) that
    // aren't in its sprite. Add a transparent 1×1 placeholder to silence the warning.
    map.on('styleimagemissing', (e) => {
      map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, []);

  // Update basemap style when theme changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const newStyle = getMapLibreStyle(theme as 'light' | 'dark' | 'system' | undefined);
    map.setStyle(newStyle);

    // Re-add sources/layers after style change
    map.once('styledata', () => {
      addBatchLayers(map);
    });
  }, [theme, mapLoaded]);

  // Build batch route GeoJSON
  const buildBatchFeatures = useCallback(() => {
    const features: GeoJSON.Feature[] = [];

    batches.forEach((batch) => {
      const batchFacilities = Array.isArray(batch.facilities) ? batch.facilities : [];
      if (batch.status === 'cancelled' || batchFacilities.length === 0) return;

      const warehouse = warehouses.find((w) => w.id === batch.warehouseId);
      if (!warehouse || !isFinite(warehouse.lng) || !isFinite(warehouse.lat)) return;

      let coords: [number, number][];
      if (Array.isArray(batch.optimizedRoute) && batch.optimizedRoute.length > 0) {
        // optimizedRoute from Supabase JSONB can be either:
        //   [lat, lng][] (array tuples) or {lat, lng}[] (objects)
        // Convert to [lng, lat][] for GeoJSON
        coords = batch.optimizedRoute.map((point: any) => {
          if (Array.isArray(point) && point.length >= 2) {
            return [point[1], point[0]] as [number, number];
          }
          // Handle {lat, lng} objects
          if (point && typeof point === 'object' && 'lat' in point && 'lng' in point) {
            return [point.lng, point.lat] as [number, number];
          }
          return [0, 0] as [number, number];
        });
      } else {
        coords = [[warehouse.lng, warehouse.lat]];
        batchFacilities.forEach((f) => {
          if (isFinite(f.lng) && isFinite(f.lat)) {
            coords.push([f.lng, f.lat]);
          }
        });
      }

      const isSelected = selectedBatchId === batch.id;
      const hasSelection = selectedBatchId !== null;

      features.push({
        type: 'Feature',
        properties: {
          id: batch.id,
          name: batch.name,
          status: batch.status,
          color: BATCH_STATUS_COLORS[batch.status] || '#8b5cf6',
          width: batch.status === 'in-progress' ? 5 : 4,
          opacity: hasSelection ? (isSelected ? 1.0 : 0.25) : 0.85,
          isSelected,
          stops: batchFacilities.length,
          dashed: batch.status === 'planned' || batch.status === 'assigned' || batch.status === 'completed',
        },
        geometry: {
          type: 'LineString',
          coordinates: coords,
        },
      });
    });

    return features;
  }, [batches, warehouses, selectedBatchId]);

  // Add/update batch line layers on the map
  const addBatchLayers = useCallback(
    (map: maplibregl.Map) => {
      const features = buildBatchFeatures();

      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features,
      };

      if (map.getSource('batches')) {
        (map.getSource('batches') as maplibregl.GeoJSONSource).setData(geojson);
      } else {
        map.addSource('batches', {
          type: 'geojson',
          data: geojson,
        });

        // Batch route lines
        map.addLayer({
          id: 'batch-lines',
          type: 'line',
          source: 'batches',
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['get', 'width'],
            'line-opacity': ['get', 'opacity'],
            'line-dasharray': [
              'case',
              ['get', 'dashed'],
              ['literal', [2, 2]],
              ['literal', [1, 0]],
            ],
          },
        });

        // Click interaction
        map.on('click', 'batch-lines', (e) => {
          const feature = e.features?.[0];
          if (feature && onBatchClick) {
            onBatchClick(feature.properties?.id);
          }
        });

        // Cursor changes
        map.on('mouseenter', 'batch-lines', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'batch-lines', () => {
          map.getCanvas().style.cursor = '';
        });
      }
    },
    [buildBatchFeatures, onBatchClick]
  );

  // Update batch data
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    addBatchLayers(map);
  }, [mapLoaded, addBatchLayers]);

  // Update markers (warehouses + facilities)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Warehouse markers (larger, distinct)
    warehouses.forEach((wh) => {
      if (!Number.isFinite(wh.lng) || !Number.isFinite(wh.lat)) return;
      const el = document.createElement('div');
      el.style.cssText = `
        width: 28px; height: 28px;
        background: #3b82f6;
        border: 2.5px solid white;
        border-radius: 6px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: default;
        display: flex; align-items: center; justify-content: center;
      `;
      el.innerHTML = `<span style="color:white;font-size:12px;font-weight:700;">W</span>`;
      el.title = wh.name;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([wh.lng, wh.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });

    // Facility markers (small dots)
    facilities.forEach((f) => {
      if (!Number.isFinite(f.lng) || !Number.isFinite(f.lat)) return;
      const el = document.createElement('div');
      el.style.cssText = `
        width: 10px; height: 10px;
        background: #f97316;
        border: 1.5px solid white;
        border-radius: 50%;
        box-shadow: 0 1px 3px rgba(0,0,0,0.25);
        cursor: default;
      `;
      el.title = f.name;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([f.lng, f.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, [facilities, warehouses, mapLoaded]);

  // Fly to selected batch bounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !selectedBatchId) return;

    const batch = batches.find((b) => b.id === selectedBatchId);
    if (!batch) return;
    const batchFacilities = Array.isArray(batch.facilities) ? batch.facilities : [];
    if (batchFacilities.length === 0) return;

    const warehouse = warehouses.find((w) => w.id === batch.warehouseId);
    if (!warehouse || !isFinite(warehouse.lng) || !isFinite(warehouse.lat)) return;

    const bounds = new maplibregl.LngLatBounds();
    bounds.extend([warehouse.lng, warehouse.lat]);
    batchFacilities.forEach((f) => {
      if (isFinite(f.lng) && isFinite(f.lat)) {
        bounds.extend([f.lng, f.lat]);
      }
    });

    map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 800 });
  }, [selectedBatchId, batches, warehouses, mapLoaded]);

  return (
    <div className={cn('relative', className)}>
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}

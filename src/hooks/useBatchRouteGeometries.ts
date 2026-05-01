import { useState, useEffect, useRef, useMemo } from 'react';
import { getRoadRoute } from '@/lib/geoapify';
import { supabase } from '@/integrations/supabase/client';
import type { DeliveryBatch, Warehouse } from '@/types';

/**
 * Enriches delivery batches with real road geometry.
 * For each batch that lacks an optimized_route, fetches a road-following path
 * via the routing API, persists it to the DB, and returns the enriched batch list.
 * Subsequent renders will use the stored geometry directly from useDeliveryBatches.
 *
 * Coordinates are stored and returned as [lat, lng][] (Leaflet convention) to
 * stay compatible with BatchesLayer (Leaflet) and DashboardMapLibre (flips internally).
 */
export function useBatchRouteGeometries(
  batches: DeliveryBatch[],
  warehouses: Warehouse[]
): DeliveryBatch[] {
  const [enrichedRoutes, setEnrichedRoutes] = useState<Record<string, [number, number][]>>({});
  const handledRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (batches.length === 0 || warehouses.length === 0) return;

    const needsGeometry = batches.filter((b) => {
      if (b.status === 'cancelled') return false;
      if (handledRef.current.has(b.id)) return false;
      if (b.optimizedRoute && (b.optimizedRoute as unknown as any[]).length > 0) return false;
      if (b.facilities.length === 0) return false;
      const wh = warehouses.find((w) => w.id === b.warehouseId);
      return !!(wh?.lat && wh?.lng);
    });

    if (needsGeometry.length === 0) return;
    needsGeometry.forEach((b) => handledRef.current.add(b.id));

    const chunk = needsGeometry.slice(0, 3);

    Promise.all(
      chunk.map(async (batch) => {
        const wh = warehouses.find((w) => w.id === batch.warehouseId)!;
        const waypoints = [
          { lat: wh.lat!, lng: wh.lng! },
          ...batch.facilities.map((f) => ({ lat: f.lat, lng: f.lng })),
          { lat: wh.lat!, lng: wh.lng! },
        ];

        try {
          const road = await getRoadRoute(waypoints);
          if (road && road.geometry.length > 0) {
            // getRoadRoute returns [lng, lat][]; flip to [lat, lng][] for storage
            const coords = road.geometry.map(([lng, lat]) => [lat, lng] as [number, number]);

            supabase
              .from('delivery_batches')
              .update({ optimized_route: coords })
              .eq('id', batch.id)
              .then(({ error }) => {
                if (error) console.error(`[BatchRoutes] Failed to persist route for ${batch.id}:`, error);
              });

            return { batchId: batch.id, coords };
          }
        } catch (err) {
          console.error(`[BatchRoutes] Road route fetch failed for ${batch.id}:`, err);
        }
        return null;
      })
    ).then((results) => {
      const newRoutes: Record<string, [number, number][]> = {};
      let hasNew = false;
      results.forEach((r) => {
        if (!r) return;
        hasNew = true;
        newRoutes[r.batchId] = r.coords;
      });
      if (hasNew) setEnrichedRoutes((prev) => ({ ...prev, ...newRoutes }));
    });
  }, [batches, warehouses]);

  return useMemo(
    () =>
      batches.map((b) => {
        const enriched = enrichedRoutes[b.id];
        if (!enriched) return b;
        return { ...b, optimizedRoute: enriched };
      }),
    [batches, enrichedRoutes]
  );
}

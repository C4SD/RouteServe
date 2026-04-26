import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { MapFeatureCollection, RouteLineProperties, DriverStatus } from '@/types/live-map';

/**
 * Maps DB batch_status enum to map layer DriverStatus for route coloring.
 */
function mapBatchStatus(dbStatus: string): DriverStatus {
  switch (dbStatus) {
    case 'planned': return 'INACTIVE';
    case 'assigned': return 'ACTIVE';
    case 'in-progress': return 'EN_ROUTE';
    case 'completed': return 'COMPLETED';
    case 'cancelled': return 'SUSPENDED';
    default: return 'INACTIVE';
  }
}

/**
 * Fetches active batch routes and transforms to GeoJSON
 * for the RouteLineLayer.
 */
export function useMapRoutes(enabled = true) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['map-routes', workspaceId],
    enabled: enabled && !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_batches')
        .select('id, name, status, optimized_route, facility_ids, warehouse_id, driver_id')
        .eq('workspace_id', workspaceId!)
        .in('status', ['assigned', 'in-progress'])
        .not('optimized_route', 'is', null);

      if (error) throw error;

      const features = (data || [])
        .filter((b) => {
          const route = b.optimized_route as any;
          return Array.isArray(route) && route.length > 1;
        })
        .map((b) => {
          const route = b.optimized_route as [number, number][];
          return {
            type: 'Feature' as const,
            geometry: {
              type: 'LineString' as const,
              coordinates: route,
            },
            properties: {
              id: b.id,
              batchId: b.id,
              driverId: (b as any).driver_id || null,
              status: mapBatchStatus(b.status),
              progress: b.status === 'completed' ? 100 : 0,
            } as RouteLineProperties,
          };
        });

      return {
        type: 'FeatureCollection' as const,
        features,
      } as MapFeatureCollection<RouteLineProperties>;
    },
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { MapFeatureCollection, DriverMarkerProperties, DriverStatus } from '@/types/live-map';

/**
 * Maps DB driver_status enum to map layer DriverStatus.
 */
function mapDriverStatus(dbStatus: string): DriverStatus {
  switch (dbStatus) {
    case 'available': return 'ACTIVE';
    case 'busy': return 'EN_ROUTE';
    case 'offline': return 'INACTIVE';
    default: return 'INACTIVE';
  }
}

/**
 * Fetches drivers with current GPS coordinates and transforms to GeoJSON
 * for the DriverMarkerLayer.
 *
 * Polls every 30 seconds for near-real-time updates.
 */
export function useMapDrivers(enabled = true) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['map-drivers', workspaceId],
    enabled: enabled && !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, name, phone, status, current_lat, current_lng')
        .eq('workspace_id', workspaceId!)
        .not('current_lat', 'is', null)
        .not('current_lng', 'is', null);

      if (error) throw error;

      const features = (data || []).map((d) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [Number(d.current_lng), Number(d.current_lat)],
        },
        properties: {
          id: d.id,
          name: d.name,
          status: mapDriverStatus(d.status),
          heading: 0,
          isOnline: d.status !== 'offline',
          batchId: null,
        } as DriverMarkerProperties,
      }));

      return {
        type: 'FeatureCollection' as const,
        features,
      } as MapFeatureCollection<DriverMarkerProperties>;
    },
    enabled,
    refetchInterval: 30_000, // Poll every 30s
    staleTime: 15_000,
  });
}

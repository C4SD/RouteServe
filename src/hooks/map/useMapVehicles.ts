import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { MapFeatureCollection, VehicleMarkerProperties } from '@/types/live-map';

/**
 * Fetches vehicles with their assigned driver's GPS coordinates
 * and transforms to GeoJSON for the VehicleMarkerLayer.
 *
 * Vehicles get location from their currently assigned driver.
 */
export function useMapVehicles(enabled = true) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['map-vehicles', workspaceId],
    enabled: enabled && !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select(`
          id, plate_number, type, model, status, capacity, max_weight,
          current_driver_id,
          drivers!vehicles_current_driver_id_fkey (
            current_lat, current_lng, status
          )
        `)
        .eq('workspace_id', workspaceId!)
        .not('current_driver_id', 'is', null);

      if (error) throw error;

      const features = (data || [])
        .filter((v) => {
          const driver = v.drivers as any;
          return driver?.current_lat && driver?.current_lng;
        })
        .map((v) => {
          const driver = v.drivers as any;
          return {
            type: 'Feature' as const,
            geometry: {
              type: 'Point' as const,
              coordinates: [Number(driver.current_lng), Number(driver.current_lat)],
            },
            properties: {
              id: v.id,
              plate: v.plate_number,
              type: v.type,
              isActive: v.status === 'in-use',
              utilization: 0,
              driverId: v.current_driver_id,
            } as VehicleMarkerProperties,
          };
        });

      return {
        type: 'FeatureCollection' as const,
        features,
      } as MapFeatureCollection<VehicleMarkerProperties>;
    },
    enabled,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

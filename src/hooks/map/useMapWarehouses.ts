import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MapFeatureCollection } from '@/types/live-map';
import type { WarehouseMarkerProperties } from '@/maps-v3/layers/WarehouseMarkerLayer';

/**
 * Fetches warehouses with coordinates and transforms to GeoJSON
 * for the WarehouseMarkerLayer.
 */
export function useMapWarehouses() {
  return useQuery({
    queryKey: ['map-warehouses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name, lat, lng')
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      if (error) throw error;

      const features = (data || []).map((w) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [Number(w.lng), Number(w.lat)],
        },
        properties: {
          id: w.id,
          name: w.name,
          code: w.name.substring(0, 4).toUpperCase(),
          isActive: true,
        } as WarehouseMarkerProperties,
      }));

      return {
        type: 'FeatureCollection' as const,
        features,
      } as MapFeatureCollection<WarehouseMarkerProperties>;
    },
    staleTime: 5 * 60 * 1000,
  });
}

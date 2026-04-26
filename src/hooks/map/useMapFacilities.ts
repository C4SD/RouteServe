import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { MapFeatureCollection } from '@/types/live-map';
import type { FacilityMarkerProperties } from '@/maps-v3/layers/FacilityMarkerLayer';

/**
 * Fetches facilities with coordinates and transforms to GeoJSON
 * for the FacilityMarkerLayer.
 */
export function useMapFacilities() {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['map-facilities', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facilities')
        .select('id, name, type, lat, lng, lga')
        .eq('workspace_id', workspaceId!)
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      if (error) throw error;

      const features = (data || []).map((f) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [Number(f.lng), Number(f.lat)],
        },
        properties: {
          id: f.id,
          name: f.name,
          type: f.type || 'clinic',
          lga: f.lga || undefined,
        } as FacilityMarkerProperties,
      }));

      return {
        type: 'FeatureCollection' as const,
        features,
      } as MapFeatureCollection<FacilityMarkerProperties>;
    },
    staleTime: 5 * 60 * 1000,
  });
}

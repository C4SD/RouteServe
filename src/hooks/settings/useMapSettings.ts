/**
 * useMapSettings — reads map-specific workspace preferences.
 *
 * Wraps the existing useWorkspaceSettings / useUpdateWorkspaceSettings hooks
 * (which target the workspace_settings Supabase table) and exposes a clean
 * typed API for map components and the Map Settings page.
 */

import { useWorkspaceSettings, useUpdateWorkspaceSettings, getMapCenter } from '@/hooks/useWorkspaceSettings';
import { getBasemapStyle, type BasemapTheme } from '@/maps-v3/styles/basemap';
import type { StyleSpecification } from 'maplibre-gl';

export type BasemapStyle = 'auto' | 'light' | 'dark' | 'streets';

export interface MapLayerDefaults {
  showZones: boolean;
  showFacilities: boolean;
  showRoutes: boolean;
  enableClustering: boolean;
  realtimeRefreshInterval: number; // seconds
  showTraffic: boolean;
  showPlaces: boolean;
}

export interface ResolvedMapSettings {
  center: [number, number];        // [lng, lat] — MapLibre format
  zoom: number;
  basemapStyle: BasemapStyle;
  resolvedStyle: string | StyleSpecification; // URL or inline spec
  layers: MapLayerDefaults;
}

export function useMapSettings() {
  const { data, isLoading } = useWorkspaceSettings();
  const updateMutation = useUpdateWorkspaceSettings();
  const meta = data?.metadata ?? {};
  const basemapStyle = (meta.basemap_style as BasemapStyle) ?? 'auto';

  const settings: ResolvedMapSettings = {
    center: getMapCenter(data),
    zoom: data?.map_default_zoom ?? 11,
    basemapStyle,
    resolvedStyle: getBasemapStyle(basemapStyle as BasemapTheme),
    layers: {
      showZones:               meta.show_zones               ?? true,
      showFacilities:          meta.show_facilities           ?? true,
      showRoutes:              meta.show_routes               ?? true,
      enableClustering:        meta.enable_clustering         ?? true,
      realtimeRefreshInterval: meta.realtime_refresh_interval ?? 30,
      showTraffic:             meta.show_traffic              ?? false,
      showPlaces:              meta.show_places               ?? true,
    },
  };

  return {
    settings,
    isLoading,

    updateMapCenter(lat: number, lng: number, zoom: number) {
      updateMutation.mutate({ map_center_lat: lat, map_center_lng: lng, map_default_zoom: zoom });
    },

    updateBasemap(style: BasemapStyle) {
      updateMutation.mutate({ metadata: { ...meta, basemap_style: style } });
    },

    updateLayers(patch: Partial<MapLayerDefaults>) {
      updateMutation.mutate({
        metadata: {
          ...meta,
          ...(patch.showZones               !== undefined && { show_zones:                patch.showZones }),
          ...(patch.showFacilities          !== undefined && { show_facilities:           patch.showFacilities }),
          ...(patch.showRoutes              !== undefined && { show_routes:               patch.showRoutes }),
          ...(patch.enableClustering        !== undefined && { enable_clustering:         patch.enableClustering }),
          ...(patch.realtimeRefreshInterval !== undefined && { realtime_refresh_interval: patch.realtimeRefreshInterval }),
          ...(patch.showTraffic             !== undefined && { show_traffic:              patch.showTraffic }),
          ...(patch.showPlaces              !== undefined && { show_places:               patch.showPlaces }),
        },
      });
    },
  };
}

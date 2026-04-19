/**
 * FacilityMarkerLayer - Renders facility markers on the live map
 * Shows all facilities as colored circles with name labels
 */

import type maplibregl from 'maplibre-gl';
import { BaseLayer } from './BaseLayer';
import type { MapFeatureCollection } from '@/types/live-map';
import { tw, mapEntityColors } from '@/lib/colors';

export interface FacilityMarkerProperties {
  id: string;
  name: string;
  type: string;
  lga?: string;
}

const LAYER_ID = 'facility-markers';
const SOURCE_ID = 'facility-markers-source';

export class FacilityMarkerLayer extends BaseLayer<MapFeatureCollection<FacilityMarkerProperties>> {
  get layerId(): string {
    return LAYER_ID;
  }

  protected createLayers(): void {
    if (!this.map) return;

    this.map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    // Outer ring
    this.map.addLayer({
      id: `${LAYER_ID}-ring`,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 12, 7, 16, 10],
        'circle-color': 'transparent',
        'circle-stroke-color': mapEntityColors.facility,
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 12, 2, 16, 3],
        'circle-opacity': 0.9,
      },
    });

    // Inner dot
    this.map.addLayer({
      id: LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 2.5, 12, 4, 16, 6],
        'circle-color': mapEntityColors.facility,
        'circle-stroke-color': tw.white,
        'circle-stroke-width': 1,
      },
    });

    // Name labels
    this.map.addLayer({
      id: `${LAYER_ID}-labels`,
      type: 'symbol',
      source: SOURCE_ID,
      minzoom: 12,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Regular'],
        'text-size': 10,
        'text-offset': [0, 1.4],
        'text-anchor': 'top',
        'text-max-width': 10,
      },
      paint: {
        'text-color': mapEntityColors.facilityLabel,
        'text-halo-color': tw.white,
        'text-halo-width': 1,
      },
    });

    // Click handler
    this.map.on('click', LAYER_ID, this.handleClick.bind(this));
    this.map.on('mouseenter', LAYER_ID, () => {
      if (this.map) this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', LAYER_ID, () => {
      if (this.map) this.map.getCanvas().style.cursor = '';
    });
  }

  protected updateData(data: MapFeatureCollection<FacilityMarkerProperties>): void {
    if (!this.map) return;
    const source = this.map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(data);
    }
  }

  protected removeLayers(): void {
    if (!this.map) return;

    this.map.off('click', LAYER_ID, this.handleClick.bind(this));

    for (const id of [`${LAYER_ID}-labels`, LAYER_ID, `${LAYER_ID}-ring`]) {
      if (this.map.getLayer(id)) this.map.removeLayer(id);
    }
    if (this.map.getSource(SOURCE_ID)) this.map.removeSource(SOURCE_ID);
  }

  protected updateVisibility(visible: boolean): void {
    if (!this.map) return;
    const v = visible ? 'visible' : 'none';
    for (const id of [`${LAYER_ID}-ring`, LAYER_ID, `${LAYER_ID}-labels`]) {
      if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', v);
    }
  }

  private handleClick(e: maplibregl.MapMouseEvent): void {
    if (!e.features || e.features.length === 0) return;
    const feature = e.features[0];
    if (feature.properties?.id) {
      const coords = (feature.geometry as any)?.coordinates as [number, number] | undefined;
      window.dispatchEvent(
        new CustomEvent('facility-marker-click', {
          detail: {
            facilityId: feature.properties.id,
            properties: feature.properties,
            lngLat: coords
              ? { lng: coords[0], lat: coords[1] }
              : { lng: e.lngLat.lng, lat: e.lngLat.lat },
          },
        })
      );
    }
  }
}

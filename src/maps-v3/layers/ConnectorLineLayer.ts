/**
 * ConnectorLineLayer - Dashed emerald lines snapping facility markers to road
 *
 * Renders thin dashed connectors from facility pin positions to their nearest
 * road snapping point (as provided by Geoapify's snappedWaypoints). These are
 * purely decorative — no click handling.
 */

import type maplibregl from 'maplibre-gl';
import { BaseLayer } from './BaseLayer';
import type { FeatureCollection, LineString } from 'geojson';

const SOURCE_ID = 'connector-lines-source';
const LAYER_ID = 'connector-lines';

export class ConnectorLineLayer extends BaseLayer<FeatureCollection<LineString>> {
  get layerId(): string {
    return LAYER_ID;
  }

  protected createLayers(): void {
    if (!this.map) return;

    this.map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    this.map.addLayer({
      id: LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#10b981', // emerald-500
        'line-width': 1.5,
        'line-opacity': 0.6,
        'line-dasharray': [3, 3],
      },
    });
  }

  protected updateData(data: FeatureCollection<LineString>): void {
    if (!this.map) return;
    const source = this.map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
    if (source) source.setData(data);
  }

  protected removeLayers(): void {
    if (!this.map) return;
    if (this.map.getLayer(LAYER_ID)) this.map.removeLayer(LAYER_ID);
    if (this.map.getSource(SOURCE_ID)) this.map.removeSource(SOURCE_ID);
  }

  protected updateVisibility(visible: boolean): void {
    if (!this.map) return;
    if (this.map.getLayer(LAYER_ID)) {
      this.map.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none');
    }
  }
}

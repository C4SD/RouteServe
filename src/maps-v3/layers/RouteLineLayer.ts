/**
 * RouteLineLayer - Renders delivery route lines on the map
 * Shows completed portions as solid, remaining as dashed
 */

import type maplibregl from 'maplibre-gl';
import { BaseLayer } from './BaseLayer';
import type { MapFeatureCollection, RouteLineProperties, DriverStatus } from '@/types/live-map';
import { statusColors, tw } from '@/lib/colors';

const LAYER_ID = 'route-lines';
const SOURCE_ID = 'route-lines-source';

const STATUS_COLORS: Record<DriverStatus, string> = {
  ...statusColors,
  INACTIVE: tw.gray[400], // Routes use lighter gray than drivers
};

export class RouteLineLayer extends BaseLayer<MapFeatureCollection<RouteLineProperties>> {
  private currentData: MapFeatureCollection<RouteLineProperties> | null = null;

  get layerId(): string {
    return LAYER_ID;
  }

  protected createLayers(): void {
    if (!this.map) return;

    // Add source
    this.map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });

    // Add route line casing (outline)
    this.map.addLayer({
      id: `${LAYER_ID}-casing`,
      type: 'line',
      source: SOURCE_ID,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': tw.white,
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8, 4,
          12, 6,
          16, 8,
        ],
        'line-opacity': 0.8,
      },
    });

    // Add main route line
    this.map.addLayer({
      id: LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': [
          'match',
          ['get', 'status'],
          'INACTIVE', STATUS_COLORS.INACTIVE,
          'ACTIVE', STATUS_COLORS.ACTIVE,
          'EN_ROUTE', STATUS_COLORS.EN_ROUTE,
          'AT_STOP', STATUS_COLORS.AT_STOP,
          'DELAYED', STATUS_COLORS.DELAYED,
          'COMPLETED', STATUS_COLORS.COMPLETED,
          'SUSPENDED', STATUS_COLORS.SUSPENDED,
          STATUS_COLORS.INACTIVE,
        ],
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8, 2,
          12, 3,
          16, 4,
        ],
        'line-opacity': 0.8,
        'line-dasharray': [
          'case',
          ['>=', ['get', 'progress'], 100],
          ['literal', [1, 0]], // solid for completed
          ['literal', [2, 2]], // dashed for in-progress
        ],
      },
    });

    // Add click handler
    this.map.on('click', LAYER_ID, this.handleClick.bind(this));

    // Hover effects
    this.map.on('mouseenter', LAYER_ID, () => {
      if (this.map) this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', LAYER_ID, () => {
      if (this.map) this.map.getCanvas().style.cursor = '';
    });
  }

  protected updateData(data: MapFeatureCollection<RouteLineProperties>): void {
    if (!this.map) return;

    const source = this.map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(data);
      this.currentData = data;
    }
  }

  protected removeLayers(): void {
    if (!this.map) return;

    this.map.off('click', LAYER_ID, this.handleClick.bind(this));

    const layers = [LAYER_ID, `${LAYER_ID}-casing`];
    for (const layerId of layers) {
      if (this.map.getLayer(layerId)) {
        this.map.removeLayer(layerId);
      }
    }

    if (this.map.getSource(SOURCE_ID)) {
      this.map.removeSource(SOURCE_ID);
    }
  }

  protected updateVisibility(visible: boolean): void {
    if (!this.map) return;

    const visibility = visible ? 'visible' : 'none';
    const layers = [`${LAYER_ID}-casing`, LAYER_ID];

    for (const layerId of layers) {
      if (this.map.getLayer(layerId)) {
        this.map.setLayoutProperty(layerId, 'visibility', visibility);
      }
    }
  }

  private handleClick(e: maplibregl.MapMouseEvent): void {
    if (!e.features || e.features.length === 0) return;

    const feature = e.features[0];
    const batchId = feature.properties?.batchId;

    if (batchId) {
      window.dispatchEvent(
        new CustomEvent('route-line-click', {
          detail: { batchId, properties: feature.properties },
        })
      );
    }
  }
}

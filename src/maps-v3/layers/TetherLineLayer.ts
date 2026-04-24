/**
 * TetherLineLayer - Main route visualization lines (sandbox-style)
 *
 * Renders the primary tether geometry: blue solid lines for the active batch route
 * (cardinal spokes, road route, or selected alternative). Clicking a line shows a
 * popup with distance and time via a custom event.
 */

import type maplibregl from 'maplibre-gl';
import { BaseLayer } from './BaseLayer';
import type { Feature, FeatureCollection, LineString } from 'geojson';

export interface TetherLineProperties {
  mode: 'route' | 'cardinal';
  routeLabel?: string;
  distanceKm?: number;
  timeMinutes?: number;
  color?: string;
}

const SOURCE_ID = 'tether-lines-source';
const LAYER_ID = 'tether-lines';

export class TetherLineLayer extends BaseLayer<FeatureCollection<LineString, TetherLineProperties>> {
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
        'line-color': '#3b82f6',
        'line-width': 3,
        'line-opacity': 0.8,
      },
    });

    this.map.on('click', LAYER_ID, this.handleClick.bind(this));
    this.map.on('mouseenter', LAYER_ID, this.handleMouseEnter.bind(this));
    this.map.on('mouseleave', LAYER_ID, this.handleMouseLeave.bind(this));
  }

  protected updateData(data: FeatureCollection<LineString, TetherLineProperties>): void {
    if (!this.map) return;
    const source = this.map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
    if (source) source.setData(data);
  }

  protected removeLayers(): void {
    if (!this.map) return;

    this.map.off('click', LAYER_ID, this.handleClick.bind(this));
    this.map.off('mouseenter', LAYER_ID, this.handleMouseEnter.bind(this));
    this.map.off('mouseleave', LAYER_ID, this.handleMouseLeave.bind(this));

    if (this.map.getLayer(LAYER_ID)) this.map.removeLayer(LAYER_ID);
    if (this.map.getSource(SOURCE_ID)) this.map.removeSource(SOURCE_ID);
  }

  protected updateVisibility(visible: boolean): void {
    if (!this.map) return;
    if (this.map.getLayer(LAYER_ID)) {
      this.map.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none');
    }
  }

  private handleClick(e: maplibregl.MapMouseEvent & { features?: Feature[] }): void {
    const props = e.features?.[0]?.properties as TetherLineProperties | undefined;
    if (!props?.routeLabel && !props?.distanceKm) return;

    window.dispatchEvent(
      new CustomEvent('tether-line-click', {
        detail: {
          distanceKm: props.distanceKm,
          timeMinutes: props.timeMinutes,
          routeLabel: props.routeLabel,
          color: props.color,
          lngLat: e.lngLat,
        },
      })
    );
  }

  private handleMouseEnter(): void {
    if (this.map) this.map.getCanvas().style.cursor = 'pointer';
  }

  private handleMouseLeave(): void {
    if (this.map) this.map.getCanvas().style.cursor = '';
  }
}

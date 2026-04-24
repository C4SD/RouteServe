/**
 * AltRouteLayer - Alternative/comparison route lines
 *
 * Renders multiple comparison routes simultaneously. Color, width, and opacity
 * are driven by per-feature properties (from ROUTE_COLORS in routeOptimizer.ts).
 * This layer is inserted below connector-lines so connectors visually sit on top.
 * Clicking a line dispatches an event with route details for popup display.
 */

import type maplibregl from 'maplibre-gl';
import { BaseLayer } from './BaseLayer';
import type { Feature, FeatureCollection, LineString } from 'geojson';

export interface AltRouteProperties {
  id: string;
  color: string;
  width: number;
  opacity: number;
  routeLabel: string;
  distanceKm: number;
  timeMinutes: number;
}

const SOURCE_ID = 'alt-routes-source';
const LAYER_ID = 'alt-route-lines';

export class AltRouteLayer extends BaseLayer<FeatureCollection<LineString, AltRouteProperties>> {
  get layerId(): string {
    return LAYER_ID;
  }

  protected createLayers(): void {
    if (!this.map) return;

    this.map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    // Insert below connector-lines so connectors render on top
    this.map.addLayer(
      {
        id: LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'width'],
          'line-opacity': ['get', 'opacity'],
        },
      },
      'connector-lines' // insert below
    );

    this.map.on('click', LAYER_ID, this.handleClick.bind(this));
    this.map.on('mouseenter', LAYER_ID, this.handleMouseEnter.bind(this));
    this.map.on('mouseleave', LAYER_ID, this.handleMouseLeave.bind(this));
  }

  protected updateData(data: FeatureCollection<LineString, AltRouteProperties>): void {
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
    const props = e.features?.[0]?.properties as AltRouteProperties | undefined;
    if (!props) return;

    window.dispatchEvent(
      new CustomEvent('alt-route-line-click', {
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

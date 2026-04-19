/**
 * RouteGeometryLayer - Renders planning route polylines from the routes table
 * Distinct from RouteLineLayer which renders live delivery routes
 */

import type maplibregl from 'maplibre-gl';
import { BaseLayer } from './BaseLayer';

export interface RouteGeometryData {
  id: string;
  name: string;
  status: string;
  isSandbox: boolean;
  color?: string;
  geometry: { type: string; coordinates: [number, number][] } | null;
}

const LAYER_ID = 'route-geometry';
const SOURCE_ID = 'route-geometry-source';

const ROUTE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16',
];

function routeColor(id: string, custom?: string): string {
  if (custom) return custom;
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return ROUTE_COLORS[hash % ROUTE_COLORS.length];
}

export class RouteGeometryLayer extends BaseLayer<RouteGeometryData[]> {
  get layerId(): string { return LAYER_ID; }

  protected createLayers(): void {
    if (!this.map) return;

    this.map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    // Casing (white outline for readability)
    this.map.addLayer({
      id: `${LAYER_ID}-casing`,
      type: 'line',
      source: SOURCE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 4, 12, 6, 16, 9],
        'line-opacity': 0.7,
      },
    });

    // Route line
    this.map.addLayer({
      id: `${LAYER_ID}-line`,
      type: 'line',
      source: SOURCE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2, 12, 3.5, 16, 5],
        'line-opacity': [
          'case',
          ['==', ['get', 'isSandbox'], true], 0.65,
          0.9,
        ],
        'line-dasharray': [
          'case',
          ['==', ['get', 'isSandbox'], true], ['literal', [4, 2]],
          ['literal', [1]],
        ],
      },
    });

    // Click handler
    this.map.on('click', `${LAYER_ID}-line`, (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      window.dispatchEvent(
        new CustomEvent('plan-route-click', {
          detail: {
            routeId: feature.properties?.id,
            routeName: feature.properties?.name,
            lngLat: e.lngLat,
          },
        })
      );
    });

    this.map.on('mouseenter', `${LAYER_ID}-line`, () => {
      if (this.map) this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', `${LAYER_ID}-line`, () => {
      if (this.map) this.map.getCanvas().style.cursor = '';
    });
  }

  protected updateData(data: RouteGeometryData[]): void {
    if (!this.map) return;

    const features: GeoJSON.Feature[] = data
      .filter((r) => r.geometry && r.geometry.coordinates.length > 1)
      .map((route) => ({
        type: 'Feature' as const,
        geometry: route.geometry as any,
        properties: {
          id: route.id,
          name: route.name,
          status: route.status,
          isSandbox: route.isSandbox,
          color: routeColor(route.id, route.color),
        },
      }));

    const source = this.map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
    if (source) source.setData({ type: 'FeatureCollection', features });
  }

  protected removeLayers(): void {
    if (!this.map) return;
    for (const id of [`${LAYER_ID}-line`, `${LAYER_ID}-casing`]) {
      if (this.map.getLayer(id)) this.map.removeLayer(id);
    }
    if (this.map.getSource(SOURCE_ID)) this.map.removeSource(SOURCE_ID);
  }

  protected updateVisibility(visible: boolean): void {
    if (!this.map) return;
    const v = visible ? 'visible' : 'none';
    for (const id of [`${LAYER_ID}-casing`, `${LAYER_ID}-line`]) {
      if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', v);
    }
  }
}

declare namespace GeoJSON {
  interface Feature { type: 'Feature'; geometry: any; properties: Record<string, any> | null; }
}

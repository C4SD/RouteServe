/**
 * ServiceAreaPolygonLayer - Renders service area convex hull polygons on the map
 * Displays coverage zones with semi-transparent fills + spoke lines to center
 */

import type maplibregl from 'maplibre-gl';
import { BaseLayer } from './BaseLayer';

export interface ServiceAreaHullData {
  id: string;
  name: string;
  color?: string;
  /** Convex hull points in {lat, lng} format */
  hull: { lat: number; lng: number }[];
  /** Warehouse/depot center point */
  depot?: { lat: number; lng: number } | null;
}

const FILL_LAYER = 'sa-polygon-fill';
const STROKE_LAYER = 'sa-polygon-stroke';
const SPOKE_LAYER = 'sa-spoke-lines';
const POLYGON_SOURCE = 'sa-polygon-source';
const SPOKE_SOURCE = 'sa-spoke-source';

const SA_COLORS = [
  '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6',
  '#ef4444', '#06b6d4', '#f97316', '#84cc16',
];

function saColor(id: string, custom?: string): string {
  if (custom) return custom;
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return SA_COLORS[hash % SA_COLORS.length];
}

export class ServiceAreaPolygonLayer extends BaseLayer<ServiceAreaHullData[]> {
  get layerId(): string { return FILL_LAYER; }

  protected createLayers(): void {
    if (!this.map) return;

    // Polygon source
    this.map.addSource(POLYGON_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    // Spoke source (lines from depot to each hull vertex)
    this.map.addSource(SPOKE_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    // Fill
    this.map.addLayer({
      id: FILL_LAYER,
      type: 'fill',
      source: POLYGON_SOURCE,
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.1,
      },
    });

    // Stroke
    this.map.addLayer({
      id: STROKE_LAYER,
      type: 'line',
      source: POLYGON_SOURCE,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.5,
        'line-opacity': 0.6,
      },
    });

    // Spoke lines
    this.map.addLayer({
      id: SPOKE_LAYER,
      type: 'line',
      source: SPOKE_SOURCE,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 0.8,
        'line-opacity': 0.35,
        'line-dasharray': [3, 3],
      },
    });
  }

  protected updateData(data: ServiceAreaHullData[]): void {
    if (!this.map) return;

    const polygonFeatures: GeoJSON.Feature[] = [];
    const spokeFeatures: GeoJSON.Feature[] = [];

    data.forEach((sa) => {
      if (sa.hull.length < 3) return;
      const color = saColor(sa.id, sa.color);

      // Close the polygon ring
      const ring = [
        ...sa.hull.map(({ lat, lng }) => [lng, lat] as [number, number]),
        [sa.hull[0].lng, sa.hull[0].lat] as [number, number],
      ];

      polygonFeatures.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [ring] },
        properties: { id: sa.id, name: sa.name, color },
      });

      // Spokes from depot to each hull vertex
      if (sa.depot) {
        const depot: [number, number] = [sa.depot.lng, sa.depot.lat];
        sa.hull.forEach(({ lat, lng }) => {
          spokeFeatures.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [depot, [lng, lat]] },
            properties: { id: sa.id, color },
          });
        });
      }
    });

    const polySrc = this.map.getSource(POLYGON_SOURCE) as maplibregl.GeoJSONSource;
    if (polySrc) polySrc.setData({ type: 'FeatureCollection', features: polygonFeatures });

    const spokeSrc = this.map.getSource(SPOKE_SOURCE) as maplibregl.GeoJSONSource;
    if (spokeSrc) spokeSrc.setData({ type: 'FeatureCollection', features: spokeFeatures });
  }

  protected removeLayers(): void {
    if (!this.map) return;
    for (const id of [SPOKE_LAYER, STROKE_LAYER, FILL_LAYER]) {
      if (this.map.getLayer(id)) this.map.removeLayer(id);
    }
    for (const id of [POLYGON_SOURCE, SPOKE_SOURCE]) {
      if (this.map.getSource(id)) this.map.removeSource(id);
    }
  }

  protected updateVisibility(visible: boolean): void {
    if (!this.map) return;
    const v = visible ? 'visible' : 'none';
    for (const id of [FILL_LAYER, STROKE_LAYER, SPOKE_LAYER]) {
      if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', v);
    }
  }
}

declare namespace GeoJSON {
  interface Feature { type: 'Feature'; geometry: any; properties: Record<string, any> | null; }
}

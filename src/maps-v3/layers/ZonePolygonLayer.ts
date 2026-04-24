/**
 * ZonePolygonLayer - Renders operational zone boundaries as filled polygons
 * Uses GeoJSON Polygon geometry stored in zone metadata
 */

import type maplibregl from 'maplibre-gl';
import { BaseLayer } from './BaseLayer';

export interface ZonePolygonData {
  id: string;
  name: string;
  code?: string | null;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  color?: string;
}

const LAYER_ID = 'zone-polygons';
const SOURCE_ID = 'zone-polygons-source';

// Default zone colors cycling palette
const ZONE_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
  '#14b8a6', '#3b82f6', '#f59e0b', '#10b981',
];

function getZoneColor(index: number, custom?: string): string {
  return custom || ZONE_COLORS[index % ZONE_COLORS.length];
}

export class ZonePolygonLayer extends BaseLayer<ZonePolygonData[]> {
  get layerId(): string { return LAYER_ID; }

  protected createLayers(): void {
    if (!this.map) return;

    this.map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    // Fill layer
    this.map.addLayer({
      id: `${LAYER_ID}-fill`,
      type: 'fill',
      source: SOURCE_ID,
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.08,
      },
    });

    // Stroke layer
    this.map.addLayer({
      id: `${LAYER_ID}-stroke`,
      type: 'line',
      source: SOURCE_ID,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 12, 2, 16, 2.5],
        'line-opacity': 0.7,
        'line-dasharray': [4, 2],
      },
    });

    // Label layer (zone names at centroid is complex; skip for now — ZoneMarkerLayer handles labels)
  }

  protected updateData(data: ZonePolygonData[]): void {
    if (!this.map) return;

    const features: GeoJSON.Feature[] = data.map((zone, idx) => ({
      type: 'Feature',
      id: zone.id,
      geometry: zone.geometry,
      properties: {
        id: zone.id,
        name: zone.name,
        code: zone.code ?? null,
        color: getZoneColor(idx, zone.color),
      },
    }));

    const source = this.map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
    if (source) {
      source.setData({ type: 'FeatureCollection', features });
    }
  }

  protected removeLayers(): void {
    if (!this.map) return;
    for (const id of [`${LAYER_ID}-stroke`, `${LAYER_ID}-fill`]) {
      if (this.map.getLayer(id)) this.map.removeLayer(id);
    }
    if (this.map.getSource(SOURCE_ID)) this.map.removeSource(SOURCE_ID);
  }

  protected updateVisibility(visible: boolean): void {
    if (!this.map) return;
    const v = visible ? 'visible' : 'none';
    for (const id of [`${LAYER_ID}-fill`, `${LAYER_ID}-stroke`]) {
      if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', v);
    }
  }
}

declare namespace GeoJSON {
  interface Polygon { type: 'Polygon'; coordinates: number[][][]; }
  interface MultiPolygon { type: 'MultiPolygon'; coordinates: number[][][][]; }
  interface Feature { type: 'Feature'; id?: string | number; geometry: any; properties: Record<string, any> | null; }
}

/**
 * WarehouseMarkerLayer - Renders warehouse markers on the live map
 *
 * Hybrid approach:
 * - GL layers: name labels (for spatial context)
 * - DOM markers: large square-ish marker with "W" icon (precise click target)
 *
 * DOM markers are independent of GL rendering, ensuring warehouses always
 * appear even when the basemap style has glyph/sprite issues.
 */

import maplibregl from 'maplibre-gl';
import { BaseLayer } from './BaseLayer';
import type { MapFeatureCollection } from '@/types/live-map';
import { tw, mapEntityColors } from '@/lib/colors';

export interface WarehouseMarkerProperties {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

const LAYER_ID = 'warehouse-markers';
const SOURCE_ID = 'warehouse-markers-source';

/** Inject warehouse marker CSS once into document.head */
function ensureWarehouseStyle(): void {
  if (document.getElementById('warehouse-marker-style')) return;
  const style = document.createElement('style');
  style.id = 'warehouse-marker-style';
  style.textContent = `
    .warehouse-dom-marker {
      cursor: pointer;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      color: white;
      font-weight: bold;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      transition: transform 0.15s ease;
    }
    .warehouse-dom-marker:hover {
      transform: scale(1.2);
      z-index: 1000;
    }
  `;
  document.head.appendChild(style);
}

export class WarehouseMarkerLayer extends BaseLayer<MapFeatureCollection<WarehouseMarkerProperties>> {
  private warehouseMarkers = new Map<string, maplibregl.Marker>();

  get layerId(): string {
    return LAYER_ID;
  }

  protected createLayers(): void {
    if (!this.map) return;

    ensureWarehouseStyle();

    this.map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    // Name labels (GL symbol layer for spatial context)
    this.map.addLayer({
      id: `${LAYER_ID}-labels`,
      type: 'symbol',
      source: SOURCE_ID,
      minzoom: 10,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Bold'],
        'text-size': 11,
        'text-offset': [0, 1.6],
        'text-anchor': 'top',
        'text-max-width': 12,
      },
      paint: {
        'text-color': mapEntityColors.warehouseLabel,
        'text-halo-color': tw.white,
        'text-halo-width': 1,
      },
    });
  }

  protected updateData(data: MapFeatureCollection<WarehouseMarkerProperties>): void {
    if (!this.map) return;

    // Update GL source (labels)
    const source = this.map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
    if (source) source.setData(data as any);

    // Diff DOM markers
    const newIds = new Set<string>();

    for (const feature of data.features) {
      const props = feature.properties as WarehouseMarkerProperties;
      if (!props?.id) continue;
      if (feature.geometry.type !== 'Point') continue;

      const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
      newIds.add(props.id);

      if (!this.warehouseMarkers.has(props.id)) {
        const el = this.buildMarkerElement(props);
        el.addEventListener('click', () => {
          window.dispatchEvent(
            new CustomEvent('warehouse-marker-click', {
              detail: {
                warehouseId: props.id,
                properties: props,
                lngLat: { lng, lat },
              },
            })
          );
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(this.map!);

        this.warehouseMarkers.set(props.id, marker);
      }
    }

    // Remove stale markers
    for (const [id, marker] of this.warehouseMarkers) {
      if (!newIds.has(id)) {
        marker.remove();
        this.warehouseMarkers.delete(id);
      }
    }
  }

  protected removeLayers(): void {
    if (!this.map) return;

    // Remove DOM markers
    this.warehouseMarkers.forEach((m) => m.remove());
    this.warehouseMarkers.clear();

    // Remove GL layers + source
    if (this.map.getLayer(`${LAYER_ID}-labels`)) this.map.removeLayer(`${LAYER_ID}-labels`);
    if (this.map.getSource(SOURCE_ID)) this.map.removeSource(SOURCE_ID);
  }

  protected updateVisibility(visible: boolean): void {
    if (!this.map) return;

    const v = visible ? 'visible' : 'none';
    if (this.map.getLayer(`${LAYER_ID}-labels`)) {
      this.map.setLayoutProperty(`${LAYER_ID}-labels`, 'visibility', v);
    }

    const display = visible ? '' : 'none';
    this.warehouseMarkers.forEach((m) => {
      m.getElement().style.display = display;
    });
  }

  private buildMarkerElement(props: WarehouseMarkerProperties): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'cursor:pointer;width:32px;height:32px;';
    wrapper.innerHTML = `
      <div class="warehouse-dom-marker" title="${props.name}${props.code ? ' · ' + props.code : ''}" style="
        width:32px;height:32px;
        background:${mapEntityColors.warehouse};
      ">W</div>
    `;
    return wrapper;
  }
}

// GeoJSON type helper used internally
declare namespace GeoJSON {
  interface Point {
    type: 'Point';
    coordinates: [number, number];
  }
}

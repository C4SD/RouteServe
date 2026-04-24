/**
 * ZoneMarkerLayer - Renders operational zone center markers on the live map
 *
 * Hybrid approach:
 * - GL layers: large translucent area circle + name labels (for spatial context)
 * - DOM markers: 40px blue "Z" circle with pulsing ring (sandbox-style, precise click target)
 *
 * The center dot GL layer is replaced by the DOM marker so the visual matches
 * the sandbox route builder exactly.
 */

import maplibregl from 'maplibre-gl';
import { BaseLayer } from './BaseLayer';
import type { MapFeatureCollection } from '@/types/live-map';
import { tw, mapEntityColors } from '@/lib/colors';

export interface ZoneMarkerProperties {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
}

const LAYER_ID = 'zone-markers';
const SOURCE_ID = 'zone-markers-source';

/** Inject pulsing ring CSS animation once into document.head */
function ensurePulseStyle(): void {
  if (document.getElementById('zone-marker-pulse')) return;
  const style = document.createElement('style');
  style.id = 'zone-marker-pulse';
  style.textContent = `
    @keyframes zone-marker-pulse {
      0%, 100% { box-shadow: 0 0 0 6px rgba(59,130,246,0.25), 0 2px 8px rgba(0,0,0,0.3); }
      50%       { box-shadow: 0 0 0 6px rgba(59,130,246,0.05), 0 2px 8px rgba(0,0,0,0.15); }
    }
    .zone-dom-marker {
      animation: zone-marker-pulse 2s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
}

export class ZoneMarkerLayer extends BaseLayer<MapFeatureCollection<ZoneMarkerProperties>> {
  private zoneMarkers = new Map<string, maplibregl.Marker>();

  get layerId(): string {
    return LAYER_ID;
  }

  protected createLayers(): void {
    if (!this.map) return;

    ensurePulseStyle();

    this.map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    // Large translucent circle to represent zone area
    this.map.addLayer({
      id: `${LAYER_ID}-area`,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 16, 12, 28, 16, 40],
        'circle-color': mapEntityColors.zone,
        'circle-opacity': 0.12,
        'circle-stroke-color': mapEntityColors.zone,
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 12, 2, 16, 2.5],
        'circle-stroke-opacity': 0.5,
      },
    });

    // Zone name labels (DOM marker handles click; labels are for spatial context)
    this.map.addLayer({
      id: `${LAYER_ID}-labels`,
      type: 'symbol',
      source: SOURCE_ID,
      minzoom: 9,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 9, 11, 14, 14],
        'text-offset': [0, 2.5],
        'text-anchor': 'top',
        'text-max-width': 14,
      },
      paint: {
        'text-color': mapEntityColors.zoneLabel,
        'text-halo-color': tw.white,
        'text-halo-width': 1.5,
      },
    });
  }

  protected updateData(data: MapFeatureCollection<ZoneMarkerProperties>): void {
    if (!this.map) return;

    // Update GL source (area circle + labels)
    const source = this.map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
    if (source) source.setData(data);

    // Diff DOM markers
    const newIds = new Set<string>();

    for (const feature of data.features) {
      const props = feature.properties as ZoneMarkerProperties;
      if (!props?.id) continue;
      if (feature.geometry.type !== 'Point') continue;

      const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
      newIds.add(props.id);

      if (!this.zoneMarkers.has(props.id)) {
        const el = this.buildMarkerElement(props.name);
        el.addEventListener('click', () => {
          window.dispatchEvent(
            new CustomEvent('zone-marker-click', {
              detail: { zoneId: props.id, properties: props },
            })
          );
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(this.map!);

        this.zoneMarkers.set(props.id, marker);
      }
      // If the marker already exists we leave it (positions don't change at runtime)
    }

    // Remove stale markers
    for (const [id, marker] of this.zoneMarkers) {
      if (!newIds.has(id)) {
        marker.remove();
        this.zoneMarkers.delete(id);
      }
    }
  }

  protected removeLayers(): void {
    if (!this.map) return;

    // Remove DOM markers
    this.zoneMarkers.forEach((m) => m.remove());
    this.zoneMarkers.clear();

    // Remove GL layers + source
    for (const id of [`${LAYER_ID}-labels`, `${LAYER_ID}-area`]) {
      if (this.map.getLayer(id)) this.map.removeLayer(id);
    }
    if (this.map.getSource(SOURCE_ID)) this.map.removeSource(SOURCE_ID);
  }

  protected updateVisibility(visible: boolean): void {
    if (!this.map) return;

    const v = visible ? 'visible' : 'none';
    for (const id of [`${LAYER_ID}-area`, `${LAYER_ID}-labels`]) {
      if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', v);
    }

    const display = visible ? '' : 'none';
    this.zoneMarkers.forEach((m) => {
      m.getElement().style.display = display;
    });
  }

  private buildMarkerElement(name: string): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'cursor:pointer;width:40px;height:40px;';
    wrapper.innerHTML = `
      <div class="zone-dom-marker" title="${name}" style="
        width:40px;height:40px;
        background:#3b82f6;
        border:3px solid white;
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        font-size:18px;color:white;font-weight:bold;
        box-shadow:0 0 0 6px rgba(59,130,246,0.25),0 2px 8px rgba(0,0,0,0.3);
      ">Z</div>
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

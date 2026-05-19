/**
 * FacilityMarkerLayer - Renders facility markers on the live map
 *
 * Hybrid approach:
 * - GL layers: name labels (for spatial context)
 * - DOM markers: colored circle with facility type icon (precise click target)
 *
 * DOM markers are independent of GL rendering, ensuring facilities always
 * appear even when the basemap style has glyph/sprite issues.
 */

import maplibregl from 'maplibre-gl';
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

/** Inject facility marker CSS once into document.head */
function ensureFacilityStyle(): void {
  if (document.getElementById('facility-marker-style')) return;
  const style = document.createElement('style');
  style.id = 'facility-marker-style';
  style.textContent = `
    .facility-dom-marker {
      cursor: pointer;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: white;
      font-weight: bold;
      border: 2px solid white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.35);
      transition: transform 0.15s ease;
    }
    .facility-dom-marker:hover {
      transform: scale(1.2);
      z-index: 1000;
    }
  `;
  document.head.appendChild(style);
}

export class FacilityMarkerLayer extends BaseLayer<MapFeatureCollection<FacilityMarkerProperties>> {
  private facilityMarkers = new Map<string, maplibregl.Marker>();

  get layerId(): string {
    return LAYER_ID;
  }

  protected createLayers(): void {
    if (!this.map) return;

    ensureFacilityStyle();

    this.map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    // Name labels (GL symbol layer for spatial context)
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
  }

  protected updateData(data: MapFeatureCollection<FacilityMarkerProperties>): void {
    if (!this.map) return;

    // Update GL source (labels)
    const source = this.map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
    if (source) source.setData(data as any);

    // Diff DOM markers
    const newIds = new Set<string>();

    for (const feature of data.features) {
      const props = feature.properties as FacilityMarkerProperties;
      if (!props?.id) continue;
      if (feature.geometry.type !== 'Point') continue;

      const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
      newIds.add(props.id);

      if (!this.facilityMarkers.has(props.id)) {
        const el = this.buildMarkerElement(props);
        el.addEventListener('click', () => {
          window.dispatchEvent(
            new CustomEvent('facility-marker-click', {
              detail: {
                facilityId: props.id,
                properties: props,
                lngLat: { lng, lat },
              },
            })
          );
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(this.map!);

        this.facilityMarkers.set(props.id, marker);
      }
    }

    // Remove stale markers
    for (const [id, marker] of this.facilityMarkers) {
      if (!newIds.has(id)) {
        marker.remove();
        this.facilityMarkers.delete(id);
      }
    }
  }

  protected removeLayers(): void {
    if (!this.map) return;

    // Remove DOM markers
    this.facilityMarkers.forEach((m) => m.remove());
    this.facilityMarkers.clear();

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
    this.facilityMarkers.forEach((m) => {
      m.getElement().style.display = display;
    });
  }

  private buildMarkerElement(props: FacilityMarkerProperties): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'cursor:pointer;width:24px;height:24px;';
    wrapper.innerHTML = `
      <div class="facility-dom-marker" title="${props.name}${props.lga ? ' · ' + props.lga : ''}" style="
        width:24px;height:24px;
        background:${mapEntityColors.facility};
      ">F</div>
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

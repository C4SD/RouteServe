/**
 * VehicleMarkerLayer - Renders vehicle markers on the map
 * Shows truck icons with capacity utilization badges
 */

import type maplibregl from 'maplibre-gl';
import { BaseLayer } from './BaseLayer';
import type { MapFeatureCollection, VehicleMarkerProperties } from '@/types/live-map';
import { tw, mapEntityColors } from '@/lib/colors';

const LAYER_ID = 'vehicle-markers';
const SOURCE_ID = 'vehicle-markers-source';

export class VehicleMarkerLayer extends BaseLayer<MapFeatureCollection<VehicleMarkerProperties>> {
  private currentData: MapFeatureCollection<VehicleMarkerProperties> | null = null;

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

    // Add circle layer for vehicle markers (square-ish appearance)
    this.map.addLayer({
      id: LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8, 8,
          12, 12,
          16, 16,
        ],
        'circle-color': [
          'case',
          ['get', 'isActive'],
          mapEntityColors.vehicle,
          tw.gray[400],
        ],
        'circle-stroke-color': tw.white,
        'circle-stroke-width': 2,
        'circle-opacity': 0.9,
      },
    });

    // Register canvas-drawn vehicle images so icon-image works in MapLibre
    this.addVehicleImages();

    // Add icon symbol rendered on top of the circle
    this.map.addLayer({
      id: `${LAYER_ID}-icons`,
      type: 'symbol',
      source: SOURCE_ID,
      layout: {
        'icon-image': ['case', ['boolean', ['get', 'isActive'], false], 'vehicle-active', 'vehicle-inactive'],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.45, 12, 0.65, 16, 0.9],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-anchor': 'center',
      },
      paint: {
        'icon-opacity': 0.95,
      },
    });

    // Add plate number labels
    this.map.addLayer({
      id: `${LAYER_ID}-labels`,
      type: 'symbol',
      source: SOURCE_ID,
      minzoom: 13,
      layout: {
        'text-field': ['get', 'plate'],
        'text-font': ['Open Sans Bold'],
        'text-size': 10,
        'text-offset': [0, 1.8],
        'text-anchor': 'top',
        'text-transform': 'uppercase',
      },
      paint: {
        'text-color': tw.gray[700],
        'text-halo-color': tw.white,
        'text-halo-width': 1,
      },
    });

    // Add utilization badge layer
    this.map.addLayer({
      id: `${LAYER_ID}-utilization`,
      type: 'symbol',
      source: SOURCE_ID,
      minzoom: 11,
      layout: {
        'text-field': ['concat', ['to-string', ['round', ['get', 'utilization']]], '%'],
        'text-font': ['Open Sans Bold'],
        'text-size': 9,
        'text-offset': [0.8, -0.8],
        'text-anchor': 'center',
      },
      paint: {
        'text-color': tw.white,
        'text-halo-color': [
          'case',
          ['>', ['get', 'utilization'], 80],
          tw.red[500],
          ['>', ['get', 'utilization'], 50],
          tw.amber[500],
          tw.green[500],
        ],
        'text-halo-width': 4,
      },
    });

    // Add click handler
    this.map.on('click', LAYER_ID, this.handleClick.bind(this));

    // Add hover cursor
    this.map.on('mouseenter', LAYER_ID, () => {
      if (this.map) this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', LAYER_ID, () => {
      if (this.map) this.map.getCanvas().style.cursor = '';
    });
  }

  protected updateData(data: MapFeatureCollection<VehicleMarkerProperties>): void {
    if (!this.map) return;

    const source = this.map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(data);
      this.currentData = data;
    }
  }

  protected removeLayers(): void {
    if (!this.map) return;

    // Remove click handler
    this.map.off('click', LAYER_ID, this.handleClick.bind(this));

    // Remove layers in reverse order
    const layers = [`${LAYER_ID}-utilization`, `${LAYER_ID}-labels`, `${LAYER_ID}-icons`, LAYER_ID];
    for (const layerId of layers) {
      if (this.map.getLayer(layerId)) {
        this.map.removeLayer(layerId);
      }
    }

    // Remove source
    if (this.map.getSource(SOURCE_ID)) {
      this.map.removeSource(SOURCE_ID);
    }
  }

  protected updateVisibility(visible: boolean): void {
    if (!this.map) return;

    const visibility = visible ? 'visible' : 'none';
    const layers = [LAYER_ID, `${LAYER_ID}-icons`, `${LAYER_ID}-labels`, `${LAYER_ID}-utilization`];

    for (const layerId of layers) {
      if (this.map.getLayer(layerId)) {
        this.map.setLayoutProperty(layerId, 'visibility', visibility);
      }
    }
  }

  /**
   * Draws a simple truck icon onto a canvas and registers it as a MapLibre
   * sprite image.  MapLibre's SDF glyph system cannot render emoji, so we
   * generate the icon programmatically instead of using text-field.
   */
  private addVehicleImages(): void {
    if (!this.map) return;

    const drawTruck = (bodyColor: string, cabColor: string): ImageData => {
      const size = 48;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      // Cargo body
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.roundRect(3, 14, 26, 18, 4);
      ctx.fill();

      // Cab
      ctx.fillStyle = cabColor;
      ctx.beginPath();
      ctx.roundRect(29, 18, 14, 14, 3);
      ctx.fill();

      // Windshield
      ctx.fillStyle = 'rgba(191,219,254,0.85)';
      ctx.beginPath();
      ctx.roundRect(30, 19, 12, 7, 2);
      ctx.fill();

      // Wheels (3 axles)
      const wheelPositions: [number, number][] = [[10, 32], [20, 32], [34, 32]];
      for (const [wx, wy] of wheelPositions) {
        // Tyre
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(wx, wy, 5, 0, Math.PI * 2);
        ctx.fill();
        // Hub
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(wx, wy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      return ctx.getImageData(0, 0, size, size);
    };

    if (!this.map.hasImage('vehicle-active')) {
      this.map.addImage('vehicle-active', drawTruck('#3b82f6', '#1d4ed8'), { pixelRatio: 2 });
    }
    if (!this.map.hasImage('vehicle-inactive')) {
      this.map.addImage('vehicle-inactive', drawTruck('#94a3b8', '#64748b'), { pixelRatio: 2 });
    }
  }

  private handleClick(e: maplibregl.MapMouseEvent): void {
    if (!e.features || e.features.length === 0) return;

    const feature = e.features[0];
    const vehicleId = feature.properties?.id;

    if (vehicleId) {
      window.dispatchEvent(
        new CustomEvent('vehicle-marker-click', {
          detail: { vehicleId, properties: feature.properties },
        })
      );
    }
  }

  getVisibleVehicleIds(): string[] {
    if (!this.currentData) return [];
    return this.currentData.features.map((f) => f.properties.id);
  }
}

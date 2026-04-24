/**
 * DomMarkerLayer - Abstract base class for layers that use MapLibre DOM markers
 *
 * Extends BaseLayer to provide a managed Map of maplibregl.Marker instances.
 * Subclasses implement buildMarkerElement(), getMarkerId(), and getMarkerCoords()
 * to define how each data item becomes a positioned DOM marker.
 *
 * Unlike GL source/layer based layers, DOM markers float above the canvas in HTML.
 * Visibility is managed by toggling display on each marker element.
 */

import maplibregl from 'maplibre-gl';
import { BaseLayer } from './BaseLayer';

export abstract class DomMarkerLayer<TItem = any> extends BaseLayer<TItem[]> {
  protected markers = new Map<string, maplibregl.Marker>();

  // ── Abstract interface ────────────────────────────────────────────────────

  /** Unique string ID for this item (used to diff/update markers) */
  protected abstract getMarkerId(item: TItem): string;

  /** [lng, lat] position for the marker */
  protected abstract getMarkerCoords(item: TItem): [number, number];

  /**
   * Build the DOM element for a new marker.
   * Return null to skip placing a marker for this item.
   */
  protected abstract buildMarkerElement(item: TItem): HTMLElement | null;

  /**
   * Optionally update an existing marker element in-place (e.g. change color).
   * Default: rebuild the element and replace it.
   */
  protected updateMarkerElement(marker: maplibregl.Marker, item: TItem): void {
    const el = this.buildMarkerElement(item);
    if (!el) return;
    // Replace inner content by swapping the element
    const existing = marker.getElement();
    existing.replaceWith(el);
    // MapLibre marker still points to old element reference — recreate
    marker.remove();
    const newMarker = new maplibregl.Marker({ element: el })
      .setLngLat(this.getMarkerCoords(item));
    if (this.map) newMarker.addTo(this.map);
    this.markers.set(this.getMarkerId(item), newMarker);
  }

  // ── BaseLayer implementation ──────────────────────────────────────────────

  /**
   * createLayers: no GL layers to add. Subclasses may override to also add GL layers.
   */
  protected createLayers(): void {
    // no-op — DOM markers are added via updateData()
  }

  /**
   * removeLayers: remove all DOM markers from the map and clear the internal map.
   */
  protected removeLayers(): void {
    this.markers.forEach((marker) => marker.remove());
    this.markers.clear();
  }

  /**
   * updateData: diff current markers against new data items.
   * - Adds markers for new items
   * - Updates markers for existing items
   * - Removes markers for stale items
   */
  protected updateData(items: TItem[]): void {
    if (!this.map) return;

    const newIds = new Set<string>();

    for (const item of items) {
      const id = this.getMarkerId(item);
      newIds.add(id);

      if (this.markers.has(id)) {
        // Update existing marker
        this.updateMarkerElement(this.markers.get(id)!, item);
      } else {
        // Add new marker
        const el = this.buildMarkerElement(item);
        if (!el) continue;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(this.getMarkerCoords(item))
          .addTo(this.map);

        this.markers.set(id, marker);
      }
    }

    // Remove stale markers
    for (const [id, marker] of this.markers) {
      if (!newIds.has(id)) {
        marker.remove();
        this.markers.delete(id);
      }
    }
  }

  /**
   * updateVisibility: show or hide all DOM markers.
   */
  protected updateVisibility(visible: boolean): void {
    const display = visible ? '' : 'none';
    this.markers.forEach((marker) => {
      marker.getElement().style.display = display;
    });
  }
}

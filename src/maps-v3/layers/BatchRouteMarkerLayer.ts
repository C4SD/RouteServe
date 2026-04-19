/**
 * BatchRouteMarkerLayer - Sandbox-style DOM markers for active batch route
 *
 * Renders:
 * - Zone/warehouse center: 40px blue "Z" circle with pulsing ring shadow
 * - Delivery facilities: 26px circles, emerald when "in route", gray otherwise
 *   with visit sequence number and focus-mode support
 *
 * Registered dynamically (not at boot) — added when a batch is selected,
 * removed when deselected.
 */

import maplibregl from 'maplibre-gl';
import { DomMarkerLayer } from './DomMarkerLayer';

export interface BatchRouteFacility {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lga?: string;
  isSelected: boolean;
  visitIndex?: number;
}

export interface BatchRouteMarkerData {
  facilities: BatchRouteFacility[];
  /** Warehouse or zone center — gets the "Z" marker */
  depot: { lat: number; lng: number; name: string } | null;
  focusMode: boolean;
}

// Internal unified item type for DomMarkerLayer
type MarkerItem =
  | { kind: 'depot'; lat: number; lng: number; name: string }
  | ({ kind: 'facility' } & BatchRouteFacility);

/** Inject the pulsing ring CSS animation once into the document */
function ensurePulseStyle(): void {
  if (document.getElementById('batch-route-marker-pulse')) return;
  const style = document.createElement('style');
  style.id = 'batch-route-marker-pulse';
  style.textContent = `
    @keyframes zone-marker-pulse {
      0%, 100% { box-shadow: 0 0 0 6px rgba(59,130,246,0.25), 0 2px 8px rgba(0,0,0,0.3); }
      50%       { box-shadow: 0 0 0 6px rgba(59,130,246,0.05), 0 2px 8px rgba(0,0,0,0.15); }
    }
    .batch-depot-marker {
      animation: zone-marker-pulse 2s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
}

export class BatchRouteMarkerLayer extends DomMarkerLayer<MarkerItem> {
  private currentData: BatchRouteMarkerData | null = null;

  get layerId(): string {
    return 'batch-route-markers';
  }

  protected getMarkerId(item: MarkerItem): string {
    return item.kind === 'depot' ? '__depot__' : item.id;
  }

  protected getMarkerCoords(item: MarkerItem): [number, number] {
    return [item.lng, item.lat];
  }

  protected buildMarkerElement(item: MarkerItem): HTMLElement | null {
    if (item.kind === 'depot') {
      return this.buildDepotElement(item.name);
    }
    return this.buildFacilityElement(item);
  }

  private buildDepotElement(name: string): HTMLElement {
    ensurePulseStyle();
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'cursor:pointer;width:40px;height:40px;';
    wrapper.innerHTML = `
      <div class="batch-depot-marker" title="${name}" style="
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

  private buildFacilityElement(f: BatchRouteFacility): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'cursor:pointer;width:26px;height:26px;';
    wrapper.style.transition = 'transform 120ms ease';

    const bg = f.isSelected ? '#10b981' : '#6b7280';
    const border = f.isSelected ? '#059669' : '#9ca3af';
    const opacity = f.isSelected ? '1' : '0.35';
    const label = f.visitIndex != null ? String(f.visitIndex) : '';

    wrapper.innerHTML = `
      <div data-marker-inner="true" style="
        width:26px;height:26px;
        background:${bg};
        border:2px solid ${border};
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 6px rgba(0,0,0,0.25);
        color:white;font-size:11px;font-weight:700;
        opacity:${opacity};
        transition:opacity 120ms ease;
      " title="${f.name}">${label}</div>
    `;

    wrapper.addEventListener('mouseenter', () => {
      wrapper.style.transform = 'scale(1.08)';
    });
    wrapper.addEventListener('mouseleave', () => {
      wrapper.style.transform = 'scale(1)';
    });

    return wrapper;
  }

  /**
   * Accept the full BatchRouteMarkerData and flatten into MarkerItems for DomMarkerLayer.
   */
  updateBatch(data: BatchRouteMarkerData): void {
    this.currentData = data;
    const items: MarkerItem[] = [];

    if (data.depot) {
      items.push({ kind: 'depot', ...data.depot });
    }

    for (const f of data.facilities) {
      // In focus mode skip unselected facilities
      if (data.focusMode && !f.isSelected) continue;
      items.push({ kind: 'facility', ...f });
    }

    this.update(items);
  }
}

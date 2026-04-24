/**
 * Core type definitions for maps-v3 Live Map system
 */

export interface MapKernelEvents {
  onReady?: () => void;
  onError?: (error: Error) => void;
  onEntityClick?: (entityId: string, entityType: EntityType) => void;
  onEntityHover?: (entityId: string | null, entityType: EntityType | null) => void;
}

export type EntityType = 'driver' | 'vehicle' | 'delivery';

import type { StyleSpecification } from 'maplibre-gl';

export interface MapOptions {
  container: HTMLElement;
  center?: [number, number];
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  /** Inline StyleSpecification or URL; falls back to getBasemapStyle() */
  style?: string | StyleSpecification;
}

export interface LayerOptions {
  visible?: boolean;
  interactive?: boolean;
}

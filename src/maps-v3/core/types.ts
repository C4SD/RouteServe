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

export interface MapOptions {
  container: HTMLElement;
  center?: [number, number];
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  /** CARTO GL style URL from workspace settings; falls back to getBasemapStyle() */
  style?: string;
}

export interface LayerOptions {
  visible?: boolean;
  interactive?: boolean;
}

/**
 * Basemap style configuration for Live Map
 * Delegates to CARTO GL vector styles (free, no API key required).
 * Returns a style URL string accepted by MapLibre's `style` option.
 */

import { getMapLibreStyle } from '@/lib/mapConfig';

export type BasemapTheme = 'light' | 'dark' | 'system';

/**
 * Get the CARTO GL basemap style URL for the given theme.
 * - 'light'  → CARTO Positron (clean light map with full place labels)
 * - 'dark'   → CARTO Dark Matter
 * - 'system' / undefined → follows window.matchMedia prefers-color-scheme
 */
export function getBasemapStyle(theme?: BasemapTheme): string {
  return getMapLibreStyle(theme as 'light' | 'dark' | 'system' | undefined);
}

/**
 * Basemap style configuration for Live Map
 *
 * Returns an OpenFreeMap vector style URL (free, no API key required).
 * MapLibre fetches the style JSON which includes tile sources, sprites,
 * glyphs, and layers — no inline configuration needed.
 *
 * Available themes:
 *   light   → OpenFreeMap Positron (clean light map)
 *   dark    → OpenFreeMap Fiord
 *   streets → OpenFreeMap Liberty (detailed streets)
 *   auto    → follows window.matchMedia prefers-color-scheme
 */

import { getMapLibreStyle } from '@/lib/mapConfig';

export type BasemapTheme = 'light' | 'dark' | 'streets' | 'auto';

/**
 * Return an OpenFreeMap style URL for the given theme.
 * MapLibre accepts a URL string directly as its `style` option.
 */
export function getBasemapStyle(theme?: BasemapTheme): string {
  if (!theme || theme === 'auto') {
    const dark =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    return getMapLibreStyle(dark ? 'dark' : 'light');
  }
  return getMapLibreStyle(theme as 'light' | 'dark' | 'streets');
}

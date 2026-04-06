export const MAP_CONFIG = {
  defaultCenter: [12.0, 8.5] as [number, number],
  defaultZoom: 6,
  maxZoom: 19,

  tileProviders: {
    standard: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
    humanitarian: {
      url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/">Humanitarian OpenStreetMap Team</a>',
    },
    cartoLight: {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    cartoDark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },

  leafletOptions: {
    zoomControl: false,
    zoomAnimation: false,
    fadeAnimation: false,
    markerZoomAnimation: false,
    inertia: false,
    preferCanvas: true,
  },

  /**
   * MapLibre GL JS style URLs
   * Theme-aware basemap styles for vector rendering
   * Using OpenFreeMap (https://openfreemap.org) — free, no API key required.
   */
  mapLibreStyles: {
    light: 'https://tiles.openfreemap.org/styles/positron',
    dark: 'https://tiles.openfreemap.org/styles/fiord',
  },
} as const;

export type TileProvider = keyof typeof MAP_CONFIG.tileProviders;

/**
 * Get MapLibre GL JS style URL based on theme
 *
 * Automatically selects light or dark basemap style to match UI theme.
 * Ensures visual consistency between controls and map tiles.
 *
 * @param theme - Current theme ('light', 'dark', 'system', or undefined)
 * @returns MapLibre style URL for the effective theme
 */
export function getMapLibreStyle(theme: 'light' | 'dark' | 'system' | undefined): string {
  // Explicit light theme
  if (theme === 'light') {
    return MAP_CONFIG.mapLibreStyles.light;
  }

  // Explicit dark theme
  if (theme === 'dark') {
    return MAP_CONFIG.mapLibreStyles.dark;
  }

  // System theme - detect from window
  if (typeof window !== 'undefined') {
    const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return systemIsDark
      ? MAP_CONFIG.mapLibreStyles.dark
      : MAP_CONFIG.mapLibreStyles.light;
  }

  // SSR fallback - default to light
  return MAP_CONFIG.mapLibreStyles.light;
}

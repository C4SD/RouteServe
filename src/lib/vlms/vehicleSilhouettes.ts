/**
 * Vehicle Silhouette Asset Mapping
 * Maps vehicle category codes to their corresponding silhouette image paths
 */

export interface VehicleSilhouetteInfo {
  path: string;
  fallbackIcon: string; // Lucide icon name as fallback
  cargoHighlightPath?: string; // Optional cargo area highlight overlay
}

/**
 * Map of category codes to silhouette asset paths
 */
export const VEHICLE_SILHOUETTES: Record<string, VehicleSilhouetteInfo> = {
  // EU Categories
  L1: {
    path: '/assets/vehicles/silhouettes/L1.webp',
    fallbackIcon: 'bike',
  },
  L2: {
    path: '/assets/vehicles/silhouettes/L2.webp',
    fallbackIcon: 'bike',
  },
  M1: {
    path: '/assets/vehicles/silhouettes/M1.webp',
    fallbackIcon: 'car',
  },
  M2: {
    path: '/assets/vehicles/silhouettes/M2.webp',
    fallbackIcon: 'bus',
  },
  N1: {
    path: '/assets/vehicles/silhouettes/N1.webp',
    fallbackIcon: 'truck',
  },
  N2: {
    path: '/assets/vehicles/silhouettes/N2.webp',
    fallbackIcon: 'truck',
  },
  N3: {
    path: '/assets/vehicles/silhouettes/N3.webp',
    fallbackIcon: 'truck',
  },

  // RouteServe Shortcuts
  BIKO_MINIVAN: {
    path: '/assets/vehicles/silhouettes/BIKO_MINIVAN.webp',
    fallbackIcon: 'van',
  },
  BIKO_KEKE: {
    path: '/assets/vehicles/silhouettes/BIKO_KEKE.webp',
    fallbackIcon: 'bike',
  },
  BIKO_MOPED: {
    path: '/assets/vehicles/silhouettes/BIKO_MOPED.webp',
    fallbackIcon: 'bike',
  },
  BIKO_COLDCHAIN: {
    path: '/assets/vehicles/silhouettes/BIKO_COLDCHAIN.webp',
    fallbackIcon: 'snowflake',
  },
};

/**
 * Get silhouette info for a vehicle category
 */
export function getVehicleSilhouette(
  categoryCode: string | null | undefined
): VehicleSilhouetteInfo {
  const defaultSilhouette: VehicleSilhouetteInfo = {
    path: '/assets/vehicles/silhouettes/N1.webp',
    fallbackIcon: 'truck',
  };

  if (!categoryCode) return defaultSilhouette;

  return VEHICLE_SILHOUETTES[categoryCode] || defaultSilhouette;
}

/**
 * Check if silhouette image exists (client-side)
 * Returns a promise that resolves to true if image loads successfully
 */
export function checkSilhouetteExists(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = path;
  });
}

/**
 * Get cargo area dimensions as percentage of total vehicle length
 * Used for positioning cargo highlight overlay
 */
export function getCargoAreaDimensions(categoryCode: string): {
  offsetPercent: number; // From left edge
  widthPercent: number; // Of total length
} {
  const defaults = { offsetPercent: 40, widthPercent: 50 };

  const dimensions: Record<string, typeof defaults> = {
    L1: { offsetPercent: 0, widthPercent: 0 }, // Moped - cargo visible in image
    L2: { offsetPercent: 0, widthPercent: 0 }, // Motorcycle - cargo visible in image
    M1: { offsetPercent: 0, widthPercent: 0 }, // No cargo area
    M2: { offsetPercent: 0, widthPercent: 0 }, // Passenger only
    N1: { offsetPercent: 0, widthPercent: 0 }, // Box truck - cargo visible in image
    N2: { offsetPercent: 0, widthPercent: 0 }, // Medium truck - cargo visible in image
    N3: { offsetPercent: 0, widthPercent: 0 }, // Heavy truck - cargo visible in image
    BIKO_MINIVAN: { offsetPercent: 0, widthPercent: 0 }, // Passenger vehicle
    BIKO_KEKE: { offsetPercent: 0, widthPercent: 0 }, // Tricycle - cargo visible in image
    BIKO_MOPED: { offsetPercent: 0, widthPercent: 0 }, // Moped - cargo visible in image
    BIKO_COLDCHAIN: { offsetPercent: 0, widthPercent: 0 }, // Box truck - cargo visible in image
  };

  return dimensions[categoryCode] || defaults;
}

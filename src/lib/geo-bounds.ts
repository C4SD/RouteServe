/**
 * Geographic bounds validation for Nigeria.
 * Used to detect invalid/swapped facility coordinates during import and form entry.
 */

export interface BoundingBox {
  name: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export type CoordinateIssueType =
  | 'outside_nigeria'
  | 'outside_state'
  | 'likely_swapped';

export interface CoordinateIssue {
  type: CoordinateIssueType;
  message: string;
  suggestion?: string;
}

export const NIGERIA_BOUNDS: Omit<BoundingBox, 'name'> = {
  minLat: 4.3,
  maxLat: 13.9,
  minLng: 2.7,
  maxLng: 14.7,
};

/**
 * Bounding boxes for all 36 Nigerian states + FCT.
 * Keyed by state abbreviation (uppercase).
 */
export const NIGERIA_STATE_BOUNDS: Record<string, BoundingBox> = {
  AB: { name: 'Abia',              minLat: 4.7,  maxLat: 5.8,  minLng: 7.1, maxLng: 8.1  },
  AD: { name: 'Adamawa',           minLat: 7.8,  maxLat: 10.9, minLng: 11.5, maxLng: 13.7 },
  AK: { name: 'Akwa Ibom',         minLat: 4.5,  maxLat: 5.6,  minLng: 7.3,  maxLng: 8.5  },
  AN: { name: 'Anambra',           minLat: 5.7,  maxLat: 6.8,  minLng: 6.6,  maxLng: 7.3  },
  BA: { name: 'Bauchi',            minLat: 9.4,  maxLat: 12.3, minLng: 8.8,  maxLng: 11.5 },
  BY: { name: 'Bayelsa',           minLat: 4.2,  maxLat: 5.1,  minLng: 5.8,  maxLng: 6.9  },
  BE: { name: 'Benue',             minLat: 6.2,  maxLat: 8.2,  minLng: 7.7,  maxLng: 10.0 },
  BO: { name: 'Borno',             minLat: 10.0, maxLat: 13.9, minLng: 11.4, maxLng: 14.7 },
  CR: { name: 'Cross River',       minLat: 4.3,  maxLat: 7.2,  minLng: 7.8,  maxLng: 9.5  },
  DE: { name: 'Delta',             minLat: 5.0,  maxLat: 6.4,  minLng: 5.5,  maxLng: 6.9  },
  EB: { name: 'Ebonyi',            minLat: 5.7,  maxLat: 6.7,  minLng: 7.7,  maxLng: 8.6  },
  ED: { name: 'Edo',               minLat: 5.7,  maxLat: 7.4,  minLng: 5.3,  maxLng: 6.8  },
  EK: { name: 'Ekiti',             minLat: 7.2,  maxLat: 8.0,  minLng: 4.9,  maxLng: 5.9  },
  EN: { name: 'Enugu',             minLat: 5.9,  maxLat: 7.0,  minLng: 6.9,  maxLng: 8.0  },
  FC: { name: 'FCT Abuja',         minLat: 8.4,  maxLat: 9.3,  minLng: 6.7,  maxLng: 7.9  },
  GO: { name: 'Gombe',             minLat: 9.5,  maxLat: 11.2, minLng: 10.0, maxLng: 11.9 },
  IM: { name: 'Imo',               minLat: 5.1,  maxLat: 5.9,  minLng: 6.7,  maxLng: 7.5  },
  JI: { name: 'Jigawa',            minLat: 11.4, maxLat: 13.1, minLng: 8.6,  maxLng: 10.6 },
  KD: { name: 'Kaduna',            minLat: 9.2,  maxLat: 11.7, minLng: 6.9,  maxLng: 9.4  },
  KN: { name: 'Kano',              minLat: 11.2, maxLat: 13.0, minLng: 7.6,  maxLng: 9.4  },
  KT: { name: 'Katsina',           minLat: 11.5, maxLat: 13.5, minLng: 6.5,  maxLng: 9.2  },
  KE: { name: 'Kebbi',             minLat: 10.2, maxLat: 13.2, minLng: 3.3,  maxLng: 6.4  },
  KO: { name: 'Kogi',              minLat: 6.7,  maxLat: 9.0,  minLng: 5.8,  maxLng: 8.0  },
  KW: { name: 'Kwara',             minLat: 7.8,  maxLat: 10.2, minLng: 2.8,  maxLng: 6.5  },
  LA: { name: 'Lagos',             minLat: 6.3,  maxLat: 6.7,  minLng: 2.7,  maxLng: 3.7  },
  NA: { name: 'Nasarawa',          minLat: 7.7,  maxLat: 9.3,  minLng: 7.5,  maxLng: 9.6  },
  NI: { name: 'Niger',             minLat: 8.5,  maxLat: 12.0, minLng: 3.6,  maxLng: 7.7  },
  OG: { name: 'Ogun',              minLat: 6.4,  maxLat: 7.8,  minLng: 2.7,  maxLng: 4.2  },
  ON: { name: 'Ondo',              minLat: 5.7,  maxLat: 7.9,  minLng: 4.4,  maxLng: 6.1  },
  OS: { name: 'Osun',              minLat: 7.1,  maxLat: 8.1,  minLng: 4.2,  maxLng: 5.2  },
  OY: { name: 'Oyo',               minLat: 7.2,  maxLat: 9.2,  minLng: 2.8,  maxLng: 5.1  },
  PL: { name: 'Plateau',           minLat: 8.2,  maxLat: 10.4, minLng: 8.2,  maxLng: 10.4 },
  RI: { name: 'Rivers',            minLat: 4.3,  maxLat: 5.6,  minLng: 6.3,  maxLng: 7.5  },
  SO: { name: 'Sokoto',            minLat: 12.2, maxLat: 13.9, minLng: 4.0,  maxLng: 6.4  },
  TA: { name: 'Taraba',            minLat: 6.6,  maxLat: 9.4,  minLng: 9.5,  maxLng: 12.7 },
  YO: { name: 'Yobe',              minLat: 10.6, maxLat: 13.6, minLng: 10.5, maxLng: 13.4 },
  ZA: { name: 'Zamfara',           minLat: 11.2, maxLat: 13.3, minLng: 5.6,  maxLng: 7.5  },
};

/**
 * Look up state bounding box by common name variants (case-insensitive).
 * Handles full names like "Kaduna", "Kaduna State", or codes like "KD".
 */
export function getStateBounds(stateNameOrCode: string): BoundingBox | null {
  if (!stateNameOrCode) return null;
  const upper = stateNameOrCode.toUpperCase().replace(' STATE', '').trim();
  // Try direct code match
  if (NIGERIA_STATE_BOUNDS[upper]) return NIGERIA_STATE_BOUNDS[upper];
  // Try name match
  for (const bounds of Object.values(NIGERIA_STATE_BOUNDS)) {
    if (bounds.name.toUpperCase() === upper) return bounds;
  }
  return null;
}

function isInBox(lat: number, lng: number, box: Omit<BoundingBox, 'name'>): boolean {
  return lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng;
}

export function isWithinNigeria(lat: number, lng: number): boolean {
  return isInBox(lat, lng, NIGERIA_BOUNDS);
}

export function isWithinState(lat: number, lng: number, stateNameOrCode: string): boolean {
  const bounds = getStateBounds(stateNameOrCode);
  if (!bounds) return true; // unknown state → don't block
  return isInBox(lat, lng, bounds);
}

/**
 * Returns all coordinate issues for a given lat/lng.
 * Optionally checks against a specific state.
 *
 * Includes "likely_swapped" detection: if (lng, lat) is valid in Nigeria
 * but (lat, lng) is not, the coordinates are probably swapped.
 */
export function detectCoordinateIssues(
  lat: number,
  lng: number,
  stateNameOrCode?: string
): CoordinateIssue[] {
  const issues: CoordinateIssue[] = [];

  if (isNaN(lat) || isNaN(lng)) return issues;

  const withinNigeria = isWithinNigeria(lat, lng);

  if (!withinNigeria) {
    // Check if swapping would fix it
    const swappedWorks = isWithinNigeria(lng, lat);
    if (swappedWorks) {
      issues.push({
        type: 'likely_swapped',
        message: `Coordinates appear to be swapped (lat/lng reversed)`,
        suggestion: `Try lat=${lng.toFixed(6)}, lng=${lat.toFixed(6)}`,
      });
    } else {
      issues.push({
        type: 'outside_nigeria',
        message: `Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)}) are outside Nigeria`,
        suggestion: swappedWorks ? `Try swapping: lat=${lng.toFixed(4)}, lng=${lat.toFixed(4)}` : undefined,
      });
    }
    return issues; // no point checking state if outside Nigeria
  }

  if (stateNameOrCode && !isWithinState(lat, lng, stateNameOrCode)) {
    const bounds = getStateBounds(stateNameOrCode);
    issues.push({
      type: 'outside_state',
      message: bounds
        ? `Coordinates are outside ${bounds.name} State bounds`
        : `Coordinates are outside the expected state`,
    });
  }

  return issues;
}

/**
 * Returns a human-readable summary of coordinate issues, or null if valid.
 */
export function getCoordinateIssueSummary(issues: CoordinateIssue[]): string | null {
  if (issues.length === 0) return null;
  return issues.map((i) => i.message).join('; ');
}

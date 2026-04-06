/**
 * Overpass API Boundary Import
 *
 * Two-phase import:
 *  Phase 1 — fetch states/regions (admin_level 4) for a country. Fast (~40 results).
 *  Phase 2 — fetch districts/LGAs (admin_level 6) scoped to selected states only,
 *             one Overpass request per state to avoid 504 gateway timeouts.
 *
 * Names + metadata only (no full geometry) to keep payloads small.
 */

// Multiple mirrors — tried in order on 429/5xx errors
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

export interface BoundaryResult {
  osmId: number;
  name: string;
  nameEn?: string;
  adminLevel: number;
  isoCode?: string;
  parentName?: string;
  population?: number;
  center?: { lat: number; lng: number };
  tags: Record<string, string>;
}

export interface ImportProgress {
  status: 'idle' | 'fetching' | 'parsing' | 'saving' | 'complete' | 'error';
  message: string;
  progress: number;
  total?: number;
  imported?: number;
  error?: string;
}

/**
 * Known admin_level mappings per country.
 */
export const COUNTRY_ADMIN_LEVELS: Record<string, {
  states: number;
  districts: number;
  label_states: string;
  label_districts: string;
}> = {
  NG: { states: 4, districts: 6, label_states: 'States',    label_districts: 'LGAs' },
  GH: { states: 4, districts: 6, label_states: 'Regions',   label_districts: 'Districts' },
  KE: { states: 4, districts: 6, label_states: 'Counties',  label_districts: 'Sub-Counties' },
  TZ: { states: 4, districts: 6, label_states: 'Regions',   label_districts: 'Districts' },
  UG: { states: 4, districts: 5, label_states: 'Regions',   label_districts: 'Districts' },
  ZA: { states: 4, districts: 6, label_states: 'Provinces', label_districts: 'Municipalities' },
  ET: { states: 4, districts: 6, label_states: 'Regions',   label_districts: 'Zones' },
  RW: { states: 4, districts: 6, label_states: 'Provinces', label_districts: 'Districts' },
  IN: { states: 4, districts: 5, label_states: 'States',    label_districts: 'Districts' },
  PK: { states: 4, districts: 6, label_states: 'Provinces', label_districts: 'Districts' },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildCountryLevelQuery(isoCode: string, adminLevel: number, timeout = 180): string {
  return `[out:json][timeout:${timeout}];
area["ISO3166-1"="${isoCode}"]->.country;
(
  relation(area.country)["boundary"="administrative"]["admin_level"="${adminLevel}"];
);
out center tags;`;
}

/**
 * Query LGAs within a specific state, identified by its OSM relation ID.
 * Overpass area IDs for relations = osmId + 3600000000.
 */
function buildStateLevelQuery(stateOsmId: number, districtLevel: number, timeout = 180): string {
  const areaId = 3600000000 + stateOsmId;
  return `[out:json][timeout:${timeout}];
area(${areaId})->.state;
(
  relation(area.state)["boundary"="administrative"]["admin_level"="${districtLevel}"];
);
out center tags;`;
}

async function queryOverpass(query: string): Promise<any[]> {
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (response.status === 429 || response.status >= 500) {
        const text = await response.text();
        lastError = new Error(`Overpass API error (${response.status}): ${text.slice(0, 200)}`);
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Overpass API error (${response.status}): ${text.slice(0, 200)}`);
      }

      const json = await response.json();
      return json.elements || [];
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Overpass API error (4')) {
        throw err; // non-retryable client errors
      }
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error('All Overpass mirrors failed');
}

function parseElements(elements: any[], adminLevel: number): BoundaryResult[] {
  return elements
    .filter((el: any) => {
      const level = parseInt(el.tags?.admin_level || '0', 10);
      return el.type === 'relation' && level === adminLevel && el.tags?.name;
    })
    .map((el: any): BoundaryResult => ({
      osmId: el.id,
      name: el.tags.name,
      nameEn: el.tags['name:en'],
      adminLevel: parseInt(el.tags.admin_level, 10),
      isoCode: el.tags['ISO3166-2'] || undefined,
      parentName: el.tags['is_in:state'] || el.tags['is_in'] || undefined,
      population: el.tags.population ? parseInt(el.tags.population, 10) : undefined,
      center: el.center ? { lat: el.center.lat, lng: el.center.lon } : undefined,
      tags: el.tags,
    }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Phase 1 — fetch all states/regions for a country.
 * Fast query (~40 results for most countries).
 */
export async function fetchStatesFromOverpass(
  isoCode: string,
  stateLevel: number,
  onProgress?: (p: ImportProgress) => void
): Promise<BoundaryResult[]> {
  onProgress?.({ status: 'fetching', message: `Fetching states for ${isoCode}...`, progress: 10 });

  const elements = await queryOverpass(buildCountryLevelQuery(isoCode, stateLevel));
  const boundaries = parseElements(elements, stateLevel);

  onProgress?.({
    status: 'parsing',
    message: `Found ${boundaries.length} states`,
    progress: 80,
    total: boundaries.length,
  });

  return boundaries;
}

/**
 * Phase 2 — fetch districts/LGAs for a specific set of states.
 *
 * One Overpass request per state to avoid 504 timeouts on large countries.
 * States must have their OSM relation ID (osmId) populated.
 *
 * @param states        - State boundaries (must have osmId)
 * @param districtLevel - admin_level for districts (e.g. 6)
 * @param onProgress    - Progress callback
 */
export async function fetchDistrictsForStates(
  states: Pick<BoundaryResult, 'osmId' | 'name'>[],
  districtLevel: number,
  onProgress?: (p: ImportProgress) => void
): Promise<BoundaryResult[]> {
  const all: BoundaryResult[] = [];

  for (let i = 0; i < states.length; i++) {
    const state = states[i];
    const pct = 10 + Math.round((i / states.length) * 70);

    onProgress?.({
      status: 'fetching',
      message: `Fetching districts for ${state.name} (${i + 1}/${states.length})...`,
      progress: pct,
    });

    const query = buildStateLevelQuery(state.osmId, districtLevel);
    const elements = await queryOverpass(query);
    const boundaries = parseElements(elements, districtLevel);
    all.push(...boundaries);

    onProgress?.({
      status: 'fetching',
      message: `${state.name}: ${boundaries.length} districts found`,
      progress: pct + Math.round(70 / states.length),
      total: all.length,
    });
  }

  onProgress?.({
    status: 'parsing',
    message: `Found ${all.length} districts total`,
    progress: 82,
    total: all.length,
  });

  return all;
}

/**
 * Save imported boundaries to the admin_units table using batch upsert.
 * Requires unique index on (osm_id, country_id) — migration 20260404000001.
 */
export async function saveBoundariesToDB(
  supabase: any,
  boundaries: BoundaryResult[],
  countryId: string,
  workspaceId: string,
  onProgress?: (p: ImportProgress) => void
): Promise<number> {
  const total = boundaries.length;

  onProgress?.({ status: 'saving', message: `Saving ${total} boundaries...`, progress: 85, total, imported: 0 });

  let imported = 0;
  const batchSize = 100;

  for (let i = 0; i < total; i += batchSize) {
    const batch = boundaries.slice(i, i + batchSize);

    const rows = batch.map((b) => ({
      name: b.name,
      name_en: b.nameEn || b.name,
      admin_level: b.adminLevel,
      country_id: countryId,
      workspace_id: workspaceId,
      osm_id: b.osmId,
      osm_type: 'relation' as const,
      population: b.population || null,
      is_active: true,
      metadata: { iso_code: b.isoCode, parent_name: b.parentName },
    }));

    const { error, count } = await supabase
      .from('admin_units')
      .upsert(rows, { onConflict: 'osm_id,country_id', count: 'exact' });

    if (error) {
      console.error('[overpass-boundaries] Upsert error:', error.message, error.details);
      throw new Error(`Failed to save boundaries: ${error.message}`);
    }

    imported += count ?? batch.length;

    onProgress?.({
      status: 'saving',
      message: `Saved ${imported} of ${total} boundaries...`,
      progress: 85 + Math.round((imported / total) * 15),
      total,
      imported,
    });
  }

  onProgress?.({ status: 'complete', message: `Import complete: ${imported} saved`, progress: 100, total, imported });

  return imported;
}

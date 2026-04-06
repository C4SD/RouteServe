/**
 * NHTSA vPIC API hooks for vehicle make/model lookup and VIN decoding
 * API docs: https://vpic.nhtsa.dot.gov/api/
 * No API key required.
 */

import { useState, useEffect, useCallback } from 'react';

const NHTSA_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles';

// ── Module-level cache so makes are fetched only once per page session ─────
let _makesCache: string[] | null = null;
let _makesCachePromise: Promise<string[]> | null = null;

async function getAllMakesCached(): Promise<string[]> {
  if (_makesCache) return _makesCache;
  if (!_makesCachePromise) {
    _makesCachePromise = fetch(`${NHTSA_BASE}/GetAllMakes?format=json`)
      .then((r) => {
        if (!r.ok) throw new Error('NHTSA makes request failed');
        return r.json();
      })
      .then((data) => {
        const makes: string[] = (data.Results as { Make_Name: string }[])
          .map((m) => m.Make_Name)
          .sort();
        _makesCache = makes;
        return makes;
      })
      .catch(() => {
        _makesCachePromise = null; // allow retry
        return [];
      });
  }
  return _makesCachePromise;
}

// ── Make autocomplete ───────────────────────────────────────────────────────

/**
 * Returns makes matching `query` (min 2 chars), filtered client-side from
 * the cached NHTSA all-makes list (~11 k entries, fetched once).
 */
export function useNHTSAMakes(query: string) {
  const [makes, setMakes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) {
      setMakes([]);
      return;
    }
    setIsLoading(true);
    getAllMakesCached().then((allMakes) => {
      const lower = query.toLowerCase();
      setMakes(allMakes.filter((m) => m.toLowerCase().startsWith(lower)).slice(0, 12));
      setIsLoading(false);
    });
  }, [query]);

  return { makes, isLoading };
}

// ── Model lookup ────────────────────────────────────────────────────────────

/**
 * Returns models for the given make (+ optional year) from NHTSA.
 * Fetches when `make` has ≥ 2 chars; re-fetches when make or year changes.
 */
export function useNHTSAModels(make: string, year?: number) {
  const [models, setModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!make || make.trim().length < 2) {
      setModels([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const url =
      year && year > 1900
        ? `${NHTSA_BASE}/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`
        : `${NHTSA_BASE}/GetModelsForMake/${encodeURIComponent(make)}?format=json`;

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error('NHTSA models request failed');
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const modelNames: string[] = [
          ...new Set(
            (data.Results as { Model_Name: string }[]).map((m) => m.Model_Name)
          ),
        ].sort();
        setModels(modelNames);
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [make, year]);

  return { models, isLoading };
}

// ── VIN decoder ─────────────────────────────────────────────────────────────

export interface VehicleVinInfo {
  make?: string;
  model?: string;
  year?: number;
  fuel_type?: 'gasoline' | 'diesel' | 'electric' | 'hybrid' | 'cng' | 'lpg';
  engine_capacity?: number; // in cc (NHTSA gives litres × 1000)
}

function mapNHTSAFuel(
  raw?: string,
): VehicleVinInfo['fuel_type'] | undefined {
  if (!raw) return undefined;
  const f = raw.toLowerCase();
  if (f.includes('gasoline') && f.includes('electric')) return 'hybrid';
  if (f.includes('gasoline') || f.includes('gas')) return 'gasoline';
  if (f.includes('diesel')) return 'diesel';
  if (f.includes('electric')) return 'electric';
  if (f.includes('cng') || f.includes('natural gas')) return 'cng';
  if (f.includes('lpg') || f.includes('propane')) return 'lpg';
  return undefined;
}

/**
 * Returns a `decodeVin` callback. Call it with a 17-char VIN to get
 * make / model / year / fuel_type / engine_capacity.
 */
export function useVINDecoder() {
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  const decodeVin = useCallback(
    async (vin: string): Promise<VehicleVinInfo | null> => {
      if (!vin || vin.length !== 17) return null;

      setIsDecoding(true);
      setDecodeError(null);

      try {
        const res = await fetch(
          `${NHTSA_BASE}/DecodeVin/${encodeURIComponent(vin)}?format=json`,
        );
        if (!res.ok) throw new Error('NHTSA VIN decode failed');

        const data = await res.json();
        const results: { Variable: string; Value: string | null }[] = data.Results;

        const get = (varName: string) =>
          results.find((r) => r.Variable === varName)?.Value ?? undefined;

        const yearStr = get('Model Year');
        const dispL = get('Displacement (L)');

        return {
          make: get('Make') || undefined,
          model: get('Model') || undefined,
          year: yearStr ? parseInt(yearStr) || undefined : undefined,
          fuel_type: mapNHTSAFuel(get('Fuel Type - Primary')),
          engine_capacity: dispL
            ? Math.round(parseFloat(dispL) * 1000) || undefined
            : undefined,
        };
      } catch {
        setDecodeError('Could not decode VIN — check the number and try again');
        return null;
      } finally {
        setIsDecoding(false);
      }
    },
    [],
  );

  return { decodeVin, isDecoding, decodeError };
}

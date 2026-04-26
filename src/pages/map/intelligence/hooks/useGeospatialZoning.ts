import { useState, useCallback, useRef } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { OperationalZone, LGA } from '@/types/zones';
import type { ConflictInfo, ConflictMode, AssignedLgaMap } from '@/services/zoningService';
import {
  loadZonesWithAssignments,
  createZone as svcCreateZone,
  assignBoundariesToZone,
  removeBoundariesFromZone,
  deleteZone as svcDeleteZone,
  detectConflicts,
} from '@/services/zoningService';

export interface BoundaryFeature {
  type: 'Feature';
  properties: {
    id: string;        // unique boundary ID, e.g. "ng_kano_nassarawa"
    name: string;      // display name
    level: 'state' | 'lga';
    parent_id: string; // state ID for LGAs
    country_id: string;
    state: string;     // state name (for LGAs)
  };
  geometry: GeoJSON.Geometry;
}

export interface BoundaryCollection {
  type: 'FeatureCollection';
  features: BoundaryFeature[];
}

export interface PendingConflict {
  conflicts: ConflictInfo[];
  targetZoneId: string;
  features: { boundaryId: string; name: string; state: string }[];
  resolve: (mode: ConflictMode) => void;
}

export type ZoningEditMode = 'select' | 'add-to-zone' | 'remove-from-zone';

export interface ZoningState {
  // LGA IDs (boundary_id) currently selected — always LGA level
  selectedLgaIds: string[];
  // DB-derived: boundaryId → zone_id (rebuilt after every mutation)
  assignedMap: AssignedLgaMap;
  zones: OperationalZone[];
  lgas: LGA[];
  // Loaded boundary data
  stateFeatures: BoundaryFeature[];
  lgaFeatures: BoundaryFeature[];
  // LGA IDs grouped by state boundary ID
  lgasByState: Record<string, string[]>;
  // Which zone is being edited (add/remove mode)
  editingZoneId: string | null;
  editMode: ZoningEditMode;
  isLoading: boolean;
  isMutating: boolean;
  pendingConflict: PendingConflict | null;
  error: string | null;
}

const ZONE_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#d97706',
  '#7c3aed', '#0891b2', '#be185d', '#65a30d',
];

export function nextZoneColor(existingZones: OperationalZone[]): string {
  return ZONE_COLORS[existingZones.length % ZONE_COLORS.length];
}

const BOUNDARY_INDEX_URL = '/boundaries/index.json';

interface BoundaryCountry {
  id: string;
  name: string;
  center: [number, number];
  zoom: number;
  levels: string[];
  sources: { state: string | null; lga: string | null };
  stateProperty: string;
  lgaProperty: string;
  stateIdProperty: string;
  lgaIdProperty: string;
}

// Spatial helpers for building state→LGA grouping when sources lack parent IDs
function _approxCentroid(geometry: GeoJSON.Geometry): [number, number] | null {
  let ring: GeoJSON.Position[] | undefined;
  if (geometry.type === 'Polygon') ring = geometry.coordinates[0];
  else if (geometry.type === 'MultiPolygon') ring = geometry.coordinates[0]?.[0];
  if (!ring?.length) return null;
  return [
    ring.reduce((s, c) => s + c[0], 0) / ring.length,
    ring.reduce((s, c) => s + c[1], 0) / ring.length,
  ];
}

function _pointInRing(point: [number, number], ring: GeoJSON.Position[]): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function _geomContainsPoint(geom: GeoJSON.Geometry, pt: [number, number]): boolean {
  const rings: GeoJSON.Position[][] =
    geom.type === 'Polygon' ? [geom.coordinates[0]] :
    geom.type === 'MultiPolygon' ? geom.coordinates.map((p) => p[0]) : [];
  return rings.some((r) => _pointInRing(pt, r));
}

function normalizeToBoundaryFeatures(
  raw: any,
  country: BoundaryCountry,
  level: 'state' | 'lga',
): BoundaryFeature[] {
  if (raw?.type !== 'FeatureCollection') return [];

  return (raw.features ?? []).map((f: any, idx: number) => {
    const props = f.properties ?? {};
    const nameKey = level === 'state' ? country.stateProperty : country.lgaProperty;
    const idKey = level === 'state' ? country.stateIdProperty : country.lgaIdProperty;
    const name: string = props[nameKey] ?? props.name ?? props.NAME ?? `Unknown ${idx}`;
    const rawId: string = props[idKey] ?? props.id ?? '';
    const boundaryId = rawId
      ? `${country.id}_${rawId.toLowerCase().replace(/\./g, '_').replace(/\s+/g, '_')}`
      : `${country.id}_${level}_${idx}`;
    const stateName: string = level === 'lga' ? (props[country.stateProperty] ?? '') : name;

    return {
      type: 'Feature' as const,
      properties: {
        id: boundaryId,
        name,
        level,
        parent_id: country.id,   // placeholder — corrected spatially after load
        country_id: country.id,
        state: stateName,
      },
      geometry: f.geometry,
    } as BoundaryFeature;
  });
}

export function useGeospatialZoning() {
  const { workspaceId } = useWorkspace();
  const [state, setState] = useState<ZoningState>({
    selectedLgaIds: [],
    assignedMap: {},
    zones: [],
    lgas: [],
    stateFeatures: [],
    lgaFeatures: [],
    lgasByState: {},
    editingZoneId: null,
    editMode: 'select',
    isLoading: false,
    isMutating: false,
    pendingConflict: null,
    error: null,
  });

  const loadedRef = useRef(false);

  // ── Load everything from DB + boundaries ─────────────────────────────────
  const initialize = useCallback(async (countryId = 'ng') => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      // Load boundary index
      const indexRes = await fetch(BOUNDARY_INDEX_URL);
      const index = await indexRes.json();
      const country: BoundaryCountry | undefined = index.countries.find(
        (c: BoundaryCountry) => c.id === countryId,
      );

      let stateFeatures: BoundaryFeature[] = [];
      let lgaFeatures: BoundaryFeature[] = [];

      if (country) {
        const fetches = await Promise.allSettled([
          country.sources.state ? fetch(country.sources.state).then((r) => r.json()) : Promise.resolve(null),
          country.sources.lga ? fetch(country.sources.lga).then((r) => r.json()) : Promise.resolve(null),
        ]);

        const stateRaw = fetches[0].status === 'fulfilled' ? fetches[0].value : null;
        const lgaRaw = fetches[1].status === 'fulfilled' ? fetches[1].value : null;

        if (stateRaw) stateFeatures = normalizeToBoundaryFeatures(stateRaw, country, 'state');
        if (lgaRaw) lgaFeatures = normalizeToBoundaryFeatures(lgaRaw, country, 'lga');
      }

      // Build lgasByState via point-in-polygon (sources lack embedded parent IDs)
      const lgasByState: Record<string, string[]> = {};
      const lgaToState: Record<string, string> = {};
      for (const lga of lgaFeatures) {
        const centroid = _approxCentroid(lga.geometry);
        if (!centroid) continue;
        for (const state of stateFeatures) {
          if (_geomContainsPoint(state.geometry, centroid)) {
            const sid = state.properties.id;
            (lgasByState[sid] ??= []).push(lga.properties.id);
            lgaToState[lga.properties.id] = sid;
            break;
          }
        }
      }
      // Patch parent_id on LGA features so shift-click works
      const linkedLgaFeatures = lgaFeatures.map((f) =>
        lgaToState[f.properties.id]
          ? { ...f, properties: { ...f.properties, parent_id: lgaToState[f.properties.id] } }
          : f,
      );

      // Load DB state
      const { zones, assignedMap, lgas } = await loadZonesWithAssignments(workspaceId!);

      setState((s) => ({
        ...s,
        isLoading: false,
        stateFeatures,
        lgaFeatures: linkedLgaFeatures,
        lgasByState,
        zones,
        assignedMap,
        lgas,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load zoning data',
      }));
      loadedRef.current = false;
    }
  }, []);

  const refreshFromDb = useCallback(async () => {
    try {
      const { zones, assignedMap, lgas } = await loadZonesWithAssignments(workspaceId!);
      setState((s) => ({ ...s, zones, assignedMap, lgas }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'Failed to refresh zoning data',
      }));
    }
  }, []);

  // ── Selection ─────────────────────────────────────────────────────────────
  const toggleLga = useCallback((lgaId: string) => {
    setState((s) => ({
      ...s,
      selectedLgaIds: s.selectedLgaIds.includes(lgaId)
        ? s.selectedLgaIds.filter((id) => id !== lgaId)
        : [...s.selectedLgaIds, lgaId],
    }));
  }, []);

  const toggleState = useCallback((stateId: string) => {
    setState((s) => {
      const lgaIds = s.lgasByState[stateId] ?? [];
      if (lgaIds.length === 0) return s;
      const allSelected = lgaIds.every((id) => s.selectedLgaIds.includes(id));
      return {
        ...s,
        selectedLgaIds: allSelected
          ? s.selectedLgaIds.filter((id) => !lgaIds.includes(id))
          : [...new Set([...s.selectedLgaIds, ...lgaIds])],
      };
    });
  }, []);

  const clearSelection = useCallback(() => {
    setState((s) => ({ ...s, selectedLgaIds: [] }));
  }, []);

  // ── Zone CRUD ─────────────────────────────────────────────────────────────
  const createZone = useCallback(async (name: string, color: string): Promise<OperationalZone | null> => {
    setState((s) => ({ ...s, isMutating: true, error: null }));
    try {
      const zone = await svcCreateZone(name, color);
      await refreshFromDb();
      setState((s) => ({ ...s, isMutating: false }));
      return zone;
    } catch (err) {
      setState((s) => ({
        ...s,
        isMutating: false,
        error: err instanceof Error ? err.message : 'Failed to create zone',
      }));
      return null;
    }
  }, [refreshFromDb]);

  const resolveConflictAndAssign = useCallback(
    (
      targetZoneId: string,
      features: { boundaryId: string; name: string; state: string }[],
    ) => {
      return new Promise<void>((resolve) => {
        setState((s) => ({
          ...s,
          pendingConflict: {
            conflicts: [],
            targetZoneId,
            features,
            resolve: async (mode: ConflictMode) => {
              setState((ss) => ({ ...ss, pendingConflict: null }));
              if (mode === 'cancel') { resolve(); return; }
              setState((ss) => ({ ...ss, isMutating: true }));
              try {
                await assignBoundariesToZone(targetZoneId, features, mode);
                await refreshFromDb();
              } catch (err) {
                setState((ss) => ({
                  ...ss,
                  error: err instanceof Error ? err.message : 'Assignment failed',
                }));
              } finally {
                setState((ss) => ({ ...ss, isMutating: false }));
                resolve();
              }
            },
          },
        }));
      });
    },
    [refreshFromDb],
  );

  const assignSelectionToZone = useCallback(
    async (targetZoneId: string) => {
      setState((s) => {
        const selectedLgaIds = s.selectedLgaIds;
        const features = selectedLgaIds
          .map((id) => s.lgaFeatures.find((f) => f.properties.id === id))
          .filter(Boolean)
          .map((f) => ({
            boundaryId: f!.properties.id,
            name: f!.properties.name,
            state: f!.properties.state,
          }));

        if (features.length === 0) return s;

        // Fire async logic outside state setter
        (async () => {
          const conflicts = await detectConflicts(features, targetZoneId, s.zones);
          if (conflicts.length > 0) {
            setState((ss) => ({
              ...ss,
              pendingConflict: {
                conflicts,
                targetZoneId,
                features,
                resolve: async (mode: ConflictMode) => {
                  setState((sss) => ({ ...sss, pendingConflict: null }));
                  if (mode === 'cancel') return;
                  setState((sss) => ({ ...sss, isMutating: true }));
                  try {
                    await assignBoundariesToZone(targetZoneId, features, mode);
                    await refreshFromDb();
                  } catch (err) {
                    setState((sss) => ({
                      ...sss,
                      error: err instanceof Error ? err.message : 'Assignment failed',
                    }));
                  } finally {
                    setState((sss) => ({ ...sss, isMutating: false, selectedLgaIds: [] }));
                  }
                },
              },
            }));
          } else {
            setState((ss) => ({ ...ss, isMutating: true }));
            try {
              await assignBoundariesToZone(targetZoneId, features, 'reassign');
              await refreshFromDb();
              setState((ss) => ({ ...ss, isMutating: false, selectedLgaIds: [] }));
            } catch (err) {
              setState((ss) => ({
                ...ss,
                isMutating: false,
                error: err instanceof Error ? err.message : 'Assignment failed',
              }));
            }
          }
        })();

        return s;
      });
    },
    [refreshFromDb],
  );

  const enterAddMode = useCallback((zoneId: string) => {
    setState((s) => ({ ...s, editingZoneId: zoneId, editMode: 'add-to-zone', selectedLgaIds: [] }));
  }, []);

  const enterRemoveMode = useCallback((zoneId: string) => {
    setState((s) => ({ ...s, editingZoneId: zoneId, editMode: 'remove-from-zone', selectedLgaIds: [] }));
  }, []);

  const exitEditMode = useCallback(() => {
    setState((s) => ({ ...s, editingZoneId: null, editMode: 'select', selectedLgaIds: [] }));
  }, []);

  const commitEditModeSelection = useCallback(async () => {
    setState((s) => {
      const { editMode, editingZoneId, selectedLgaIds, lgaFeatures, zones } = s;
      if (!editingZoneId || selectedLgaIds.length === 0) return s;

      const features = selectedLgaIds
        .map((id) => lgaFeatures.find((f) => f.properties.id === id))
        .filter(Boolean)
        .map((f) => ({
          boundaryId: f!.properties.id,
          name: f!.properties.name,
          state: f!.properties.state,
        }));

      (async () => {
        setState((ss) => ({ ...ss, isMutating: true }));
        try {
          if (editMode === 'add-to-zone') {
            const conflicts = await detectConflicts(features, editingZoneId, zones);
            if (conflicts.length > 0) {
              setState((ss) => ({
                ...ss,
                isMutating: false,
                pendingConflict: {
                  conflicts,
                  targetZoneId: editingZoneId,
                  features,
                  resolve: async (mode: ConflictMode) => {
                    setState((sss) => ({ ...sss, pendingConflict: null }));
                    if (mode === 'cancel') return;
                    setState((sss) => ({ ...sss, isMutating: true }));
                    await assignBoundariesToZone(editingZoneId, features, mode);
                    await refreshFromDb();
                    setState((sss) => ({ ...sss, isMutating: false, selectedLgaIds: [], editMode: 'select', editingZoneId: null }));
                  },
                },
              }));
            } else {
              await assignBoundariesToZone(editingZoneId, features, 'reassign');
              await refreshFromDb();
              setState((ss) => ({ ...ss, isMutating: false, selectedLgaIds: [], editMode: 'select', editingZoneId: null }));
            }
          } else if (editMode === 'remove-from-zone') {
            await removeBoundariesFromZone(selectedLgaIds);
            await refreshFromDb();
            setState((ss) => ({ ...ss, isMutating: false, selectedLgaIds: [], editMode: 'select', editingZoneId: null }));
          }
        } catch (err) {
          setState((ss) => ({
            ...ss,
            isMutating: false,
            error: err instanceof Error ? err.message : 'Edit failed',
          }));
        }
      })();

      return s;
    });
  }, [refreshFromDb]);

  const deleteZone = useCallback(async (zoneId: string) => {
    setState((s) => ({ ...s, isMutating: true, error: null }));
    try {
      await svcDeleteZone(zoneId);
      await refreshFromDb();
      setState((s) => ({ ...s, isMutating: false }));
    } catch (err) {
      setState((s) => ({
        ...s,
        isMutating: false,
        error: err instanceof Error ? err.message : 'Failed to delete zone',
      }));
    }
  }, [refreshFromDb]);

  const dismissPendingConflict = useCallback(() => {
    setState((s) => ({ ...s, pendingConflict: null }));
  }, []);

  // Derived: get LGA count for a zone
  const getZoneLgaCount = useCallback((zoneId: string, assignedMap: AssignedLgaMap): number => {
    return Object.values(assignedMap).filter((z) => z === zoneId).length;
  }, []);

  // Derived: get boundary IDs assigned to a zone
  const getZoneBoundaryIds = useCallback((zoneId: string, assignedMap: AssignedLgaMap): string[] => {
    return Object.entries(assignedMap)
      .filter(([, z]) => z === zoneId)
      .map(([id]) => id);
  }, []);

  return {
    ...state,
    initialize,
    refreshFromDb,
    toggleLga,
    toggleState,
    clearSelection,
    createZone,
    assignSelectionToZone,
    enterAddMode,
    enterRemoveMode,
    exitEditMode,
    commitEditModeSelection,
    deleteZone,
    dismissPendingConflict,
    getZoneLgaCount,
    getZoneBoundaryIds,
    nextColor: () => nextZoneColor(state.zones),
  };
}

export type UseGeospatialZoningReturn = ReturnType<typeof useGeospatialZoning>;

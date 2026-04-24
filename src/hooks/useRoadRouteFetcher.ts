/**
 * Hook to fetch real road routes (Geoapify + OSRM fallback).
 * Extracted from SandboxRouteBuilder for reuse in batch views.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getRoadRoute,
  getAlternativeRoadRoutes,
  type RoadRouteResult,
  type AlternativeRoadRoute,
} from '@/lib/geoapify';
import type { CardinalPath, TetherMode } from '@/lib/algorithms/routeOptimizer';
import { ROUTE_COLORS, ROUTE_TYPE_LABELS } from '@/lib/algorithms/routeOptimizer';
import type { ComparisonRoute } from '@/types/routes';

interface Depot {
  lat: number;
  lng: number;
}

interface FacilityPoint {
  id: string;
  lat: number;
  lng: number;
}

interface UseRoadRouteFetcherOptions {
  depot: Depot | null;
  facilities: FacilityPoint[];
  orderedFacilityIds: string[];
  tetherMode: TetherMode;
  enabled: boolean;
}

/** Build waypoints for routing: depot → facilities → depot (round trip) or just facilities when depot is missing */
function buildWaypoints(depot: Depot | null, ordered: FacilityPoint[]): Array<{ lat: number; lng: number }> {
  if (depot) {
    return [depot, ...ordered, depot];
  }
  // No depot — route through facilities only (open path, no round trip)
  return ordered;
}

interface UseRoadRouteFetcherResult {
  /** Main road route (waypoint mode: depot → facilities → depot) */
  roadRoute: RoadRouteResult | null;
  /** Alternative routes (3 route types) */
  alternativeRoutes: ComparisonRoute[];
  /** Per-facility cardinal paths (depot → each facility) */
  cardinalPaths: Record<string, CardinalPath[]>;
  /** Whether any fetch is in progress */
  isFetching: boolean;
  /** Fetch alternatives for the current order */
  fetchAlternatives: () => Promise<void>;
}

export function useRoadRouteFetcher({
  depot,
  facilities,
  orderedFacilityIds,
  tetherMode,
  enabled,
}: UseRoadRouteFetcherOptions): UseRoadRouteFetcherResult {
  const [roadRoute, setRoadRoute] = useState<RoadRouteResult | null>(null);
  const [alternativeRoutes, setAlternativeRoutes] = useState<ComparisonRoute[]>([]);
  const [cardinalPaths, setCardinalPaths] = useState<Record<string, CardinalPath[]>>({});
  const [isFetching, setIsFetching] = useState(false);

  // Track last fetched key to avoid duplicate requests
  const lastRouteKeyRef = useRef<string>('');
  const lastCardinalKeyRef = useRef<string>('');

  // Build ordered facilities list
  const getOrderedFacilities = useCallback((): FacilityPoint[] => {
    if (orderedFacilityIds.length === 0) return facilities;
    return orderedFacilityIds
      .map(id => facilities.find(f => f.id === id))
      .filter((f): f is FacilityPoint => !!f);
  }, [orderedFacilityIds, facilities]);

  // Fetch main road route (waypoint mode)
  useEffect(() => {
    if (!enabled || facilities.length === 0) return;
    if (tetherMode !== 'route') return;

    const ordered = getOrderedFacilities();
    if (ordered.length === 0) return;
    // Need at least 2 points to form a route (2 facilities, or depot + 1 facility)
    if (!depot && ordered.length < 2) return;

    const depotKey = depot ? `${depot.lat},${depot.lng}` : 'nodepot';
    const key = `${depotKey}|${ordered.map(f => f.id).join(',')}`;
    if (key === lastRouteKeyRef.current) return;
    lastRouteKeyRef.current = key;

    setIsFetching(true);
    const waypoints = buildWaypoints(depot, ordered);

    getRoadRoute(waypoints)
      .then(route => {
        if (route) setRoadRoute(route);
      })
      .catch(err => console.error('Road route fetch failed:', err))
      .finally(() => setIsFetching(false));
  }, [enabled, depot, facilities, orderedFacilityIds, tetherMode, getOrderedFacilities]);

  // Fetch cardinal paths (depot → each facility individually)
  useEffect(() => {
    if (!enabled || !depot || facilities.length === 0) return; // cardinal mode requires a depot
    if (tetherMode !== 'cardinal') return;

    const ordered = getOrderedFacilities();
    const needFetch = ordered.filter(f => !cardinalPaths[f.id]);
    if (needFetch.length === 0) return;

    const key = needFetch.map(f => f.id).join(',');
    if (key === lastCardinalKeyRef.current) return;
    lastCardinalKeyRef.current = key;

    setIsFetching(true);

    // Batch fetch up to 6 at a time to avoid rate limiting
    const batch = needFetch.slice(0, 6);

    Promise.allSettled(
      batch.map(async (facility) => {
        const waypoints = [depot, { lat: facility.lat, lng: facility.lng }];
        const alternatives = await getAlternativeRoadRoutes(waypoints);

        const paths: CardinalPath[] = alternatives.map(alt => ({
          routeType: alt.routeType,
          geometry: alt.geometry,
          distanceKm: alt.roadDistanceKm,
          timeMinutes: alt.roadTimeMinutes,
        }));

        return { facilityId: facility.id, paths };
      })
    )
      .then(results => {
        const newPaths: Record<string, CardinalPath[]> = {};
        for (const result of results) {
          if (result.status === 'fulfilled') {
            newPaths[result.value.facilityId] = result.value.paths;
          }
        }
        setCardinalPaths(prev => ({ ...prev, ...newPaths }));
      })
      .catch(err => console.error('Cardinal paths fetch failed:', err))
      .finally(() => setIsFetching(false));
  }, [enabled, depot, facilities, tetherMode, cardinalPaths, getOrderedFacilities]);

  // Fetch alternative routes
  const fetchAlternatives = useCallback(async () => {
    const minPoints = depot ? 1 : 2;
    if (facilities.length < minPoints) return;

    setIsFetching(true);
    try {
      const ordered = getOrderedFacilities();
      const waypoints = buildWaypoints(depot, ordered);

      const alternatives = await getAlternativeRoadRoutes(waypoints);
      const routes: ComparisonRoute[] = alternatives.map((alt, idx) => ({
        id: `alt-${alt.routeType}-${idx}`,
        routeType: alt.routeType,
        routeTypeLabel: alt.label,
        algorithmLabel: 'Current Order',
        color: ROUTE_COLORS[alt.routeType],
        distanceKm: alt.roadDistanceKm,
        timeMinutes: alt.roadTimeMinutes,
        geometry: alt.geometry,
        snappedWaypoints: alt.snappedWaypoints,
        facilityOrder: orderedFacilityIds.length > 0 ? orderedFacilityIds : facilities.map(f => f.id),
      }));

      setAlternativeRoutes(routes);
      // Also set the balanced route as the main road route
      const balanced = alternatives.find(a => a.routeType === 'balanced') || alternatives[0];
      if (balanced) {
        setRoadRoute({
          roadDistanceKm: balanced.roadDistanceKm,
          roadTimeMinutes: balanced.roadTimeMinutes,
          geometry: balanced.geometry,
          snappedWaypoints: balanced.snappedWaypoints,
        });
      }
    } catch (err) {
      console.error('Failed to fetch alternative routes:', err);
    }
    setIsFetching(false);
  }, [depot, facilities, orderedFacilityIds, getOrderedFacilities]);

  return {
    roadRoute,
    alternativeRoutes,
    cardinalPaths,
    isFetching,
    fetchAlternatives,
  };
}

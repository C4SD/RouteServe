/**
 * useTetherGeometry - Compute tether/connector/alt-route GeoJSON from route data
 *
 * Pure computation hook (no side effects, no Supabase calls). Derives the three
 * FeatureCollections that drive TetherLineLayer, ConnectorLineLayer, and AltRouteLayer
 * from the road-route data provided by useRoadRouteFetcher.
 *
 * Logic extracted from SandboxRouteBuilder's marker/tether update effect.
 */

import { useMemo } from 'react';
import type { FeatureCollection, LineString, Feature } from 'geojson';
import type { TetherMode, CardinalPath } from '@/lib/algorithms/routeOptimizer';
import { ROUTE_COLORS, ROUTE_TYPE_LABELS } from '@/lib/algorithms/routeOptimizer';
import type { RoadRouteResult } from '@/lib/geoapify';
import type { ComparisonRoute } from '@/types/routes';
import type { TetherLineProperties } from '@/maps-v3/layers/TetherLineLayer';
import type { AltRouteProperties } from '@/maps-v3/layers/AltRouteLayer';

interface TetherFacility {
  id: string;
  lat: number;
  lng: number;
  name: string;
}

interface TetherDepot {
  lat: number;
  lng: number;
}

export interface TetherGeometry {
  tetherFeatures: FeatureCollection<LineString, TetherLineProperties>;
  connectorFeatures: FeatureCollection<LineString>;
  altRouteFeatures: FeatureCollection<LineString, AltRouteProperties>;
}

const EMPTY: TetherGeometry = {
  tetherFeatures: { type: 'FeatureCollection', features: [] },
  connectorFeatures: { type: 'FeatureCollection', features: [] },
  altRouteFeatures: { type: 'FeatureCollection', features: [] },
};

function emptyFC<P>(): FeatureCollection<LineString, P> {
  return { type: 'FeatureCollection', features: [] } as FeatureCollection<LineString, P>;
}

export function useTetherGeometry(
  depot: TetherDepot | null,
  facilities: TetherFacility[],
  orderedIds: string[],
  tetherMode: TetherMode,
  roadRoute: RoadRouteResult | null,
  cardinalPaths: Record<string, CardinalPath[]>,
  alternativeRoutes: ComparisonRoute[],
  selectedComparisonId: string | null,
  isOptimized: boolean,
): TetherGeometry {
  return useMemo(() => {
    if (!depot || facilities.length === 0) return EMPTY;

    const getOrdered = (): TetherFacility[] => {
      if (orderedIds.length === 0) return facilities;
      return orderedIds
        .map((id) => facilities.find((f) => f.id === id))
        .filter((f): f is TetherFacility => !!f);
    };

    // ── Route mode ──────────────────────────────────────────────────────────
    if (tetherMode === 'route') {
      const route = roadRoute;
      if (!route || route.geometry.length === 0) return EMPTY;

      const tetherFeature: Feature<LineString, TetherLineProperties> = {
        type: 'Feature',
        properties: {
          mode: 'route',
          routeLabel: 'Optimized Route',
          distanceKm: route.roadDistanceKm,
          timeMinutes: route.roadTimeMinutes,
          color: ROUTE_COLORS.balanced,
        },
        geometry: { type: 'LineString', coordinates: route.geometry },
      };

      const connectorFeatures: Feature<LineString>[] = [];
      if (route.snappedWaypoints.length > 0) {
        const ordered = getOrdered();
        connectorFeatures.push({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [[depot.lng, depot.lat], route.snappedWaypoints[0]],
          },
        });
        ordered.forEach((f, idx) => {
          const snappedIdx = idx + 1;
          if (snappedIdx < route.snappedWaypoints.length) {
            connectorFeatures.push({
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: [[f.lng, f.lat], route.snappedWaypoints[snappedIdx]],
              },
            });
          }
        });
      }

      return {
        tetherFeatures: { type: 'FeatureCollection', features: [tetherFeature] },
        connectorFeatures: { type: 'FeatureCollection', features: connectorFeatures },
        altRouteFeatures: emptyFC<AltRouteProperties>(),
      };
    }

    // ── Alternatives mode ────────────────────────────────────────────────────
    if (tetherMode === 'alternatives') {
      const altFeatures: Feature<LineString, AltRouteProperties>[] = [];
      let tetherFeatures: Feature<LineString, TetherLineProperties>[] = [];
      const connectorFeatures: Feature<LineString>[] = [];

      if (alternativeRoutes.length > 0) {
        const routesToShow = selectedComparisonId
          ? alternativeRoutes.filter((r) => r.id === selectedComparisonId)
          : alternativeRoutes;

        for (const r of routesToShow.filter((r) => r.geometry.length > 0)) {
          altFeatures.push({
            type: 'Feature',
            properties: {
              id: r.id,
              color: r.color,
              width: 4,
              opacity: 0.9,
              routeLabel: r.routeTypeLabel,
              distanceKm: r.distanceKm,
              timeMinutes: r.timeMinutes,
            },
            geometry: { type: 'LineString', coordinates: r.geometry },
          });
        }

        // Show selected route in main tether layer
        const activeRoute = selectedComparisonId
          ? alternativeRoutes.find((r) => r.id === selectedComparisonId)
          : null;

        if (activeRoute && activeRoute.geometry.length > 0) {
          tetherFeatures = [
            {
              type: 'Feature',
              properties: {
                mode: 'route',
                routeLabel: activeRoute.routeTypeLabel,
                distanceKm: activeRoute.distanceKm,
                timeMinutes: activeRoute.timeMinutes,
                color: activeRoute.color,
              },
              geometry: { type: 'LineString', coordinates: activeRoute.geometry },
            },
          ];

          if (activeRoute.snappedWaypoints.length > 0) {
            const ordered = orderedIds.length > 0
              ? orderedIds.map((id) => facilities.find((f) => f.id === id)).filter((f): f is TetherFacility => !!f)
              : facilities;

            connectorFeatures.push({
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: [[depot.lng, depot.lat], activeRoute.snappedWaypoints[0]],
              },
            });
            ordered.forEach((f, idx) => {
              const snappedIdx = idx + 1;
              if (snappedIdx < activeRoute.snappedWaypoints.length) {
                connectorFeatures.push({
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: [[f.lng, f.lat], activeRoute.snappedWaypoints[snappedIdx]],
                  },
                });
              }
            });
          }
        } else if (roadRoute && roadRoute.geometry.length > 0) {
          tetherFeatures = [
            {
              type: 'Feature',
              properties: {
                mode: 'route',
                routeLabel: 'Optimized Route',
                distanceKm: roadRoute.roadDistanceKm,
                timeMinutes: roadRoute.roadTimeMinutes,
                color: ROUTE_COLORS.balanced,
              },
              geometry: { type: 'LineString', coordinates: roadRoute.geometry },
            },
          ];
        }
      }

      return {
        tetherFeatures: { type: 'FeatureCollection', features: tetherFeatures },
        connectorFeatures: { type: 'FeatureCollection', features: connectorFeatures },
        altRouteFeatures: { type: 'FeatureCollection', features: altFeatures },
      };
    }

    // ── Cardinal mode (default) ──────────────────────────────────────────────
    const tetherPathFeatures: Feature<LineString, TetherLineProperties>[] = [];
    const connectorFeatures: Feature<LineString>[] = [];
    const altPathFeatures: Feature<LineString, AltRouteProperties>[] = [];

    const selectedFacs = orderedIds.length > 0
      ? orderedIds.map((id) => facilities.find((f) => f.id === id)).filter((f): f is TetherFacility => !!f)
      : facilities;

    for (const f of selectedFacs) {
      const paths = cardinalPaths[f.id];
      if (!paths || paths.length === 0) continue; // no straight-line fallback

      const primary = paths[0];
      const primaryColor = ROUTE_COLORS[primary.routeType as keyof typeof ROUTE_COLORS] || '#3b82f6';
      const primaryLabel = ROUTE_TYPE_LABELS[primary.routeType as keyof typeof ROUTE_TYPE_LABELS] || primary.routeType;

      tetherPathFeatures.push({
        type: 'Feature',
        properties: {
          mode: 'cardinal',
          routeLabel: `${f.name}: ${primaryLabel}`,
          distanceKm: primary.distanceKm,
          timeMinutes: primary.timeMinutes,
          color: primaryColor,
        },
        geometry: { type: 'LineString', coordinates: primary.geometry },
      });

      // Alternatives only shown before optimization (keeps the map clean after TSP)
      if (!isOptimized) {
        for (let i = 1; i < paths.length; i++) {
          const alt = paths[i];
          const color = ROUTE_COLORS[alt.routeType as keyof typeof ROUTE_COLORS] || '#22c55e';
          altPathFeatures.push({
            type: 'Feature',
            properties: {
              id: `${f.id}-alt-${i}`,
              color,
              width: 3,
              opacity: 0.6,
              routeLabel: `${f.name}: ${ROUTE_TYPE_LABELS[alt.routeType as keyof typeof ROUTE_TYPE_LABELS] || alt.routeType}`,
              distanceKm: alt.distanceKm,
              timeMinutes: alt.timeMinutes,
            },
            geometry: { type: 'LineString', coordinates: alt.geometry },
          });
        }
      }

      // Connectors: facility → road end, depot → road start
      if (primary.geometry.length > 0) {
        connectorFeatures.push({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [[f.lng, f.lat], primary.geometry[primary.geometry.length - 1]],
          },
        });
        connectorFeatures.push({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [[depot.lng, depot.lat], primary.geometry[0]],
          },
        });
      }
    }

    return {
      tetherFeatures: { type: 'FeatureCollection', features: tetherPathFeatures },
      connectorFeatures: { type: 'FeatureCollection', features: connectorFeatures },
      altRouteFeatures: { type: 'FeatureCollection', features: altPathFeatures },
    };
  }, [depot, facilities, orderedIds, tetherMode, roadRoute, cardinalPaths, alternativeRoutes, selectedComparisonId, isOptimized]);
}

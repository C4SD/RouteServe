/**
 * Shared route optimization algorithms.
 * Extracted from SandboxRouteBuilder for reuse in batch views.
 */

import { Route, Fuel, Clock, Layers, type LucideIcon } from 'lucide-react';
import { computeDistanceMatrix, type GeoPoint } from './distanceMatrix';
import { solveTSP } from './tsp';

// ─── Types ───

export interface OptimizationConfig {
  shortestDistance: boolean;
  fuelEfficiency: boolean;
  timeOptimized: boolean;
  clusterPriority: boolean;
}

export interface OptimizationCriterion {
  key: keyof OptimizationConfig;
  label: string;
  description: string;
  icon: LucideIcon;
}

export interface OptimizationResult {
  orderedIds: string[];
  algorithmLabel: string;
}

// ─── Constants ───

export const OPTIMIZATION_CRITERIA: OptimizationCriterion[] = [
  {
    key: 'shortestDistance',
    label: 'Shortest Distance',
    description: 'Minimize total route kilometers',
    icon: Route,
  },
  {
    key: 'fuelEfficiency',
    label: 'Fuel Efficiency',
    description: 'Penalize long detours & backtracking',
    icon: Fuel,
  },
  {
    key: 'timeOptimized',
    label: 'Time Optimized',
    description: 'Minimize travel + service time (40 km/h avg)',
    icon: Clock,
  },
  {
    key: 'clusterPriority',
    label: 'Cluster Priority',
    description: 'Group nearby facilities to reduce zig-zagging',
    icon: Layers,
  },
];

export const DEFAULT_OPTIMIZATION_CONFIG: OptimizationConfig = {
  shortestDistance: true,
  fuelEfficiency: false,
  timeOptimized: false,
  clusterPriority: false,
};

/** Default waiting time per stop in hours (15 min) — overridden by workspace Waiting Time SLA */
export const SERVICE_TIME_HOURS = 0.25;
export const AVG_SPEED_KMH = 40;

export const ROUTE_COLORS: Record<string, string> = {
  balanced: '#3b82f6',
  short: '#22c55e',
  less_maneuvers: '#f97316',
};

export const ROUTE_TYPE_LABELS: Record<string, string> = {
  balanced: 'Fastest',
  short: 'Shortest',
  less_maneuvers: 'Fewest Turns',
};

export const ALGORITHM_COLOR_OFFSET: Record<string, string[]> = {
  'Shortest Distance': ['#3b82f6', '#22c55e', '#f97316'],
  'Fuel Efficient': ['#8b5cf6', '#a855f7', '#d946ef'],
  'Time Optimized': ['#06b6d4', '#14b8a6', '#10b981'],
  'Cluster Priority': ['#ef4444', '#f59e0b', '#ec4899'],
};

// Per-facility cardinal path metadata
export interface CardinalPath {
  routeType: string;
  geometry: Array<[number, number]>;
  distanceKm: number;
  timeMinutes: number;
}

export type TetherMode = 'cardinal' | 'route' | 'alternatives';

// ─── Algorithms ───

/**
 * Solve route optimization using the selected criteria.
 * Depot is always index 0 in the matrix so TSP
 * considers the real starting/ending point.
 *
 * Returns ordered facility IDs (excluding depot).
 */
export function solveWithConfig(
  depot: { lat: number; lng: number },
  facilityPoints: GeoPoint[],
  config: OptimizationConfig,
  waitingTimeMin: number = SERVICE_TIME_HOURS * 60
): OptimizationResult {
  // Validate inputs
  if (!Array.isArray(facilityPoints)) {
    throw new TypeError('facilityPoints must be an array');
  }

  const n = facilityPoints.length;
  if (n === 0) {
    return { orderedIds: [], algorithmLabel: 'Empty' };
  }
  if (n === 1) {
    return { orderedIds: facilityPoints.map(p => p.id), algorithmLabel: 'Direct' };
  }

  const allPoints: GeoPoint[] = [
    { id: '__depot__', lat: depot.lat, lng: depot.lng },
    ...facilityPoints,
  ];
  const rawMatrix = computeDistanceMatrix(allPoints);

  if (config.clusterPriority) {
    return solveClusterFirst(allPoints, facilityPoints, rawMatrix);
  }

  const total = allPoints.length;
  let matrix = rawMatrix;
  const labels: string[] = [];

  if (config.fuelEfficiency) {
    matrix = Array.from({ length: total }, (_, i) =>
      Array.from({ length: total }, (_, j) => rawMatrix[i][j] ** 3)
    );
    labels.push('Fuel Efficient');
  } else if (config.timeOptimized) {
    const waitingTimeHours = waitingTimeMin / 60;
    matrix = Array.from({ length: total }, (_, i) =>
      Array.from({ length: total }, (_, j) => {
        if (i === j) return 0;
        const dist = rawMatrix[i][j];
        const speed = dist < 10 ? 25 : dist < 30 ? 35 : 50;
        return dist / speed + waitingTimeHours;
      })
    );
    labels.push('Time Optimized');
  } else {
    labels.push('Shortest Distance');
  }

  const result = solveTSP(matrix, 0);
  const facilityOrder = result.order.filter(idx => idx !== 0);
  const orderedIds = facilityOrder.map(idx => allPoints[idx].id);

  return { orderedIds, algorithmLabel: labels.join(' + ') };
}

/**
 * Cluster-first-route-second: group nearby facilities into clusters,
 * then visit all facilities in the nearest cluster before moving to the next.
 */
export function solveClusterFirst(
  allPoints: GeoPoint[],
  facilityPoints: GeoPoint[],
  rawMatrix: number[][]
): OptimizationResult {
  const n = facilityPoints.length;
  const clusterCount = Math.max(2, Math.ceil(n / 4));
  const assignments = simpleKMeans(facilityPoints, clusterCount);

  const clusters: Map<number, number[]> = new Map();
  assignments.forEach((clusterId, facIdx) => {
    const list = clusters.get(clusterId) || [];
    list.push(facIdx + 1); // +1 because depot is at index 0
    clusters.set(clusterId, list);
  });

  const depotIdx = 0;
  const clusterOrder = [...clusters.entries()]
    .map(([cid, members]) => {
      const avgDist = members.reduce((s, m) => s + rawMatrix[depotIdx][m], 0) / members.length;
      return { cid, members, avgDist };
    })
    .sort((a, b) => a.avgDist - b.avgDist);

  const orderedIds: string[] = [];
  let currentIdx = depotIdx;

  for (const { members } of clusterOrder) {
    const remaining = new Set(members);
    while (remaining.size > 0) {
      let nearest = -1;
      let nearestDist = Infinity;
      for (const m of remaining) {
        if (rawMatrix[currentIdx][m] < nearestDist) {
          nearestDist = rawMatrix[currentIdx][m];
          nearest = m;
        }
      }
      if (nearest === -1) break;
      remaining.delete(nearest);
      orderedIds.push(allPoints[nearest].id);
      currentIdx = nearest;
    }
  }

  return { orderedIds, algorithmLabel: 'Cluster Priority' };
}

/**
 * Simple k-means clustering for geo points.
 * Returns an array of cluster assignments (index per point).
 */
export function simpleKMeans(points: GeoPoint[], k: number, maxIter = 20): number[] {
  const n = points.length;
  if (n <= k) return points.map((_, i) => i);

  const centroids: { lat: number; lng: number }[] = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.floor((i * n) / k);
    centroids.push({ lat: points[idx].lat, lng: points[idx].lng });
  }

  let assignments = new Array(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    const newAssignments = points.map((p) => {
      let minDist = Infinity;
      let closest = 0;
      for (let c = 0; c < k; c++) {
        const d = (p.lat - centroids[c].lat) ** 2 + (p.lng - centroids[c].lng) ** 2;
        if (d < minDist) {
          minDist = d;
          closest = c;
        }
      }
      return closest;
    });

    const changed = newAssignments.some((a, i) => a !== assignments[i]);
    assignments = newAssignments;
    if (!changed) break;

    for (let c = 0; c < k; c++) {
      const members = points.filter((_, i) => assignments[i] === c);
      if (members.length > 0) {
        centroids[c] = {
          lat: members.reduce((s, m) => s + m.lat, 0) / members.length,
          lng: members.reduce((s, m) => s + m.lng, 0) / members.length,
        };
      }
    }
  }

  return assignments;
}

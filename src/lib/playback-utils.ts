/**
 * Playback Utility Functions
 *
 * Core algorithms for the playback engine:
 * - Binary search for O(log n) time lookups
 * - GPS interpolation for smooth movement
 * - Distance calculations (Haversine formula)
 * - Route variance computation
 * - Deviation detection
 */

import type {
  IndexedPosition,
  InterpolatedPosition,
  Polyline,
  RouteVariance,
  DeviationSegment,
} from '@/types/live-map';

// Earth radius in meters (for Haversine formula)
const EARTH_RADIUS = 6371000;

/**
 * Binary search to find GPS position index at specific time
 * Returns the index of the last GPS point before or at the given time
 *
 * Time Complexity: O(log n)
 *
 * @param gps - Sorted array of GPS positions
 * @param time - Unix timestamp in milliseconds
 * @returns Index of position (or -1 if time is before first GPS point)
 */
export function binarySearchPosition(
  gps: IndexedPosition[],
  time: number
): number {
  if (gps.length === 0 || time < gps[0].timestamp) {
    return -1;
  }

  if (time >= gps[gps.length - 1].timestamp) {
    return gps.length - 1;
  }

  let left = 0;
  let right = gps.length - 1;
  let result = 0;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);

    if (gps[mid].timestamp <= time) {
      result = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return result;
}

/**
 * Linear interpolation helper
 */
function lerp(start: number, end: number, ratio: number): number {
  return start + (end - start) * ratio;
}

/**
 * Interpolate position between two GPS points based on time
 * Provides smooth movement between GPS pings
 *
 * @param time - Current playback time (Unix timestamp ms)
 * @param gps - GPS array
 * @param index - Index of previous GPS point (from binary search)
 * @returns Interpolated position with heading and speed
 */
export function interpolatePosition(
  time: number,
  gps: IndexedPosition[],
  index: number
): InterpolatedPosition | null {
  if (index < 0 || index >= gps.length) {
    return null;
  }

  const prev = gps[index];
  const next = gps[index + 1];

  // If no next point, return current position
  if (!next) {
    return {
      lat: prev.lat,
      lng: prev.lng,
      heading: prev.heading,
      speed: prev.speed,
      timestamp: time,
      index,
      ratio: 1,
    };
  }

  // Calculate interpolation ratio
  const timeDiff = next.timestamp - prev.timestamp;
  const ratio = timeDiff > 0 ? (time - prev.timestamp) / timeDiff : 0;

  // Clamp ratio to [0, 1]
  const clampedRatio = Math.max(0, Math.min(1, ratio));

  // Interpolate position
  const lat = lerp(prev.lat, next.lat, clampedRatio);
  const lng = lerp(prev.lng, next.lng, clampedRatio);

  // Interpolate heading (handle 0/360 wrap-around)
  let heading = prev.heading;
  if (next.heading !== undefined && prev.heading !== undefined) {
    let headingDiff = next.heading - prev.heading;

    // Handle wrap-around (e.g., 350° → 10°)
    if (headingDiff > 180) headingDiff -= 360;
    if (headingDiff < -180) headingDiff += 360;

    heading = prev.heading + headingDiff * clampedRatio;
    if (heading < 0) heading += 360;
    if (heading >= 360) heading -= 360;
  }

  // Interpolate speed
  const speed = lerp(prev.speed || 0, next.speed || 0, clampedRatio);

  return {
    lat,
    lng,
    heading,
    speed,
    timestamp: time,
    index,
    ratio: clampedRatio,
  };
}

/**
 * Calculate distance between two GPS points using Haversine formula
 *
 * @param p1 - [lng, lat]
 * @param p2 - [lng, lat]
 * @returns Distance in meters
 */
function calculateDistance(
  p1: [number, number],
  p2: [number, number]
): number {
  const [lng1, lat1] = p1;
  const [lng2, lat2] = p2;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate total distance of a polyline
 *
 * @param polyline - Array of [lng, lat] points
 * @returns Total distance in meters
 */
export function calculatePolylineDistance(polyline: Polyline): number {
  if (polyline.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    totalDistance += calculateDistance(polyline[i], polyline[i + 1]);
  }

  return totalDistance;
}

/**
 * Compute cumulative distances for each GPS point
 * Used for O(1) distance lookups during playback
 *
 * @param gps - GPS array
 * @returns Array of cumulative distances (same length as gps)
 */
export function computeCumulativeDistances(
  gps: IndexedPosition[]
): number[] {
  if (gps.length === 0) return [];

  const distances: number[] = [0]; // First point has distance 0

  for (let i = 1; i < gps.length; i++) {
    const prev = gps[i - 1];
    const curr = gps[i];
    const segmentDistance = calculateDistance(
      [prev.lng, prev.lat],
      [curr.lng, curr.lat]
    );
    distances.push(distances[i - 1] + segmentDistance);
  }

  return distances;
}

/**
 * Compute route variance between planned and actual routes
 *
 * @param actual - Actual route polyline
 * @param planned - Planned route polyline
 * @returns Route variance metrics
 */
export function computeRouteVariance(
  actual: Polyline,
  planned: Polyline | null
): RouteVariance {
  const actualDistance = calculatePolylineDistance(actual);

  if (!planned || planned.length === 0) {
    return {
      plannedDistance: 0,
      actualDistance,
      variance: 0,
      variancePercent: 0,
    };
  }

  const plannedDistance = calculatePolylineDistance(planned);
  const variance = actualDistance - plannedDistance;
  const variancePercent =
    plannedDistance > 0 ? (variance / plannedDistance) * 100 : 0;

  return {
    plannedDistance,
    actualDistance,
    variance,
    variancePercent,
  };
}

/**
 * Find closest point on a polyline to a given point
 *
 * @param point - [lng, lat]
 * @param polyline - Array of [lng, lat] points
 * @returns Closest point on polyline and distance to it
 */
export function closestPointOnPolyline(
  point: [number, number],
  polyline: Polyline
): { point: [number, number]; distance: number; segmentIndex: number } {
  if (polyline.length === 0) {
    return { point: [0, 0], distance: Infinity, segmentIndex: -1 };
  }

  if (polyline.length === 1) {
    return {
      point: polyline[0],
      distance: calculateDistance(point, polyline[0]),
      segmentIndex: 0,
    };
  }

  let minDistance = Infinity;
  let closestPoint: [number, number] = polyline[0];
  let closestSegmentIndex = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const p1 = polyline[i];
    const p2 = polyline[i + 1];

    const closest = closestPointOnSegment(point, p1, p2);
    const distance = calculateDistance(point, closest);

    if (distance < minDistance) {
      minDistance = distance;
      closestPoint = closest;
      closestSegmentIndex = i;
    }
  }

  return { point: closestPoint, distance: minDistance, segmentIndex: closestSegmentIndex };
}

/**
 * Find closest point on a line segment to a given point
 *
 * @param point - [lng, lat]
 * @param lineStart - [lng, lat]
 * @param lineEnd - [lng, lat]
 * @returns Closest point on segment
 */
function closestPointOnSegment(
  point: [number, number],
  lineStart: [number, number],
  lineEnd: [number, number]
): [number, number] {
  const [px, py] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;

  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return lineStart;
  }

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));

  return [x1 + t * dx, y1 + t * dy];
}

/**
 * Detect route deviations where actual route differs from planned route
 *
 * @param actual - Actual route (array of GPS positions)
 * @param planned - Planned route polyline
 * @param threshold - Deviation threshold in meters (default 100m)
 * @returns Array of deviation segments
 */
export function detectDeviations(
  actual: IndexedPosition[],
  planned: Polyline | null,
  threshold: number = 100
): DeviationSegment[] {
  if (!planned || planned.length === 0 || actual.length === 0) {
    return [];
  }

  const deviations: DeviationSegment[] = [];
  let currentDeviation: DeviationSegment | null = null;

  for (let i = 0; i < actual.length; i++) {
    const gpsPoint = actual[i];
    const point: [number, number] = [gpsPoint.lng, gpsPoint.lat];

    const { distance } = closestPointOnPolyline(point, planned);

    if (distance > threshold) {
      // Start new deviation or continue existing
      if (!currentDeviation) {
        currentDeviation = {
          id: `deviation-${Date.now()}-${i}`,
          startIndex: i,
          endIndex: i,
          startTime: gpsPoint.timestamp,
          endTime: gpsPoint.timestamp,
          coordinates: [point],
          plannedCoordinates: [],
          maxDeviation: distance,
          totalDeviation: distance,
        };
      } else {
        currentDeviation.endIndex = i;
        currentDeviation.endTime = gpsPoint.timestamp;
        currentDeviation.coordinates.push(point);
        currentDeviation.maxDeviation = Math.max(
          currentDeviation.maxDeviation,
          distance
        );
        currentDeviation.totalDeviation += distance;
      }
    } else {
      // End current deviation
      if (currentDeviation) {
        deviations.push(currentDeviation);
        currentDeviation = null;
      }
    }
  }

  // Add final deviation if exists
  if (currentDeviation) {
    deviations.push(currentDeviation);
  }

  return deviations;
}

/**
 * Format duration in seconds to human-readable string
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "1h 23m", "45m", "12s")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    const secs = Math.round(seconds % 60);
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format distance in meters to human-readable string
 *
 * @param meters - Distance in meters
 * @returns Formatted string (e.g., "1.2 km", "450 m")
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format speed in m/s to km/h
 *
 * @param metersPerSecond - Speed in m/s
 * @returns Speed in km/h
 */
export function speedToKmh(metersPerSecond: number): number {
  return metersPerSecond * 3.6;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

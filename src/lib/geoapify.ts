import { supabase } from '@/integrations/supabase/client';

export interface GeoapifyPlace {
  formatted: string;
  lat: number;
  lon: number;
  address_line1: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

export interface GeoapifyRoute {
  distance: number; // in meters
  time: number; // in seconds
  geometry: Array<[number, number]>; // [lng, lat] pairs (flattened road path)
  snappedWaypoints: Array<[number, number]>; // [lng, lat] — road-snapped position of each input waypoint
  legs: Array<{
    distance: number;
    time: number;
    steps: Array<{
      distance: number;
      time: number;
      instruction: string;
    }>;
  }>;
}

export async function searchAddress(query: string): Promise<GeoapifyPlace[]> {
  try {
    // Use secure Supabase edge function proxy
    const { data, error } = await supabase.functions.invoke('geocode', {
      body: {
        type: 'search',
        query
      }
    });

    if (error) throw error;

    if (data && data.features && data.features.length > 0) {
      return data.features.map((feature: any) => ({
        formatted: feature.properties.formatted,
        lat: feature.properties.lat,
        lon: feature.properties.lon,
        address_line1: feature.properties.address_line1 || '',
        address_line2: feature.properties.address_line2,
        city: feature.properties.city,
        state: feature.properties.state,
        postcode: feature.properties.postcode,
        country: feature.properties.country
      }));
    }
  } catch (error) {
    console.error('Geoapify search error:', error);
  }

  // Fallback to Nominatim (OpenStreetMap) — no API key required
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );

    if (!response.ok) throw new Error('Nominatim search failed');

    const data = await response.json();
    return data.map((item: any) => ({
      formatted: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      address_line1: item.address?.road || item.name || item.display_name.split(',')[0],
      address_line2: undefined,
      city: item.address?.city || item.address?.town || item.address?.village,
      state: item.address?.state,
      postcode: item.address?.postcode,
      country: item.address?.country,
    }));
  } catch (error) {
    console.error('Nominatim search error:', error);
    return [];
  }
}

export async function reverseGeocode(lat: number, lon: number): Promise<GeoapifyPlace | null> {
  try {
    // Use secure Supabase edge function proxy
    const { data, error } = await supabase.functions.invoke('geocode', {
      body: {
        type: 'reverse',
        lat,
        lon
      }
    });

    if (error) throw error;

    if (data && data.features && data.features.length > 0) {
      const feature = data.features[0];
      return {
        formatted: feature.properties.formatted,
        lat: feature.properties.lat,
        lon: feature.properties.lon,
        address_line1: feature.properties.address_line1 || '',
        address_line2: feature.properties.address_line2,
        city: feature.properties.city,
        state: feature.properties.state,
        postcode: feature.properties.postcode,
        country: feature.properties.country
      };
    }

    return null;
  } catch (error) {
    console.error('Geoapify reverse geocode error:', error);
    return null;
  }
}

export type RouteType = 'balanced' | 'short' | 'less_maneuvers';

export async function getRoute(
  waypoints: Array<[number, number]>,
  routeType?: RouteType
): Promise<GeoapifyRoute | null> {
  if (waypoints.length < 2) return null;

  try {
    // Convert waypoints from [lat, lon] to { lat, lon } format for edge function
    const waypointsFormatted = waypoints.map(([lat, lon]) => ({ lat, lon }));

    // Use secure Supabase edge function proxy
    const { data, error } = await supabase.functions.invoke('routing', {
      body: {
        waypoints: waypointsFormatted,
        mode: 'drive',
        ...(routeType && routeType !== 'balanced' ? { routeType } : {}),
      }
    });

    if (error) throw error;

    if (data && data.features && data.features.length > 0) {
      const feature = data.features[0];
      const properties = feature.properties;
      const geomType = feature.geometry?.type;
      const rawCoords = feature.geometry?.coordinates;

      // Handle both MultiLineString (coordinates[0] = first linestring) and LineString (coordinates = flat array)
      let coords: Array<[number, number]>;
      let snappedWaypoints: Array<[number, number]> = [];

      if (geomType === 'MultiLineString' && Array.isArray(rawCoords?.[0]?.[0])) {
        // MultiLineString: each linestring is a leg between consecutive waypoints
        const legs = rawCoords as number[][][];
        coords = legs.flat().map((c: number[]) => [c[0], c[1]] as [number, number]);

        // Extract snapped waypoints from leg boundaries:
        // - First waypoint: first point of first leg
        // - Intermediate waypoints: first point of each subsequent leg
        // - Last waypoint: last point of last leg
        for (let i = 0; i < legs.length; i++) {
          if (i === 0 && legs[i].length > 0) {
            snappedWaypoints.push([legs[i][0][0], legs[i][0][1]]);
          }
          if (legs[i].length > 0) {
            const lastPt = legs[i][legs[i].length - 1];
            snappedWaypoints.push([lastPt[0], lastPt[1]]);
          }
        }
      } else if (geomType === 'LineString' && Array.isArray(rawCoords)) {
        coords = (rawCoords as number[][]).map((c: number[]) => [c[0], c[1]] as [number, number]);
        // For LineString, snapped waypoints are just start and end
        if (coords.length > 0) {
          snappedWaypoints = [coords[0], coords[coords.length - 1]];
        }
      } else {
        // Fallback: try the old approach
        coords = (rawCoords?.[0] || []).map((c: number[]) => [c[0], c[1]] as [number, number]);
        if (coords.length > 0) {
          snappedWaypoints = [coords[0], coords[coords.length - 1]];
        }
      }

      return {
        distance: properties.distance,
        time: properties.time,
        geometry: coords,
        snappedWaypoints,
        legs: properties.legs || []
      };
    }

    return null;
  } catch (error) {
    console.error('Geoapify routing error:', error);
    return null;
  }
}

export interface RoadRouteResult {
  roadDistanceKm: number;
  roadTimeMinutes: number;
  geometry: Array<[number, number]>; // [lng, lat] pairs for map rendering
  snappedWaypoints: Array<[number, number]>; // [lng, lat] — where each waypoint was snapped to the road
}

/**
 * Get road route for an ordered list of waypoints.
 * Tries Geoapify (via Supabase edge function) first; falls back to OSRM on failure.
 */
export async function getRoadRoute(
  waypoints: Array<{ lat: number; lng: number }>,
  routeType?: RouteType
): Promise<RoadRouteResult | null> {
  if (waypoints.length < 2) return null;

  // Try Geoapify via Supabase edge function
  try {
    const formatted = waypoints.map(w => [w.lat, w.lng] as [number, number]);
    const route = await getRoute(formatted, routeType);
    if (route) {
      return {
        roadDistanceKm: Math.round((route.distance / 1000) * 10) / 10,
        roadTimeMinutes: Math.round(route.time / 60),
        geometry: route.geometry,
        snappedWaypoints: route.snappedWaypoints,
      };
    }
  } catch {
    // fall through to OSRM
  }

  // Fallback: OSRM (direct, no Supabase dependency)
  try {
    const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(';');
    const url = `${OSRM_BASE_URL}/${coords}?geometries=geojson&overview=full`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes?.length) return null;

    const route = data.routes[0];
    const geom: Array<[number, number]> = (route.geometry?.coordinates || [])
      .map((c: number[]) => [c[0], c[1]] as [number, number]);

    return {
      roadDistanceKm: Math.round((route.distance / 1000) * 10) / 10,
      roadTimeMinutes: Math.round(route.duration / 60),
      geometry: geom,
      snappedWaypoints: geom.length > 0 ? [geom[0], geom[geom.length - 1]] : [],
    };
  } catch (error) {
    console.error('Road route fetch failed (Geoapify + OSRM):', error);
    return null;
  }
}

export interface AlternativeRoadRoute extends RoadRouteResult {
  routeType: RouteType;
  label: string;
}

const ROUTE_TYPE_LABELS: Record<RouteType, string> = {
  balanced: 'Fastest Route',
  short: 'Shortest Path',
  less_maneuvers: 'Fewest Turns',
};

// ─── OSRM Fallback (genuinely different road paths) ───

const OSRM_BASE_URL = import.meta.env.VITE_ROUTING_API_URL || 'https://routing.openstreetmap.de/routed-car/route/v1/driving';
const OSRM_ROUTE_COLORS = ['#3b82f6', '#22c55e', '#f97316']; // blue, green, orange
const OSRM_ROUTE_LABELS = ['Primary Route', 'Alternative A', 'Alternative B'];

/**
 * Fetch alternative routes from OSRM's public demo server.
 * OSRM returns genuinely different road paths (unlike Geoapify type variants
 * which can converge in areas with limited road networks).
 */
async function getOsrmAlternatives(
  waypoints: Array<{ lat: number; lng: number }>,
  maxAlternatives = 3
): Promise<AlternativeRoadRoute[]> {
  if (waypoints.length < 2) return [];

  try {
    const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(';');
    const url = `${OSRM_BASE_URL}/${coords}?alternatives=${maxAlternatives}&geometries=geojson&overview=full`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`OSRM error: ${response.statusText}`);

    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes?.length) return [];

    return data.routes.map((route: any, i: number): AlternativeRoadRoute => {
      const geom: Array<[number, number]> = (route.geometry?.coordinates || [])
        .map((c: number[]) => [c[0], c[1]] as [number, number]);

      // Extract snapped waypoints from leg start/end
      const snapped: Array<[number, number]> = [];
      if (geom.length > 0) {
        snapped.push(geom[0]);
        if (geom.length > 1) snapped.push(geom[geom.length - 1]);
      }

      // Classify OSRM alternatives by what they actually optimize:
      // - Route 0 (primary): fastest/balanced
      // - Route 1+: genuinely different paths — label by their relative characteristics
      const distKm = Math.round((route.distance / 1000) * 10) / 10;
      const timeMins = Math.round(route.duration / 60);

      return {
        roadDistanceKm: distKm,
        roadTimeMinutes: timeMins,
        geometry: geom,
        snappedWaypoints: snapped,
        // Will be reclassified during merge to avoid label collisions
        routeType: (['balanced', 'short', 'less_maneuvers'] as RouteType[])[i] || 'balanced',
        label: OSRM_ROUTE_LABELS[i] || `Alternative ${i}`,
      };
    });
  } catch (error) {
    console.error('OSRM alternatives fetch failed:', error);
    return [];
  }
}

/** Check if two routes are effectively identical */
function routesAreIdentical(a: RoadRouteResult, b: RoadRouteResult): boolean {
  return Math.abs(a.roadDistanceKm - b.roadDistanceKm) < 0.5 &&
         Math.abs(a.roadTimeMinutes - b.roadTimeMinutes) < 2;
}

/**
 * Fetch alternative road routes, using Geoapify as primary and OSRM as fallback.
 *
 * Strategy:
 * 1. Fetch all 3 Geoapify route types in parallel
 * 2. If ≥2 routes are identical, replace duplicates with OSRM alternatives
 * 3. Return a mix of unique routes from both engines
 */
export async function getAlternativeRoadRoutes(
  waypoints: Array<{ lat: number; lng: number }>
): Promise<AlternativeRoadRoute[]> {
  const types: RouteType[] = ['balanced', 'short', 'less_maneuvers'];

  // Step 1: Fetch Geoapify routes
  const results = await Promise.allSettled(
    types.map(async (type) => {
      const route = await getRoadRoute(waypoints, type);
      if (!route) return null;
      return {
        ...route,
        routeType: type,
        label: ROUTE_TYPE_LABELS[type],
      };
    })
  );

  const geoapifyRoutes = results
    .filter((r): r is PromiseFulfilledResult<AlternativeRoadRoute | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((r): r is AlternativeRoadRoute => r !== null);

  // Step 2: Check for duplicates
  const uniqueGeoapify: AlternativeRoadRoute[] = [];
  let duplicateCount = 0;
  for (const route of geoapifyRoutes) {
    if (uniqueGeoapify.some(u => routesAreIdentical(u, route))) {
      duplicateCount++;
    } else {
      uniqueGeoapify.push(route);
    }
  }

  // If no duplicates, Geoapify gave us genuinely different routes
  if (duplicateCount === 0) return geoapifyRoutes;

  // Step 3: Fetch OSRM alternatives to replace duplicates
  console.info(`Geoapify returned ${duplicateCount} duplicate route(s), fetching OSRM alternatives...`);

  try {
    const osrmRoutes = await getOsrmAlternatives(waypoints, 3);

    // Merge: keep unique Geoapify routes + add OSRM routes that are different
    const merged = [...uniqueGeoapify];
    const usedTypes = new Set(merged.map(r => r.routeType));

    // Available route types for OSRM slots (assign types not already used by Geoapify)
    const availableTypes: RouteType[] = (['balanced', 'short', 'less_maneuvers'] as RouteType[])
      .filter(t => !usedTypes.has(t));

    let slotIdx = 0;
    for (const osrmRoute of osrmRoutes) {
      if (merged.length >= 3) break;
      const isDuplicate = merged.some(m => routesAreIdentical(m, osrmRoute));
      if (!isDuplicate) {
        // Assign a non-colliding routeType and a descriptive label
        const assignedType = availableTypes[slotIdx] || 'less_maneuvers';
        merged.push({
          ...osrmRoute,
          routeType: assignedType,
          label: `Alt. Route ${slotIdx + 1}`,
        });
        slotIdx++;
      }
    }

    return merged;
  } catch {
    // OSRM fallback failed, return what we have from Geoapify
    return geoapifyRoutes;
  }
}

export async function getIsochrone(
  lat: number,
  lon: number,
  timeMinutes: number
): Promise<any> {
  try {
    // Use secure Supabase edge function proxy
    const { data, error } = await supabase.functions.invoke('isoline', {
      body: {
        lat,
        lon,
        type: 'time',
        mode: 'drive',
        range: timeMinutes * 60 // Convert minutes to seconds
      }
    });

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Geoapify isochrone error:', error);
    return null;
  }
}

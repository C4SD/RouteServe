import type {
  CopilotConstraints,
  CopilotFacility,
  CopilotWarehouse,
  SuggestedZone,
  SuggestedServiceArea,
  SuggestedPolicy,
  SuggestedRouteGroup,
  SuggestedOperationalStructure,
  CopilotGenerationResult,
  ConfidenceLevel,
  ZoneStatus,
} from '@/types/operations-copilot';

// ─── Haversine distance (km) ──────────────────────────────────────────────────

export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Centroid of a set of facilities ─────────────────────────────────────────

function centroid(facilities: CopilotFacility[]): { lat: number; lng: number } {
  const lat = facilities.reduce((s, f) => s + f.lat, 0) / facilities.length;
  const lng = facilities.reduce((s, f) => s + f.lng, 0) / facilities.length;
  return { lat, lng };
}

// ─── Confidence scoring ───────────────────────────────────────────────────────

function computeConfidence(
  avgDist: number,
  maxDist: number,
  facilityCount: number,
  constraints: CopilotConstraints,
): { score: number; level: ConfidenceLevel } {
  const radiusRatio = avgDist / constraints.max_radius_km;
  const countRatio = facilityCount / constraints.max_facilities_per_zone;

  // Penalise spread and imbalance
  const spreadPenalty = Math.min(radiusRatio, 1);
  const countPenalty = countRatio > 1 ? 1 : Math.abs(countRatio - 0.6) * 0.3;
  const maxDistPenalty = maxDist > constraints.max_radius_km ? 0.2 : 0;

  const score = Math.max(0, Math.min(1, 1 - spreadPenalty * 0.6 - countPenalty - maxDistPenalty));

  const level: ConfidenceLevel =
    score >= 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low';

  return { score: Math.round(score * 100) / 100, level };
}

function zoneStatus(
  facilities: CopilotFacility[],
  maxDist: number,
  constraints: CopilotConstraints,
): ZoneStatus {
  if (facilities.length === 0) return 'out_of_coverage';
  if (maxDist > constraints.max_radius_km) return 'overflow';
  if (facilities.length < 2) return 'sparse';
  return 'valid';
}

// ─── Step 1 — Warehouse assignment ───────────────────────────────────────────

interface WarehouseGroup {
  warehouse: CopilotWarehouse;
  facilities: CopilotFacility[];
}

function assignFacilitiesToWarehouses(
  warehouses: CopilotWarehouse[],
  facilities: CopilotFacility[],
  constraints: CopilotConstraints,
): { groups: WarehouseGroup[]; outOfCoverage: CopilotFacility[] } {
  const groups: WarehouseGroup[] = warehouses.map(w => ({ warehouse: w, facilities: [] }));
  const outOfCoverage: CopilotFacility[] = [];

  for (const facility of facilities) {
    // Sort warehouses by distance to facility
    const ranked = warehouses
      .map((w, i) => ({
        idx: i,
        dist: haversineKm(facility.lat, facility.lng, w.lat, w.lng),
      }))
      .sort((a, b) => a.dist - b.dist);

    let assigned = false;
    for (const { idx, dist } of ranked) {
      if (dist <= constraints.max_radius_km) {
        groups[idx].facilities.push(facility);
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      // Assign to closest warehouse even if outside radius, but mark out-of-coverage
      outOfCoverage.push(facility);
    }
  }

  return { groups, outOfCoverage };
}

// ─── Step 2 — Zone generation ─────────────────────────────────────────────────

function generateZonesForWarehouse(
  warehouse: CopilotWarehouse,
  facilities: CopilotFacility[],
  constraints: CopilotConstraints,
  warehouseIndex: number,
): SuggestedZone[] {
  if (facilities.length === 0) return [];

  const maxPerZone = constraints.max_facilities_per_zone;
  const remaining = new Set(facilities.map(f => f.id));
  const facilityMap = new Map(facilities.map(f => [f.id, f]));
  const zones: SuggestedZone[] = [];
  let zoneIndex = 0;

  // Seed-based greedy clustering: pick unassigned facility farthest from warehouse
  // as the seed of a new zone, then fill with nearest neighbours.
  const unassigned = () => [...remaining].map(id => facilityMap.get(id)!);

  while (remaining.size > 0) {
    const pool = unassigned();

    // Seed: farthest from warehouse (creates compact outer zones first)
    const seed = pool.reduce((best, f) => {
      const d = haversineKm(f.lat, f.lng, warehouse.lat, warehouse.lng);
      const bd = haversineKm(best.lat, best.lng, warehouse.lat, warehouse.lng);
      return d > bd ? f : best;
    });

    // Build zone around seed by nearest-neighbour from seed
    const zoneFacilities: CopilotFacility[] = [];
    remaining.delete(seed.id);
    zoneFacilities.push(seed);

    while (zoneFacilities.length < maxPerZone && remaining.size > 0) {
      const c = centroid(zoneFacilities);
      let nearest: CopilotFacility | null = null;
      let nearestDist = Infinity;
      for (const id of remaining) {
        const f = facilityMap.get(id)!;
        const d = haversineKm(f.lat, f.lng, c.lat, c.lng);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = f;
        }
      }
      if (!nearest) break;
      remaining.delete(nearest.id);
      zoneFacilities.push(nearest);
    }

    // Calculate metrics
    const c = centroid(zoneFacilities);
    const distances = zoneFacilities.map(f =>
      haversineKm(f.lat, f.lng, c.lat, c.lng),
    );
    const avgDist = distances.reduce((s, d) => s + d, 0) / distances.length;
    const maxDist = Math.max(...distances);
    const { score, level } = computeConfidence(avgDist, maxDist, zoneFacilities.length, constraints);

    const zoneLetter = String.fromCharCode(65 + zoneIndex); // A, B, C …
    const zoneId = `gen-zone-${warehouseIndex}-${zoneIndex}-${Date.now()}`;

    zones.push({
      id: zoneId,
      warehouse_id: warehouse.id,
      name: `${warehouse.name} — Zone ${zoneLetter}`,
      facilities: zoneFacilities,
      metrics: {
        facility_count: zoneFacilities.length,
        avg_distance_km: Math.round(avgDist * 10) / 10,
        max_distance_km: Math.round(maxDist * 10) / 10,
      },
      confidence_score: score,
      confidence_level: level,
      status: zoneStatus(zoneFacilities, maxDist, constraints),
      acceptance: 'pending',
    });

    zoneIndex++;
  }

  return zones;
}

// ─── Step 3 — Service area generation ────────────────────────────────────────

function suggestPolicies(zone: SuggestedZone): SuggestedPolicy[] {
  const policies: SuggestedPolicy[] = [];

  // Dispatch frequency based on facility count
  const freq =
    zone.metrics.facility_count <= 4 ? 'weekly' :
    zone.metrics.facility_count <= 8 ? 'biweekly' : 'monthly';

  policies.push({
    id: `pol-freq-${zone.id}`,
    type: 'dispatch_frequency',
    label: 'Dispatch Frequency',
    value: freq,
  });

  // SLA window based on distance
  const slaHours =
    zone.metrics.max_distance_km <= 10 ? 24 :
    zone.metrics.max_distance_km <= 20 ? 48 : 72;

  policies.push({
    id: `pol-sla-${zone.id}`,
    type: 'sla_window',
    label: 'SLA Window',
    value: `${slaHours}h`,
  });

  // Confidence-based category
  const category =
    zone.confidence_level === 'high' ? 'standard' :
    zone.confidence_level === 'medium' ? 'monitored' : 'priority_review';

  policies.push({
    id: `pol-cat-${zone.id}`,
    type: 'operational_category',
    label: 'Operational Category',
    value: category,
  });

  return policies;
}

function generateRouteGroups(zone: SuggestedZone): SuggestedRouteGroup[] {
  // Split facilities into route groups of ~4 each
  const groupSize = 4;
  const groups: SuggestedRouteGroup[] = [];
  let i = 0;
  let groupIndex = 0;

  while (i < zone.facilities.length) {
    const slice = zone.facilities.slice(i, i + groupSize);
    groups.push({
      id: `rg-${zone.id}-${groupIndex}`,
      name: `Route ${groupIndex + 1}`,
      facilities: slice,
    });
    i += groupSize;
    groupIndex++;
  }

  return groups;
}

function generateServiceArea(
  zone: SuggestedZone,
  warehouse: CopilotWarehouse,
): SuggestedServiceArea {
  const policies = suggestPolicies(zone);
  const routeGroups = generateRouteGroups(zone);

  return {
    id: `gen-sa-${zone.id}`,
    warehouse_id: warehouse.id,
    zone_id: zone.id,
    name: zone.name.replace('Zone', 'Service Area'),
    facilities: zone.facilities,
    policies,
    route_groups: routeGroups,
    acceptance: 'pending',
  };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function runCopilotEngine(
  warehouses: CopilotWarehouse[],
  facilities: CopilotFacility[],
  constraints: CopilotConstraints,
): CopilotGenerationResult {
  // Filter facilities with valid coordinates
  const validFacilities = facilities.filter(
    f => Number.isFinite(f.lat) && Number.isFinite(f.lng) &&
         f.lat !== 0 && f.lng !== 0,
  );

  const { groups, outOfCoverage } = assignFacilitiesToWarehouses(
    warehouses, validFacilities, constraints,
  );

  const structures: SuggestedOperationalStructure[] = groups
    .filter(g => g.facilities.length > 0)
    .map((group, warehouseIndex) => {
      const zones = generateZonesForWarehouse(
        group.warehouse,
        group.facilities,
        constraints,
        warehouseIndex,
      );

      const service_areas = zones.map(zone =>
        generateServiceArea(zone, group.warehouse),
      );

      return {
        warehouse: group.warehouse,
        zones,
        service_areas,
        out_of_coverage: [],
      };
    });

  return {
    structures,
    global_out_of_coverage: outOfCoverage,
    generated_at: new Date().toISOString(),
    constraints,
  };
}

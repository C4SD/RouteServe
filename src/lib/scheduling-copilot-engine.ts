/**
 * =====================================================
 * Scheduling Copilot Engine
 * =====================================================
 * Deterministic operational orchestration engine.
 *
 * NOT AI optimization — deterministic constraint-aware
 * planning using:
 * - operational constraints
 * - resource availability
 * - temporal feasibility
 * - route-aware grouping
 * - capacity splitting
 */

import type {
  PlanningCandidate,
  PlanningIntent,
  CopilotPlan,
  LogicalBatch,
  BatchSegment,
  DispatchRunProposal,
  FeasibilityWarning,
  ResourceOccupancyEntry,
} from '@/types/scheduling-copilot';

// =====================================================
// RESOURCE CONTEXT (passed in from live data)
// =====================================================

export interface VehicleResource {
  id: string;
  model: string;
  plate: string;
  capacity_slots: number;
  max_weight_kg: number;
  status: 'available' | 'maintenance' | 'occupied';
  cold_chain_capable?: boolean;
}

export interface DriverResource {
  id: string;
  name: string;
  status: 'available' | 'on_route' | 'off_duty';
}

export interface EngineContext {
  vehicles: VehicleResource[];
  drivers: DriverResource[];
}

// =====================================================
// HAVERSINE DISTANCE
// =====================================================

function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
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

// =====================================================
// STEP 1: ROUTE-AWARE GROUPING
// =====================================================
// Groups candidates by:
//   1. cold-chain (separated first if prioritize_cold_chain)
//   2. zone / LGA proximity
//   3. geographic clustering (greedy nearest-neighbor seed)

const GEO_CLUSTER_RADIUS_KM = 80;

function groupCandidates(
  candidates: PlanningCandidate[],
  intent: PlanningIntent
): LogicalBatch[] {
  const batches: LogicalBatch[] = [];
  let remaining = [...candidates];

  // If prioritize_cold_chain, separate cold-chain candidates first
  if (intent.prioritize_cold_chain) {
    const coldChain = remaining.filter((c) => c.cold_chain);
    remaining = remaining.filter((c) => !c.cold_chain);

    if (coldChain.length > 0) {
      const id = `batch-cold-${Date.now()}`;
      batches.push(buildBatch(id, 'Cold-Chain Run', coldChain, 'Cold-chain segregation'));
    }
  }

  // Group remaining by zone first
  const zoneMap = new Map<string, PlanningCandidate[]>();
  const noZone: PlanningCandidate[] = [];

  for (const c of remaining) {
    const key = c.zone || c.lga || '';
    if (key) {
      if (!zoneMap.has(key)) zoneMap.set(key, []);
      zoneMap.get(key)!.push(c);
    } else {
      noZone.push(c);
    }
  }

  // One batch per zone
  let batchIndex = batches.length;
  for (const [zone, group] of zoneMap.entries()) {
    const label = `Batch ${toLetter(batchIndex)}`;
    batches.push(buildBatch(`batch-${batchIndex}`, label, group, `Zone: ${zone}`));
    batchIndex++;
  }

  // Geo-cluster candidates with no zone
  const geoClusters = geoCluster(noZone, GEO_CLUSTER_RADIUS_KM);
  for (const cluster of geoClusters) {
    const label = `Batch ${toLetter(batchIndex)}`;
    batches.push(buildBatch(`batch-${batchIndex}`, label, cluster, 'Geographic proximity'));
    batchIndex++;
  }

  return batches;
}

function buildBatch(
  id: string,
  label: string,
  candidates: PlanningCandidate[],
  reason: string
): LogicalBatch {
  const total_slot_demand = candidates.reduce((s, c) => s + c.slot_demand, 0);
  const total_weight = candidates.reduce((s, c) => s + c.total_weight, 0);
  const total_volume = candidates.reduce((s, c) => s + c.total_volume, 0);
  const has_cold_chain = candidates.some((c) => c.cold_chain);
  return {
    id,
    label,
    candidates,
    grouping_reason: reason,
    total_slot_demand,
    total_weight,
    total_volume,
    has_cold_chain,
  };
}

function geoCluster(
  candidates: PlanningCandidate[],
  radiusKm: number
): PlanningCandidate[][] {
  const unvisited = [...candidates];
  const clusters: PlanningCandidate[][] = [];

  while (unvisited.length > 0) {
    const seed = unvisited.shift()!;
    const cluster = [seed];
    const seedLat = seed.lat ?? 0;
    const seedLng = seed.lng ?? 0;

    for (let i = unvisited.length - 1; i >= 0; i--) {
      const c = unvisited[i];
      const dist = haversineKm(seedLat, seedLng, c.lat ?? 0, c.lng ?? 0);
      if (dist <= radiusKm) {
        cluster.push(c);
        unvisited.splice(i, 1);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

function toLetter(index: number): string {
  return String.fromCharCode(65 + (index % 26));
}

// =====================================================
// STEP 2: CAPACITY SPLITTING
// =====================================================
// Split batches into segments if slot/weight/volume is exceeded.

function splitBatchesByCapacity(
  batches: LogicalBatch[],
  vehicles: VehicleResource[]
): LogicalBatch[] {
  if (vehicles.length === 0) return batches;

  const maxSlots = Math.max(...vehicles.map((v) => v.capacity_slots));
  const maxWeight = Math.max(...vehicles.map((v) => v.max_weight_kg));

  return batches.map((batch) => {
    if (
      batch.total_slot_demand <= maxSlots &&
      batch.total_weight <= maxWeight
    ) {
      return batch;
    }

    // Split into segments
    const segments: BatchSegment[] = [];
    let segIdx = 0;
    let currentSlots = 0;
    let currentWeight = 0;
    let segCandidates: PlanningCandidate[] = [];

    const flush = () => {
      if (segCandidates.length === 0) return;
      segments.push({
        id: `${batch.id}-seg-${segIdx}`,
        label: `Segment ${segIdx + 1}`,
        candidates: segCandidates,
        total_slot_demand: currentSlots,
      });
      segIdx++;
      segCandidates = [];
      currentSlots = 0;
      currentWeight = 0;
    };

    for (const c of batch.candidates) {
      if (
        segCandidates.length > 0 &&
        (currentSlots + c.slot_demand > maxSlots ||
          currentWeight + c.total_weight > maxWeight)
      ) {
        flush();
      }
      segCandidates.push(c);
      currentSlots += c.slot_demand;
      currentWeight += c.total_weight;
    }
    flush();

    return { ...batch, segments };
  });
}

// =====================================================
// STEP 3: TEMPORAL FEASIBILITY & RUN GENERATION
// =====================================================
// Maps each batch (or segment) to a DispatchRunProposal
// within the planning window.

function generateDispatchRuns(
  batches: LogicalBatch[],
  intent: PlanningIntent,
  vehicles: VehicleResource[],
  drivers: DriverResource[]
): { runs: DispatchRunProposal[]; unassigned: PlanningCandidate[] } {
  const runs: DispatchRunProposal[] = [];
  const unassigned: PlanningCandidate[] = [];

  const availableVehicles = vehicles.filter(
    (v) => v.status === 'available' || v.status !== 'maintenance'
  );
  const availableDrivers = drivers.filter(
    (d) => d.status === 'available'
  );

  // Build a flat list of units to schedule (batch or its segments)
  type ScheduleUnit = {
    candidates: PlanningCandidate[];
    parent_label: string;
    has_cold_chain: boolean;
    total_slot_demand: number;
    total_weight: number;
  };

  const units: ScheduleUnit[] = [];
  for (const batch of batches) {
    if (batch.segments && batch.segments.length > 1) {
      for (const seg of batch.segments) {
        units.push({
          candidates: seg.candidates,
          parent_label: `${batch.label} / ${seg.label}`,
          has_cold_chain: batch.has_cold_chain,
          total_slot_demand: seg.total_slot_demand,
          total_weight: seg.candidates.reduce((s, c) => s + c.total_weight, 0),
        });
      }
    } else {
      units.push({
        candidates: batch.candidates,
        parent_label: batch.label,
        has_cold_chain: batch.has_cold_chain,
        total_slot_demand: batch.total_slot_demand,
        total_weight: batch.total_weight,
      });
    }
  }

  // Vehicle occupancy tracking (per-day, by hour)
  const vehicleOccupancy = new Map<string, number>(); // vehicleId -> hour occupied until on current day
  const driverOccupancy = new Map<string, number>();  // driverId  -> hour occupied until on current day
  let occupancyDay = '';

  const resetOccupancyForDay = (day: string) => {
    if (day !== occupancyDay) {
      vehicleOccupancy.clear();
      driverOccupancy.clear();
      occupancyDay = day;
    }
  };

  // Estimate run duration in hours: 1h base + 0.5h per stop, capped at max
  const estimateDurationHours = (numFacilities: number): number => {
    const raw = 1 + numFacilities * 0.5;
    return Math.min(raw, intent.max_run_duration_hours);
  };

  // Iterate through planning window days
  const windowStart = new Date(intent.planning_window_start + 'T00:00:00');
  const windowEnd = new Date(intent.planning_window_end + 'T23:59:59');
  const dayMs = 24 * 60 * 60 * 1000;

  let runNumber = 1;
  let unitIndex = 0;

  for (
    let d = new Date(windowStart);
    d <= windowEnd && unitIndex < units.length;
    d = new Date(d.getTime() + dayMs)
  ) {
    const dayStr = d.toISOString().split('T')[0];
    resetOccupancyForDay(dayStr);

    let currentHour = intent.shift_start_hour;

    while (currentHour < intent.shift_end_hour && unitIndex < units.length) {
      const unit = units[unitIndex];
      const durationHours = estimateDurationHours(unit.candidates.length);

      if (currentHour + durationHours > intent.shift_end_hour) {
        // Doesn't fit today — move to next day
        break;
      }

      const warnings: FeasibilityWarning[] = [];

      // Find a suitable vehicle
      let assignedVehicle: VehicleResource | null = null;
      for (const v of availableVehicles) {
        const occupiedUntil = vehicleOccupancy.get(v.id) ?? intent.shift_start_hour;
        if (occupiedUntil > currentHour) continue;
        if (v.capacity_slots < unit.total_slot_demand) continue;
        if (unit.has_cold_chain && !v.cold_chain_capable) continue;
        assignedVehicle = v;
        break;
      }

      if (!assignedVehicle) {
        if (availableVehicles.length === 0) {
          warnings.push({
            type: 'vehicle_unavailable',
            message: 'No vehicles available in this workspace',
            severity: 'error',
          });
        } else {
          warnings.push({
            type: 'additional_vehicle_required',
            message: 'No vehicle with sufficient capacity available at this time slot',
            severity: 'warning',
          });
          // Assign best-effort (first available regardless of capacity)
          const fallback = availableVehicles.find(
            (v) => (vehicleOccupancy.get(v.id) ?? intent.shift_start_hour) <= currentHour
          );
          if (fallback) {
            assignedVehicle = fallback;
            warnings.push({
              type: 'capacity_exceeded',
              message: `Vehicle ${fallback.model} may be over capacity`,
              severity: 'warning',
            });
          }
        }
      }

      // Find a suitable driver
      let assignedDriver: DriverResource | null = null;
      for (const dr of availableDrivers) {
        const occupiedUntil = driverOccupancy.get(dr.id) ?? intent.shift_start_hour;
        if (occupiedUntil <= currentHour) {
          assignedDriver = dr;
          break;
        }
      }

      if (!assignedDriver && availableDrivers.length > 0) {
        warnings.push({
          type: 'driver_overlap',
          message: 'All drivers are occupied at this time slot',
          severity: 'warning',
        });
        // Assign first driver anyway with overlap warning
        assignedDriver = availableDrivers[0] ?? null;
      }

      // Shift exceeded check
      if (currentHour + durationHours > intent.max_run_duration_hours + intent.shift_start_hour) {
        warnings.push({
          type: 'shift_exceeded',
          message: `Run duration (${durationHours.toFixed(1)}h) approaches shift limit`,
          severity: 'warning',
        });
      }

      const returnHour = Math.min(currentHour + durationHours, intent.shift_end_hour);
      const utilization =
        assignedVehicle
          ? Math.round((unit.total_slot_demand / assignedVehicle.capacity_slots) * 100)
          : 0;

      runs.push({
        id: `run-${runNumber}-${dayStr}`,
        run_number: runNumber,
        planned_date: dayStr,
        planned_departure: formatHour(currentHour),
        planned_return: formatHour(returnHour),
        estimated_duration_hours: durationHours,
        vehicle_id: assignedVehicle?.id ?? null,
        vehicle_model: assignedVehicle?.model,
        vehicle_plate: assignedVehicle?.plate,
        vehicle_capacity_slots: assignedVehicle?.capacity_slots,
        driver_id: assignedDriver?.id ?? null,
        driver_name: assignedDriver?.name,
        candidates: unit.candidates,
        total_slot_demand: unit.total_slot_demand,
        total_weight: unit.total_weight,
        utilization_pct: utilization,
        feasibility_warnings: warnings,
        has_cold_chain: unit.has_cold_chain,
        user_overridden: false,
      });

      // Mark occupancy
      if (assignedVehicle) vehicleOccupancy.set(assignedVehicle.id, returnHour);
      if (assignedDriver) driverOccupancy.set(assignedDriver.id, returnHour);

      // Advance time
      currentHour = returnHour + 0.25; // 15-min turnaround
      runNumber++;
      unitIndex++;
    }
  }

  // Any units we couldn't schedule become unassigned
  for (let i = unitIndex; i < units.length; i++) {
    unassigned.push(...units[i].candidates);
  }

  return { runs, unassigned };
}

function formatHour(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// =====================================================
// STEP 4: RESOURCE OCCUPANCY SNAPSHOT
// =====================================================

function buildResourceOccupancy(
  runs: DispatchRunProposal[],
  vehicles: VehicleResource[],
  drivers: DriverResource[]
): ResourceOccupancyEntry[] {
  const entries: ResourceOccupancyEntry[] = [];

  for (const v of vehicles) {
    const lastRun = [...runs]
      .filter((r) => r.vehicle_id === v.id)
      .sort((a, b) => {
        if (a.planned_date !== b.planned_date) return a.planned_date < b.planned_date ? -1 : 1;
        return a.planned_return < b.planned_return ? -1 : 1;
      })
      .pop();

    if (v.status === 'maintenance') {
      entries.push({
        resource_id: v.id,
        resource_type: 'vehicle',
        resource_name: `${v.model} (${v.plate})`,
        status: 'maintenance',
        note: 'Under maintenance',
      });
    } else if (lastRun) {
      entries.push({
        resource_id: v.id,
        resource_type: 'vehicle',
        resource_name: `${v.model} (${v.plate})`,
        status: 'occupied',
        occupied_until: `${lastRun.planned_date}T${lastRun.planned_return}`,
      });
    } else {
      entries.push({
        resource_id: v.id,
        resource_type: 'vehicle',
        resource_name: `${v.model} (${v.plate})`,
        status: 'available',
      });
    }
  }

  for (const d of drivers) {
    const lastRun = [...runs]
      .filter((r) => r.driver_id === d.id)
      .sort((a, b) => {
        if (a.planned_date !== b.planned_date) return a.planned_date < b.planned_date ? -1 : 1;
        return a.planned_return < b.planned_return ? -1 : 1;
      })
      .pop();

    if (d.status !== 'available') {
      entries.push({
        resource_id: d.id,
        resource_type: 'driver',
        resource_name: d.name,
        status: d.status === 'off_duty' ? 'maintenance' : 'occupied',
        note: d.status === 'off_duty' ? 'Off duty' : 'Currently on route',
      });
    } else if (lastRun) {
      entries.push({
        resource_id: d.id,
        resource_type: 'driver',
        resource_name: d.name,
        status: 'occupied',
        occupied_until: `${lastRun.planned_date}T${lastRun.planned_return}`,
      });
    } else {
      entries.push({
        resource_id: d.id,
        resource_type: 'driver',
        resource_name: d.name,
        status: 'available',
      });
    }
  }

  return entries;
}

// =====================================================
// PUBLIC: generateCopilotPlan
// =====================================================

export function generateCopilotPlan(
  candidates: PlanningCandidate[],
  intent: PlanningIntent,
  context: EngineContext
): CopilotPlan {
  const readyCandidates = candidates.filter((c) => c.dispatch_ready);
  const notReadyCandidates = candidates.filter((c) => !c.dispatch_ready);

  // Route-aware grouping
  let batches = groupCandidates(readyCandidates, intent);

  // Capacity splitting
  batches = splitBatchesByCapacity(batches, context.vehicles);

  // Temporal feasibility + run generation
  const { runs, unassigned } = generateDispatchRuns(
    batches,
    intent,
    context.vehicles,
    context.drivers
  );

  // Resource occupancy
  const resourceOccupancy = buildResourceOccupancy(
    runs,
    context.vehicles,
    context.drivers
  );

  // Unique days spanned
  const daysSet = new Set(runs.map((r) => r.planned_date));
  const vehiclesSet = new Set(runs.map((r) => r.vehicle_id).filter(Boolean));
  const totalWarnings = runs.reduce((s, r) => s + r.feasibility_warnings.length, 0);

  return {
    plan_id: `plan-${Date.now()}`,
    generated_at: new Date().toISOString(),
    planning_window_start: intent.planning_window_start,
    planning_window_end: intent.planning_window_end,
    logical_batches: batches,
    dispatch_runs: runs,
    unassigned_candidates: [...unassigned, ...notReadyCandidates],
    resource_occupancy: resourceOccupancy,
    summary: {
      total_candidates: candidates.length,
      total_assigned: readyCandidates.length - unassigned.length,
      total_unassigned: unassigned.length + notReadyCandidates.length,
      total_runs: runs.length,
      total_days: daysSet.size,
      total_vehicles_used: vehiclesSet.size,
      total_warnings: totalWarnings,
      estimated_execution_days: daysSet.size,
    },
  };
}

// =====================================================
// PUBLIC: convertFacilityCandidatesToPlanningCandidates
// =====================================================
// Converts existing FacilityCandidate[] (from source resolution)
// into PlanningCandidate[] with enriched operational metadata.

export function convertToPlanningCandidates(
  facilityCandidates: Array<{
    id: string;
    name: string;
    code?: string;
    lga?: string;
    zone?: string;
    lat?: number;
    lng?: number;
    requisition_ids: string[];
    slot_demand: number;
    weight_kg?: number;
    volume_m3?: number;
    status?: string;
  }>
): PlanningCandidate[] {
  return facilityCandidates.map((fc) => ({
    facility_id: fc.id,
    facility_name: fc.name,
    facility_code: fc.code,
    lga: fc.lga,
    zone: fc.zone,
    lat: fc.lat,
    lng: fc.lng,
    requisition_ids: fc.requisition_ids,
    invoice_ids: fc.requisition_ids, // invoice_ids = requisition_ids in current data model
    dispatch_ready: fc.requisition_ids.length > 0 || fc.status === 'packaged',
    slot_demand: fc.slot_demand,
    total_weight: fc.weight_kg ?? 0,
    total_volume: fc.volume_m3 ?? 0,
    cold_chain: false, // enriched from DB when available
    priority: 'routine',
    packaging_status:
      fc.status === 'packaged'
        ? 'complete'
        : fc.requisition_ids.length > 0
        ? 'partial'
        : 'pending',
  }));
}

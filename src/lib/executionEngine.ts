/**
 * =====================================================
 * Execution Engine — Manual Scheduling
 * =====================================================
 * Resource-constrained operational execution planner.
 *
 * Given: facilities, assigned vehicles, and operational config
 * Produces: execution waves → dispatch runs → per-run timing
 *
 * This is a simulation engine, not an optimizer.
 * Users retain full control — the engine projects feasibility.
 */

import type {
  ExecutionEngineConfig,
  ExecutionProjection,
  ExecutionWaveProjection,
  DispatchRunProjection,
  ExecutionEngineWarning,
  ClusteringStrategy,
} from '@/types/unified-workflow';
import type { WorkingSetItem } from '@/types/unified-workflow';

// =====================================================
// INTERNAL HELPERS
// =====================================================

function parseMinutes(timeStr: string): number {
  const [h = 0, m = 0] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTimeLabel(totalMin: number): string {
  const clamped = Math.max(0, Math.min(totalMin, 23 * 60 + 59));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function waveLabel(isoDate: string, waveIndex: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  const parts = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `Wave ${waveIndex + 1} · ${parts}`;
}

// =====================================================
// CLUSTERING
// =====================================================

/**
 * Groups facilities into geographic clusters for wave planning.
 * We do NOT split arbitrarily — we derive natural groupings.
 */
export function clusterFacilities(
  facilities: WorkingSetItem[],
  strategy: ClusteringStrategy,
  targetClusterSize: number,
): WorkingSetItem[][] {
  if (facilities.length === 0) return [];

  const sorted = [...facilities].sort((a, b) => a.sequence - b.sequence);

  if (strategy === 'geographic_proximity') {
    return clusterByGeography(sorted, targetClusterSize);
  }

  // balanced_workload and sla_priority: equal-size sequential chunks
  const chunks: WorkingSetItem[][] = [];
  for (let i = 0; i < sorted.length; i += targetClusterSize) {
    chunks.push(sorted.slice(i, i + targetClusterSize));
  }
  return chunks;
}

function clusterByGeography(
  facilities: WorkingSetItem[],
  targetSize: number,
): WorkingSetItem[][] {
  // Facilities with coordinates: sort by a Hilbert-like curve approximation
  // (sort by lat band then alternate lng direction for spatial locality)
  const withCoords = facilities.filter(f => (f as any).lat && (f as any).lng);
  const withoutCoords = facilities.filter(f => !(f as any).lat || !(f as any).lng);

  const clusters: WorkingSetItem[][] = [];

  if (withCoords.length >= 3) {
    const lats = withCoords.map(f => (f as any).lat as number);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const latRange = maxLat - minLat || 1;
    const bandCount = Math.max(1, Math.ceil(Math.sqrt(withCoords.length / targetSize)));
    const bandSize = latRange / bandCount;

    const bands: WorkingSetItem[][] = Array.from({ length: bandCount }, () => []);
    for (const f of withCoords) {
      const band = Math.min(Math.floor(((f as any).lat - minLat) / bandSize), bandCount - 1);
      bands[band].push(f);
    }

    bands.forEach((band, bi) => {
      // Alternate lng sort direction (boustrophedon) for route continuity
      const sorted = [...band].sort((a, b) =>
        bi % 2 === 0
          ? (a as any).lng - (b as any).lng
          : (b as any).lng - (a as any).lng,
      );
      for (let i = 0; i < sorted.length; i += targetSize) {
        clusters.push(sorted.slice(i, i + targetSize));
      }
    });
  }

  // Facilities without coordinates: append in sequence order
  if (withoutCoords.length > 0) {
    for (let i = 0; i < withoutCoords.length; i += targetSize) {
      clusters.push(withoutCoords.slice(i, i + targetSize));
    }
  }

  // Fallback: if clustering produced nothing, fall back to sequential
  if (clusters.length === 0) {
    for (let i = 0; i < facilities.length; i += targetSize) {
      clusters.push(facilities.slice(i, i + targetSize));
    }
  }

  return clusters;
}

// =====================================================
// IDLE PROJECTION (no vehicles assigned yet)
// =====================================================

function emptyProjection(facilities: WorkingSetItem[]): ExecutionProjection {
  const totalFacilities = facilities.length;
  const totalSlots = facilities.reduce((s, f) => s + (f.slot_demand || 1), 0);
  return {
    operational_days: 0,
    total_waves: 0,
    total_runs: 0,
    total_facilities: totalFacilities,
    total_slots: totalSlots,
    vehicle_utilization_avg: 0,
    vehicle_reuse_enabled: false,
    projected_completion: null,
    waves: [],
    warnings: totalFacilities > 0
      ? [{ id: 'no-vehicles', message: 'No vehicles assigned — cannot project execution' }]
      : [],
  };
}

// =====================================================
// MAIN PROJECTION ENGINE
// =====================================================

export interface VehicleForEngine {
  id: string;
  model: string;
  plateNumber?: string;
  plate_number?: string;
  capacity: number;
  status: string;
}

export function projectExecution(
  facilities: WorkingSetItem[],
  assignedVehicles: VehicleForEngine[],
  config: ExecutionEngineConfig,
  planningWindowStart: string | null,
): ExecutionProjection {
  if (facilities.length === 0) return emptyProjection([]);

  const activeVehicles = assignedVehicles.filter(
    v => v.status === 'available' || v.status === 'active' || v.status === 'in-use',
  );
  const V = activeVehicles.length;

  if (V === 0) return emptyProjection(facilities);

  const startDate = planningWindowStart ?? new Date().toISOString().split('T')[0];
  const totalFacilities = facilities.length;
  const totalSlots = facilities.reduce((s, f) => s + (f.slot_demand || 1), 0);

  // --- Timing model ---
  const workStartMin = parseMinutes(config.working_hours_start); // 9:00 → 540
  const workEndMin   = parseMinutes(config.working_hours_end);   // 16:00 → 960
  const workDayMin   = workEndMin - workStartMin;                // 420

  const returnBufferMin =
    config.return_buffer === 'immediate' ? 30
    : config.return_buffer === 'half_day' ? 60
    : 90;

  const timePerFacility = config.service_buffer_min + 15; // service + avg travel

  // Max facilities that can fit in one run
  const maxFacsPerRun = Math.max(
    1,
    Math.floor((workDayMin - returnBufferMin) / timePerFacility),
  );

  // Runs per vehicle per day
  const reuse =
    config.allow_same_day_reuse &&
    (config.execution_strategy === 'maximize_vehicle_reuse' ||
      config.execution_strategy === 'balance_fleet_utilization');

  let runsPerVehiclePerDay = 1;
  let facsPerRun = maxFacsPerRun;

  if (reuse) {
    const halfDayMin = Math.floor(workDayMin / 2) - returnBufferMin;
    if (halfDayMin >= timePerFacility) {
      runsPerVehiclePerDay = 2;
      facsPerRun = Math.max(1, Math.floor(halfDayMin / timePerFacility));
    }
  }

  // Strategy override
  if (config.execution_strategy === 'fastest_completion') {
    // Max throughput: pack facilities, one run per vehicle
    facsPerRun = maxFacsPerRun;
    runsPerVehiclePerDay = 1;
  } else if (config.execution_strategy === 'minimize_operational_days') {
    // Same as fastest but explicitly 1 run per vehicle
    facsPerRun = maxFacsPerRun;
    runsPerVehiclePerDay = 1;
  }

  // Derive natural cluster size ≈ facsPerRun
  const clusters = clusterFacilities(facilities, config.clustering_strategy, facsPerRun);

  // Total runs needed = number of clusters
  const totalRunsNeeded = clusters.length;

  // Vehicle-run slots per day = V * runsPerVehiclePerDay
  const vehicleRunsPerDay = V * runsPerVehiclePerDay;

  // Operational days
  const operationalDays = config.allow_multi_day
    ? Math.max(1, Math.ceil(totalRunsNeeded / vehicleRunsPerDay))
    : 1;

  // --- Wave & run generation ---
  const waves: ExecutionWaveProjection[] = [];
  let clusterIndex = 0;
  let globalRunIndex = 0;

  for (let dayIdx = 0; dayIdx < operationalDays && clusterIndex < clusters.length; dayIdx++) {
    const waveDate = addDays(startDate, dayIdx);
    const waveId   = `wave-${dayIdx}`;
    const waveRuns: DispatchRunProjection[] = [];
    const waveFacIds: string[] = [];

    for (let vIdx = 0; vIdx < V && clusterIndex < clusters.length; vIdx++) {
      const vehicle = activeVehicles[vIdx];
      const vPlate  = vehicle.plateNumber ?? vehicle.plate_number ?? '';
      const vLabel  = `${vehicle.model}${vPlate ? ` (${vPlate})` : ''}`;

      for (let rIdx = 0; rIdx < runsPerVehiclePerDay && clusterIndex < clusters.length; rIdx++) {
        const cluster = clusters[clusterIndex++];
        if (!cluster || cluster.length === 0) continue;

        const runDurMin = cluster.length * timePerFacility + returnBufferMin;
        const halfOffset = rIdx === 1 ? Math.floor(workDayMin / 2) : 0;
        const depMin  = workStartMin + halfOffset;
        const retMin  = Math.min(depMin + runDurMin, workEndMin + 90);

        waveRuns.push({
          id: `run-${dayIdx}-${vIdx}-${rIdx}`,
          run_index: ++globalRunIndex,
          wave_id: waveId,
          vehicle_id: vehicle.id,
          vehicle_label: vLabel,
          facility_ids: cluster.map(f => f.facility_id),
          facility_names: cluster.map(f => f.facility_name),
          total_slots: cluster.reduce((s, f) => s + (f.slot_demand || 1), 0),
          departure_time: minutesToTimeLabel(depMin),
          return_time: minutesToTimeLabel(retMin),
          duration_min: runDurMin,
        });

        waveFacIds.push(...cluster.map(f => f.facility_id));
      }
    }

    if (waveRuns.length === 0) continue;

    const waveSlots = waveFacIds.reduce((s, fid) => {
      const f = facilities.find(x => x.facility_id === fid);
      return s + (f?.slot_demand || 1);
    }, 0);

    waves.push({
      id: waveId,
      wave_index: dayIdx,
      date: waveDate,
      label: waveLabel(waveDate, dayIdx),
      vehicle_ids: [...new Set(waveRuns.map(r => r.vehicle_id).filter(Boolean) as string[])],
      vehicle_labels: [...new Set(waveRuns.map(r => r.vehicle_label).filter(Boolean) as string[])],
      runs: waveRuns,
      facility_ids: waveFacIds,
      total_slots: waveSlots,
      total_facilities: waveFacIds.length,
    });
  }

  // --- Utilization ---
  const totalCapacity = V * operationalDays * runsPerVehiclePerDay * facsPerRun;
  const utilizationPct = totalCapacity > 0
    ? Math.min(100, Math.round((totalFacilities / totalCapacity) * 100))
    : 0;

  const projectedCompletion = waves.length > 0 ? waves[waves.length - 1].date : null;

  // --- Warnings ---
  const warnings: ExecutionEngineWarning[] = [];
  const allRuns = waves.flatMap(w => w.runs);
  const runsOverShift = allRuns.filter(r => r.duration_min > workDayMin);

  if (!config.allow_multi_day && operationalDays > 1) {
    warnings.push({ id: 'multi-day-required', message: `Additional operational days required` });
  }
  if (runsOverShift.length > 0) {
    warnings.push({
      id: 'run-exceeds-shift',
      message: `Run exceeds shift duration in ${runsOverShift.length} case${runsOverShift.length > 1 ? 's' : ''}`,
    });
  }
  if (V === 1 && totalFacilities > 10) {
    warnings.push({ id: 'additional-vehicle', message: 'Consider 1 additional vehicle for faster completion' });
  }
  if (operationalDays > 5) {
    warnings.push({ id: 'long-execution', message: `Execution spans ${operationalDays} days — consider more vehicles` });
  }

  return {
    operational_days: operationalDays,
    total_waves: waves.length,
    total_runs: globalRunIndex,
    total_facilities: totalFacilities,
    total_slots: totalSlots,
    vehicle_utilization_avg: utilizationPct,
    vehicle_reuse_enabled: runsPerVehiclePerDay > 1,
    projected_completion: projectedCompletion,
    waves,
    warnings,
  };
}

// =====================================================
// IDEAL RESOURCE PROJECTION (pre-vehicle-assignment)
// =====================================================

/** Estimates the ideal resource plan before vehicles are committed. */
export function projectIdealResources(
  facilities: WorkingSetItem[],
  config: ExecutionEngineConfig,
): { ideal_vehicles: number; ideal_days: number; ideal_runs: number } {
  if (facilities.length === 0) return { ideal_vehicles: 0, ideal_days: 0, ideal_runs: 0 };

  const workStartMin = parseMinutes(config.working_hours_start);
  const workEndMin   = parseMinutes(config.working_hours_end);
  const workDayMin   = workEndMin - workStartMin;
  const returnBuf    = 30;
  const timePerFac   = config.service_buffer_min + 15;
  const facsPerRun   = Math.max(1, Math.floor((workDayMin - returnBuf) / timePerFac));
  const totalRuns    = Math.ceil(facilities.length / facsPerRun);

  // Target 2 operational days ideally
  const idealDays    = Math.max(1, Math.ceil(Math.sqrt(totalRuns)));
  const idealVehicles = Math.max(1, Math.ceil(totalRuns / idealDays));

  return { ideal_vehicles: idealVehicles, ideal_days: idealDays, ideal_runs: totalRuns };
}

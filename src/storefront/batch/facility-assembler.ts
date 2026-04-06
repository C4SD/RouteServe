/**
 * =====================================================
 * FACILITY ASSEMBLER
 * =====================================================
 *
 * Translates DB requisition + item data into AssignableFacility
 * for the slot assignment engine.
 *
 * This is the only place where:
 *   - temperature_required  → storage_type
 *   - items.program         → AssignableFacility.program
 *
 * Rules:
 *   - storage_type is "cold" if ANY item in the facility's
 *     requisition has temperature_required = true, else "ambient"
 *   - program is the dominant program (most items); if mixed,
 *     the facility is tagged with the plurality program and a
 *     warning is surfaced
 */

import type { AssignableFacility } from '@/fleetops/payload';

/**
 * Minimal shape needed from DB requisition items.
 * Matches requisition_items row joined with items.program.
 */
export interface RequisitionItemSeed {
  facility_id: string;
  weight_kg: number | null;
  volume_m3: number | null;
  temperature_required: boolean | null;
  program: string | null; // from items table join
}

/**
 * Result of assembling one facility.
 */
export interface AssembledFacility {
  facility: AssignableFacility;
  warnings: string[];
}

/**
 * Build an AssignableFacility from a facility's aggregated requisition items.
 *
 * @param facilityId  - the facility being assembled
 * @param items       - all requisition items belonging to this facility
 * @param facilityName - optional display name
 */
export function buildAssignableFacility(
  facilityId: string,
  items: RequisitionItemSeed[],
  facilityName?: string
): AssembledFacility {
  const warnings: string[] = [];

  if (items.length === 0) {
    return {
      facility: { id: facilityId, name: facilityName },
      warnings: [`Facility ${facilityId} has no requisition items`],
    };
  }

  // Weight and volume — sum across all items
  const totalWeightKg = items.reduce((sum, i) => sum + (i.weight_kg ?? 0), 0);
  const totalVolumeM3 = items.reduce((sum, i) => sum + (i.volume_m3 ?? 0), 0);

  // storage_type — cold if ANY item requires temperature control
  const requiresCold = items.some((i) => i.temperature_required === true);
  const storageType: AssignableFacility['storage_type'] = requiresCold ? 'cold' : 'ambient';

  // program — derive dominant program by item count
  const programCounts = new Map<string, number>();
  for (const item of items) {
    const p = item.program ?? 'Untagged';
    programCounts.set(p, (programCounts.get(p) ?? 0) + 1);
  }

  const sortedPrograms = Array.from(programCounts.entries()).sort((a, b) => b[1] - a[1]);
  const dominantProgram = sortedPrograms[0][0] === 'Untagged' ? undefined : sortedPrograms[0][0];

  if (sortedPrograms.length > 1) {
    const breakdown = sortedPrograms.map(([p, n]) => `${p}(${n})`).join(', ');
    warnings.push(
      `Facility ${facilityId} has mixed programs [${breakdown}]; tagged with dominant: ${dominantProgram ?? 'Untagged'}`
    );
  }

  return {
    facility: {
      id: facilityId,
      name: facilityName,
      estimated_weight: totalWeightKg > 0 ? totalWeightKg : undefined,
      estimated_volume: totalVolumeM3 > 0 ? totalVolumeM3 : undefined,
      storage_type: storageType,
      program: dominantProgram,
    },
    warnings,
  };
}

/**
 * Batch-assemble multiple facilities from a flat list of items.
 * Groups items by facility_id automatically.
 */
export function buildAssignableFacilities(
  facilityIds: string[],
  allItems: RequisitionItemSeed[],
  facilityNames?: Record<string, string>
): { facilities: AssignableFacility[]; warnings: string[] } {
  const allWarnings: string[] = [];
  const facilities: AssignableFacility[] = [];

  for (const facilityId of facilityIds) {
    const facilityItems = allItems.filter((i) => i.facility_id === facilityId);
    const { facility, warnings } = buildAssignableFacility(
      facilityId,
      facilityItems,
      facilityNames?.[facilityId]
    );
    facilities.push(facility);
    allWarnings.push(...warnings);
  }

  return { facilities, warnings: allWarnings };
}

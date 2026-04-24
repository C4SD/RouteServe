import { supabase } from '@/integrations/supabase/client';
import type { OperationalZone, LGA } from '@/types/zones';

export interface AssignedLgaMap {
  [lgaBoundaryId: string]: string; // boundaryId → zone_id
}

export interface ConflictInfo {
  boundaryId: string;
  lgaName: string;
  currentZoneId: string;
  currentZoneName: string;
}

export type ConflictMode = 'reassign' | 'skip' | 'cancel';

export interface ZonesWithAssignments {
  zones: OperationalZone[];
  assignedMap: AssignedLgaMap;
  lgas: LGA[];
}

// Color stored in metadata.color (no schema change required)
function extractColor(zone: OperationalZone): string {
  return (zone.metadata as any)?.color ?? '#6366f1';
}

export function zoneColor(zone: OperationalZone): string {
  return extractColor(zone);
}

export async function loadZonesWithAssignments(): Promise<ZonesWithAssignments> {
  const [zonesRes, lgasRes] = await Promise.all([
    supabase.from('zones').select('*').eq('is_active', true).order('name'),
    supabase.from('lgas').select('*, zones(id, name, code)').order('name'),
  ]);

  if (zonesRes.error) throw zonesRes.error;
  if (lgasRes.error) throw lgasRes.error;

  const zones: OperationalZone[] = (zonesRes.data ?? []).map((z) => ({
    id: z.id,
    name: z.name,
    code: z.code,
    region_center: z.region_center as any,
    zone_manager_id: z.zone_manager_id,
    description: z.description,
    is_active: z.is_active,
    metadata: (z.metadata as Record<string, any>) ?? {},
    created_at: z.created_at,
    updated_at: z.updated_at,
    created_by: z.created_by,
    updated_by: z.updated_by,
  }));

  const lgas: LGA[] = (lgasRes.data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    zone_id: l.zone_id,
    warehouse_id: l.warehouse_id,
    state: l.state ?? '',
    population: l.population,
    metadata: (l.metadata as Record<string, any>) ?? {},
    created_at: l.created_at ?? '',
    updated_at: l.updated_at ?? '',
    zones: l.zones as any,
  }));

  // Build map from boundary_id (stored in lga.metadata.boundary_id) → zone_id
  const assignedMap: AssignedLgaMap = {};
  for (const lga of lgas) {
    const boundaryId = (lga.metadata as any)?.boundary_id;
    if (boundaryId && lga.zone_id) {
      assignedMap[boundaryId] = lga.zone_id;
    }
  }

  return { zones, assignedMap, lgas };
}

export async function createZone(name: string, color: string): Promise<OperationalZone> {
  const { data, error } = await supabase
    .from('zones')
    .insert({ name, metadata: { color }, is_active: true, type: 'operational' })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    code: data.code,
    region_center: data.region_center as any,
    zone_manager_id: data.zone_manager_id,
    description: data.description,
    is_active: data.is_active,
    metadata: (data.metadata as Record<string, any>) ?? {},
    created_at: data.created_at,
    updated_at: data.updated_at,
    created_by: data.created_by,
    updated_by: data.updated_by,
  };
}

// Upsert LGA records from boundary features and assign to a zone
// boundaryFeatures: array of {boundaryId, name, state}
export async function assignBoundariesToZone(
  zoneId: string,
  boundaryFeatures: { boundaryId: string; name: string; state: string }[],
  mode: Exclude<ConflictMode, 'cancel'>,
): Promise<{ assigned: string[]; skipped: string[] }> {
  if (boundaryFeatures.length === 0) return { assigned: [], skipped: [] };

  const { data: existingLgas, error: fetchErr } = await supabase
    .from('lgas')
    .select('id, name, state, zone_id, metadata')
    .in('name', boundaryFeatures.map((f) => f.name));

  if (fetchErr) throw fetchErr;

  const existingByKey = new Map<string, typeof existingLgas[number]>();
  for (const lga of existingLgas ?? []) {
    existingByKey.set(`${lga.state}||${lga.name}`, lga);
  }

  const assigned: string[] = [];
  const skipped: string[] = [];

  for (const feature of boundaryFeatures) {
    const key = `${feature.state}||${feature.name}`;
    const existing = existingByKey.get(key);

    if (existing && existing.zone_id && existing.zone_id !== zoneId) {
      if (mode === 'skip') {
        skipped.push(feature.boundaryId);
        continue;
      }
      // mode === 'reassign' — fall through to upsert
    }

    if (existing) {
      const { error } = await supabase
        .from('lgas')
        .update({ zone_id: zoneId, metadata: { ...(existing.metadata as any), boundary_id: feature.boundaryId } })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('lgas')
        .insert({ name: feature.name, state: feature.state, zone_id: zoneId, metadata: { boundary_id: feature.boundaryId } });
      if (error) throw error;
    }
    assigned.push(feature.boundaryId);
  }

  return { assigned, skipped };
}

export async function removeBoundariesFromZone(boundaryIds: string[]): Promise<void> {
  if (boundaryIds.length === 0) return;

  // Find LGAs whose boundary_id is in the list
  const { data, error } = await supabase
    .from('lgas')
    .select('id, metadata');
  if (error) throw error;

  const toUpdate = (data ?? [])
    .filter((l) => boundaryIds.includes((l.metadata as any)?.boundary_id))
    .map((l) => l.id);

  if (toUpdate.length === 0) return;

  const { error: updateErr } = await supabase
    .from('lgas')
    .update({ zone_id: null })
    .in('id', toUpdate);
  if (updateErr) throw updateErr;
}

export async function deleteZone(zoneId: string): Promise<void> {
  // Unassign all LGAs in this zone
  const { error: unassignErr } = await supabase
    .from('lgas')
    .update({ zone_id: null })
    .eq('zone_id', zoneId);
  if (unassignErr) throw unassignErr;

  const { error } = await supabase.from('zones').delete().eq('id', zoneId);
  if (error) throw error;
}

export async function detectConflicts(
  boundaryFeatures: { boundaryId: string; name: string; state: string }[],
  targetZoneId: string,
  zones: OperationalZone[],
): Promise<ConflictInfo[]> {
  const { data, error } = await supabase
    .from('lgas')
    .select('name, state, zone_id, metadata')
    .in('name', boundaryFeatures.map((f) => f.name))
    .not('zone_id', 'is', null)
    .neq('zone_id', targetZoneId);

  if (error) throw error;

  const zoneMap = new Map(zones.map((z) => [z.id, z]));

  return (data ?? []).map((lga) => {
    const currentZone = zoneMap.get(lga.zone_id!);
    const feature = boundaryFeatures.find(
      (f) => f.name === lga.name && f.state === lga.state,
    );
    return {
      boundaryId: (lga.metadata as any)?.boundary_id ?? feature?.boundaryId ?? '',
      lgaName: lga.name,
      currentZoneId: lga.zone_id!,
      currentZoneName: currentZone?.name ?? 'Unknown Zone',
    };
  });
}

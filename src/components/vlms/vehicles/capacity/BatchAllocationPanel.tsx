/**
 * BatchAllocationPanel
 *
 * Full allocation UI: drag facilities into vehicle slots.
 *
 * Modes:
 *   - Auto  → click "Auto Fill", greedy engine assigns all facilities
 *   - Manual → drag items from the left list onto the slot grid
 *   - Hybrid → Auto fill, then manually adjust
 *
 * Props:
 *   vehicle     — VehicleCapacity (from fleetops types)
 *   facilities  — list of items to assign (AssignableFacility)
 *   onSave      — called with final SlotAssignment[] when user confirms
 *   onCancel    — optional dismiss handler
 *   initialAssignments — optional pre-existing assignments (e.g. from DB)
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Wand2,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  GripVertical,
  Package,
  Weight,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SlotGrid } from './SlotGrid';
import {
  generateVehicleSlotMap,
  getTierNameFromSlotKey,
} from '@/fleetops/payload/slot-mapper';
import { autoAssignFacilitiesToSlots } from '@/fleetops/payload/slot-assignment-engine';
import type {
  VehicleCapacity,
  AssignableFacility,
  SlotAssignment,
} from '@/fleetops/payload/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BatchAllocationPanelProps {
  vehicle: VehicleCapacity;
  facilities: AssignableFacility[];
  onSave: (assignments: SlotAssignment[]) => void;
  onCancel?: () => void;
  initialAssignments?: SlotAssignment[];
  /** If true, shows a compact read-only slot view (no drag/drop or buttons) */
  readOnly?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatKg(kg?: number): string {
  if (!kg) return '—';
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${kg} kg`;
}

function formatM3(m3?: number): string {
  if (!m3) return '—';
  return `${m3.toFixed(2)} m³`;
}

function utilizationColor(pct: number): string {
  if (pct >= 95) return 'text-destructive';
  if (pct >= 80) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

function progressColor(pct: number): string {
  if (pct >= 95) return '[&>div]:bg-destructive';
  if (pct >= 80) return '[&>div]:bg-amber-500';
  return '[&>div]:bg-emerald-500';
}

// ─────────────────────────────────────────────────────────────────────────────
// FacilityCard — draggable item in the left panel
// ─────────────────────────────────────────────────────────────────────────────

interface FacilityCardProps {
  facility: AssignableFacility;
  assigned: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function FacilityCard({ facility, assigned, dragging, onDragStart, onDragEnd }: FacilityCardProps) {
  return (
    <div
      draggable={!assigned}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-all',
        assigned
          ? 'opacity-40 bg-muted border-transparent cursor-default'
          : dragging
          ? 'opacity-50 bg-primary/5 border-primary/30 cursor-grabbing'
          : 'bg-card border-border hover:border-primary/40 cursor-grab hover:shadow-sm',
      )}
    >
      <GripVertical
        className={cn('h-4 w-4 shrink-0', assigned ? 'text-muted-foreground/30' : 'text-muted-foreground/60')}
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{facility.name ?? facility.id}</p>
        <p className="text-xs text-muted-foreground">
          {[
            facility.estimated_weight && `${facility.estimated_weight} kg`,
            facility.estimated_volume && `${facility.estimated_volume.toFixed(2)} m³`,
            facility.priority && facility.priority !== 'medium' && facility.priority,
          ]
            .filter(Boolean)
            .join(' · ') || 'No capacity data'}
        </p>
      </div>
      {assigned && (
        <Badge variant="secondary" className="shrink-0 text-xs">
          Assigned
        </Badge>
      )}
      {facility.fragile && !assigned && (
        <Badge variant="outline" className="shrink-0 text-xs text-amber-600 border-amber-400">
          Fragile
        </Badge>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UtilizationBar
// ─────────────────────────────────────────────────────────────────────────────

interface UtilizationBarProps {
  label: string;
  used: number;
  total: number;
  unit: string;
  icon: React.ReactNode;
}

function UtilizationBar({ label, used, total, unit, icon }: UtilizationBarProps) {
  const pct = total > 0 ? Math.min(Math.round((used / total) * 100), 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className={cn('font-semibold tabular-nums', utilizationColor(pct))}>
          {used} / {total} {unit}
          <span className="font-normal text-muted-foreground ml-1">({pct}%)</span>
        </span>
      </div>
      <Progress value={pct} className={cn('h-1.5', progressColor(pct))} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BatchAllocationPanel
// ─────────────────────────────────────────────────────────────────────────────

export function BatchAllocationPanel({
  vehicle,
  facilities,
  onSave,
  onCancel,
  initialAssignments = [],
  readOnly = false,
}: BatchAllocationPanelProps) {
  // ── State ──────────────────────────────────────────────────────────────────

  const [slotAssignments, setSlotAssignments] = useState<Map<string, AssignableFacility>>(() => {
    const map = new Map<string, AssignableFacility>();
    for (const assignment of initialAssignments) {
      const facility = facilities.find((f) => f.id === assignment.facility_id);
      if (facility) map.set(assignment.slot_key, facility);
    }
    return map;
  });

  const [draggingFacility, setDraggingFacility] = useState<AssignableFacility | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const assignedIds = useMemo(
    () => new Set([...slotAssignments.values()].map((f) => f.id)),
    [slotAssignments],
  );

  const unassignedFacilities = useMemo(
    () => facilities.filter((f) => !assignedIds.has(f.id)),
    [facilities, assignedIds],
  );

  // Convert map → SlotAssignment[] for slot mapper
  const currentSlotAssignments: SlotAssignment[] = useMemo(
    () =>
      [...slotAssignments.entries()].map(([slotKey, facility], i) => ({
        slot_key: slotKey,
        vehicle_id: vehicle.vehicle_id,
        tier_name: getTierNameFromSlotKey(slotKey) ?? '',
        slot_number: parseInt(slotKey.split('-').pop() ?? '0', 10),
        facility_id: facility.id,
        load_kg: facility.estimated_weight,
        load_volume_m3: facility.estimated_volume,
        sequence_order: i + 1,
      })),
    [slotAssignments, vehicle.vehicle_id],
  );

  // Generate full slot map (marks occupied slots)
  const slots = useMemo(
    () => generateVehicleSlotMap(vehicle, currentSlotAssignments),
    [vehicle, currentSlotAssignments],
  );

  // Utilization stats
  const stats = useMemo(() => {
    const totalSlots = slots.length;
    const usedSlots = slotAssignments.size;
    const totalWeight = vehicle.capacity_kg ?? 0;
    const totalVolume = vehicle.capacity_m3 ?? 0;
    const usedWeight = [...slotAssignments.values()].reduce(
      (sum, f) => sum + (f.estimated_weight ?? 0),
      0,
    );
    const usedVolume = [...slotAssignments.values()].reduce(
      (sum, f) => sum + (f.estimated_volume ?? 0),
      0,
    );
    return { totalSlots, usedSlots, totalWeight, totalVolume, usedWeight, usedVolume };
  }, [slots, slotAssignments, vehicle]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSlotDrop = useCallback(
    (slotKey: string) => {
      if (!draggingFacility) return;

      // Weight check: total assigned weight + this facility ≤ vehicle capacity
      const newTotalWeight =
        stats.usedWeight + (draggingFacility.estimated_weight ?? 0);
      if (vehicle.capacity_kg && newTotalWeight > vehicle.capacity_kg) {
        setErrors([
          `Cannot assign — would exceed vehicle weight capacity (${formatKg(vehicle.capacity_kg)})`,
        ]);
        return;
      }

      setErrors([]);
      setSlotAssignments((prev) => {
        const next = new Map(prev);
        next.set(slotKey, draggingFacility);
        return next;
      });
    },
    [draggingFacility, stats.usedWeight, vehicle.capacity_kg],
  );

  const handleSlotClear = useCallback((slotKey: string) => {
    setSlotAssignments((prev) => {
      const next = new Map(prev);
      next.delete(slotKey);
      return next;
    });
    setErrors([]);
  }, []);

  const handleAutoFill = useCallback(() => {
    setErrors([]);
    setWarnings([]);

    const result = autoAssignFacilitiesToSlots(unassignedFacilities, vehicle, {
      rules: [{ priority: 'weight', order: 'descending' }],
      fillStrategy: 'lower-first',
    });

    if (result.assignments.length > 0) {
      setSlotAssignments((prev) => {
        const next = new Map(prev);
        for (const assignment of result.assignments) {
          const facility = facilities.find((f) => f.id === assignment.facility_id);
          if (facility) next.set(assignment.slot_key, facility);
        }
        return next;
      });
    }

    if (result.errors.length > 0) setErrors(result.errors);
    if (result.warnings.length > 0) setWarnings(result.warnings);
  }, [unassignedFacilities, vehicle, facilities]);

  const handleClearAll = useCallback(() => {
    setSlotAssignments(new Map());
    setErrors([]);
    setWarnings([]);
  }, []);

  const handleSave = useCallback(() => {
    onSave(currentSlotAssignments);
  }, [currentSlotAssignments, onSave]);

  // ── Render ────────────────────────────────────────────────────────────────

  const slotPct =
    stats.totalSlots > 0 ? Math.round((stats.usedSlots / stats.totalSlots) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 min-h-0">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            Load Plan
            <Badge variant="outline" className="font-mono text-xs">
              {stats.usedSlots}/{stats.totalSlots} slots
            </Badge>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {vehicle.license_plate ?? vehicle.vehicle_id} ·{' '}
            {unassignedFacilities.length > 0
              ? `${unassignedFacilities.length} unassigned`
              : 'All assigned'}
          </p>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearAll}
              disabled={slotAssignments.size === 0}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Clear
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleAutoFill}
              disabled={unassignedFacilities.length === 0 || slots.filter((s) => !s.occupied).length === 0}
            >
              <Wand2 className="h-3.5 w-3.5 mr-1.5" />
              Auto Fill
            </Button>
          </div>
        )}
      </div>

      {/* ── Utilization Summary ────────────────────────────────────────── */}
      <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
        <UtilizationBar
          label="Slots"
          used={stats.usedSlots}
          total={stats.totalSlots}
          unit="slots"
          icon={<Package className="h-3 w-3" />}
        />
        {stats.totalWeight > 0 && (
          <UtilizationBar
            label="Weight"
            used={Math.round(stats.usedWeight)}
            total={stats.totalWeight}
            unit="kg"
            icon={<Weight className="h-3 w-3" />}
          />
        )}
      </div>

      {/* ── Errors / Warnings ─────────────────────────────────────────── */}
      {errors.length > 0 && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {errors.map((e, i) => <div key={i}>{e}</div>)}
          </AlertDescription>
        </Alert>
      )}
      {warnings.length > 0 && errors.length === 0 && (
        <Alert className="py-2 border-amber-400/60 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-xs text-amber-700 dark:text-amber-400">
            {warnings.map((w, i) => <div key={i}>{w}</div>)}
          </AlertDescription>
        </Alert>
      )}

      {/* ── Main: facilities list + slot grid ─────────────────────────── */}
      <div className="flex gap-4 min-h-0 flex-1">
        {/* Left: Facility list */}
        {!readOnly && (
          <div className="w-52 shrink-0 flex flex-col gap-2 min-h-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Items ({facilities.length})
            </p>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {facilities.map((facility) => (
                <FacilityCard
                  key={facility.id}
                  facility={facility}
                  assigned={assignedIds.has(facility.id)}
                  dragging={draggingFacility?.id === facility.id}
                  onDragStart={() => setDraggingFacility(facility)}
                  onDragEnd={() => setDraggingFacility(null)}
                />
              ))}
              {facilities.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No facilities to assign
                </p>
              )}
            </div>
          </div>
        )}

        {!readOnly && <Separator orientation="vertical" className="h-auto" />}

        {/* Right: Slot grid */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <SlotGrid
            slots={slots}
            assignments={slotAssignments}
            draggingFacility={draggingFacility}
            onSlotDrop={handleSlotDrop}
            onSlotClear={handleSlotClear}
            compact={readOnly}
          />
        </div>
      </div>

      {/* ── Footer: save / cancel ──────────────────────────────────────── */}
      {!readOnly && (
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            {unassignedFacilities.length === 0 && slotAssignments.size > 0 ? (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                All items assigned
              </span>
            ) : (
              `${unassignedFacilities.length} of ${facilities.length} unassigned`
            )}
          </div>
          <div className="flex gap-2">
            {onCancel && (
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={slotAssignments.size === 0}
            >
              Confirm Load Plan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

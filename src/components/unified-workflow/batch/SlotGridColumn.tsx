/**
 * =====================================================
 * Slot Grid Column (Middle Column - Step 3)
 * =====================================================
 * Multi-vehicle selector + interactive slot grid.
 * Multiple vehicles can be assigned to a batch.
 * The slot grid shows slots for the currently "active" vehicle tab.
 */

import * as React from 'react';
import { Truck, AlertTriangle, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { InteractiveSlotGrid } from './InteractiveSlotGrid';
import type { SlotAssignment, WorkingSetItem } from '@/types/unified-workflow';

interface Vehicle {
  id: string;
  model: string;
  plateNumber: string;
  capacity: number;
  maxWeight: number;
  status: 'available' | 'in-use' | 'maintenance';
  tiered_config?: {
    tiers: Array<{
      tier_name: string;
      tier_order: number;
      slot_count: number;
      capacity_kg?: number;
      capacity_m3?: number;
    }>;
  };
}

interface SlotGridColumnProps {
  selectedVehicleId: string | null; // primary vehicle for slot grid
  selectedVehicleIds?: string[];
  vehicles: Vehicle[];
  onVehicleChange: (vehicleId: string) => void;
  onVehiclesChange?: (vehicleIds: string[]) => void;
  slotAssignments: Record<string, SlotAssignment>;
  availableFacilities: WorkingSetItem[];
  onAssignSlot: (slotKey: string, facilityId: string, requisitionIds: string[]) => void;
  onUnassignSlot: (slotKey: string) => void;
  onAutoAssign: () => void;
  isLoading?: boolean;
  className?: string;
}

export function SlotGridColumn({
  selectedVehicleId,
  selectedVehicleIds = [],
  vehicles,
  onVehicleChange,
  onVehiclesChange,
  slotAssignments,
  availableFacilities,
  onAssignSlot,
  onUnassignSlot,
  onAutoAssign,
  isLoading = false,
  className,
}: SlotGridColumnProps) {
  // activeVehicleId drives the slot grid display; defaults to first selected
  const [activeVehicleId, setActiveVehicleId] = React.useState<string | null>(
    selectedVehicleId
  );

  // Sync active vehicle when selection changes
  React.useEffect(() => {
    if (selectedVehicleIds.length > 0 && !selectedVehicleIds.includes(activeVehicleId ?? '')) {
      setActiveVehicleId(selectedVehicleIds[0]);
    } else if (selectedVehicleIds.length === 0) {
      setActiveVehicleId(null);
    }
  }, [selectedVehicleIds, activeVehicleId]);

  const activeVehicle = vehicles.find((v) => v.id === activeVehicleId) || null;
  const selectedVehicles = vehicles.filter(v => selectedVehicleIds.includes(v.id));

  const availableVehicles = vehicles.filter((v) => v.status === 'available');
  const inUseVehicles = vehicles.filter((v) => v.status === 'in-use');
  const maintenanceVehicles = vehicles.filter((v) => v.status === 'maintenance');

  const getVehicleSlots = (v: Vehicle) =>
    v.tiered_config?.tiers?.reduce((s, t) => s + (t.slot_count || 0), 0) ?? 0;

  // Combined capacity across all selected vehicles
  const totalSlots = React.useMemo(
    () => selectedVehicles.reduce((s, v) => s + getVehicleSlots(v), 0),
    [selectedVehicles]
  );

  const requiredSlots = React.useMemo(
    () => availableFacilities.reduce((sum, f) => sum + (f.slot_demand || 1), 0),
    [availableFacilities]
  );

  const hasCapacityIssue = totalSlots > 0 && requiredSlots > totalSlots;

  const toggleVehicle = (vehicleId: string) => {
    const next = selectedVehicleIds.includes(vehicleId)
      ? selectedVehicleIds.filter(id => id !== vehicleId)
      : [...selectedVehicleIds, vehicleId];
    onVehiclesChange?.(next);
    // Also call legacy single-vehicle handler for the first vehicle
    if (next.length > 0) onVehicleChange(next[0]);
    // Update active vehicle for slot grid
    if (!selectedVehicleIds.includes(vehicleId)) setActiveVehicleId(vehicleId);
    else if (activeVehicleId === vehicleId) setActiveVehicleId(next[0] ?? null);
  };

  const removeVehicle = (vehicleId: string) => {
    const next = selectedVehicleIds.filter(id => id !== vehicleId);
    onVehiclesChange?.(next);
    if (next.length > 0) onVehicleChange(next[0]);
    if (activeVehicleId === vehicleId) setActiveVehicleId(next[0] ?? null);
  };

  const renderVehicleRow = (v: Vehicle) => {
    const checked = selectedVehicleIds.includes(v.id);
    const slots = getVehicleSlots(v);
    return (
      <div
        key={v.id}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
        onClick={() => toggleVehicle(v.id)}
      >
        <Checkbox checked={checked} onCheckedChange={() => toggleVehicle(v.id)} />
        <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs flex-1 truncate">{v.model} ({v.plateNumber})</span>
        {slots > 0 && <Badge variant="outline" className="text-xs shrink-0">{slots}sl</Badge>}
      </div>
    );
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Vehicle Multi-Selector */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs font-medium">Vehicles</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select one or more vehicles for this batch
            </p>
          </div>
          {selectedVehicles.length > 0 && (
            <Badge variant="secondary">{selectedVehicles.length} selected</Badge>
          )}
        </div>

        {/* Selected vehicle chips */}
        {selectedVehicles.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedVehicles.map(v => (
              <Badge
                key={v.id}
                variant={activeVehicleId === v.id ? 'default' : 'secondary'}
                className="gap-1 pr-1 cursor-pointer"
                onClick={() => setActiveVehicleId(v.id)}
              >
                {v.model}
                <button
                  onClick={(e) => { e.stopPropagation(); removeVehicle(v.id); }}
                  className="ml-0.5 rounded-full hover:bg-foreground/20 p-0.5"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Vehicle list */}
        <ScrollArea className="h-36 rounded-md border">
          <div className="p-2 space-y-0.5">
            {availableVehicles.length > 0 && (
              <>
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  Available ({availableVehicles.length})
                </div>
                {availableVehicles.map(renderVehicleRow)}
              </>
            )}
            {inUseVehicles.length > 0 && (
              <>
                <Separator className="my-1" />
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  In Use ({inUseVehicles.length})
                </div>
                {inUseVehicles.map(renderVehicleRow)}
              </>
            )}
            {maintenanceVehicles.length > 0 && (
              <>
                <Separator className="my-1" />
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  Maintenance
                </div>
                {maintenanceVehicles.map(renderVehicleRow)}
              </>
            )}
            {vehicles.length === 0 && (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">No vehicles found</div>
            )}
          </div>
        </ScrollArea>

        {/* Capacity status */}
        {selectedVehicles.length > 0 && hasCapacityIssue && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-medium text-amber-700 dark:text-amber-400">Capacity Warning</p>
              <p className="text-muted-foreground mt-0.5">
                {requiredSlots} slots needed, {totalSlots} available across {selectedVehicles.length} vehicle{selectedVehicles.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}
        {selectedVehicles.length > 0 && !hasCapacityIssue && totalSlots > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/30">
            <Check className="h-4 w-4 text-green-600" />
            <span className="text-xs text-green-700 dark:text-green-400">
              Capacity OK ({requiredSlots}/{totalSlots} slots)
            </span>
          </div>
        )}

        {/* Per-vehicle tab selector when multiple vehicles selected */}
        {selectedVehicles.length > 1 && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Slot grid for:</Label>
            <div className="flex gap-1 flex-wrap">
              {selectedVehicles.map(v => (
                <button
                  key={v.id}
                  onClick={() => setActiveVehicleId(v.id)}
                  className={cn(
                    'text-xs px-2 py-1 rounded border',
                    activeVehicleId === v.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 border-border hover:bg-muted'
                  )}
                >
                  {v.plateNumber}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Slot Grid for active vehicle */}
      <div className="flex-1 min-h-0">
        <InteractiveSlotGrid
          vehicle={activeVehicle}
          slotAssignments={slotAssignments}
          availableFacilities={availableFacilities}
          onAssignSlot={onAssignSlot}
          onUnassignSlot={onUnassignSlot}
          onAutoAssign={onAutoAssign}
          className="h-full"
        />
      </div>
    </div>
  );
}

export default SlotGridColumn;

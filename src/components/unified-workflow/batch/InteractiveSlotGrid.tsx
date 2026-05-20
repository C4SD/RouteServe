/**
 * =====================================================
 * Interactive Slot Grid
 * =====================================================
 * Clickable slot grid for assigning facility consignments
 * to vehicle slots. Based on VehicleSlotGrid but interactive.
 */

import * as React from 'react';
import {
  Package,
  Plus,
  X,
  Truck,
  AlertTriangle,
  CheckCircle,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { SlotAssignment, WorkingSetItem } from '@/types/unified-workflow';

interface TierConfig {
  tier_name: string;
  tier_order: number;
  slot_count: number;
  capacity_kg?: number;
  capacity_m3?: number;
}

interface Vehicle {
  id: string;
  model: string;
  plateNumber: string;
  capacity: number;
  maxWeight: number;
  tiered_config?: {
    tiers: TierConfig[];
  };
}

interface InteractiveSlotGridProps {
  vehicle: Vehicle | null;
  slotAssignments: Record<string, SlotAssignment>;
  availableFacilities: WorkingSetItem[];
  onAssignSlot: (slotKey: string, facilityId: string, requisitionIds: string[]) => void;
  onUnassignSlot: (slotKey: string) => void;
  onAutoAssign: () => void;
  className?: string;
}

export function InteractiveSlotGrid({
  vehicle,
  slotAssignments,
  availableFacilities,
  onAssignSlot,
  onUnassignSlot,
  onAutoAssign,
  className,
}: InteractiveSlotGridProps) {
  // Parse tiered config
  const tiers = React.useMemo(() => {
    if (!vehicle?.tiered_config?.tiers) return [];
    return [...vehicle.tiered_config.tiers].sort((a, b) => a.tier_order - b.tier_order);
  }, [vehicle]);

  // Calculate slot utilization
  const slotInfo = React.useMemo(() => {
    const totalSlots = tiers.reduce((sum, tier) => sum + (tier.slot_count || 0), 0);
    const assignedSlots = Object.keys(slotAssignments).length;
    const utilizationPct = totalSlots > 0 ? Math.round((assignedSlots / totalSlots) * 100) : 0;
    const isOverflow = assignedSlots > totalSlots;

    return {
      totalSlots,
      assignedSlots,
      availableSlots: totalSlots - assignedSlots,
      utilizationPct: Math.min(utilizationPct, 100),
      isOverflow,
    };
  }, [tiers, slotAssignments]);

  // Get unassigned facilities
  const unassignedFacilities = React.useMemo(() => {
    const assignedFacilityIds = new Set(
      Object.values(slotAssignments).map((a) => a.facility_id)
    );
    return availableFacilities.filter((f) => !assignedFacilityIds.has(f.facility_id));
  }, [availableFacilities, slotAssignments]);

  if (!vehicle) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full text-muted-foreground p-4', className)}>
        <Truck className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">No vehicle selected</p>
        <p className="text-xs mt-1">Select a vehicle to see slot configuration</p>
      </div>
    );
  }

  if (tiers.length === 0) {
    return (
      <div className={cn('rounded-lg border p-4', className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Truck className="h-5 w-5" />
          <span className="text-sm">
            {vehicle.model} - {vehicle.capacity}m³ / {vehicle.maxWeight}kg
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          This vehicle does not have slot configuration.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium text-sm">{vehicle.model}</span>
          <Badge variant="outline" className="text-xs">
            {vehicle.plateNumber}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {slotInfo.isOverflow ? (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Overflow
            </Badge>
          ) : slotInfo.assignedSlots === slotInfo.totalSlots ? (
            <Badge variant="default" className="flex items-center gap-1 bg-green-600">
              <CheckCircle className="h-3 w-3" />
              Full
            </Badge>
          ) : (
            <Badge variant="secondary">
              {slotInfo.assignedSlots} / {slotInfo.totalSlots} slots
            </Badge>
          )}
        </div>
      </div>

      {/* Utilization Bar */}
      <div className="px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">Slot Utilization</span>
          <span className={cn('font-medium', slotInfo.isOverflow && 'text-destructive')}>
            {slotInfo.utilizationPct}%
          </span>
        </div>
        <Progress
          value={slotInfo.utilizationPct}
          className={cn('h-2', slotInfo.isOverflow && '[&>div]:bg-destructive')}
        />
      </div>

      {/* Slot Grid */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {tiers.map((tier) => (
            <TierRow
              key={tier.tier_name}
              tier={tier}
              slotAssignments={slotAssignments}
              unassignedFacilities={unassignedFacilities}
              onAssignSlot={onAssignSlot}
              onUnassignSlot={onUnassignSlot}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Footer with Auto-assign */}
      <div className="px-4 py-3 border-t bg-muted/30 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {unassignedFacilities.length} facilities unassigned
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onAutoAssign}
          disabled={unassignedFacilities.length === 0 || slotInfo.availableSlots === 0}
        >
          Auto-assign All
        </Button>
      </div>
    </div>
  );
}

// =====================================================
// Tier Row Sub-component
// =====================================================

interface TierRowProps {
  tier: TierConfig;
  slotAssignments: Record<string, SlotAssignment>;
  unassignedFacilities: WorkingSetItem[];
  onAssignSlot: (slotKey: string, facilityId: string, requisitionIds: string[]) => void;
  onUnassignSlot: (slotKey: string) => void;
}

function TierRow({
  tier,
  slotAssignments,
  unassignedFacilities,
  onAssignSlot,
  onUnassignSlot,
}: TierRowProps) {
  // Generate slot keys for this tier
  const slots = React.useMemo(() => {
    return Array.from({ length: tier.slot_count }, (_, idx) => ({
      slotKey: `${tier.tier_name}-${idx + 1}`,
      slotNumber: idx + 1,
      tierName: tier.tier_name,
    }));
  }, [tier]);

  return (
    <div className="rounded-lg border p-3 bg-card">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">{tier.tier_name}</span>
        <span className="text-xs text-muted-foreground">
          {tier.slot_count} slots
          {tier.capacity_kg && ` • ${tier.capacity_kg}kg`}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {slots.map((slot) => {
          const assignment = slotAssignments[slot.slotKey];
          return (
            <SlotCell
              key={slot.slotKey}
              slotKey={slot.slotKey}
              slotNumber={slot.slotNumber}
              tierName={slot.tierName}
              assignment={assignment}
              unassignedFacilities={unassignedFacilities}
              onAssign={(facilityId, requisitionIds) =>
                onAssignSlot(slot.slotKey, facilityId, requisitionIds)
              }
              onUnassign={() => onUnassignSlot(slot.slotKey)}
            />
          );
        })}
      </div>
    </div>
  );
}

// =====================================================
// Slot Cell Sub-component
// =====================================================

interface SlotCellProps {
  slotKey: string;
  slotNumber: number;
  tierName: string;
  assignment: SlotAssignment | undefined;
  unassignedFacilities: WorkingSetItem[];
  onAssign: (facilityId: string, requisitionIds: string[]) => void;
  onUnassign: () => void;
}

function SlotCell({
  slotKey,
  slotNumber,
  tierName,
  assignment,
  unassignedFacilities,
  onAssign,
  onUnassign,
}: SlotCellProps) {
  const [popoverOpen, setPopoverOpen] = React.useState(false);

  const handleSelect = (facility: WorkingSetItem) => {
    onAssign(facility.facility_id, facility.requisition_ids);
    setPopoverOpen(false);
  };

  // Assigned slot
  if (assignment) {
    return (
      <div
        className={cn(
          'relative group aspect-square rounded-lg border-2 border-primary bg-primary/10',
          'flex flex-col items-center justify-center p-1 transition-all'
        )}
      >
        <Package className="h-4 w-4 text-primary mb-0.5" />
        <span className="text-[10px] font-medium text-primary truncate max-w-full px-1">
          {assignment.facility_name?.split(' ')[0] || 'Assigned'}
        </span>
        {/* Unassign button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground shadow-sm"
          onClick={onUnassign}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // Empty slot with popover for assignment
  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30',
            'flex flex-col items-center justify-center transition-all',
            'hover:border-primary hover:bg-primary/5 cursor-pointer',
            unassignedFacilities.length === 0 && 'opacity-50 cursor-not-allowed'
          )}
          disabled={unassignedFacilities.length === 0}
        >
          <Plus className="h-4 w-4 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground mt-0.5">
            {tierName[0]}{slotNumber}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="text-xs font-medium mb-2 text-muted-foreground">
          Assign to {tierName} Slot {slotNumber}
        </div>
        <ScrollArea className="max-h-48">
          <div className="space-y-1">
            {unassignedFacilities.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                All facilities assigned
              </p>
            ) : (
              unassignedFacilities.map((facility) => (
                <button
                  key={facility.facility_id}
                  onClick={() => handleSelect(facility)}
                  className={cn(
                    'w-full flex items-center gap-2 p-2 rounded-md text-left',
                    'hover:bg-accent transition-colors'
                  )}
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                    <Package className="h-3 w-3 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {facility.facility_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {facility.slot_demand} slots
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export default InteractiveSlotGrid;

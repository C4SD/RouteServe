/**
 * =====================================================
 * Vehicle Allocation Panel
 * =====================================================
 * Shows per-vehicle facility assignments and slot usage
 * for multi-vehicle batches. Advisory warnings on
 * overlapping assignments or capacity issues.
 */

import * as React from 'react';
import { Truck, AlertTriangle, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { WorkingSetItem, SlotAssignment } from '@/types/unified-workflow';

interface VehicleInfo {
  id: string;
  model: string;
  plateNumber: string;
  capacity: number; // total slots
  maxWeight: number;
  status: 'available' | 'in-use' | 'maintenance';
}

interface VehicleAllocationPanelProps {
  vehicles: VehicleInfo[];
  selectedVehicleIds: string[];
  facilities: WorkingSetItem[];
  slotAssignments: Record<string, SlotAssignment>;
  className?: string;
}

interface VehicleAllocation {
  vehicle: VehicleInfo;
  facilities: WorkingSetItem[];
  slotsUsed: number;
  capacitySlots: number;
  utilizationPct: number;
  warnings: string[];
}

function buildAllocations(
  vehicles: VehicleInfo[],
  selectedIds: string[],
  facilities: WorkingSetItem[],
  slotAssignments: Record<string, SlotAssignment>
): VehicleAllocation[] {
  const selectedVehicles = vehicles.filter((v) => selectedIds.includes(v.id));
  if (selectedVehicles.length === 0) return [];

  return selectedVehicles.map((vehicle) => {
    // Find slot assignments that belong to this vehicle
    const vehicleSlots = Object.values(slotAssignments).filter((sa) =>
      sa.slot_key.startsWith(`${vehicle.id}-`)
    );

    const assignedFacilityIds = new Set(vehicleSlots.map((sa) => sa.facility_id));
    const vehicleFacilities = facilities.filter((f) =>
      assignedFacilityIds.has(f.facility_id)
    );

    const slotsUsed = vehicleSlots.reduce((sum, sa) => sum + (sa.slot_demand || 1), 0);
    const capacitySlots = vehicle.capacity > 0 ? Math.floor(vehicle.capacity) : 10;
    const utilizationPct = Math.min(Math.round((slotsUsed / capacitySlots) * 100), 100);

    const warnings: string[] = [];
    if (slotsUsed > capacitySlots) {
      warnings.push(`Over capacity by ${slotsUsed - capacitySlots} slots`);
    }
    if (vehicle.status === 'maintenance') {
      warnings.push('Vehicle flagged for maintenance');
    }
    if (vehicle.status === 'in-use') {
      warnings.push('Vehicle currently in use');
    }

    return {
      vehicle,
      facilities: vehicleFacilities,
      slotsUsed,
      capacitySlots,
      utilizationPct,
      warnings,
    };
  });
}

export function VehicleAllocationPanel({
  vehicles,
  selectedVehicleIds,
  facilities,
  slotAssignments,
  className,
}: VehicleAllocationPanelProps) {
  const allocations = React.useMemo(
    () => buildAllocations(vehicles, selectedVehicleIds, facilities, slotAssignments),
    [vehicles, selectedVehicleIds, facilities, slotAssignments]
  );

  // Check for facilities assigned to multiple vehicles (overlap warning)
  const facilityVehicleCount = React.useMemo(() => {
    const counts: Record<string, number> = {};
    allocations.forEach((alloc) => {
      alloc.facilities.forEach((f) => {
        counts[f.facility_id] = (counts[f.facility_id] ?? 0) + 1;
      });
    });
    return counts;
  }, [allocations]);

  const overlappingFacilities = Object.entries(facilityVehicleCount)
    .filter(([, count]) => count > 1)
    .map(([id]) => facilities.find((f) => f.facility_id === id)?.facility_name ?? id);

  if (allocations.length === 0) {
    return null;
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Truck className="h-4 w-4" />
          Vehicle Allocation
          <Badge variant="outline" className="text-xs ml-auto">
            {allocations.length} vehicle{allocations.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
        {overlappingFacilities.length > 0 && (
          <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mt-1">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Overlapping assignment:{' '}
              <span className="font-medium">
                {overlappingFacilities.slice(0, 3).join(', ')}
                {overlappingFacilities.length > 3 && ` +${overlappingFacilities.length - 3} more`}
              </span>
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {allocations.map((alloc) => (
          <AllocationCard key={alloc.vehicle.id} allocation={alloc} />
        ))}
      </CardContent>
    </Card>
  );
}

function AllocationCard({ allocation }: { allocation: VehicleAllocation }) {
  const { vehicle, facilities, slotsUsed, capacitySlots, utilizationPct, warnings } = allocation;
  const isOverCapacity = slotsUsed > capacitySlots;

  return (
    <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
      {/* Vehicle header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Truck className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{vehicle.model}</span>
          <span className="text-xs text-muted-foreground">{vehicle.plateNumber}</span>
        </div>
        <div className="flex items-center gap-1">
          {warnings.length > 0 && (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          )}
          <Badge
            variant="outline"
            className={cn(
              'text-xs px-1.5',
              isOverCapacity
                ? 'border-red-300 text-red-700 bg-red-50'
                : 'border-muted'
            )}
          >
            {slotsUsed}/{capacitySlots} slots
          </Badge>
        </div>
      </div>

      {/* Capacity bar */}
      <div className="space-y-1">
        <Progress
          value={Math.min(utilizationPct, 100)}
          className={cn(
            'h-1.5',
            isOverCapacity
              ? '[&>div]:bg-red-500'
              : utilizationPct > 85
              ? '[&>div]:bg-amber-500'
              : '[&>div]:bg-green-500'
          )}
        />
        <p className="text-[10px] text-muted-foreground text-right">
          {utilizationPct}% capacity
        </p>
      </div>

      {/* Assigned facilities */}
      {facilities.length > 0 ? (
        <div className="flex items-start gap-1.5">
          <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            {facilities
              .slice(0, 5)
              .map((f) => f.facility_name)
              .join(', ')}
            {facilities.length > 5 && ` +${facilities.length - 5} more`}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          No facilities assigned to this vehicle yet
        </p>
      )}

      {/* Inline warnings */}
      {warnings.map((w, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {w}
        </div>
      ))}
    </div>
  );
}

export default VehicleAllocationPanel;

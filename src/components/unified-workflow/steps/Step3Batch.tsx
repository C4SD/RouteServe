/**
 * =====================================================
 * Step 3: Batch Phase
 * =====================================================
 * 3-column layout for batch configuration:
 * - Left: Facility Schedule List (route sequence)
 * - Middle: Slot Grid (vehicle + slots)
 * - Right: Schedule Details (info + driver)
 */

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ThreeColumnLayout, LeftColumn, MiddleColumn, RightColumn } from '../schedule/ThreeColumnLayout';
import { FacilityScheduleList } from '../batch/FacilityScheduleList';
import { SlotGridColumn } from '../batch/SlotGridColumn';
import { ScheduleDetailsColumn } from '../batch/ScheduleDetailsColumn';
import type { WorkingSetItem, SlotAssignment } from '@/types/unified-workflow';
import type { TimeWindow, Priority } from '@/types/scheduler';

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

interface Driver {
  id: string;
  name: string;
  phone?: string;
  status: 'available' | 'busy' | 'offline';
  licenseType?: string;
}

interface Step3BatchProps {
  // Batch Info
  batchName: string | null;
  onBatchNameChange: (name: string) => void;
  priority: Priority;
  onPriorityChange: (priority: Priority) => void;

  // Schedule Info (from Step 2)
  scheduleTitle: string | null;
  startLocationName: string | null;
  plannedDate: string | null;
  timeWindow: TimeWindow | null;

  // Facilities (from Step 2)
  facilities: WorkingSetItem[];

  // Vehicle (multi)
  selectedVehicleIds: string[];
  vehicles: Vehicle[];
  onVehicleChange: (vehicleId: string) => void;
  onVehiclesChange: (vehicleIds: string[]) => void;

  // Driver
  selectedDriverId: string | null;
  drivers: Driver[];
  onDriverChange: (driverId: string | null) => void;

  // Slot Assignments
  slotAssignments: Record<string, SlotAssignment>;
  onAssignSlot: (slotKey: string, facilityId: string, requisitionIds: string[]) => void;
  onUnassignSlot: (slotKey: string) => void;
  onAutoAssign: () => void;

  // Route Info
  totalDistanceKm: number | null;
  estimatedDurationMin: number | null;
}

export function Step3Batch({
  batchName,
  onBatchNameChange,
  priority,
  onPriorityChange,
  scheduleTitle,
  startLocationName,
  plannedDate,
  timeWindow,
  facilities,
  selectedVehicleIds,
  vehicles,
  onVehicleChange,
  onVehiclesChange,
  selectedDriverId,
  drivers,
  onDriverChange,
  slotAssignments,
  onAssignSlot,
  onUnassignSlot,
  onAutoAssign,
  totalDistanceKm,
  estimatedDurationMin,
}: Step3BatchProps) {
  // Start location for route display
  const startLocation = React.useMemo(() => {
    if (!startLocationName) return null;
    return { id: 'start', name: startLocationName, type: 'warehouse' as const };
  }, [startLocationName]);

  return (
    <div className="flex flex-col min-h-[65vh]">
      {/* Batch Header */}
      <div className="p-4 border-b bg-muted/30">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Batch Name */}
          <div>
            <Label htmlFor="batch-name" className="text-xs font-medium">
              Batch Name
            </Label>
            <Input
              id="batch-name"
              value={batchName || ''}
              onChange={(e) => onBatchNameChange(e.target.value)}
              placeholder="Enter batch name..."
              className="mt-1"
            />
          </div>

          {/* Schedule Reference */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground">
              Schedule Reference
            </Label>
            <div className="mt-1 p-2 rounded-md bg-muted/50 border text-sm">
              {scheduleTitle || 'No schedule title'}
            </div>
          </div>

          {/* Priority */}
          <div>
            <Label className="text-xs font-medium">Priority</Label>
            <Select value={priority} onValueChange={(v) => onPriorityChange(v as Priority)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="flex-1 min-h-0 p-4">
        <ThreeColumnLayout className="h-full">
          {/* Left Column: Route Sequence */}
          <LeftColumn>
            <FacilityScheduleList
              facilities={facilities}
              startLocation={startLocation}
            />
          </LeftColumn>

          {/* Middle Column: Slot Grid */}
          <MiddleColumn>
            <SlotGridColumn
              selectedVehicleId={selectedVehicleIds[0] ?? null}
              selectedVehicleIds={selectedVehicleIds}
              vehicles={vehicles}
              onVehicleChange={onVehicleChange}
              onVehiclesChange={onVehiclesChange}
              slotAssignments={slotAssignments}
              availableFacilities={facilities}
              onAssignSlot={onAssignSlot}
              onUnassignSlot={onUnassignSlot}
              onAutoAssign={onAutoAssign}
            />
          </MiddleColumn>

          {/* Right Column: Details */}
          <RightColumn>
            <ScheduleDetailsColumn
              scheduleTitle={scheduleTitle}
              startLocationName={startLocationName}
              plannedDate={plannedDate}
              timeWindow={timeWindow}
              priority={priority}
              totalDistanceKm={totalDistanceKm}
              estimatedDurationMin={estimatedDurationMin}
              selectedDriverId={selectedDriverId}
              drivers={drivers}
              onDriverChange={onDriverChange}
              facilities={facilities}
            />
          </RightColumn>
        </ThreeColumnLayout>
      </div>
    </div>
  );
}

export default Step3Batch;

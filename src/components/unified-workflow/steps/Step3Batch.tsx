/**
 * =====================================================
 * Step 5: Batch — Manual Scheduling
 * =====================================================
 * Resource-aware execution planning.
 *
 * Architecture:
 *   Facilities → Operational Clustering
 *             → Initial Projection (pre-vehicle)
 *             → Vehicle Assignment
 *             → Dynamic Resimulation
 *             → Execution Waves → Dispatch Runs
 *
 * Users retain full control. The engine simulates and
 * warns; it never auto-dispatches.
 *
 * Layout:
 *   [Execution Strategy Bar]
 *   [Left: Wave List] [Center: Wave Vehicle Assignment] [Right: Schedule + Analysis]
 */

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ThreeColumnLayout, LeftColumn, MiddleColumn, RightColumn } from '../schedule/ThreeColumnLayout';
import { ScheduleDetailsColumn } from '../batch/ScheduleDetailsColumn';
import { VehicleAvailabilityPanel } from '../batch/VehicleAvailabilityPanel';
import { ExecutionStrategyBar } from '../batch/ExecutionStrategyBar';
import { WaveGroupedFacilityList } from '../batch/WaveGroupedFacilityList';
import { WaveVehicleAssignmentPanel } from '../batch/WaveVehicleAssignmentPanel';
import { ExecutionIntelligencePanel } from '../batch/ExecutionIntelligencePanel';
import { OperationalWarningsPanel, buildOperationalWarnings } from '../shared/OperationalWarnings';
import { projectExecution, projectIdealResources } from '@/lib/executionEngine';
import type { WorkingSetItem, SlotAssignment } from '@/types/unified-workflow';
import type {
  ExecutionEngineConfig,
  ExecutionProjection,
  DEFAULT_EXECUTION_CONFIG,
} from '@/types/unified-workflow';
import { DEFAULT_EXECUTION_CONFIG as DEFAULT_CONFIG } from '@/types/unified-workflow';
import type { TimeWindow, Priority } from '@/types/scheduler';
import type { VehicleAvailabilityEntry } from '../batch/VehicleAvailabilityPanel';

// =====================================================
// Types
// =====================================================

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

  // Schedule Info
  scheduleTitle: string | null;
  startLocationName: string | null;
  /** @deprecated use planningWindowStart/End */
  plannedDate: string | null;
  planningWindowStart?: string | null;
  planningWindowEnd?: string | null;
  timeWindow: TimeWindow | null;

  // Facilities
  facilities: WorkingSetItem[];

  // Vehicles (multi)
  selectedVehicleIds: string[];
  vehicles: Vehicle[];
  onVehicleChange: (vehicleId: string) => void;
  onVehiclesChange: (vehicleIds: string[]) => void;

  // Driver
  selectedDriverId: string | null;
  drivers: Driver[];
  onDriverChange: (driverId: string | null) => void;

  // Slot Assignments (legacy — kept for store compat)
  slotAssignments: Record<string, SlotAssignment>;
  onAssignSlot: (slotKey: string, facilityId: string, requisitionIds: string[]) => void;
  onUnassignSlot: (slotKey: string) => void;
  onAutoAssign: () => void;

  // Route Info
  totalDistanceKm: number | null;
  estimatedDurationMin: number | null;
}

// =====================================================
// Component
// =====================================================

export function Step3Batch({
  batchName,
  onBatchNameChange,
  priority,
  onPriorityChange,
  scheduleTitle,
  startLocationName,
  plannedDate,
  planningWindowStart,
  planningWindowEnd,
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
  // -----------------------------------------------
  // Execution engine config (local state)
  // -----------------------------------------------
  const [execConfig, setExecConfig] = React.useState<ExecutionEngineConfig>(DEFAULT_CONFIG);

  const handleConfigChange = React.useCallback(
    (updates: Partial<ExecutionEngineConfig>) => {
      setExecConfig(prev => ({ ...prev, ...updates }));
    },
    [],
  );

  // -----------------------------------------------
  // Wave vehicle overrides (user can re-assign vehicles per wave)
  // -----------------------------------------------
  const [waveVehicleOverrides, setWaveVehicleOverrides] = React.useState<Record<string, string[]>>({});

  const handleWaveVehicleOverride = React.useCallback(
    (waveId: string, vehicleIds: string[]) => {
      setWaveVehicleOverrides(prev => ({ ...prev, [waveId]: vehicleIds }));
    },
    [],
  );

  // -----------------------------------------------
  // Execution projection (resimulates dynamically)
  // -----------------------------------------------
  const assignedVehicles = React.useMemo(
    () => vehicles.filter(v => selectedVehicleIds.includes(v.id)),
    [vehicles, selectedVehicleIds],
  );

  const projection: ExecutionProjection = React.useMemo(
    () =>
      projectExecution(
        facilities,
        assignedVehicles,
        execConfig,
        planningWindowStart ?? plannedDate,
      ),
    [facilities, assignedVehicles, execConfig, planningWindowStart, plannedDate],
  );

  // Ideal resource estimate (shown before vehicles are assigned)
  const idealResources = React.useMemo(
    () => projectIdealResources(facilities, execConfig),
    [facilities, execConfig],
  );

  // -----------------------------------------------
  // Auto-assign: distribute committed vehicles across waves
  // -----------------------------------------------
  const handleAutoAssignWaves = React.useCallback(() => {
    if (projection.waves.length === 0 || selectedVehicleIds.length === 0) return;
    const overrides: Record<string, string[]> = {};
    projection.waves.forEach(wave => {
      overrides[wave.id] = wave.vehicle_ids;
    });
    setWaveVehicleOverrides(overrides);
  }, [projection.waves, selectedVehicleIds]);

  // -----------------------------------------------
  // Dismissed warnings
  // -----------------------------------------------
  const [dismissedWarnings, setDismissedWarnings] = React.useState<string[]>([]);

  const handleDismissWarning = React.useCallback((id: string) => {
    setDismissedWarnings(prev => [...prev, id]);
  }, []);

  // -----------------------------------------------
  // Vehicle availability entries
  // -----------------------------------------------
  const vehicleAvailabilityEntries: VehicleAvailabilityEntry[] = React.useMemo(
    () =>
      vehicles.map(v => ({
        vehicle_id: v.id,
        vehicle_label: `${v.model} (${v.plateNumber})`,
        plate_number: v.plateNumber,
        operational_status:
          v.status === 'available' ? 'available'
          : v.status === 'in-use'   ? 'occupied'
          : v.status === 'maintenance' ? 'maintenance'
          : 'offline',
        is_committed: selectedVehicleIds.includes(v.id),
      })),
    [vehicles, selectedVehicleIds],
  );

  // -----------------------------------------------
  // Legacy operational warnings (shift/maintenance)
  // -----------------------------------------------
  const vehicleStatuses = React.useMemo(() => {
    const map: Record<string, 'available' | 'occupied' | 'maintenance' | 'offline'> = {};
    vehicleAvailabilityEntries.forEach(e => {
      map[e.vehicle_id] = e.operational_status;
    });
    return map;
  }, [vehicleAvailabilityEntries]);

  const legacyWarnings = React.useMemo(
    () =>
      buildOperationalWarnings({
        estimatedDurationMin,
        vehicleIds: selectedVehicleIds,
        vehicleStatuses,
        planningWindowStart: planningWindowStart ?? plannedDate,
        planningWindowEnd,
      }),
    [estimatedDurationMin, selectedVehicleIds, vehicleStatuses, planningWindowStart, plannedDate, planningWindowEnd],
  );

  const activeWarnings = legacyWarnings.filter(w => !dismissedWarnings.includes(w.id));

  // -----------------------------------------------
  // Counts for strategy bar
  // -----------------------------------------------
  const vehiclesAvailable = vehicles.filter(
    v => v.status === 'available' || v.status === 'in-use',
  ).length;

  const startLocation = React.useMemo(
    () => (startLocationName ? { id: 'start', name: startLocationName, type: 'warehouse' as const } : null),
    [startLocationName],
  );

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
              onChange={e => onBatchNameChange(e.target.value)}
              placeholder="Enter batch name…"
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
            <Select value={priority} onValueChange={v => onPriorityChange(v as Priority)}>
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

        {/* Legacy operational warnings */}
        {activeWarnings.length > 0 && (
          <div className="mt-3">
            <OperationalWarningsPanel
              warnings={activeWarnings}
              onDismiss={handleDismissWarning}
            />
          </div>
        )}
      </div>

      {/* Execution Strategy Bar */}
      <ExecutionStrategyBar
        config={execConfig}
        onConfigChange={handleConfigChange}
        vehiclesAvailable={vehiclesAvailable}
        vehiclesTotal={vehicles.length}
      />

      {/* 3-Column Layout */}
      <div className="flex-1 min-h-0 p-4">
        <ThreeColumnLayout className="h-full">
          {/* Left: Wave-Grouped Route Sequence */}
          <LeftColumn>
            <WaveGroupedFacilityList
              facilities={facilities}
              waves={projection.waves}
              startLocation={startLocation}
            />
          </LeftColumn>

          {/* Center: Wave Vehicle Assignment */}
          <MiddleColumn>
            <WaveVehicleAssignmentPanel
              waves={projection.waves}
              vehicles={vehicles}
              selectedVehicleIds={selectedVehicleIds}
              waveVehicleOverrides={waveVehicleOverrides}
              onSelectVehicles={onVehiclesChange}
              onWaveVehicleOverride={handleWaveVehicleOverride}
              onAutoAssign={handleAutoAssignWaves}
            />
          </MiddleColumn>

          {/* Right: Schedule Details + Execution Intelligence */}
          <RightColumn>
            <ScrollArea className="h-full">
              <div className="space-y-4 pb-4">
                <ScheduleDetailsColumn
                  scheduleTitle={scheduleTitle}
                  startLocationName={startLocationName}
                  plannedDate={plannedDate}
                  planningWindowStart={planningWindowStart}
                  planningWindowEnd={planningWindowEnd}
                  timeWindow={timeWindow}
                  priority={priority}
                  totalDistanceKm={totalDistanceKm}
                  estimatedDurationMin={estimatedDurationMin}
                  selectedDriverId={selectedDriverId}
                  drivers={drivers}
                  onDriverChange={onDriverChange}
                  facilities={facilities}
                />

                {/* Execution Intelligence */}
                <div className="px-4">
                  <ExecutionIntelligencePanel projection={projection} />
                </div>

                {/* Vehicle Availability */}
                {vehicleAvailabilityEntries.length > 0 && (
                  <div className="px-4">
                    <VehicleAvailabilityPanel
                      entries={vehicleAvailabilityEntries}
                      committedVehicleIds={selectedVehicleIds}
                    />
                  </div>
                )}
              </div>
            </ScrollArea>
          </RightColumn>
        </ThreeColumnLayout>
      </div>
    </div>
  );
}

export default Step3Batch;

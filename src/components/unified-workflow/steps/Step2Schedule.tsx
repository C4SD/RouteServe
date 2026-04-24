/**
 * =====================================================
 * Step 2: Schedule Phase
 * =====================================================
 * 3-column layout for building the schedule:
 * - Left: Source of Truth (available facilities)
 * - Middle: Working Set (selected facilities)
 * - Right: Decision Support (map, insights, AI options)
 */

import * as React from 'react';
import { ThreeColumnLayout, LeftColumn, MiddleColumn, RightColumn } from '../schedule/ThreeColumnLayout';
import { ScheduleHeader } from '../schedule/ScheduleHeader';
import { SourceOfTruthColumn, type FacilityCandidate } from '../schedule/SourceOfTruthColumn';
import { FileUploadColumn } from '../schedule/FileUploadColumn';
import { WorkingSetColumn } from '../schedule/WorkingSetColumn';
import { DecisionSupportColumn } from '../schedule/DecisionSupportColumn';
import { PolicyContextColumn } from '../schedule/PolicyContextColumn';
import type {
  WorkingSetItem,
  ParsedFacility,
  AiOptimizationOptions,
  SourceSubOption,
  SourceMethod,
  VehicleSuggestion,
  PolicyContext,
} from '@/types/unified-workflow';
import type { TimeWindow } from '@/types/scheduler';

interface Step2ScheduleProps {
  // Header props
  title: string | null;
  onTitleChange: (title: string) => void;
  startLocationId: string | null;
  startLocationType: 'warehouse' | 'facility';
  onStartLocationChange: (id: string, type: 'warehouse' | 'facility') => void;
  plannedDate: string | null;
  onPlannedDateChange: (date: string) => void;
  timeWindow: TimeWindow | null;
  onTimeWindowChange: (window: TimeWindow | null) => void;

  // Source method (to switch between upload vs consignment left column)
  sourceMethod?: SourceMethod | null;

  // Data
  warehouses: Array<{ id: string; name: string; lat?: number; lng?: number }>;
  facilities?: Array<{ id: string; name: string }>;
  candidates: FacilityCandidate[];
  candidatesLoading?: boolean;

  // Working set props
  workingSet: WorkingSetItem[];
  onAddToWorkingSet: (item: WorkingSetItem) => void;
  onRemoveFromWorkingSet: (facilityId: string) => void;
  onReorderWorkingSet: (fromIndex: number, toIndex: number) => void;
  onClearWorkingSet: () => void;
  onSetWorkingSet?: (items: WorkingSetItem[]) => void;

  // AI options
  sourceSubOption: SourceSubOption | null;
  aiOptions: AiOptimizationOptions;
  onAiOptionsChange: (options: Partial<AiOptimizationOptions>) => void;

  // Vehicle suggestion
  suggestedVehicleId: string | null;
  onSuggestedVehicleChange: (vehicleId: string | null) => void;
  vehicleSuggestions?: VehicleSuggestion[];

  // File upload (only used when sourceMethod === 'upload')
  parsedFacilities?: ParsedFacility[] | null;
  onFileParsed?: (facilities: ParsedFacility[]) => void;
  onUpdateParsedRow?: (rowIndex: number, updates: Partial<ParsedFacility>) => void;

  // Policy context (only used when sourceMethod === 'service_policy')
  policyContext?: PolicyContext | null;
  onPolicyContextChange?: (context: PolicyContext | null) => void;
}

export function Step2Schedule({
  title,
  onTitleChange,
  startLocationId,
  startLocationType,
  onStartLocationChange,
  plannedDate,
  onPlannedDateChange,
  timeWindow,
  onTimeWindowChange,
  sourceMethod,
  warehouses,
  facilities = [],
  candidates,
  candidatesLoading = false,
  workingSet,
  onAddToWorkingSet,
  onRemoveFromWorkingSet,
  onReorderWorkingSet,
  onClearWorkingSet,
  onSetWorkingSet,
  sourceSubOption,
  aiOptions,
  onAiOptionsChange,
  suggestedVehicleId,
  onSuggestedVehicleChange,
  vehicleSuggestions = [],
  parsedFacilities,
  onFileParsed,
  onUpdateParsedRow,
  policyContext,
  onPolicyContextChange,
}: Step2ScheduleProps) {
  // Get selected facility IDs for the left column
  const selectedFacilityIds = React.useMemo(
    () => workingSet.map((item) => item.facility_id),
    [workingSet]
  );

  const isUploadMode = sourceMethod === 'upload';
  const isPolicyMode = sourceMethod === 'service_policy';

  // All facilities (for upload matching dropdown)
  const allFacilitiesForMatch = React.useMemo(
    () => [...facilities, ...candidates.map((c) => ({ id: c.id, name: c.name }))],
    [facilities, candidates],
  );

  // Handler: add all valid parsed facilities to the working set
  const handleAddParsedToWorkingSet = React.useCallback(() => {
    if (!parsedFacilities) return;
    parsedFacilities
      .filter((f) => f.is_valid && f.matched_facility_id)
      .forEach((f) => {
        onAddToWorkingSet({
          facility_id: f.matched_facility_id!,
          facility_name: f.matched_facility_name!,
          requisition_ids: [],
          slot_demand: 1,
        });
      });
  }, [parsedFacilities, onAddToWorkingSet]);

  // Get start location details for the right column
  const startLocation = React.useMemo(() => {
    if (!startLocationId) return null;
    const warehouse = warehouses.find((w) => w.id === startLocationId);
    if (warehouse) {
      return { id: warehouse.id, name: warehouse.name, lat: warehouse.lat, lng: warehouse.lng };
    }
    const facility = facilities.find((f) => f.id === startLocationId);
    if (facility) {
      return { id: facility.id, name: facility.name };
    }
    return null;
  }, [startLocationId, warehouses, facilities]);

  return (
    <div className="flex flex-col min-h-[65vh]">
      {/* Schedule Header */}
      <ScheduleHeader
        title={title}
        onTitleChange={onTitleChange}
        startLocationId={startLocationId}
        startLocationType={startLocationType}
        onStartLocationChange={onStartLocationChange}
        plannedDate={plannedDate}
        onPlannedDateChange={onPlannedDateChange}
        timeWindow={timeWindow}
        onTimeWindowChange={onTimeWindowChange}
        warehouses={warehouses}
        facilities={facilities}
        startLocationAutoSet={isPolicyMode && !!startLocationId}
      />

      {/* 3-Column Layout */}
      <div className="flex-1 min-h-0 p-4">
        <ThreeColumnLayout className="h-full">
          {/* Left Column: Policy Context / File Upload / Source of Truth */}
          {isPolicyMode ? (
            <LeftColumn
              title="Policy Context"
              subtitle="Select service area, policy, and cluster"
            >
              <PolicyContextColumn
                policyContext={policyContext ?? null}
                workingSet={workingSet}
                onPolicyContextChange={onPolicyContextChange ?? (() => {})}
                onSetWorkingSet={onSetWorkingSet ?? ((items) => {
                  onClearWorkingSet();
                  items.forEach((item) => onAddToWorkingSet(item));
                })}
                onWarehouseAutoSet={(warehouseId) => {
                  if (warehouseId) {
                    onStartLocationChange(warehouseId, 'warehouse');
                  }
                }}
              />
            </LeftColumn>
          ) : isUploadMode ? (
            <LeftColumn
              title="Upload Facility List"
              subtitle="Import from PDF, CSV, XLSX, or DOCX"
            >
              <FileUploadColumn
                allFacilities={allFacilitiesForMatch}
                parsedFacilities={parsedFacilities ?? null}
                onFileParsed={onFileParsed ?? (() => {})}
                onUpdateRow={onUpdateParsedRow ?? (() => {})}
                onAddValidToWorkingSet={handleAddParsedToWorkingSet}
              />
            </LeftColumn>
          ) : (
            <LeftColumn
              title={sourceMethod === 'manual' ? 'All Facilities' : 'Available Facility Orders'}
              subtitle={sourceMethod === 'manual' ? 'Select facilities to add to schedule' : 'Ready consignments from finalized requisitions'}
            >
              <SourceOfTruthColumn
                candidates={candidates}
                selectedIds={selectedFacilityIds}
                onAddToWorkingSet={onAddToWorkingSet}
                isLoading={candidatesLoading}
              />
            </LeftColumn>
          )}

          {/* Middle Column: Working Set */}
          <MiddleColumn
            title="Selected Facilities"
            subtitle="Batch-in-formation • Drag to reorder"
          >
            <WorkingSetColumn
              items={workingSet}
              onReorder={onReorderWorkingSet}
              onRemove={onRemoveFromWorkingSet}
              onClear={onClearWorkingSet}
            />
          </MiddleColumn>

          {/* Right Column: Decision Support */}
          <RightColumn title="Decision Support">
            <DecisionSupportColumn
              workingSet={workingSet}
              startLocation={startLocation}
              facilities={candidates}
              sourceSubOption={sourceSubOption}
              aiOptions={aiOptions}
              onAiOptionsChange={onAiOptionsChange}
              suggestedVehicleId={suggestedVehicleId}
              onSuggestedVehicleChange={onSuggestedVehicleChange}
              vehicleSuggestions={vehicleSuggestions}
            />
          </RightColumn>
        </ThreeColumnLayout>
      </div>
    </div>
  );
}

export default Step2Schedule;

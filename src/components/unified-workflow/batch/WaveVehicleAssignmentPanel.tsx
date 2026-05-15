/**
 * =====================================================
 * Wave Vehicle Assignment Panel — Center Panel (Step 5)
 * =====================================================
 * Replaces the static slot grid for multi-day execution.
 * Shows vehicle assignments per execution wave.
 *
 * Users manually assign vehicles to each wave.
 * "Auto Assign" distributes available vehicles evenly.
 * Changing assignments triggers re-projection.
 */

import * as React from 'react';
import {
  Truck,
  RefreshCw,
  Plus,
  X,
  Pencil,
  Check,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { ExecutionWaveProjection } from '@/types/unified-workflow';

interface Vehicle {
  id: string;
  model: string;
  plateNumber: string;
  status: 'available' | 'in-use' | 'maintenance';
}

interface WaveVehicleAssignmentPanelProps {
  waves: ExecutionWaveProjection[];
  vehicles: Vehicle[];
  selectedVehicleIds: string[];            // globally committed vehicles
  waveVehicleOverrides: Record<string, string[]>; // waveId → vehicleIds
  onSelectVehicles: (vehicleIds: string[]) => void;
  onWaveVehicleOverride: (waveId: string, vehicleIds: string[]) => void;
  onAutoAssign: () => void;
  className?: string;
}

const WAVE_COLORS = [
  'text-green-700 bg-green-50 border-green-200',
  'text-amber-700 bg-amber-50 border-amber-200',
  'text-blue-700 bg-blue-50 border-blue-200',
  'text-purple-700 bg-purple-50 border-purple-200',
  'text-rose-700 bg-rose-50 border-rose-200',
  'text-cyan-700 bg-cyan-50 border-cyan-200',
];

const STATUS_DOT: Record<Vehicle['status'], string> = {
  available:   'bg-green-500',
  'in-use':    'bg-amber-500',
  maintenance: 'bg-red-500',
};

export function WaveVehicleAssignmentPanel({
  waves,
  vehicles,
  selectedVehicleIds,
  waveVehicleOverrides,
  onSelectVehicles,
  onWaveVehicleOverride,
  onAutoAssign,
  className,
}: WaveVehicleAssignmentPanelProps) {
  // Global vehicle selector (top-level "committed" list)
  const [globalSelectorOpen, setGlobalSelectorOpen] = React.useState(false);

  const availableVehicles = vehicles.filter(
    v => v.status === 'available' || v.status === 'in-use',
  );

  const toggleGlobalVehicle = (vid: string) => {
    const next = selectedVehicleIds.includes(vid)
      ? selectedVehicleIds.filter(id => id !== vid)
      : [...selectedVehicleIds, vid];
    onSelectVehicles(next);
  };

  if (waves.length === 0) {
    return (
      <NoWavesPlaceholder
        vehicles={vehicles}
        selectedVehicleIds={selectedVehicleIds}
        onSelectVehicles={onSelectVehicles}
        className={className}
      />
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Vehicle Assignment by Wave</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Assign vehicles to execution waves
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 text-primary border-primary/30"
            onClick={onAutoAssign}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Auto Assign
          </Button>
        </div>

        {/* Global vehicle picker */}
        <div className="mt-2">
          <Popover open={globalSelectorOpen} onOpenChange={setGlobalSelectorOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs w-full justify-between"
              >
                <span>
                  {selectedVehicleIds.length === 0
                    ? 'Select vehicles…'
                    : `${selectedVehicleIds.length} vehicle${selectedVehicleIds.length > 1 ? 's' : ''} committed`}
                </span>
                <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <p className="text-xs font-medium text-muted-foreground mb-2 px-1">
                Fleet vehicles
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {vehicles.map(v => (
                  <label
                    key={v.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedVehicleIds.includes(v.id)}
                      onCheckedChange={() => toggleGlobalVehicle(v.id)}
                      className="h-3.5 w-3.5"
                    />
                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', STATUS_DOT[v.status])} />
                    <span className="text-xs flex-1 min-w-0 truncate">
                      {v.model} <span className="text-muted-foreground">{v.plateNumber}</span>
                    </span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Wave list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {waves.map((wave, wIdx) => {
            const colorClass = WAVE_COLORS[wIdx % WAVE_COLORS.length];
            // Use override if present, otherwise fall back to projection's vehicle_ids
            const waveVehicleIds = waveVehicleOverrides[wave.id] ?? wave.vehicle_ids;
            const waveVehicles = vehicles.filter(v => waveVehicleIds.includes(v.id));

            return (
              <WaveVehicleRow
                key={wave.id}
                wave={wave}
                waveVehicles={waveVehicles}
                allVehicles={vehicles}
                colorClass={colorClass}
                onOverride={(vIds) => onWaveVehicleOverride(wave.id, vIds)}
              />
            );
          })}

          {/* Add Wave hint */}
          <div className="flex items-center justify-center border-2 border-dashed rounded-lg py-5 text-muted-foreground">
            <div className="text-center">
              <Plus className="h-5 w-5 mx-auto mb-1 opacity-40" />
              <p className="text-xs">Add Wave</p>
              <p className="text-[10px] opacity-70">Add another execution wave</p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// =====================================================
// Wave row
// =====================================================

function WaveVehicleRow({
  wave,
  waveVehicles,
  allVehicles,
  colorClass,
  onOverride,
}: {
  wave: ExecutionWaveProjection;
  waveVehicles: Vehicle[];
  allVehicles: Vehicle[];
  colorClass: string;
  onOverride: (vehicleIds: string[]) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<string[]>(waveVehicles.map(v => v.id));

  const handleSave = () => {
    onOverride(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(waveVehicles.map(v => v.id));
    setEditing(false);
  };

  const toggleDraft = (vid: string) => {
    setDraft(prev =>
      prev.includes(vid) ? prev.filter(id => id !== vid) : [...prev, vid],
    );
  };

  return (
    <div className={cn('rounded-lg border overflow-hidden', colorClass)}>
      {/* Wave header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div>
          <p className="text-xs font-semibold">{wave.label}</p>
          <p className="text-[10px] opacity-70">
            {wave.total_facilities} facilities • {wave.runs.length} run{wave.runs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-current">
            {waveVehicles.length} vehicle{waveVehicles.length !== 1 ? 's' : ''}
          </Badge>
          {!editing ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
              onClick={() => { setDraft(waveVehicles.map(v => v.id)); setEditing(true); }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-green-700 hover:text-green-800"
                onClick={handleSave}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                onClick={handleCancel}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Vehicle pills */}
      <div className="px-3 pb-3 bg-white/60">
        {!editing ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {waveVehicles.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No vehicles assigned</p>
            ) : (
              waveVehicles.map(v => (
                <VehiclePill key={v.id} vehicle={v} />
              ))
            )}
          </div>
        ) : (
          <div className="pt-2 space-y-1.5">
            <p className="text-[10px] text-muted-foreground font-medium">Select vehicles for this wave:</p>
            {allVehicles.map(v => (
              <label
                key={v.id}
                className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
              >
                <Checkbox
                  checked={draft.includes(v.id)}
                  onCheckedChange={() => toggleDraft(v.id)}
                  className="h-3.5 w-3.5"
                />
                <span className={cn('w-2 h-2 rounded-full flex-shrink-0', STATUS_DOT[v.status])} />
                <span className="text-xs">{v.model}</span>
                <span className="text-[10px] text-muted-foreground">{v.plateNumber}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VehiclePill({ vehicle }: { vehicle: Vehicle }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border bg-white/80 shadow-sm">
      <Truck className="h-3.5 w-3.5 text-muted-foreground" />
      <div className="flex flex-col leading-none">
        <span className="text-xs font-medium">{vehicle.model}</span>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <span className={cn('w-1.5 h-1.5 rounded-full inline-block', STATUS_DOT[vehicle.status])} />
          Available
        </span>
      </div>
    </div>
  );
}

// =====================================================
// No-waves placeholder (before vehicle selection)
// =====================================================

function NoWavesPlaceholder({
  vehicles,
  selectedVehicleIds,
  onSelectVehicles,
  className,
}: {
  vehicles: Vehicle[];
  selectedVehicleIds: string[];
  onSelectVehicles: (ids: string[]) => void;
  className?: string;
}) {
  const toggleVehicle = (vid: string) => {
    const next = selectedVehicleIds.includes(vid)
      ? selectedVehicleIds.filter(id => id !== vid)
      : [...selectedVehicleIds, vid];
    onSelectVehicles(next);
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="px-4 py-3 border-b bg-muted/50">
        <h3 className="text-sm font-medium">Vehicle Assignment by Wave</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Assign vehicles to execution waves
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <Truck className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          {selectedVehicleIds.length === 0
            ? 'Select vehicles to generate execution waves'
            : 'Generating execution projection…'}
        </p>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          {selectedVehicleIds.length === 0
            ? 'Choose from your available fleet below'
            : 'Simulation will appear once projection is ready'}
        </p>

        {/* Fleet quick-select */}
        <div className="w-full max-w-xs space-y-1.5">
          {vehicles.map(v => (
            <label
              key={v.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <Checkbox
                checked={selectedVehicleIds.includes(v.id)}
                onCheckedChange={() => toggleVehicle(v.id)}
              />
              <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', STATUS_DOT[v.status])} />
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">{v.model}</p>
                <p className="text-xs text-muted-foreground">{v.plateNumber}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export default WaveVehicleAssignmentPanel;

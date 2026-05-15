/**
 * =====================================================
 * Wave-Grouped Facility List — Left Panel (Step 5)
 * =====================================================
 * Extends the route sequence list with execution wave
 * grouping. Toggle between flat sequence and wave view.
 * Manual override: uncluster button reverts to flat list.
 */

import * as React from 'react';
import {
  Building2,
  Package,
  ArrowDown,
  Route,
  Layers,
  Calendar,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WorkingSetItem } from '@/types/unified-workflow';
import type { ExecutionWaveProjection } from '@/types/unified-workflow';

type GroupMode = 'waves' | 'sequence';

interface WaveGroupedFacilityListProps {
  facilities: WorkingSetItem[];
  waves: ExecutionWaveProjection[];
  startLocation?: { id: string; name: string; type: 'warehouse' | 'facility' } | null;
  className?: string;
}

const WAVE_COLORS = [
  'bg-green-500',
  'bg-amber-500',
  'bg-blue-500',
  'bg-purple-500',
  'bg-rose-500',
  'bg-cyan-500',
];

const WAVE_BG = [
  'bg-green-50 border-green-200',
  'bg-amber-50 border-amber-200',
  'bg-blue-50 border-blue-200',
  'bg-purple-50 border-purple-200',
  'bg-rose-50 border-rose-200',
  'bg-cyan-50 border-cyan-200',
];

export function WaveGroupedFacilityList({
  facilities,
  waves,
  startLocation,
  className,
}: WaveGroupedFacilityListProps) {
  const [groupMode, setGroupMode] = React.useState<GroupMode>(
    waves.length > 0 ? 'waves' : 'sequence',
  );
  const [collapsedWaves, setCollapsedWaves] = React.useState<Set<string>>(new Set());

  // Keep groupMode in sync when waves appear/disappear
  React.useEffect(() => {
    if (waves.length > 0 && groupMode === 'sequence') {
      // don't auto-switch — respect user's toggle
    }
  }, [waves.length]);

  const toggleWave = (waveId: string) => {
    setCollapsedWaves(prev => {
      const next = new Set(prev);
      next.has(waveId) ? next.delete(waveId) : next.add(waveId);
      return next;
    });
  };

  const totals = React.useMemo(() => ({
    stops: facilities.length,
    slots: facilities.reduce((s, f) => s + (f.slot_demand || 0), 0),
  }), [facilities]);

  if (facilities.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full text-muted-foreground p-4', className)}>
        <Route className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">No facilities in schedule</p>
        <p className="text-xs mt-1 text-center">
          Facilities from the schedule phase will appear here
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Route Sequence</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totals.stops} stops • {totals.slots} slots
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Group by toggle */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Group by:</span>
              <Select value={groupMode} onValueChange={v => setGroupMode(v as GroupMode)}>
                <SelectTrigger className="h-7 text-xs w-[90px] border-0 bg-muted/60 hover:bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="waves" className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <Layers className="h-3 w-3" /> Waves
                    </span>
                  </SelectItem>
                  <SelectItem value="sequence" className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <Route className="h-3 w-3" /> Sequence
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {groupMode === 'waves' && waves.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setGroupMode('sequence')}
              >
                Uncluster
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">

          {/* Start location */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {startLocation?.name || 'Start Location'}
              </p>
              <p className="text-xs text-muted-foreground">Origin</p>
            </div>
          </div>

          {groupMode === 'waves' && waves.length > 0
            ? <WaveGroupedContent
                waves={waves}
                facilities={facilities}
                collapsedWaves={collapsedWaves}
                onToggleWave={toggleWave}
              />
            : <FlatSequenceContent facilities={facilities} />
          }

          {/* Return indicator */}
          <div className="flex items-center gap-3 pl-4 pt-2 opacity-50">
            <div className="w-8 flex justify-center">
              <div className="h-6 w-0.5 bg-border border-dashed" />
            </div>
            <span className="text-xs text-muted-foreground">Return to origin</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed bg-muted/30 opacity-50">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {startLocation?.name || 'Start Location'}
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// =====================================================
// Wave-grouped view
// =====================================================

function WaveGroupedContent({
  waves,
  facilities,
  collapsedWaves,
  onToggleWave,
}: {
  waves: ExecutionWaveProjection[];
  facilities: WorkingSetItem[];
  collapsedWaves: Set<string>;
  onToggleWave: (id: string) => void;
}) {
  const facilityMap = React.useMemo(() => {
    const m = new Map<string, WorkingSetItem>();
    facilities.forEach(f => m.set(f.facility_id, f));
    return m;
  }, [facilities]);

  return (
    <>
      {waves.map((wave, wIdx) => {
        const isCollapsed = collapsedWaves.has(wave.id);
        const dotColor   = WAVE_COLORS[wIdx % WAVE_COLORS.length];
        const headerBg   = WAVE_BG[wIdx % WAVE_BG.length];
        const waveFacilities = wave.facility_ids
          .map(id => facilityMap.get(id))
          .filter((f): f is WorkingSetItem => !!f);

        return (
          <div key={wave.id} className="space-y-2">
            {/* Connector */}
            <div className="flex items-center gap-3 pl-4">
              <div className="w-8 flex justify-center">
                <div className="h-4 w-0.5 bg-border" />
              </div>
            </div>

            {/* Wave header */}
            <button
              className={cn(
                'w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors',
                headerBg,
              )}
              onClick={() => onToggleWave(wave.id)}
            >
              <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', dotColor)} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{wave.label}</p>
                <p className="text-[10px] text-muted-foreground">
                  {wave.total_facilities} facilities • {wave.total_slots} slots
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {wave.vehicle_ids.length} vehicle{wave.vehicle_ids.length !== 1 ? 's' : ''}
                </Badge>
                {isCollapsed
                  ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                }
              </div>
            </button>

            {/* Wave facilities */}
            {!isCollapsed && (
              <div className="pl-4 space-y-1.5">
                {waveFacilities.slice(0, 3).map((facility, fIdx) => (
                  <div
                    key={facility.facility_id}
                    className="flex items-center gap-3 p-2.5 rounded-md border bg-card"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-medium">
                      {fIdx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{facility.facility_name}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 flex-shrink-0">
                      <Package className="h-2.5 w-2.5 mr-0.5" />
                      {facility.slot_demand}
                    </Badge>
                  </div>
                ))}
                {waveFacilities.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    +{waveFacilities.length - 3} more facilities in this wave
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// =====================================================
// Flat sequence view
// =====================================================

function FlatSequenceContent({ facilities }: { facilities: WorkingSetItem[] }) {
  return (
    <>
      {facilities.map((facility, idx) => (
        <React.Fragment key={facility.facility_id}>
          {/* Connector */}
          <div className="flex items-center gap-3 pl-4">
            <div className="w-8 flex justify-center">
              <div className="h-4 w-0.5 bg-border" />
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowDown className="h-3 w-3" />
              <span>Leg {idx + 1}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-medium">
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{facility.facility_name}</p>
            </div>
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              <Package className="h-3 w-3 mr-1" />
              {facility.slot_demand}
            </Badge>
          </div>
        </React.Fragment>
      ))}
    </>
  );
}

export default WaveGroupedFacilityList;

/**
 * =====================================================
 * Source of Truth Column (Left Column)
 * =====================================================
 * Displays available facility orders (ready consignments)
 * from finalized requisitions. Users can add items to
 * the working set (middle column).
 */

import * as React from 'react';
import { Search, Plus, Building2, Package, MapPin, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { WorkingSetItem } from '@/types/unified-workflow';

export interface FacilityCandidate {
  id: string;
  name: string;
  code?: string;
  lga?: string;
  zone?: string;
  lat?: number;
  lng?: number;
  requisition_ids: string[];
  slot_demand: number;
  weight_kg?: number;
  volume_m3?: number;
  status?: string;
}

interface SourceOfTruthColumnProps {
  candidates: FacilityCandidate[];
  selectedIds: string[];
  onAddToWorkingSet: (item: WorkingSetItem) => void;
  isLoading?: boolean;
  className?: string;
}

export function SourceOfTruthColumn({
  candidates,
  selectedIds,
  onAddToWorkingSet,
  isLoading = false,
  className,
}: SourceOfTruthColumnProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedZones, setSelectedZones] = React.useState<string[]>([]);
  const [selectedLgas, setSelectedLgas] = React.useState<string[]>([]);

  // Get unique zones and LGAs for filters
  const zones = React.useMemo(() => {
    const uniqueZones = new Set(candidates.map((c) => c.zone).filter(Boolean));
    return Array.from(uniqueZones) as string[];
  }, [candidates]);

  const lgas = React.useMemo(() => {
    const uniqueLgas = new Set(candidates.map((c) => c.lga).filter(Boolean));
    return Array.from(uniqueLgas) as string[];
  }, [candidates]);

  // Filter candidates
  const filteredCandidates = React.useMemo(() => {
    return candidates.filter((candidate) => {
      // Exclude already selected
      if (selectedIds.includes(candidate.id)) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          candidate.name.toLowerCase().includes(query) ||
          candidate.code?.toLowerCase().includes(query) ||
          candidate.lga?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Zone filter
      if (selectedZones.length > 0 && candidate.zone) {
        if (!selectedZones.includes(candidate.zone)) return false;
      }

      // LGA filter
      if (selectedLgas.length > 0 && candidate.lga) {
        if (!selectedLgas.includes(candidate.lga)) return false;
      }

      return true;
    });
  }, [candidates, selectedIds, searchQuery, selectedZones, selectedLgas]);

  const handleAddCandidate = (candidate: FacilityCandidate) => {
    const workingSetItem: WorkingSetItem = {
      facility_id: candidate.id,
      facility_name: candidate.name,
      facility_code: candidate.code,
      lga: candidate.lga,
      zone: candidate.zone,
      requisition_ids: candidate.requisition_ids,
      slot_demand: candidate.slot_demand,
      weight_kg: candidate.weight_kg,
      volume_m3: candidate.volume_m3,
      sequence: 0, // Will be set by the store
    };
    onAddToWorkingSet(workingSetItem);
  };

  const handleAddAll = () => {
    filteredCandidates.forEach((candidate) => {
      handleAddCandidate(candidate);
    });
  };

  const toggleZone = (zone: string) => {
    setSelectedZones((prev) =>
      prev.includes(zone) ? prev.filter((z) => z !== zone) : [...prev, zone]
    );
  };

  const toggleLga = (lga: string) => {
    setSelectedLgas((prev) =>
      prev.includes(lga) ? prev.filter((l) => l !== lga) : [...prev, lga]
    );
  };

  const hasActiveFilters = selectedZones.length > 0 || selectedLgas.length > 0;

  if (isLoading) {
    return (
      <div className={cn('flex flex-col h-full', className)}>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-16 bg-muted rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Search and Filter */}
      <div className="p-3 space-y-2 border-b">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search facilities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={hasActiveFilters ? 'secondary' : 'outline'}
                size="sm"
                className="h-9"
              >
                <Filter className="h-4 w-4" />
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1 px-1">
                    {selectedZones.length + selectedLgas.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {zones.length > 0 && (
                <>
                  <DropdownMenuLabel>Zones</DropdownMenuLabel>
                  {zones.map((zone) => (
                    <DropdownMenuCheckboxItem
                      key={zone}
                      checked={selectedZones.includes(zone)}
                      onCheckedChange={() => toggleZone(zone)}
                    >
                      {zone}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
              {lgas.length > 0 && (
                <>
                  <DropdownMenuLabel>LGAs</DropdownMenuLabel>
                  {lgas.slice(0, 10).map((lga) => (
                    <DropdownMenuCheckboxItem
                      key={lga}
                      checked={selectedLgas.includes(lga)}
                      onCheckedChange={() => toggleLga(lga)}
                    >
                      {lga}
                    </DropdownMenuCheckboxItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Add All Button */}
        {filteredCandidates.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleAddAll}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add All ({filteredCandidates.length})
          </Button>
        )}
      </div>

      {/* Candidate List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {filteredCandidates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {candidates.length === 0
                  ? 'No ready consignments available'
                  : selectedIds.length === candidates.length
                  ? 'All facilities added'
                  : 'No matching facilities'}
              </p>
            </div>
          ) : (
            filteredCandidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                onAdd={() => handleAddCandidate(candidate)}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer Stats */}
      <div className="p-3 border-t bg-muted/50 text-xs text-muted-foreground">
        <span>
          {filteredCandidates.length} of {candidates.length} available
        </span>
        {selectedIds.length > 0 && (
          <span className="ml-2">
            • {selectedIds.length} selected
          </span>
        )}
      </div>
    </div>
  );
}

// =====================================================
// Candidate Card Sub-component
// =====================================================

interface CandidateCardProps {
  candidate: FacilityCandidate;
  onAdd: () => void;
}

function CandidateCard({ candidate, onAdd }: CandidateCardProps) {
  return (
    <div
      className={cn(
        'group flex items-start gap-3 p-3 rounded-lg border bg-card',
        'hover:border-primary/50 hover:bg-accent/50 transition-colors cursor-pointer'
      )}
      onClick={onAdd}
    >
      {/* Facility Icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
        <Building2 className="h-5 w-5 text-primary" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm break-words leading-snug">{candidate.name}</p>
            {candidate.code && (
              <p className="text-xs text-muted-foreground truncate">
                {candidate.code}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-primary/10"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            title="Add to schedule"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          {candidate.lga && (
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              <MapPin className="h-3 w-3 mr-1" />
              {candidate.lga}
            </Badge>
          )}
          {candidate.slot_demand > 0 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              <Package className="h-3 w-3 mr-1" />
              {candidate.slot_demand} slots
            </Badge>
          )}
          {candidate.weight_kg && (
            <span className="text-xs text-muted-foreground">
              {candidate.weight_kg.toLocaleString()} kg
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default SourceOfTruthColumn;

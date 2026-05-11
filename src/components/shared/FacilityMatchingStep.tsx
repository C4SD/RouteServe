/**
 * FacilityMatchingStep
 *
 * 2-column review UI shown after a file is parsed. By default only shows
 * facilities that need review (unmatched or low-confidence). Clicking the
 * "X matched" badge or the "Show all" toggle reveals all facilities.
 *
 * Reusable across storefront/scheduler and fleetops/batches upload flows.
 */

import * as React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Plus,
  SkipForward,
  MapPin,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { matchFacilities, type FacilityMatch } from '@/lib/facility-matcher';
import type { ParsedFacility } from '@/types/unified-workflow';
import type { Facility } from '@/types';
import { FacilityFormDialog } from '@/pages/storefront/facilities/components/FacilityFormDialog';

// Facilities with auto-match score at or above this threshold are considered
// well-matched and are hidden from the default "needs review" list.
const HIGH_CONFIDENCE = 0.95;

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbFacility {
  id: string;
  name: string;
  lga?: string;
  address?: string;
  type?: string;
  lat?: number;
  lng?: number;
}

interface FacilityMatchingStepProps {
  parsedFacilities: ParsedFacility[];
  allFacilities: DbFacility[];
  onUpdate: (rowIndex: number, updates: Partial<ParsedFacility>) => void;
  onConfirm: () => void;
  onBack?: () => void;
  confirmLabel?: string;
}

// ─── Confidence badge helper ──────────────────────────────────────────────────

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  if (score >= 0.95)
    return <Badge className="bg-green-100 text-green-800 text-[10px] px-1.5 py-0">{pct}%</Badge>;
  if (score >= 0.75)
    return <Badge className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0">{pct}%</Badge>;
  if (score >= 0.5)
    return <Badge className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0">{pct}%</Badge>;
  return <Badge className="bg-red-100 text-red-800 text-[10px] px-1.5 py-0">{pct}%</Badge>;
}

function rowStatusIcon(row: ParsedFacility) {
  if (row.user_corrected && !row.matched_facility_id) {
    return <SkipForward className="h-3.5 w-3.5 text-muted-foreground" />;
  }
  if (row.is_valid && row.confidence_score >= 0.75) {
    return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
  }
  if (row.is_valid) {
    return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
  }
  return <XCircle className="h-3.5 w-3.5 text-red-500" />;
}

// ─── Right panel: match detail for one row ────────────────────────────────────

interface MatchPanelProps {
  row: ParsedFacility;
  allFacilities: DbFacility[];
  recommendations: Array<FacilityMatch & { facility: DbFacility }>;
  onSelect: (facilityId: string, facilityName: string, score: number) => void;
  onSkip: () => void;
  onFacilityCreated: (facility: Facility) => void;
}

function MatchPanel({
  row,
  allFacilities,
  recommendations,
  onSelect,
  onSkip,
  onFacilityCreated,
}: MatchPanelProps) {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const currentValue = row.matched_facility_id ?? '';
  const isSkipped = row.user_corrected && !row.matched_facility_id;

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* Header */}
      <div>
        <p className="text-xs text-muted-foreground">Matching for</p>
        <p className="font-semibold text-sm mt-0.5 truncate">{row.raw_name}</p>
      </div>

      {/* Top recommendations */}
      <div className="flex-1 min-h-0">
        <p className="text-xs font-medium text-muted-foreground mb-2">Recommended matches</p>

        {recommendations.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-3 text-center">
            No close matches found in the database
          </p>
        ) : (
          <ScrollArea className="h-full max-h-[240px]">
            <RadioGroup
              value={isSkipped ? '' : currentValue}
              onValueChange={(id) => {
                const rec = recommendations.find((r) => r.id === id);
                if (rec) onSelect(rec.facility.id, rec.facility.name, rec.score);
              }}
              className="space-y-2"
            >
              {recommendations.map((rec) => (
                <label
                  key={rec.id}
                  htmlFor={`rec-${rec.id}`}
                  className={cn(
                    'flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors',
                    currentValue === rec.id && !isSkipped
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent/40',
                  )}
                >
                  <RadioGroupItem value={rec.id} id={`rec-${rec.id}`} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium truncate">{rec.name}</span>
                      <ConfidenceBadge score={rec.score} />
                    </div>
                    {rec.facility.lga && (
                      <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {rec.facility.lga}
                      </div>
                    )}
                    {rec.facility.address && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {rec.facility.address}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </RadioGroup>
          </ScrollArea>
        )}
      </div>

      {/* Divider */}
      <div className="border-t" />

      {/* Search all facilities */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">Search all facilities</p>
        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-start text-xs gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              {currentValue && !isSkipped
                ? allFacilities.find((f) => f.id === currentValue)?.name ?? 'Selected'
                : 'Search by name, LGA…'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-72" align="start" side="top">
            <Command>
              <CommandInput placeholder="Type to search…" className="h-8 text-xs" />
              <CommandList>
                <CommandEmpty className="text-xs py-4 text-center text-muted-foreground">
                  No facilities found
                </CommandEmpty>
                <CommandGroup>
                  {allFacilities.map((f) => (
                    <CommandItem
                      key={f.id}
                      value={`${f.name} ${f.lga ?? ''}`}
                      onSelect={() => {
                        onSelect(f.id, f.name, 1);
                        setSearchOpen(false);
                      }}
                      className="text-xs"
                    >
                      <Building2 className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="truncate block">{f.name}</span>
                        {f.lga && (
                          <span className="text-[10px] text-muted-foreground">{f.lga}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs gap-1.5"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add new facility
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn('text-xs gap-1.5', isSkipped && 'text-muted-foreground bg-muted')}
          onClick={onSkip}
          title="Exclude this facility from the schedule"
        >
          <SkipForward className="h-3.5 w-3.5" />
          {isSkipped ? 'Skipped' : 'Skip'}
        </Button>
      </div>

      <FacilityFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        prefillName={row.raw_name}
        onCreated={(fac) => {
          onFacilityCreated(fac);
          onSelect(fac.id, fac.name, 1);
        }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FacilityMatchingStep({
  parsedFacilities,
  allFacilities,
  onUpdate,
  onConfirm,
  onBack,
  confirmLabel,
}: FacilityMatchingStepProps) {
  // Track selection by row_index (stable across filter changes)
  const [selectedRowIndex, setSelectedRowIndex] = React.useState<number>(() => {
    const firstUnresolved = parsedFacilities.find(
      (r) => !r.is_valid || r.confidence_score < HIGH_CONFIDENCE,
    );
    return firstUnresolved?.row_index ?? parsedFacilities[0]?.row_index ?? 0;
  });

  // Show only "needs review" by default; toggled via badge or header link
  const [showAll, setShowAll] = React.useState(false);

  // Extra facilities created inline during this session (full Facility, compatible with DbFacility shape)
  const [localFacilities, setLocalFacilities] = React.useState<Facility[]>([]);

  const allDbFacilities = React.useMemo(
    () => [...allFacilities, ...localFacilities],
    [allFacilities, localFacilities],
  );

  // Pre-compute recommendations for each row
  const recommendationMap = React.useMemo(() => {
    const map = new Map<number, Array<FacilityMatch & { facility: DbFacility }>>();
    for (const row of parsedFacilities) {
      map.set(row.row_index, matchFacilities(row.raw_name, allDbFacilities, 5, 0.3));
    }
    return map;
  }, [parsedFacilities, allDbFacilities]);

  // Rows that genuinely need human review: not auto-matched with high confidence
  // and not already user-confirmed as good.
  const needsReview = React.useMemo(
    () =>
      parsedFacilities.filter(
        (r) =>
          !(r.is_valid && r.confidence_score >= HIGH_CONFIDENCE) &&
          !(r.user_corrected && r.is_valid),
      ),
    [parsedFacilities],
  );

  const displayedList = showAll ? parsedFacilities : needsReview;

  // When switching to filtered view, ensure selected row is still visible
  React.useEffect(() => {
    if (!showAll) {
      const inDisplay = needsReview.some((r) => r.row_index === selectedRowIndex);
      if (!inDisplay && needsReview.length > 0) {
        setSelectedRowIndex(needsReview[0].row_index);
      }
    }
  }, [showAll]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedRow =
    parsedFacilities.find((r) => r.row_index === selectedRowIndex) ?? parsedFacilities[0];

  const matched = parsedFacilities.filter(
    (r) => r.is_valid && !(r.user_corrected && !r.matched_facility_id),
  );
  const skipped = parsedFacilities.filter((r) => r.user_corrected && !r.matched_facility_id);
  const unresolved = parsedFacilities.filter(
    (r) => !r.is_valid && !(r.user_corrected && !r.matched_facility_id),
  );

  function handleSelect(rowIndex: number, facilityId: string, facilityName: string, score: number) {
    onUpdate(rowIndex, {
      matched_facility_id: facilityId,
      matched_facility_name: facilityName,
      confidence_score: score,
      is_valid: true,
      user_corrected: true,
    });
  }

  function handleSkip(rowIndex: number) {
    const row = parsedFacilities.find((r) => r.row_index === rowIndex);
    if (!row) return;
    const isSkipped = row.user_corrected && !row.matched_facility_id;
    if (isSkipped) {
      const recs = recommendationMap.get(rowIndex) ?? [];
      const top = recs[0];
      onUpdate(rowIndex, {
        matched_facility_id: top?.id ?? null,
        matched_facility_name: top?.name ?? null,
        confidence_score: top?.score ?? 0,
        is_valid: !!top && top.score >= 0.5,
        user_corrected: false,
      });
    } else {
      onUpdate(rowIndex, {
        matched_facility_id: null,
        matched_facility_name: null,
        confidence_score: 0,
        is_valid: false,
        user_corrected: true,
      });
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Summary bar */}
      <div className="flex items-center gap-2 px-1 pb-3 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">
          {parsedFacilities.length} facilities from file
        </span>
        <div className="flex items-center gap-1.5 ml-auto">
          {matched.length > 0 && (
            <button
              onClick={() => setShowAll(true)}
              title="Click to review all matched facilities"
            >
              <Badge
                variant="secondary"
                className="gap-1 text-[11px] cursor-pointer hover:bg-secondary/80 transition-colors"
              >
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                {matched.length} matched
              </Badge>
            </button>
          )}
          {unresolved.length > 0 && (
            <button onClick={() => setShowAll(false)} title="Show only unmatched facilities">
              <Badge
                variant="secondary"
                className="gap-1 text-[11px] text-amber-700 bg-amber-50 cursor-pointer hover:bg-amber-100 transition-colors"
              >
                <AlertTriangle className="h-3 w-3 text-amber-600" />
                {unresolved.length} need review
              </Badge>
            </button>
          )}
          {skipped.length > 0 && (
            <Badge variant="secondary" className="gap-1 text-[11px]">
              <SkipForward className="h-3 w-3 text-muted-foreground" />
              {skipped.length} skipped
            </Badge>
          )}
        </div>
      </div>

      {/* 2-column body */}
      <div className="flex flex-1 min-h-0 gap-0 border rounded-lg overflow-hidden">
        {/* Left: facility list */}
        <div className="w-[220px] flex-shrink-0 border-r flex flex-col">
          <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex-1">
              {showAll ? 'All facilities' : 'Needs review'}
              {!showAll && needsReview.length > 0 && (
                <span className="ml-1 text-amber-600">({needsReview.length})</span>
              )}
            </p>
            {!showAll && needsReview.length < parsedFacilities.length && (
              <button
                className="text-[10px] text-primary hover:underline flex-shrink-0"
                onClick={() => setShowAll(true)}
              >
                Show all
              </button>
            )}
            {showAll && (
              <button
                className="text-[10px] text-primary hover:underline flex-shrink-0"
                onClick={() => setShowAll(false)}
              >
                Needs review
              </button>
            )}
          </div>

          {/* Empty state when all facilities are resolved */}
          {displayedList.length === 0 && !showAll && (
            <div className="flex flex-col items-center justify-center flex-1 gap-2 px-4 text-center">
              <CheckCircle2 className="h-7 w-7 text-green-500" />
              <p className="text-xs text-muted-foreground">All facilities matched!</p>
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => setShowAll(true)}
              >
                Review all matches
              </button>
            </div>
          )}

          <ScrollArea className="flex-1">
            <div className="py-1">
              {displayedList.map((row) => {
                const isSelected = row.row_index === selectedRowIndex;
                const isSkippedRow = row.user_corrected && !row.matched_facility_id;
                return (
                  <button
                    key={row.row_index}
                    onClick={() => setSelectedRowIndex(row.row_index)}
                    className={cn(
                      'w-full text-left px-3 py-2 flex items-start gap-2 transition-colors',
                      isSelected
                        ? 'bg-primary/8 border-l-2 border-primary'
                        : 'hover:bg-accent/40 border-l-2 border-transparent',
                    )}
                  >
                    <div className="pt-0.5 flex-shrink-0">{rowStatusIcon(row)}</div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          'text-xs font-medium truncate',
                          isSkippedRow && 'text-muted-foreground line-through',
                        )}
                      >
                        {row.raw_name}
                      </p>
                      {row.matched_facility_name && !isSkippedRow && (
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          → {row.matched_facility_name}
                        </p>
                      )}
                    </div>
                    {!isSkippedRow && row.confidence_score > 0 && (
                      <div className="flex-shrink-0">
                        <ConfidenceBadge score={row.confidence_score} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Right: match panel */}
        <div className="flex-1 min-w-0">
          {selectedRow ? (
            <MatchPanel
              row={selectedRow}
              allFacilities={allDbFacilities}
              recommendations={recommendationMap.get(selectedRow.row_index) ?? []}
              onSelect={(id, name, score) =>
                handleSelect(selectedRow.row_index, id, name, score)
              }
              onSkip={() => handleSkip(selectedRow.row_index)}
              onFacilityCreated={(fac) => {
                setLocalFacilities((prev) => [...prev, fac]);
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Select a facility from the list
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 mt-1">
        {onBack ? (
          <Button variant="outline" size="sm" onClick={onBack}>
            Back
          </Button>
        ) : (
          <div />
        )}
        <Button size="sm" onClick={onConfirm} disabled={matched.length === 0}>
          {confirmLabel ?? `Add ${matched.length} to schedule`}
        </Button>
      </div>
    </div>
  );
}

export default FacilityMatchingStep;

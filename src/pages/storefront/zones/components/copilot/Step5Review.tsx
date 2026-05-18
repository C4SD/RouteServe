import { useState } from 'react';
import {
  CheckCircle2, XCircle, Clock, ChevronRight, ChevronDown,
  Building2, Layers, MapPin, AlertTriangle, Edit2, Check,
  RotateCcw, Shield, Route, TrendingUp, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CopilotReviewMap } from './CopilotReviewMap';
import type {
  CopilotGenerationResult,
  SuggestedZone,
  SuggestedOperationalStructure,
  CopilotFacility,
  CopilotWarehouse,
  AcceptanceStatus,
  InspectorSelection,
  ConfidenceLevel,
  SuggestedRouteGroup,
} from '@/types/operations-copilot';

// ─── Palette (mirrors CopilotReviewMap) ──────────────────────────────────────

const PALETTE = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function confidenceBadge(level: ConfidenceLevel) {
  const map: Record<ConfidenceLevel, { label: string; className: string }> = {
    high: { label: 'High', className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
    medium: { label: 'Medium', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
    low: { label: 'Low', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  };
  const { label, className } = map[level];
  return <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${className}`}>{label}</span>;
}

function acceptanceIcon(status: AcceptanceStatus) {
  if (status === 'accepted') return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  if (status === 'rejected') return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
  return <Clock className="h-4 w-4 text-muted-foreground shrink-0" />;
}

// ─── Inline rename input ──────────────────────────────────────────────────────

function RenameField({
  value,
  onChange,
}: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(value); setEditing(true); }}
        className="flex items-center gap-1.5 group text-left"
      >
        <span className="font-semibold text-base">{value}</span>
        <Edit2 className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { onChange(draft); setEditing(false); }
          if (e.key === 'Escape') setEditing(false);
        }}
        className="h-7 text-sm font-medium"
      />
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => { onChange(draft); setEditing(false); }}
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ─── Left panel — structure list ──────────────────────────────────────────────

interface StructureListProps {
  result: CopilotGenerationResult;
  selectedZoneId: string | null;
  onSelectZone: (zone: SuggestedZone, warehouse: CopilotWarehouse) => void;
  onToggleZone: (structIdx: number, zoneIdx: number) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

function StructureList({
  result, selectedZoneId, onSelectZone, onToggleZone, onAcceptAll, onRejectAll,
}: StructureListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(result.structures.map(s => s.warehouse.id)),
  );

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  const totalAccepted = result.structures.flatMap(s => s.zones).filter(z => z.acceptance === 'accepted').length;
  const totalZones = result.structures.flatMap(s => s.zones).length;

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* Header */}
      <div className="px-3 py-3 border-b space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Structures</span>
          <Badge variant="outline" className="text-xs shrink-0">
            {totalAccepted}/{totalZones} accepted
          </Badge>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={onAcceptAll}>
            Accept all
          </Button>
          <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs" onClick={onRejectAll}>
            Reset all
          </Button>
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="py-1.5">
          {result.structures.map((structure, wi) => {
            const color = PALETTE[wi % PALETTE.length];
            const isExpanded = expanded.has(structure.warehouse.id);
            const warehouseAccepted = structure.zones.filter(z => z.acceptance === 'accepted').length;

            return (
              <div key={structure.warehouse.id}>
                <button
                  onClick={() => toggleExpand(structure.warehouse.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-xs font-medium text-left truncate min-w-0">
                    {structure.warehouse.name}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {warehouseAccepted}/{structure.zones.length}
                  </span>
                  {isExpanded
                    ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  }
                </button>

                {isExpanded && structure.zones.map((zone, zi) => {
                  const isSelected = zone.id === selectedZoneId;
                  return (
                    <div
                      key={zone.id}
                      className={`flex items-center gap-2 pl-7 pr-2 py-2 cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/10' : 'hover:bg-muted/40'
                      }`}
                      onClick={() => onSelectZone(zone, structure.warehouse)}
                    >
                      {acceptanceIcon(zone.acceptance)}
                      <Layers className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-xs truncate min-w-0">
                        {zone.user_name ?? zone.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {confidenceBadge(zone.confidence_level)}
                        <button
                          onClick={e => { e.stopPropagation(); onToggleZone(wi, zi); }}
                          className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
                          title={zone.acceptance === 'accepted' ? 'Reject' : 'Accept'}
                        >
                          {zone.acceptance === 'accepted'
                            ? <XCircle className="h-3.5 w-3.5 hover:text-red-500" />
                            : <CheckCircle2 className="h-3.5 w-3.5 hover:text-green-500" />
                          }
                        </button>
                      </div>
                    </div>
                  );
                })}

                {isExpanded && structure.out_of_coverage.length > 0 && (
                  <div className="pl-7 pr-3 py-2 flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                    <span className="text-xs text-muted-foreground">
                      {structure.out_of_coverage.length} out of coverage
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {result.global_out_of_coverage.length > 0 && (
            <div className="px-3 py-2 mt-1 border-t">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span className="text-xs font-medium">
                  {result.global_out_of_coverage.length} unassigned (no warehouse in range)
                </span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Right panel — inspector ──────────────────────────────────────────────────

interface InspectorPanelProps {
  selection: InspectorSelection;
  result: CopilotGenerationResult;
  onRenameZone: (zoneId: string, name: string) => void;
  onToggleZoneAcceptance: (zoneId: string) => void;
  onResetZone: (zoneId: string) => void;
  onRouteGroupSelect: (rg: SuggestedRouteGroup | null) => void;
  selectedRouteGroupId: string | null;
}

function InspectorPanel({
  selection, result, onRenameZone, onToggleZoneAcceptance, onResetZone,
  onRouteGroupSelect, selectedRouteGroupId,
}: InspectorPanelProps) {
  if (!selection) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 text-muted-foreground">
        <MapPin className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">Select a zone</p>
        <p className="text-xs mt-1 opacity-70">
          Click a zone in the list or on the map to inspect details.
        </p>
      </div>
    );
  }

  if (selection.type === 'warehouse') {
    const structure = result.structures.find(s => s.warehouse.id === selection.warehouse.id);
    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Warehouse</p>
            <p className="font-semibold text-base">{selection.warehouse.name}</p>
            {selection.warehouse.code && (
              <p className="text-xs text-muted-foreground">{selection.warehouse.code}</p>
            )}
          </div>
          <Separator />
          {structure && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Zones', value: structure.zones.length },
                { label: 'Accepted', value: structure.zones.filter(z => z.acceptance === 'accepted').length },
                { label: 'Facilities', value: structure.zones.reduce((s, z) => s + z.facilities.length, 0) },
                { label: 'Out of coverage', value: structure.out_of_coverage.length },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border p-3 text-center">
                  <p className="text-xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    );
  }

  if (selection.type === 'facility') {
    const { facility, zone } = selection;
    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Facility</p>
            <p className="font-semibold text-base">{facility.name}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {facility.lga && <Badge variant="outline" className="text-xs">{facility.lga}</Badge>}
              {facility.state && <Badge variant="outline" className="text-xs">{facility.state}</Badge>}
            </div>
          </div>
          <Separator />
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Latitude</span>
              <span className="font-mono text-xs">{facility.lat.toFixed(5)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Longitude</span>
              <span className="font-mono text-xs">{facility.lng.toFixed(5)}</span>
            </div>
            {facility.ward && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ward</span>
                <span className="text-xs">{facility.ward}</span>
              </div>
            )}
          </div>
          {zone && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Assigned Zone</p>
                <p className="text-sm font-medium">{zone.user_name ?? zone.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {zone.metrics.facility_count} facilities · avg {zone.metrics.avg_distance_km} km
                </p>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    );
  }

  // Zone inspector
  const { zone, warehouse } = selection;
  const sa = result.structures
    .find(s => s.warehouse.id === warehouse.id)
    ?.service_areas.find(s => s.zone_id === zone.id);

  const activeRouteGroup = sa?.route_groups.find(rg => rg.id === selectedRouteGroupId) ?? null;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Zone name + rename */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Zone</p>
          <RenameField
            value={zone.user_name ?? zone.name}
            onChange={name => onRenameZone(zone.id, name)}
          />
          <p className="text-xs text-muted-foreground mt-1">In {warehouse.name}</p>
        </div>

        {/* Acceptance controls */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={zone.acceptance === 'accepted' ? 'default' : 'outline'}
            className="flex-1 h-9 text-xs"
            onClick={() => onToggleZoneAcceptance(zone.id)}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            {zone.acceptance === 'accepted' ? 'Accepted' : 'Accept'}
          </Button>
          <Button
            size="sm"
            variant={zone.acceptance === 'rejected' ? 'destructive' : 'outline'}
            className="flex-1 h-9 text-xs"
            onClick={() => onResetZone(zone.id)}
          >
            <XCircle className="h-3.5 w-3.5 mr-1.5" />
            {zone.acceptance === 'rejected' ? 'Rejected' : 'Reject'}
          </Button>
        </div>

        <Separator />

        {/* Metrics */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Metrics</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Facilities', value: zone.metrics.facility_count },
              { label: 'Avg dist', value: `${zone.metrics.avg_distance_km} km` },
              { label: 'Max dist', value: `${zone.metrics.max_distance_km} km` },
              { label: 'Confidence', value: `${Math.round(zone.confidence_score * 100)}%` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-md border px-3 py-2.5">
                <p className="text-sm font-semibold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Confidence:</span>
            {confidenceBadge(zone.confidence_level)}
            <Badge variant="outline" className="text-xs capitalize">{zone.status}</Badge>
          </div>
        </div>

        {/* Policies */}
        {sa && sa.policies.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Suggested Policies
              </p>
              <div className="space-y-2">
                {sa.policies.map(p => (
                  <div key={p.id} className="flex justify-between items-center rounded-md border px-3 py-2.5">
                    <span className="text-xs text-muted-foreground">{p.label}</span>
                    <Badge variant="secondary" className="text-xs capitalize">{p.value}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Route groups — interactive */}
        {sa && sa.route_groups.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Route className="h-3.5 w-3.5" />
                Route Groups
              </p>
              <div className="space-y-1.5">
                {sa.route_groups.map(rg => {
                  const isExpanded = rg.id === selectedRouteGroupId;
                  return (
                    <div key={rg.id} className="rounded-md border overflow-hidden">
                      <button
                        className={`w-full flex justify-between items-center px-3 py-2.5 text-left transition-colors ${
                          isExpanded ? 'bg-primary/10' : 'hover:bg-muted/40'
                        }`}
                        onClick={() => onRouteGroupSelect(isExpanded ? null : rg)}
                      >
                        <div className="flex items-center gap-1.5">
                          <Route className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-medium">{rg.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-muted-foreground">{rg.facilities.length} facilities</span>
                          {isExpanded
                            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          }
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="border-t bg-muted/20 px-2 py-1.5 space-y-0.5">
                          {rg.facilities.map(f => (
                            <div key={f.id} className="flex items-center gap-2 py-0.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                              <span className="text-xs truncate flex-1 min-w-0">{f.name}</span>
                              {f.lga && <span className="text-xs text-muted-foreground shrink-0">{f.lga}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Facilities list */}
        <Separator />
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            {activeRouteGroup
              ? `${activeRouteGroup.name} — Facilities (${activeRouteGroup.facilities.length})`
              : `Facilities (${zone.facilities.length})`
            }
          </p>
          <div className="space-y-1">
            {(activeRouteGroup ? activeRouteGroup.facilities : zone.facilities).map(f => (
              <div key={f.id} className="flex items-center gap-2 text-xs py-1 border-b last:border-0">
                <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{f.name}</span>
                {f.lga && <span className="text-muted-foreground shrink-0">{f.lga}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

// ─── Main Step5Review ─────────────────────────────────────────────────────────

interface Step5ReviewProps {
  result: CopilotGenerationResult;
  onResultChange: (result: CopilotGenerationResult) => void;
  onSave: () => void;
  onBack: () => void;
  isSaving: boolean;
}

export function Step5Review({
  result, onResultChange, onSave, onBack, isSaving,
}: Step5ReviewProps) {
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [inspection, setInspection] = useState<InspectorSelection>(null);
  const [selectedRouteGroupId, setSelectedRouteGroupId] = useState<string | null>(null);
  const [highlightedFacilityIds, setHighlightedFacilityIds] = useState<string[] | null>(null);

  const totalAccepted = result.structures.flatMap(s => s.zones).filter(z => z.acceptance === 'accepted').length;

  function updateZone(
    zoneId: string,
    updater: (zone: SuggestedZone) => SuggestedZone,
  ) {
    onResultChange({
      ...result,
      structures: result.structures.map(st => ({
        ...st,
        zones: st.zones.map(z => z.id === zoneId ? updater(z) : z),
        service_areas: st.service_areas.map(sa =>
          sa.zone_id === zoneId
            ? { ...sa, acceptance: updater(st.zones.find(z => z.id === zoneId)!).acceptance }
            : sa,
        ),
      })),
    });
  }

  function toggleZone(structIdx: number, zoneIdx: number) {
    const zone = result.structures[structIdx].zones[zoneIdx];
    const next: AcceptanceStatus = zone.acceptance === 'accepted' ? 'pending' : 'accepted';
    updateZone(zone.id, z => ({ ...z, acceptance: next }));
    if (inspection?.type === 'zone' && inspection.zone.id === zone.id) {
      setInspection(prev => prev?.type === 'zone' ? { ...prev, zone: { ...prev.zone, acceptance: next } } : prev);
    }
  }

  function toggleZoneAcceptance(zoneId: string) {
    const zone = result.structures.flatMap(s => s.zones).find(z => z.id === zoneId);
    if (!zone) return;
    const next: AcceptanceStatus = zone.acceptance === 'accepted' ? 'pending' : 'accepted';
    updateZone(zoneId, z => ({ ...z, acceptance: next }));
    setInspection(prev => prev?.type === 'zone' && prev.zone.id === zoneId
      ? { ...prev, zone: { ...prev.zone, acceptance: next } }
      : prev,
    );
  }

  function rejectZone(zoneId: string) {
    const zone = result.structures.flatMap(s => s.zones).find(z => z.id === zoneId);
    if (!zone) return;
    const next: AcceptanceStatus = zone.acceptance === 'rejected' ? 'pending' : 'rejected';
    updateZone(zoneId, z => ({ ...z, acceptance: next }));
    setInspection(prev => prev?.type === 'zone' && prev.zone.id === zoneId
      ? { ...prev, zone: { ...prev.zone, acceptance: next } }
      : prev,
    );
  }

  function renameZone(zoneId: string, name: string) {
    updateZone(zoneId, z => ({ ...z, user_name: name }));
    setInspection(prev => prev?.type === 'zone' && prev.zone.id === zoneId
      ? { ...prev, zone: { ...prev.zone, user_name: name } }
      : prev,
    );
  }

  function acceptAll() {
    onResultChange({
      ...result,
      structures: result.structures.map(st => ({
        ...st,
        zones: st.zones.map(z => ({ ...z, acceptance: 'accepted' as AcceptanceStatus })),
        service_areas: st.service_areas.map(sa => ({ ...sa, acceptance: 'accepted' as AcceptanceStatus })),
      })),
    });
  }

  function resetAll() {
    onResultChange({
      ...result,
      structures: result.structures.map(st => ({
        ...st,
        zones: st.zones.map(z => ({ ...z, acceptance: 'pending' as AcceptanceStatus })),
        service_areas: st.service_areas.map(sa => ({ ...sa, acceptance: 'pending' as AcceptanceStatus })),
      })),
    });
    setInspection(null);
  }

  function selectZone(zone: SuggestedZone, warehouse: CopilotWarehouse) {
    setSelectedZoneId(zone.id);
    setSelectedRouteGroupId(null);
    setHighlightedFacilityIds(null);
    const freshZone = result.structures
      .find(s => s.warehouse.id === warehouse.id)
      ?.zones.find(z => z.id === zone.id) ?? zone;
    setInspection({ type: 'zone', zone: freshZone, warehouse });
  }

  function handleFacilityClick(facility: CopilotFacility, zone?: SuggestedZone) {
    setInspection({ type: 'facility', facility, zone });
  }

  function handleRouteGroupSelect(rg: SuggestedRouteGroup | null) {
    if (!rg) {
      setSelectedRouteGroupId(null);
      setHighlightedFacilityIds(null);
    } else {
      setSelectedRouteGroupId(rg.id);
      setHighlightedFacilityIds(rg.facilities.map(f => f.id));
    }
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Top bar */}
      <div className="flex items-start justify-between gap-4 shrink-0">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">Review Generated Structure</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Accept zones you want to persist. Rejected or pending zones will not be saved.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {totalAccepted > 0 && (
            <Badge className="text-sm px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
              {totalAccepted} accepted
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={onBack}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Back
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={totalAccepted === 0 || isSaving}
          >
            {isSaving ? 'Saving…' : `Save ${totalAccepted} zone${totalAccepted !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="flex gap-0 flex-1 min-h-0 border rounded-lg overflow-x-auto">
        {/* Left — structure list (fixed width, never overlaps map) */}
        <div className="w-64 min-w-[220px] shrink-0 border-r bg-background flex flex-col overflow-hidden">
          <StructureList
            result={result}
            selectedZoneId={selectedZoneId}
            onSelectZone={selectZone}
            onToggleZone={toggleZone}
            onAcceptAll={acceptAll}
            onRejectAll={resetAll}
          />
        </div>

        {/* Center — map (takes remaining space) */}
        <div className="flex-1 min-w-[180px] bg-muted/10 overflow-hidden">
          <CopilotReviewMap
            result={result}
            selectedZoneId={selectedZoneId}
            highlightedFacilityIds={highlightedFacilityIds}
            onZoneClick={selectZone}
            onFacilityClick={handleFacilityClick}
          />
        </div>

        {/* Right — inspector (fixed width) */}
        <div className="w-80 min-w-[260px] shrink-0 border-l bg-background flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b shrink-0">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Inspector</span>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <InspectorPanel
              selection={inspection}
              result={result}
              onRenameZone={renameZone}
              onToggleZoneAcceptance={toggleZoneAcceptance}
              onResetZone={rejectZone}
              onRouteGroupSelect={handleRouteGroupSelect}
              selectedRouteGroupId={selectedRouteGroupId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

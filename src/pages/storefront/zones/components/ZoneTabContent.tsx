import { useState, useMemo } from 'react';
import {
  Plus, Layers, Building2, MapPin, LayoutGrid, Map as MapIcon,
  ChevronDown, ChevronRight, Bot, User2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useOperationalZones, useZoneMetrics, useZoneBulkStats } from '@/hooks/useOperationalZones';
import { useWarehouses } from '@/hooks/useWarehouses';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateZoneDialog } from './CreateZoneDialog';
import { ZoneDetailDialog } from './ZoneDetailDialog';
import { EditZoneDialog } from './EditZoneDialog';
import { ZoneMapView } from './ZoneMapView';
import { OperationalZone } from '@/types/zones';
import { cn } from '@/lib/utils';

type ViewMode = 'grid' | 'map';

// ─── Copilot group helpers ────────────────────────────────────────────────────

interface CopilotWarehouseGroup {
  warehouseId: string;
  warehouseName: string;
  generatedAt: string | null;
  totalFacilities: number;
  zones: OperationalZone[];
}

function inferWarehouseName(zoneName: string): string {
  const idx = zoneName.indexOf(' — ');
  return idx > 0 ? zoneName.slice(0, idx) : zoneName;
}

function getZoneLabel(zoneName: string): string {
  const idx = zoneName.indexOf(' — ');
  return idx > 0 ? zoneName.slice(idx + 3) : zoneName;
}

function buildCopilotGroups(
  copilotZones: OperationalZone[],
  warehouseNameMap: Map<string, string>,
): CopilotWarehouseGroup[] {
  const groupMap = new Map<string, CopilotWarehouseGroup>();

  for (const zone of copilotZones) {
    const whId = (zone.metadata?.warehouse_id as string | undefined) ?? '__unknown__';
    if (!groupMap.has(whId)) {
      const whName =
        (whId !== '__unknown__' ? warehouseNameMap.get(whId) : undefined) ??
        inferWarehouseName(zone.name);
      groupMap.set(whId, {
        warehouseId: whId,
        warehouseName: whName,
        generatedAt: (zone.metadata?.generated_at as string) ?? null,
        totalFacilities: 0,
        zones: [],
      });
    }
    const group = groupMap.get(whId)!;
    group.totalFacilities += ((zone.metadata?.metrics as any)?.facility_count as number) ?? 0;
    group.zones.push(zone);
  }

  return [...groupMap.values()].sort((a, b) =>
    a.warehouseName.localeCompare(b.warehouseName),
  );
}

function confidenceBadge(level: string | undefined) {
  if (!level) return null;
  const map: Record<string, string> = {
    high: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    low: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  };
  return (
    <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded capitalize', map[level] ?? '')}>
      {level}
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ZoneTabContent() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState<OperationalZone | null>(null);
  const [zoneToEdit, setZoneToEdit] = useState<OperationalZone | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [expandedWarehouses, setExpandedWarehouses] = useState<Set<string>>(new Set());

  const { zones, loading: zonesLoading } = useOperationalZones();
  const { data: metricsData, isLoading: metricsLoading } = useZoneMetrics();
  const { data: warehouseData } = useWarehouses();

  const isLoading = zonesLoading || metricsLoading;

  const warehouseNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (warehouseData?.warehouses ?? []).forEach(w => map.set(w.id, w.name));
    return map;
  }, [warehouseData]);

  const { userZones, copilotZones } = useMemo(() => {
    if (!zones) return { userZones: [] as OperationalZone[], copilotZones: [] as OperationalZone[] };
    return {
      userZones: zones.filter(z => !z.metadata?.copilot_generated),
      copilotZones: zones.filter(z => z.metadata?.copilot_generated === true),
    };
  }, [zones]);

  // Bulk LGA + facility counts for all zones (both sections)
  const allZoneIds = useMemo(() => (zones ?? []).map(z => z.id), [zones]);
  const { data: zoneBulkStats } = useZoneBulkStats(allZoneIds);

  const copilotGroups = useMemo(
    () => buildCopilotGroups(copilotZones, warehouseNameMap),
    [copilotZones, warehouseNameMap],
  );

  function toggleWarehouse(warehouseId: string) {
    setExpandedWarehouses(prev => {
      const next = new Set(prev);
      next.has(warehouseId) ? next.delete(warehouseId) : next.add(warehouseId);
      return next;
    });
  }

  const isEmpty = !isLoading && (!zones || zones.length === 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Zones</h2>
          <p className="text-muted-foreground mt-1">
            Administrative boundaries and governance units
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as ViewMode)}>
            <ToggleGroupItem value="grid" aria-label="Grid view">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="map" aria-label="Map view">
              <MapIcon className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Zone
          </Button>
        </div>
      </div>

      {/* Overview stats */}
      {!isLoading && zones && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Zones</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{zones.length}</div>
              <p className="text-xs text-muted-foreground">
                {zones.filter(z => z.is_active).length} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Facilities</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metricsData?.totalFacilities || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total LGAs</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metricsData?.totalLGAs || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Map view */}
      {viewMode === 'map' && (
        <ZoneMapView zones={zones || []} onZoneSelect={setSelectedZone} />
      )}

      {/* Grid view */}
      {viewMode === 'grid' && (
        <div className="space-y-8">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-24 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : isEmpty ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Layers className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No zones found</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first zone to organize your operations
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Zone
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* ── Section A: User-created zones ── */}
              {userZones.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <User2 className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Your Zones
                    </h3>
                    <Badge variant="secondary" className="text-xs">{userZones.length}</Badge>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {userZones.map(zone => (
                      <Card
                        key={zone.id}
                        className="cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => setSelectedZone(zone)}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="flex items-center gap-2">
                                {zone.name}
                                {!zone.is_active && (
                                  <Badge variant="secondary">Inactive</Badge>
                                )}
                              </CardTitle>
                              {zone.code && (
                                <p className="text-sm text-muted-foreground mt-1">Code: {zone.code}</p>
                              )}
                            </div>
                          </div>
                          {zone.description && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {zone.description}
                            </p>
                          )}
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>LGAs: {zoneBulkStats?.[zone.id]?.lga_count ?? 0}</span>
                            <span>Facilities: {zoneBulkStats?.[zone.id]?.facility_count ?? 0}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Section B: Copilot-generated zones ── */}
              {copilotGroups.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Copilot-Generated Zones
                    </h3>
                    <Badge variant="secondary" className="text-xs">{copilotZones.length}</Badge>
                  </div>

                  <div className="space-y-3">
                    {copilotGroups.map(group => {
                      const isExpanded = expandedWarehouses.has(group.warehouseId);
                      return (
                        <div key={group.warehouseId} className="rounded-lg border bg-card overflow-hidden">
                          {/* Warehouse header row */}
                          <button
                            type="button"
                            onClick={() => toggleWarehouse(group.warehouseId)}
                            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
                          >
                            <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-base leading-tight truncate">
                                {group.warehouseName}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Generated by Operations Copilot
                                {group.generatedAt ? ` · ${formatDate(group.generatedAt)}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              <span className="text-sm text-muted-foreground">
                                {group.zones.length} zone{group.zones.length !== 1 ? 's' : ''}
                              </span>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Building2 className="h-3.5 w-3.5" />
                                {group.totalFacilities} facilities
                              </div>
                              {isExpanded
                                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              }
                            </div>
                          </button>

                          {/* Child zones */}
                          {isExpanded && (
                            <div className="border-t bg-muted/20">
                              {group.zones.map((zone, idx) => {
                                const facilityCount =
                                  ((zone.metadata?.metrics as any)?.facility_count as number) ?? 0;
                                const confLevel = zone.metadata?.confidence_level as string | undefined;
                                const label = getZoneLabel(zone.name);

                                return (
                                  <button
                                    key={zone.id}
                                    type="button"
                                    onClick={() => setSelectedZone(zone)}
                                    className={cn(
                                      'w-full flex items-center gap-3 pl-10 pr-4 py-2.5 text-left hover:bg-muted/60 transition-colors',
                                      idx < group.zones.length - 1 && 'border-b border-border/50',
                                    )}
                                  >
                                    {/* Tree connector */}
                                    <div className="flex items-center gap-1 shrink-0">
                                      <div className="w-px h-4 bg-border" />
                                      <div className="w-3 h-px bg-border" />
                                    </div>

                                    <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

                                    <span className="flex-1 text-sm font-medium truncate min-w-0">
                                      {label}
                                    </span>

                                    <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                                      <span>Facilities: {facilityCount}</span>
                                      <span>LGAs: {zoneBulkStats?.[zone.id]?.lga_count ?? 0}</span>
                                      {confLevel && confidenceBadge(confLevel)}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {/* Dialogs */}
      <CreateZoneDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      {selectedZone && (
        <ZoneDetailDialog
          zone={selectedZone}
          open={!!selectedZone}
          onOpenChange={(open) => !open && setSelectedZone(null)}
          onEditRequest={() => setZoneToEdit(selectedZone)}
        />
      )}

      {zoneToEdit && (
        <EditZoneDialog
          zone={zoneToEdit}
          open={!!zoneToEdit}
          onOpenChange={(open) => !open && setZoneToEdit(null)}
        />
      )}
    </div>
  );
}

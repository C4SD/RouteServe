/**
 * Location Management Settings Page
 *
 * Two-phase OSM boundary import:
 *  Phase 1 — import States/Regions for the country (fast, ~40 results)
 *  Phase 2 — select specific states, then import only their LGAs/Districts
 */

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  fetchStatesFromOverpass,
  fetchDistrictsForStates,
  saveBoundariesToDB,
  COUNTRY_ADMIN_LEVELS,
  type ImportProgress,
  type BoundaryResult,
} from '@/lib/overpass-boundaries';
import {
  Download,
  MapPin,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Globe,
  Loader2,
  ChevronRight,
} from 'lucide-react';

export default function LocationManagement() {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  const [importProgress, setImportProgress] = useState<ImportProgress>({
    status: 'idle',
    message: '',
    progress: 0,
  });
  const [isImporting, setIsImporting] = useState(false);
  const [selectedCountryId, setSelectedCountryId] = useState<string>('');

  // State selection for district import
  const [selectedStateOsmIds, setSelectedStateOsmIds] = useState<Set<number>>(new Set());

  // Fetch workspace countries
  const { data: workspaceCountries = [] } = useQuery({
    queryKey: ['workspace-countries', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspace_countries')
        .select('id, country_id, is_primary, countries(id, name, iso_code)')
        .eq('workspace_id', workspaceId!);
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        country_id: string;
        is_primary: boolean;
        countries: { id: string; name: string; iso_code: string } | null;
      }>;
    },
    enabled: !!workspaceId,
  });

  const effectiveCountryId =
    selectedCountryId ||
    workspaceCountries.find((wc) => wc.is_primary)?.country_id ||
    workspaceCountries[0]?.country_id ||
    '';

  const selectedWC = workspaceCountries.find((wc) => wc.country_id === effectiveCountryId);
  const isoCode = selectedWC?.countries?.iso_code || '';
  const countryName = selectedWC?.countries?.name || 'Unknown';
  const adminConfig = COUNTRY_ADMIN_LEVELS[isoCode];
  const stateLabel = adminConfig?.label_states || 'States';
  const districtLabel = adminConfig?.label_districts || 'Districts';
  const stateLevel = adminConfig?.states ?? 4;
  const districtLevel = adminConfig?.districts ?? 6;

  // Fetch existing admin units for the selected country
  const { data: adminUnits = [], isLoading: unitsLoading, refetch: refetchUnits } = useQuery({
    queryKey: ['admin-units', effectiveCountryId, workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_units')
        .select('id, name, name_en, admin_level, osm_id, population, is_active')
        .eq('country_id', effectiveCountryId)
        .eq('workspace_id', workspaceId!)
        .order('admin_level')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!effectiveCountryId && !!workspaceId,
  });

  const stateUnits = adminUnits.filter((u) => u.admin_level === stateLevel);
  const districtUnits = adminUnits.filter((u) => u.admin_level === districtLevel);
  const hasStates = stateUnits.length > 0;

  // Fetch workspace's registered states so Step 2 pre-selects them
  const { data: workspaceStates = [] } = useQuery({
    queryKey: ['workspace-states', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspace_states')
        .select('admin_unit_id')
        .eq('workspace_id', workspaceId!);
      if (error) throw error;
      return (data || []) as Array<{ admin_unit_id: string }>;
    },
    enabled: !!workspaceId,
  });

  // Pre-select registered states once state units are loaded
  const registeredUnitIds = new Set(workspaceStates.map((ws) => ws.admin_unit_id));
  // Sync pre-selection when stateUnits or workspaceStates load
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  if (!hasAutoSelected && hasStates && registeredUnitIds.size > 0 && selectedStateOsmIds.size === 0) {
    const preselect = new Set(
      stateUnits
        .filter((s) => s.osm_id && registeredUnitIds.has(s.id))
        .map((s) => s.osm_id as number)
    );
    if (preselect.size > 0) {
      setSelectedStateOsmIds(preselect);
      setHasAutoSelected(true);
    }
  }

  const toggleState = (osmId: number) => {
    setSelectedStateOsmIds((prev) => {
      const next = new Set(prev);
      if (next.has(osmId)) next.delete(osmId);
      else next.add(osmId);
      return next;
    });
  };

  const toggleAllStates = () => {
    if (selectedStateOsmIds.size === stateUnits.length) {
      setSelectedStateOsmIds(new Set());
    } else {
      setSelectedStateOsmIds(new Set(stateUnits.map((s) => s.osm_id).filter(Boolean)));
    }
  };

  // Phase 1: import states for the country
  const handleImportStates = async () => {
    if (!effectiveCountryId || !isoCode) {
      toast.error('Please select a country first');
      return;
    }

    try {
      setIsImporting(true);
      setImportProgress({ status: 'fetching', message: 'Starting...', progress: 0 });

      const boundaries = await fetchStatesFromOverpass(isoCode, stateLevel, setImportProgress);

      if (boundaries.length === 0) {
        toast.warning('No states found', {
          description: `Overpass returned 0 results for ${countryName}. Check the country ISO code.`,
        });
        return;
      }

      const imported = await saveBoundariesToDB(
        supabase, boundaries, effectiveCountryId, workspaceId!, setImportProgress
      );

      toast.success(`${imported} ${stateLabel} imported for ${countryName}`);
      refetchUnits();
      queryClient.invalidateQueries({ queryKey: ['boundary-counts'] });
    } catch (error) {
      toast.error('Import failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      setImportProgress({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Phase 2: import districts for selected states only
  const handleImportDistricts = async () => {
    if (selectedStateOsmIds.size === 0) {
      toast.error(`Select at least one ${stateLabel.slice(0, -1)} first`);
      return;
    }

    const selectedStates: Pick<BoundaryResult, 'osmId' | 'name'>[] = stateUnits
      .filter((s) => s.osm_id && selectedStateOsmIds.has(s.osm_id))
      .map((s) => ({ osmId: s.osm_id!, name: s.name }));

    try {
      setIsImporting(true);
      setImportProgress({ status: 'fetching', message: 'Starting...', progress: 0 });

      const boundaries = await fetchDistrictsForStates(
        selectedStates, districtLevel, setImportProgress
      );

      if (boundaries.length === 0) {
        toast.warning('No districts found for selected states');
        return;
      }

      const imported = await saveBoundariesToDB(
        supabase, boundaries, effectiveCountryId, workspaceId!, setImportProgress
      );

      toast.success(`${imported} ${districtLabel} imported`, {
        description: `For: ${selectedStates.map((s) => s.name).join(', ')}`,
      });
      refetchUnits();
      queryClient.invalidateQueries({ queryKey: ['boundary-counts'] });
      setSelectedStateOsmIds(new Set());
    } catch (error) {
      toast.error('Import failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      setImportProgress({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const renderProgress = () => {
    const { status } = importProgress;
    if (status === 'idle') return null;

    const isError = status === 'error';
    const isComplete = status === 'complete';

    return (
      <div className="space-y-2 p-4 border rounded-lg bg-card">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Import Status</span>
          <Badge
            variant={isError ? 'destructive' : 'default'}
            className={isComplete ? 'bg-emerald-500/10 text-emerald-600' : ''}
          >
            {isComplete ? (
              <><CheckCircle className="h-3 w-3 mr-1" />Complete</>
            ) : isError ? (
              <><AlertCircle className="h-3 w-3 mr-1" />Error</>
            ) : (
              <><RefreshCw className="h-3 w-3 mr-1 animate-spin" />{status.charAt(0).toUpperCase() + status.slice(1)}</>
            )}
          </Badge>
        </div>
        <Progress value={importProgress.progress} className="h-2" />
        <p className="text-sm text-muted-foreground">{importProgress.message}</p>
        {importProgress.total != null && (
          <p className="text-xs text-muted-foreground">
            {importProgress.imported ?? 0} / {importProgress.total} boundaries
          </p>
        )}
        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{importProgress.error}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Locations</h1>
          <p className="text-muted-foreground">
            Manage administrative boundaries and geographic data
          </p>
        </div>

        {workspaceCountries.length > 1 && (
          <Select value={effectiveCountryId} onValueChange={setSelectedCountryId}>
            <SelectTrigger className="w-52">
              <Globe className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select country..." />
            </SelectTrigger>
            <SelectContent>
              {workspaceCountries.map((wc) => (
                <SelectItem key={wc.country_id} value={wc.country_id}>
                  {wc.countries?.name} ({wc.countries?.iso_code})
                  {wc.is_primary ? ' (Primary)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {workspaceCountries.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No countries configured for this workspace. Go to{' '}
            <strong>General Settings &gt; Region</strong> to add countries first.
          </AlertDescription>
        </Alert>
      ) : (
        <Tabs defaultValue="boundaries" className="space-y-4">
          <TabsList>
            <TabsTrigger value="boundaries">
              {stateLabel} &amp; {districtLabel}
            </TabsTrigger>
            <TabsTrigger value="import">Import from OSM</TabsTrigger>
          </TabsList>

          {/* Boundaries Tab */}
          <TabsContent value="boundaries" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Administrative Boundaries — {countryName}</CardTitle>
                <CardDescription>
                  {stateUnits.length} {stateLabel.toLowerCase()},{' '}
                  {districtUnits.length} {districtLabel.toLowerCase()} imported
                </CardDescription>
              </CardHeader>
              <CardContent>
                {unitsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : adminUnits.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No boundaries imported yet. Use the "Import from OSM" tab to get started.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="border rounded-lg max-h-[500px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Level</TableHead>
                          <TableHead>Population</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adminUnits.slice(0, 200).map((unit) => (
                          <TableRow key={unit.id}>
                            <TableCell className="font-medium">{unit.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {unit.admin_level === stateLevel ? stateLabel.slice(0, -1) : districtLabel.slice(0, -1)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {unit.population?.toLocaleString() || '—'}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={unit.is_active ? 'default' : 'outline'}
                                className={unit.is_active ? 'bg-emerald-500/10 text-emerald-600' : 'text-muted-foreground'}
                              >
                                {unit.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {adminUnits.length > 200 && (
                      <p className="text-xs text-muted-foreground p-3 text-center">
                        Showing first 200 of {adminUnits.length} entries
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-4">

            {/* Step 1: Import States */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                  Import {stateLabel}
                  {hasStates && (
                    <Badge className="ml-1 bg-emerald-500/10 text-emerald-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {stateUnits.length} imported
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Download {stateLabel.toLowerCase()} for {countryName} from OpenStreetMap.
                  This is a fast query (~{isoCode === 'NG' ? '37' : '40'} results).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={handleImportStates}
                  disabled={isImporting}
                  variant={hasStates ? 'outline' : 'default'}
                >
                  {isImporting && importProgress.status === 'fetching' ? (
                    <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Importing...</>
                  ) : (
                    <><Download className="h-4 w-4 mr-2" />{hasStates ? `Re-import ${stateLabel}` : `Import ${stateLabel}`}</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Step 2: Select States → Import Districts */}
            <Card className={!hasStates ? 'opacity-50 pointer-events-none' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                  Select {stateLabel} &amp; Import {districtLabel}
                  {districtUnits.length > 0 && (
                    <Badge className="ml-1 bg-emerald-500/10 text-emerald-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {districtUnits.length} {districtLabel.toLowerCase()} imported
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Choose which {stateLabel.toLowerCase()} to import {districtLabel.toLowerCase()} for.
                  One Overpass request per state — large states may take 20–30 s each.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!hasStates ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ChevronRight className="h-4 w-4" />
                    Complete Step 1 first to see available {stateLabel.toLowerCase()}.
                  </div>
                ) : (
                  <>
                    {/* State checklist */}
                    <div className="border rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/40">
                        <Checkbox
                          id="select-all"
                          checked={selectedStateOsmIds.size === stateUnits.length && stateUnits.length > 0}
                          onCheckedChange={toggleAllStates}
                        />
                        <label htmlFor="select-all" className="text-xs font-medium cursor-pointer select-none">
                          Select all ({stateUnits.length} {stateLabel.toLowerCase()})
                        </label>
                        {selectedStateOsmIds.size > 0 && selectedStateOsmIds.size < stateUnits.length && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            {selectedStateOsmIds.size} selected
                          </span>
                        )}
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-0 divide-y">
                          {stateUnits.map((state) => {
                            const hasDistricts = districtUnits.some(
                              (d) => d.admin_level === districtLevel
                              // Note: we can't easily match by parent without parent_id, so
                              // we just track total count as an indicator
                            );
                            return (
                              <label
                                key={state.id}
                                className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 cursor-pointer select-none"
                              >
                                <Checkbox
                                  checked={state.osm_id ? selectedStateOsmIds.has(state.osm_id) : false}
                                  onCheckedChange={() => state.osm_id && toggleState(state.osm_id)}
                                  disabled={!state.osm_id}
                                />
                                <span className="text-sm">{state.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={handleImportDistricts}
                      disabled={isImporting || selectedStateOsmIds.size === 0}
                    >
                      {isImporting ? (
                        <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Importing...</>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Import {districtLabel} for{' '}
                          {selectedStateOsmIds.size === 0
                            ? `selected ${stateLabel.toLowerCase()}`
                            : selectedStateOsmIds.size === stateUnits.length
                            ? `all ${stateUnits.length} ${stateLabel.toLowerCase()}`
                            : `${selectedStateOsmIds.size} ${selectedStateOsmIds.size === 1 ? stateLabel.slice(0, -1).toLowerCase() : stateLabel.toLowerCase()}`}
                        </>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Progress */}
            {renderProgress()}

            <div className="text-xs text-muted-foreground space-y-1 px-1">
              <p><strong>Source:</strong> OpenStreetMap via Overpass API</p>
              <p><strong>License:</strong> OpenStreetMap ODbL</p>
              <p><strong>Note:</strong> Re-importing updates existing records (upsert on OSM ID)</p>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

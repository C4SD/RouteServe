import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAbilityContext } from '@/rbac/AbilityProvider';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Loader2, AlertCircle, AlertTriangle, Plus, Archive, Globe, Download, ChevronDown, X, Check, MapPin, RefreshCw, Lock, LockOpen } from 'lucide-react';
import { COUNTRY_ADMIN_LEVELS, fetchStatesFromOverpass, saveBoundariesToDB } from '@/lib/overpass-boundaries';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  SettingsSection,
} from '@/components/admin/settings';
import { CreateWorkspaceDialog } from '@/components/workspace/CreateWorkspaceDialog';
import type { WorkspaceSettings } from '@/hooks/settings/useWorkspaceSettings';

const ORG_TYPES = [
  { value: 'state_program', label: 'State Program' },
  { value: 'ngo', label: 'NGO' },
  { value: 'private_ops', label: 'Private Ops' },
];

const ALL_DAYS = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'sunday', label: 'Sunday' },
  { value: 'saturday', label: 'Saturday' },
];

export default function SettingsGeneralPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { workspaceId, workspaceName, role, archiveWorkspace, workspaces, switchWorkspace } = useWorkspace();
  const { can } = useAbilityContext();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const isOwnerOrAdmin = role === 'owner' || role === 'admin';

  const handleArchive = async () => {
    if (!workspaceId) return;
    setIsArchiving(true);
    try {
      await archiveWorkspace(workspaceId);
      setShowArchiveConfirm(false);
    } catch {
      // Error toast handled by context
    } finally {
      setIsArchiving(false);
    }
  };

  // Fetch workspace
  const { data: workspace, isLoading, error } = useQuery({
    queryKey: ['workspace-settings', workspaceId],
    queryFn: async () => {
      if (!workspaceId) throw new Error('No active workspace');

      const { data, error } = await supabase
        .from('workspaces')
        .select('id, name, slug, description, settings, org_type, org_name')
        .eq('id', workspaceId)
        .single();

      if (error) throw error;
      return data as {
        id: string;
        name: string;
        slug: string;
        description: string | null;
        settings: WorkspaceSettings | null;
        org_type: string | null;
        org_name: string | null;
      };
    },
    enabled: !!workspaceId,
    retry: 1,
  });

  // Fetch zones for dispatch zone selector
  const { data: zones = [] } = useQuery({
    queryKey: ['settings-zones', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zones')
        .select('id, name')
        .eq('workspace_id', workspaceId!)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!workspaceId,
  });

  // Fetch warehouses
  const { data: warehouses = [] } = useQuery({
    queryKey: ['settings-warehouses', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name')
        .eq('workspace_id', workspaceId!)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!workspaceId,
  });

  // Fetch programs
  const { data: programs = [] } = useQuery({
    queryKey: ['settings-programs', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programs')
        .select('id, name')
        .eq('workspace_id', workspaceId!)
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!workspaceId,
  });

  // Fetch all available countries
  const { data: allCountries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('countries')
        .select('id, name, iso_code, iso3_code')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch workspace countries (linked via workspace_countries)
  const { data: workspaceCountries = [], refetch: refetchWorkspaceCountries } = useQuery({
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

  // Check which countries have OSM boundaries already imported
  const linkedCountryIdsList = workspaceCountries.map((wc) => wc.country_id);
  const { data: boundaryCountsRaw = [] } = useQuery({
    queryKey: ['boundary-counts', workspaceId, linkedCountryIdsList.join(',')],
    queryFn: async () => {
      if (linkedCountryIdsList.length === 0) return [];
      const { data, error } = await supabase
        .from('admin_units')
        .select('country_id')
        .in('country_id', linkedCountryIdsList)
        .eq('workspace_id', workspaceId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!workspaceId && linkedCountryIdsList.length > 0,
  });

  // Map country_id → count of imported boundaries
  const boundaryCounts: Record<string, number> = boundaryCountsRaw.reduce(
    (acc, row) => {
      acc[row.country_id] = (acc[row.country_id] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Track which country's state panel is expanded (one at a time)
  const [expandedCountryId, setExpandedCountryId] = useState<string | null>(null);
  const [stateSearchOpen, setStateSearchOpen] = useState<Record<string, boolean>>({});
  // Track loading state per country for the "Load States" OSM fetch
  const [loadingStatesForCountry, setLoadingStatesForCountry] = useState<string | null>(null);

  // Fetch admin_units states from DB (all supported admin levels for states)
  const { data: allImportedStates = [], refetch: refetchImportedStates } = useQuery({
    queryKey: ['imported-states', workspaceId, linkedCountryIdsList.join(',')],
    queryFn: async () => {
      if (linkedCountryIdsList.length === 0) return [];
      const { data, error } = await supabase
        .from('admin_units')
        .select('id, name, admin_level, country_id, osm_id')
        .in('country_id', linkedCountryIdsList)
        .eq('workspace_id', workspaceId!)
        .in('admin_level', [4, 5])
        .order('name');
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string; admin_level: number; country_id: string; osm_id: number | null }>;
    },
    enabled: !!workspaceId && linkedCountryIdsList.length > 0,
  });

  // Load all states for a country from Overpass and save to admin_units
  const handleLoadStates = async (wc: { country_id: string; countries: { iso_code: string; name: string } | null }) => {
    const isoCode = wc.countries?.iso_code;
    if (!isoCode || !workspaceId) return;
    const adminConfig = COUNTRY_ADMIN_LEVELS[isoCode];
    const stateLevel = adminConfig?.states ?? 4;

    try {
      setLoadingStatesForCountry(wc.country_id);
      const boundaries = await fetchStatesFromOverpass(isoCode, stateLevel);
      if (boundaries.length === 0) {
        toast.warning('No states found from Overpass');
        return;
      }
      await saveBoundariesToDB(supabase, boundaries, wc.country_id, workspaceId);
      await refetchImportedStates();
      queryClient.invalidateQueries({ queryKey: ['boundary-counts'] });
      toast.success(`${boundaries.length} ${adminConfig?.label_states ?? 'states'} loaded for ${wc.countries?.name}`);
    } catch (err) {
      toast.error('Failed to load states', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoadingStatesForCountry(null);
    }
  };

  // Fetch current workspace_states assignments
  const { data: workspaceStates = [], refetch: refetchWorkspaceStates } = useQuery({
    queryKey: ['workspace-states', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspace_states')
        .select('id, admin_unit_id')
        .eq('workspace_id', workspaceId!);
      if (error) throw error;
      return (data || []) as Array<{ id: string; admin_unit_id: string }>;
    },
    enabled: !!workspaceId,
  });

  const workspaceStateUnitIds = new Set(workspaceStates.map((ws) => ws.admin_unit_id));

  const addWorkspaceStateMutation = useMutation({
    mutationFn: async (adminUnitId: string) => {
      const { error } = await supabase
        .from('workspace_states')
        .insert({ workspace_id: workspaceId!, admin_unit_id: adminUnitId });
      if (error) throw error;
    },
    onSuccess: () => refetchWorkspaceStates(),
    onError: () => toast.error('Failed to add state'),
  });

  const removeWorkspaceStateMutation = useMutation({
    mutationFn: async (wsId: string) => {
      const { error } = await supabase
        .from('workspace_states')
        .delete()
        .eq('id', wsId);
      if (error) throw error;
    },
    onSuccess: () => refetchWorkspaceStates(),
    onError: () => toast.error('Failed to remove state'),
  });

  // Form state
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgNameLocked, setOrgNameLocked] = useState(true);
  const [orgType, setOrgType] = useState<string | null>(null);
  const [settings, setSettings] = useState<WorkspaceSettings>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (workspace) {
      setName(workspace.name || '');
      setOrgName(workspace.org_name || workspace.name || '');
      setOrgType(workspace.org_type || null);
      setSettings(workspace.settings || {});
      setOrgNameLocked(true);
    }
  }, [workspace]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');

      const settingsToSave = { ...settings };
      if (!settingsToSave.working_days || settingsToSave.working_days.length === 0) {
        settingsToSave.working_days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
      }

      const { error } = await supabase.rpc('update_workspace_general_settings', {
        p_workspace_id: workspace.id,
        p_name: name.trim(),
        p_org_type: orgType || null,
        p_settings: settingsToSave as Record<string, unknown>,
        p_org_name: orgName.trim() || null,
      } as any);

      if (error) {
        // Fallback to direct update if RPC not found or permission issue
        console.warn('RPC failed, attempting direct update:', error.message);
        const { error: directError } = await supabase
          .from('workspaces')
          .update({
            name: name.trim(),
            org_name: orgName.trim() || null,
            org_type: orgType || null,
            settings: settingsToSave as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          })
          .eq('id', workspace.id);

        if (directError) throw directError;
      }
    },
    onSuccess: () => {
      toast.success('Settings saved successfully');
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['workspace-settings', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['my-workspaces'] });
    },
    onError: (err: any) => {
      console.error('Failed to save settings:', err);
      toast.error('Failed to save settings', {
        description: err?.message || err?.details || String(err),
      });
    },
  });

  const updateSettings = <K extends keyof WorkspaceSettings>(
    key: K,
    value: WorkspaceSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const toggleProgram = (programId: string) => {
    const current = settings.active_program_ids || [];
    const updated = current.includes(programId)
      ? current.filter((id) => id !== programId)
      : [...current, programId];
    updateSettings('active_program_ids', updated);
  };

  const toggleWorkingDay = (day: string) => {
    const current = settings.working_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];
    updateSettings('working_days', updated);
  };

  const [addingCountryId, setAddingCountryId] = useState<string>('');

  const addCountryMutation = useMutation({
    mutationFn: async (countryId: string) => {
      if (!workspaceId) throw new Error('No workspace');
      const isPrimary = workspaceCountries.length === 0;
      const { error } = await supabase
        .from('workspace_countries')
        .insert({ workspace_id: workspaceId, country_id: countryId, is_primary: isPrimary });
      if (error) throw error;
      return countryId;
    },
    onSuccess: (countryId) => {
      const country = allCountries.find((c) => c.id === countryId);
      toast.success(`${country?.name || 'Country'} added`, {
        description: 'Import OSM boundaries to enable location features.',
        action: {
          label: 'Import boundaries',
          onClick: () => navigate('/settings/locations'),
        },
      });
      setAddingCountryId('');
      refetchWorkspaceCountries();
      queryClient.invalidateQueries({ queryKey: ['boundary-counts', workspaceId] });
    },
    onError: (err) => {
      console.error('Failed to add country:', err);
      toast.error('Failed to add country');
    },
  });

  const removeCountryMutation = useMutation({
    mutationFn: async (wcId: string) => {
      const { error } = await supabase
        .from('workspace_countries')
        .delete()
        .eq('id', wcId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Country removed');
      refetchWorkspaceCountries();
    },
    onError: (err) => {
      console.error('Failed to remove country:', err);
      toast.error('Failed to remove country');
    },
  });

  const setPrimaryCountryMutation = useMutation({
    mutationFn: async (wcId: string) => {
      if (!workspaceId) throw new Error('No workspace');
      // Unset all primary flags for this workspace
      await supabase
        .from('workspace_countries')
        .update({ is_primary: false })
        .eq('workspace_id', workspaceId);
      // Set the selected one as primary
      const { error } = await supabase
        .from('workspace_countries')
        .update({ is_primary: true })
        .eq('id', wcId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Primary country updated');
      refetchWorkspaceCountries();
    },
    onError: (err) => {
      console.error('Failed to set primary country:', err);
      toast.error('Failed to update primary country');
    },
  });

  const availableCountries = allCountries.filter((c) => !linkedCountryIdsList.includes(c.id));

  if (!can('workspace.manage')) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-md">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="font-medium mb-1">Failed to load workspace settings</p>
          <p className="text-sm text-muted-foreground">
            {(error as { message?: string })?.message || 'Please check your connection and try again.'}
          </p>
        </div>
      </div>
    );
  }

  const missingDefaults = !settings.default_zone_id || !settings.default_warehouse_id;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">General settings</h1>
          <p className="text-muted-foreground">
            Configure your workspace settings and operational defaults.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setName(workspace.name || '');
              setOrgName(workspace.org_name || workspace.name || '');
              setOrgNameLocked(true);
              setOrgType(workspace.org_type || null);
              setSettings(workspace.settings || {});
              setHasChanges(false);
            }}
            disabled={!hasChanges}
          >
            Cancel
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={!hasChanges || updateMutation.isPending}
          >
            {updateMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {missingDefaults && (
        <div className="flex items-center gap-2 p-3 mb-6 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="text-sm">
            Operational defaults (dispatch zone and warehouse) are not yet configured. You can still save other settings.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Section 1a: Organization Identity */}
        <div className="border rounded-lg bg-card">
          <div className="px-6 pt-1 pb-1">
            <h2 className="text-base font-semibold pt-4 pb-2">Organization</h2>
          </div>
          <div className="px-6">
            <SettingsSection
              title="Organization name"
              description="The legal or brand name of your organization. Only admins can change this."
              showSeparator={false}
            >
              <div className="flex items-center gap-2">
                <Input
                  value={orgName}
                  onChange={(e) => {
                    setOrgName(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="Organization name"
                  disabled={orgNameLocked || !isOwnerOrAdmin}
                  className={cn('w-64', orgNameLocked && 'opacity-60')}
                />
                {isOwnerOrAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                    title={orgNameLocked ? 'Unlock to edit organization name' : 'Lock organization name'}
                    onClick={() => setOrgNameLocked((v) => !v)}
                  >
                    {orgNameLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                  </Button>
                )}
                {!isOwnerOrAdmin && (
                  <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </div>
            </SettingsSection>
          </div>
        </div>

        {/* Section 1b: Workspace Identity */}
        <div className="border rounded-lg bg-card">
          <div className="px-6 pt-1 pb-1">
            <h2 className="text-base font-semibold pt-4 pb-2">Workspace Identity</h2>
          </div>
          <div className="px-6">
            {workspaces.length >= 2 && (
              <SettingsSection
                title="Active workspace"
                description="You are editing settings for this workspace."
              >
                <Select
                  value={workspaceId ?? ''}
                  onValueChange={(id) => { if (id !== workspaceId) switchWorkspace(id); }}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select workspace..." />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((ws) => (
                      <SelectItem key={ws.workspace_id} value={ws.workspace_id}>
                        <span className="flex items-center gap-2">
                          {ws.name}
                          <span className="text-xs text-muted-foreground capitalize">({ws.role_code.replace(/_/g, ' ')})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingsSection>
            )}
            <SettingsSection
              title="Workspace name"
              description="The name of this team workspace (e.g. Lisbon Team, Munich Team)."
            >
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="e.g. Lisbon Team"
                className="w-64"
              />
            </SettingsSection>

            <SettingsSection
              title="Workspace ID"
              description="Auto-generated URL-friendly identifier for this workspace."
            >
              <Badge variant="secondary" className="text-sm font-mono px-3 py-1">
                {workspace.slug || '—'}
              </Badge>
            </SettingsSection>

            <SettingsSection
              title="Organization type"
              description="The organizational type."
            >
              <Select
                value={orgType || ''}
                onValueChange={(v) => {
                  setOrgType(v);
                  setHasChanges(true);
                }}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {ORG_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsSection>

            <SettingsSection
              title="Workspace actions"
              description="Create a new workspace or archive the current one."
              showSeparator={false}
            >
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setShowCreateDialog(true)}
                >
                  <Plus className="h-4 w-4" />
                  Create Workspace
                </Button>

                {isOwnerOrAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setShowArchiveConfirm(true)}
                  >
                    <Archive className="h-4 w-4" />
                    Archive Workspace
                  </Button>
                )}
              </div>
            </SettingsSection>
          </div>
        </div>

        {/* Section 2: Region / Countries + States */}
        <div className="border rounded-lg bg-card">
          <div className="px-6 pt-1 pb-1">
            <h2 className="text-base font-semibold pt-4 pb-2">Region</h2>
          </div>
          <div className="px-6">
            <SettingsSection
              title="Operating countries"
              description="Countries where this workspace operates. The primary country determines default boundaries and map center."
            >
              <div className="space-y-3">
                {workspaceCountries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No countries configured yet.</p>
                ) : (
                  <div className="space-y-2">
                    {workspaceCountries.map((wc) => {
                      const hasBoundaries = (boundaryCounts[wc.country_id] || 0) > 0;
                      const isoCode = wc.countries?.iso_code || '';
                      const adminConfig = COUNTRY_ADMIN_LEVELS[isoCode];
                      const stateLabel = adminConfig?.label_states || 'States';
                      const stateLevel = adminConfig?.states ?? 4;
                      const importedStatesForCountry = allImportedStates.filter(
                        (s) => s.country_id === wc.country_id && s.admin_level === stateLevel
                      );
                      const assignedStatesForCountry = importedStatesForCountry.filter(
                        (s) => workspaceStateUnitIds.has(s.id)
                      );
                      const isExpanded = expandedCountryId === wc.country_id;

                      return (
                        <Collapsible
                          key={wc.id}
                          open={isExpanded}
                          onOpenChange={(open) => setExpandedCountryId(open ? wc.country_id : null)}
                        >
                          <div className="rounded-lg border bg-muted/30 overflow-hidden">
                            {/* Country row */}
                            <div className="flex items-center justify-between p-2.5">
                              <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">
                                  {wc.countries?.name || 'Unknown'}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {isoCode}
                                </Badge>
                                {wc.is_primary && (
                                  <Badge className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    Primary
                                  </Badge>
                                )}
                                {assignedStatesForCountry.length > 0 && (
                                  <Badge variant="outline" className="text-xs gap-1">
                                    <MapPin className="h-2.5 w-2.5" />
                                    {assignedStatesForCountry.length} {stateLabel.toLowerCase()}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {stateLabel}
                                    <ChevronDown className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-180')} />
                                  </Button>
                                </CollapsibleTrigger>
                                {!wc.is_primary && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => setPrimaryCountryMutation.mutate(wc.id)}
                                    disabled={setPrimaryCountryMutation.isPending}
                                  >
                                    Set Primary
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-destructive hover:text-destructive"
                                  onClick={() => removeCountryMutation.mutate(wc.id)}
                                  disabled={removeCountryMutation.isPending}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>

                            {/* States panel */}
                            <CollapsibleContent>
                              <div className="border-t px-3 pb-3 pt-2 space-y-2.5 bg-background/50">
                                <p className="text-xs text-muted-foreground">
                                  Select which {stateLabel.toLowerCase()} this workspace operates in.
                                  The Locations import will then pull LGAs only for these states.
                                </p>

                                {/* Assigned states chips */}
                                {assignedStatesForCountry.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {assignedStatesForCountry.map((state) => {
                                      const ws = workspaceStates.find((w) => w.admin_unit_id === state.id);
                                      return (
                                        <Badge key={state.id} variant="secondary" className="gap-1 pr-1 text-xs">
                                          {state.name}
                                          <button
                                            onClick={() => ws && removeWorkspaceStateMutation.mutate(ws.id)}
                                            disabled={removeWorkspaceStateMutation.isPending}
                                            className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5"
                                          >
                                            <X className="h-2.5 w-2.5" />
                                          </button>
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                )}

                                <div className="flex items-center gap-2">
                                  {/* Add state popover — always available once states are loaded */}
                                  {importedStatesForCountry.length > 0 && (
                                    <Popover
                                      open={stateSearchOpen[wc.country_id]}
                                      onOpenChange={(open) =>
                                        setStateSearchOpen((prev) => ({ ...prev, [wc.country_id]: open }))
                                      }
                                    >
                                      <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                                          <Plus className="h-3 w-3" />
                                          Add {stateLabel.slice(0, -1)}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-56 p-0" align="start">
                                        <Command>
                                          <CommandInput placeholder={`Search ${stateLabel.toLowerCase()}...`} className="h-8 text-xs" />
                                          <CommandList>
                                            <CommandEmpty>No {stateLabel.toLowerCase()} found.</CommandEmpty>
                                            <CommandGroup>
                                              {importedStatesForCountry.map((state) => {
                                                const assigned = workspaceStateUnitIds.has(state.id);
                                                return (
                                                  <CommandItem
                                                    key={state.id}
                                                    value={state.name}
                                                    onSelect={() => {
                                                      if (!assigned) addWorkspaceStateMutation.mutate(state.id);
                                                      setStateSearchOpen((prev) => ({ ...prev, [wc.country_id]: false }));
                                                    }}
                                                    className="text-xs"
                                                  >
                                                    <Check className={cn('mr-2 h-3 w-3', assigned ? 'opacity-100' : 'opacity-0')} />
                                                    {state.name}
                                                  </CommandItem>
                                                );
                                              })}
                                            </CommandGroup>
                                          </CommandList>
                                        </Command>
                                      </PopoverContent>
                                    </Popover>
                                  )}

                                  {/* Load / refresh states from Overpass */}
                                  <Button
                                    variant={importedStatesForCountry.length === 0 ? 'default' : 'ghost'}
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    disabled={loadingStatesForCountry === wc.country_id}
                                    onClick={() => handleLoadStates(wc)}
                                  >
                                    {loadingStatesForCountry === wc.country_id ? (
                                      <><Loader2 className="h-3 w-3 animate-spin" />Loading...</>
                                    ) : importedStatesForCountry.length === 0 ? (
                                      <><Download className="h-3 w-3" />Load {stateLabel} from OSM</>
                                    ) : (
                                      <><RefreshCw className="h-3 w-3" />Refresh {stateLabel}</>
                                    )}
                                  </Button>
                                </div>

                                {importedStatesForCountry.length === 0 && loadingStatesForCountry !== wc.country_id && (
                                  <p className="text-xs text-muted-foreground italic">
                                    Click "Load {stateLabel} from OSM" to fetch all {stateLabel.toLowerCase()} for {wc.countries?.name}.
                                  </p>
                                )}
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Select
                    value={addingCountryId}
                    onValueChange={setAddingCountryId}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Add a country..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCountries.length === 0 ? (
                        <SelectItem value="__none" disabled>
                          No more countries available
                        </SelectItem>
                      ) : (
                        availableCountries.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.iso_code})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!addingCountryId || addCountryMutation.isPending}
                    onClick={() => {
                      if (addingCountryId) addCountryMutation.mutate(addingCountryId);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            </SettingsSection>
          </div>
        </div>

        {/* Section 3: Operational Defaults */}
        <div className="border rounded-lg bg-card">
          <div className="px-6 pt-1 pb-1">
            <h2 className="text-base font-semibold pt-4 pb-2">Operational Defaults</h2>
          </div>
          <div className="px-6">
            <SettingsSection
              title="Default dispatch zone"
              description="The default zone used when creating new batches."
            >
              <Select
                value={settings.default_zone_id || ''}
                onValueChange={(v) => updateSettings('default_zone_id', v)}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select zone..." />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((zone: any) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsSection>

            <SettingsSection
              title="Default warehouse"
              description="The default warehouse used when creating new batches."
            >
              <Select
                value={settings.default_warehouse_id || ''}
                onValueChange={(v) => updateSettings('default_warehouse_id', v)}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select warehouse..." />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((wh: any) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsSection>

            <SettingsSection
              title="Auto-assign driver"
              description="Automatically assign the nearest available driver to new batches."
              showSeparator={false}
            >
              <Switch
                checked={settings.auto_assign_driver ?? false}
                onCheckedChange={(v) => updateSettings('auto_assign_driver', v)}
              />
            </SettingsSection>
          </div>
        </div>

        {/* Section 3: Programs */}
        <div className="border rounded-lg bg-card">
          <div className="px-6 pt-1 pb-1">
            <h2 className="text-base font-semibold pt-4 pb-2">Programs</h2>
          </div>
          <div className="px-6">
            <SettingsSection
              title="Active programs"
              description="Programs currently active in this workspace."
              showSeparator={false}
            >
              <div className="space-y-2">
                {programs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No programs available.</p>
                ) : (
                  programs.map((program: any) => (
                    <label
                      key={program.id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={(settings.active_program_ids || []).includes(program.id)}
                        onCheckedChange={() => toggleProgram(program.id)}
                      />
                      <span className="text-sm">{program.name}</span>
                    </label>
                  ))
                )}
              </div>
            </SettingsSection>
          </div>
        </div>

        {/* Section 4: Operational Calendar */}
        <div className="border rounded-lg bg-card">
          <div className="px-6 pt-1 pb-1">
            <h2 className="text-base font-semibold pt-4 pb-2">Operational Calendar</h2>
          </div>
          <div className="px-6">
            <SettingsSection
              title="Start of week"
              description="Choose which day marks the start of your week."
            >
              <Select
                value={settings.start_of_week || 'monday'}
                onValueChange={(v) => updateSettings('start_of_week', v)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsSection>

            <SettingsSection
              title="Working days"
              description="Days of the week when operations are active."
            >
              <div className="flex flex-wrap gap-3">
                {ALL_DAYS.map((day) => (
                  <label
                    key={day.value}
                    className="flex items-center gap-1.5 cursor-pointer"
                  >
                    <Checkbox
                      checked={(settings.working_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']).includes(day.value)}
                      onCheckedChange={() => toggleWorkingDay(day.value)}
                    />
                    <span className="text-sm">{day.label}</span>
                  </label>
                ))}
              </div>
            </SettingsSection>

            <SettingsSection
              title="Dispatch cutoff time"
              description="Latest time dispatches can be created for same-day delivery."
            >
              <Input
                type="time"
                value={settings.dispatch_cutoff || ''}
                onChange={(e) => updateSettings('dispatch_cutoff', e.target.value)}
                className="w-40"
              />
            </SettingsSection>

            <SettingsSection
              title="Delivery SLA"
              description="Maximum hours allowed for delivery completion."
              showSeparator={false}
            >
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={168}
                  value={settings.sla_hours ?? ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!e.target.value) {
                      updateSettings('sla_hours', undefined);
                    } else if (val >= 1 && val <= 168) {
                      updateSettings('sla_hours', val);
                    }
                  }}
                  className="w-24"
                  placeholder="24"
                />
                <span className="text-sm text-muted-foreground">hours</span>
              </div>
            </SettingsSection>
          </div>
        </div>
      </div>

      <CreateWorkspaceDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Workspace</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive <strong>{workspaceName}</strong>?
              This workspace will be hidden and members will no longer be able to access it.
              This action can be reversed by an administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={isArchiving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isArchiving ? 'Archiving...' : 'Archive Workspace'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

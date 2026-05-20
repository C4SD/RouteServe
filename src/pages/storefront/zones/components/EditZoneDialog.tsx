import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Users, Plus, X, Check, Search, Building2 } from 'lucide-react';
import { useUpdateZone } from '@/hooks/useOperationalZones';
import { useFacilities } from '@/hooks/useFacilities';
import { useAllLGAsWithZones } from '@/hooks/useAdminUnits';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { OperationalZone, UpdateZoneInput } from '@/types/zones';
import { toast } from 'sonner';

interface EditZoneDialogProps {
  zone: OperationalZone;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditZoneDialog({ zone, open, onOpenChange }: EditZoneDialogProps) {
  const [formData, setFormData] = useState<UpdateZoneInput>({
    id: zone.id,
    name: zone.name,
    code: zone.code || undefined,
    description: zone.description || undefined,
    is_active: zone.is_active,
    region_center: zone.region_center || undefined,
  });
  const [saving, setSaving] = useState(false);
  const [facilitySearch, setFacilitySearch] = useState('');
  const [lgaSearch, setLgaSearch] = useState('');
  const [warehouseSearch, setWarehouseSearch] = useState('');

  const updateZone = useUpdateZone();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: facilitiesData } = useFacilities();
  const { data: allLGAs } = useAllLGAsWithZones({ workspaceId: workspaceId ?? undefined });
  const { data: zoneLGAs } = useAllLGAsWithZones({ zone_id: zone.id, workspaceId: workspaceId ?? undefined });

  const allFacilities = facilitiesData?.facilities || [];

  // Warehouses currently assigned to this zone
  const { data: zoneWarehouses } = useQuery({
    queryKey: ['zone-warehouses', zone.id, workspaceId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('warehouses')
        .select('id, name, code, city, state')
        .eq('zone_id', zone.id)
        .eq('workspace_id', workspaceId!);
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; code: string | null; city: string | null; state: string | null }[];
    },
    enabled: !!workspaceId,
  });

  // All workspace warehouses (for the "add warehouse" section)
  const { data: allWarehousesData } = useQuery({
    queryKey: ['warehouses-for-zone', workspaceId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('warehouses')
        .select('id, name, code, city, state, zone_id')
        .eq('workspace_id', workspaceId!)
        .neq('is_active', false)
        .order('name');
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; name: string; code: string | null; city: string | null; state: string | null; zone_id: string | null }[];
    },
    enabled: !!workspaceId,
  });

  // ── Derived data ───────────────────────────────────────────────────────────

  const zoneFacilities = useMemo(
    () => allFacilities.filter((f: any) => f.zone_id === zone.id),
    [allFacilities, zone.id]
  );

  const unassignedFacilities = useMemo(() => {
    let filtered = allFacilities.filter((f: any) => f.zone_id !== zone.id);
    if (facilitySearch.trim()) {
      const s = facilitySearch.toLowerCase();
      filtered = filtered.filter((f: any) =>
        f.name?.toLowerCase().includes(s) ||
        f.address?.toLowerCase().includes(s) ||
        f.lga?.toLowerCase().includes(s)
      );
    }
    return filtered;
  }, [allFacilities, facilitySearch, zone.id]);

  const unassignedLGAs = useMemo(() => {
    let filtered = (allLGAs || []).filter((l: any) => l.zone_id !== zone.id);
    if (lgaSearch.trim()) {
      const s = lgaSearch.toLowerCase();
      filtered = filtered.filter((l: any) =>
        l.name?.toLowerCase().includes(s) ||
        l.state?.toLowerCase().includes(s)
      );
    }
    return filtered;
  }, [allLGAs, lgaSearch, zone.id]);

  const availableWarehouses = useMemo(() => {
    let filtered = (allWarehousesData || []).filter(w => w.zone_id !== zone.id);
    if (warehouseSearch.trim()) {
      const s = warehouseSearch.toLowerCase();
      filtered = filtered.filter(w =>
        w.name?.toLowerCase().includes(s) ||
        w.code?.toLowerCase().includes(s) ||
        w.city?.toLowerCase().includes(s)
      );
    }
    return filtered;
  }, [allWarehousesData, warehouseSearch, zone.id]);

  useEffect(() => {
    setFormData({
      id: zone.id,
      name: zone.name,
      code: zone.code || undefined,
      description: zone.description || undefined,
      is_active: zone.is_active,
      region_center: zone.region_center || undefined,
    });
  }, [zone]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const handleChange = (field: keyof UpdateZoneInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateZone.mutateAsync(formData);
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const invalidateZone = () => {
    queryClient.invalidateQueries({ queryKey: ['zone-warehouses', zone.id] });
    queryClient.invalidateQueries({ queryKey: ['warehouses-for-zone'] });
    queryClient.invalidateQueries({ queryKey: ['zone-summary', zone.id] });
  };

  // ── Warehouse operations ───────────────────────────────────────────────────

  const assignWarehouse = async (warehouseId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('warehouses')
        .update({ zone_id: zone.id } as any)
        .eq('id', warehouseId);
      if (error) throw error;
      invalidateZone();
      toast.success('Warehouse added to zone');
    } catch (err: any) {
      toast.error(`Failed to add warehouse: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const removeWarehouse = async (warehouseId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('warehouses')
        .update({ zone_id: null } as any)
        .eq('id', warehouseId);
      if (error) throw error;
      invalidateZone();
      toast.success('Warehouse removed from zone');
    } catch (err: any) {
      toast.error(`Failed to remove warehouse: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const changeLgaWarehouse = async (lgaId: string, warehouseId: string | null) => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('assign_lga_warehouse' as any, {
        p_lga_id: lgaId,
        p_warehouse_id: warehouseId,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['all-lgas-with-zones'] });
      toast.success('Warehouse updated for LGA');
    } catch (err: any) {
      toast.error(`Failed to update LGA warehouse: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ── LGA operations ─────────────────────────────────────────────────────────

  const assignLGA = async (lgaId: string) => {
    setSaving(true);
    try {
      const lga = allLGAs?.find((l: any) => l.id === lgaId);
      if (!lga) { toast.error('LGA not found'); return; }

      const { error: lgaError } = await supabase.rpc('assign_lga_to_zone' as any, {
        p_lga_id: lgaId,
        p_zone_id: zone.id,
      });
      if (lgaError) throw lgaError;

      // Auto-assign the first zone warehouse if available
      const firstWarehouse = zoneWarehouses?.[0];
      if (firstWarehouse) {
        await supabase.rpc('assign_lga_warehouse' as any, {
          p_lga_id: lgaId,
          p_warehouse_id: firstWarehouse.id,
        });
      }

      // Bulk-assign facilities with matching LGA name
      const facilitiesInLGA = allFacilities.filter(
        (f: any) => f.lga?.toLowerCase() === lga.name?.toLowerCase()
      );
      if (facilitiesInLGA.length > 0) {
        const { error: facilitiesError } = await supabase
          .from('facilities')
          .update({ zone_id: zone.id })
          .in('id', facilitiesInLGA.map((f: any) => f.id));
        if (facilitiesError) throw facilitiesError;
        toast.success(`LGA assigned to zone (${facilitiesInLGA.length} facilities auto-assigned)`);
      } else {
        toast.success('LGA assigned to zone');
      }

      queryClient.invalidateQueries({ queryKey: ['all-lgas-with-zones'] });
      queryClient.invalidateQueries({ queryKey: ['lgas-by-state'] });
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      queryClient.invalidateQueries({ queryKey: ['zone-summary', zone.id] });
    } catch (err: any) {
      toast.error(`Failed to assign LGA: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const unassignLGA = async (lgaId: string) => {
    setSaving(true);
    try {
      const lga = zoneLGAs?.find((l: any) => l.id === lgaId);
      if (!lga) { toast.error('LGA not found'); return; }

      const { error: lgaError } = await supabase.rpc('unassign_lga_from_zone' as any, {
        p_lga_id: lgaId,
        p_zone_id: zone.id,
      });
      if (lgaError) throw lgaError;

      const facilitiesInLGA = allFacilities.filter(
        (f: any) => f.lga?.toLowerCase() === lga.name?.toLowerCase() && f.zone_id === zone.id
      );
      if (facilitiesInLGA.length > 0) {
        const { error: facilitiesError } = await supabase
          .from('facilities')
          .update({ zone_id: null })
          .in('id', facilitiesInLGA.map((f: any) => f.id));
        if (facilitiesError) throw facilitiesError;
        toast.success(`LGA removed from zone (${facilitiesInLGA.length} facilities unassigned)`);
      } else {
        toast.success('LGA removed from zone');
      }

      queryClient.invalidateQueries({ queryKey: ['all-lgas-with-zones'] });
      queryClient.invalidateQueries({ queryKey: ['lgas-by-state'] });
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      queryClient.invalidateQueries({ queryKey: ['zone-summary', zone.id] });
    } catch (err: any) {
      toast.error(`Failed to remove LGA: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Facility operations ────────────────────────────────────────────────────

  const assignFacility = async (facilityId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('facilities')
        .update({ zone_id: zone.id })
        .eq('id', facilityId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      queryClient.invalidateQueries({ queryKey: ['zone-summary', zone.id] });
      toast.success('Facility assigned to zone');
    } catch (err: any) {
      toast.error(`Failed to assign facility: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const unassignFacility = async (facilityId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('facilities')
        .update({ zone_id: null })
        .eq('id', facilityId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      queryClient.invalidateQueries({ queryKey: ['zone-summary', zone.id] });
      toast.success('Facility removed from zone');
    } catch (err: any) {
      toast.error(`Failed to remove facility: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Edit Zone</DialogTitle>
          <DialogDescription>
            Update zone information and manage assigned resources.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-2">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="warehouses">
              Warehouses
              {(zoneWarehouses?.length ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                  {zoneWarehouses!.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="lgas">
              LGAs
              {(zoneLGAs?.length || 0) > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                  {zoneLGAs?.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="facilities">
              Facilities
              {zoneFacilities.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                  {zoneFacilities.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Overview Tab ────────────────────────────────────────────── */}
          <TabsContent value="overview" className="mt-4">
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Zone Name *</Label>
                  <Input
                    id="edit-name"
                    placeholder="e.g., Central Zone"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-code">Zone Code</Label>
                  <Input
                    id="edit-code"
                    placeholder="e.g., CZ01"
                    value={formData.code || ''}
                    onChange={(e) => handleChange('code', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Optional short code for easy reference</p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    placeholder="Describe the zone's coverage area..."
                    value={formData.description || ''}
                    onChange={(e) => handleChange('description', e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-latitude">Latitude</Label>
                    <Input
                      id="edit-latitude"
                      type="number"
                      step="any"
                      placeholder="e.g., 11.9984"
                      value={formData.region_center?.lat || ''}
                      onChange={(e) => {
                        const lat = e.target.value ? parseFloat(e.target.value) : 0;
                        handleChange('region_center', { ...formData.region_center, lat, lng: formData.region_center?.lng || 0 });
                      }}
                    />
                    <p className="text-xs text-muted-foreground">Center latitude coordinate</p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-longitude">Longitude</Label>
                    <Input
                      id="edit-longitude"
                      type="number"
                      step="any"
                      placeholder="e.g., 8.5919"
                      value={formData.region_center?.lng || ''}
                      onChange={(e) => {
                        const lng = e.target.value ? parseFloat(e.target.value) : 0;
                        handleChange('region_center', { lat: formData.region_center?.lat || 0, ...formData.region_center, lng });
                      }}
                    />
                    <p className="text-xs text-muted-foreground">Center longitude coordinate</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="edit-is_active">Active</Label>
                    <p className="text-xs text-muted-foreground">Enable this zone for operations</p>
                  </div>
                  <Switch
                    id="edit-is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => handleChange('is_active', checked)}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={updateZone.isPending}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateZone.isPending}>
                    {updateZone.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </form>
          </TabsContent>

          {/* ── Warehouses Tab ───────────────────────────────────────────── */}
          <TabsContent value="warehouses" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Zone Warehouses
                </CardTitle>
                <CardDescription>
                  {zoneWarehouses?.length ?? 0} warehouse(s) serving this zone — each LGA can be bound to one warehouse below
                </CardDescription>
              </CardHeader>
              <CardContent>
                {zoneWarehouses && zoneWarehouses.length > 0 ? (
                  <div className="space-y-2">
                    {zoneWarehouses.map((warehouse) => {
                      const lgaCount = (zoneLGAs || []).filter((l: any) => l.warehouse_id === warehouse.id).length;
                      return (
                        <div key={warehouse.id} className="flex items-center justify-between p-2.5 border rounded-lg">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">{warehouse.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {warehouse.code && `${warehouse.code} · `}
                              {[warehouse.city, warehouse.state].filter(Boolean).join(', ') || 'No location'}{' '}
                              · {lgaCount} LGA{lgaCount !== 1 ? 's' : ''} bound
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeWarehouse(warehouse.id)}
                            disabled={saving}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No warehouses in this zone. Add one below.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Warehouse to Zone
                </CardTitle>
                <CardDescription>
                  {availableWarehouses.length} available warehouse(s)
                  {warehouseSearch && ` (filtered)`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search warehouses..."
                    className="pl-8"
                    value={warehouseSearch}
                    onChange={(e) => setWarehouseSearch(e.target.value)}
                  />
                </div>
                {availableWarehouses.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {availableWarehouses.map((w) => (
                      <div key={w.id} className="flex items-center justify-between p-2.5 border rounded-lg">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm">{w.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {w.code && `${w.code} · `}
                            {[w.city, w.state].filter(Boolean).join(', ') || 'No location'}
                            {w.zone_id && w.zone_id !== zone.id && (
                              <span className="text-orange-600"> · In another zone</span>
                            )}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => assignWarehouse(w.id)}
                          disabled={saving}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {warehouseSearch ? 'No warehouses match your search' : 'All warehouses are already in this zone'}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── LGAs Tab ─────────────────────────────────────────────────── */}
          <TabsContent value="lgas" className="mt-4 space-y-4">
            {(zoneWarehouses?.length ?? 0) === 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                Tip: Add warehouses in the <strong>Warehouses</strong> tab first — LGAs will then be auto-bound to the first warehouse when assigned.
              </div>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Assigned LGAs
                </CardTitle>
                <CardDescription>
                  {zoneLGAs?.length || 0} LGA(s) in this zone
                  {(zoneWarehouses?.length ?? 0) > 0 && ' — set which warehouse serves each LGA'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {zoneLGAs && zoneLGAs.length > 0 ? (
                  <div className="space-y-2">
                    {zoneLGAs.map((lga: any) => (
                      <div
                        key={lga.id}
                        className="flex items-center justify-between gap-2 p-2.5 border rounded-lg"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm">{lga.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {lga.parent?.name ?? 'Unknown state'}
                            {lga.population && ` · Pop: ${lga.population.toLocaleString()}`}
                          </p>
                        </div>

                        {/* Warehouse selector for this LGA */}
                        {(zoneWarehouses?.length ?? 0) > 0 && (
                          <Select
                            value={lga.warehouse_id ?? 'none'}
                            onValueChange={(val) =>
                              changeLgaWarehouse(lga.id, val === 'none' ? null : val)
                            }
                            disabled={saving}
                          >
                            <SelectTrigger className="h-7 text-xs w-36 shrink-0">
                              <SelectValue placeholder="Warehouse" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {zoneWarehouses!.map((w) => (
                                <SelectItem key={w.id} value={w.id}>
                                  {w.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => unassignLGA(lga.id)}
                          disabled={saving}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No LGAs assigned</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Available LGAs
                </CardTitle>
                <CardDescription>
                  {unassignedLGAs.length} available LGA(s)
                  {lgaSearch && ` (filtered)`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search LGAs..."
                    className="pl-8"
                    value={lgaSearch}
                    onChange={(e) => setLgaSearch(e.target.value)}
                  />
                </div>
                {unassignedLGAs.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {unassignedLGAs.map((lga: any) => (
                      <div
                        key={lga.id}
                        className="flex items-center justify-between p-2.5 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-sm">{lga.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {lga.parent?.name ?? 'Unknown state'}
                            {lga.zone_id && (
                              <span className="text-orange-600"> · Already assigned</span>
                            )}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => assignLGA(lga.id)}
                          disabled={saving}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {lgaSearch
                      ? 'No LGAs match your search'
                      : (allLGAs?.length ?? 0) === 0
                        ? 'No LGAs found. Import boundaries from Admin → Location Management.'
                        : 'All LGAs are in this zone'}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Facilities Tab ───────────────────────────────────────────── */}
          <TabsContent value="facilities" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Assigned Facilities
                </CardTitle>
                <CardDescription>
                  {zoneFacilities.length} facilit{zoneFacilities.length === 1 ? 'y' : 'ies'} in this zone
                </CardDescription>
              </CardHeader>
              <CardContent>
                {zoneFacilities.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {zoneFacilities.map((facility: any) => (
                      <div
                        key={facility.id}
                        className="flex items-center justify-between p-2.5 border rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{facility.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {facility.address}
                            {facility.lga && ` · LGA: ${facility.lga}`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2 flex-shrink-0"
                          onClick={() => unassignFacility(facility.id)}
                          disabled={saving}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No facilities assigned</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Available Facilities
                </CardTitle>
                <CardDescription>
                  {unassignedFacilities.length} available facilit{unassignedFacilities.length === 1 ? 'y' : 'ies'}
                  {facilitySearch && ` (filtered)`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, address, or LGA..."
                    className="pl-8"
                    value={facilitySearch}
                    onChange={(e) => setFacilitySearch(e.target.value)}
                  />
                </div>
                {unassignedFacilities.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {unassignedFacilities.map((facility: any) => (
                      <div
                        key={facility.id}
                        className="flex items-center justify-between p-2.5 border rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{facility.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {facility.address}
                            {facility.lga && ` · LGA: ${facility.lga}`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2 flex-shrink-0"
                          onClick={() => assignFacility(facility.id)}
                          disabled={saving}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {facilitySearch ? 'No facilities match your search' : 'All facilities are in this zone'}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

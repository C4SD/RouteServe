import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Users, Plus, X, Check, Search } from 'lucide-react';
import { useUpdateZone } from '@/hooks/useOperationalZones';
import { useFacilities } from '@/hooks/useFacilities';
import { useAllLGAsWithZones } from '@/hooks/useAdminUnits';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
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

  const updateZone = useUpdateZone();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  const { data: facilitiesData } = useFacilities();
  const { data: allLGAs } = useAllLGAsWithZones({ workspaceId: workspaceId ?? undefined });
  const { data: zoneLGAs } = useAllLGAsWithZones({ zone_id: zone.id, workspaceId: workspaceId ?? undefined });

  const allFacilities = facilitiesData?.facilities || [];

  const zoneFacilities = useMemo(
    () => allFacilities.filter((f: any) => f.zone_id === zone.id),
    [allFacilities, zone.id]
  );
  const unassignedFacilities = useMemo(
    () => {
      // Show all facilities that are NOT in the current zone (includes unassigned and assigned to other zones)
      let filtered = allFacilities.filter((f: any) => f.zone_id !== zone.id);

      if (facilitySearch.trim()) {
        const search = facilitySearch.toLowerCase();
        filtered = filtered.filter((f: any) =>
          f.name?.toLowerCase().includes(search) ||
          f.address?.toLowerCase().includes(search) ||
          f.lga?.toLowerCase().includes(search)
        );
      }

      return filtered;
    },
    [allFacilities, facilitySearch, zone.id]
  );

  const unassignedLGAs = useMemo(
    () => {
      // Show all LGAs that are NOT in the current zone (includes unassigned and assigned to other zones)
      let filtered = (allLGAs || []).filter((l: any) => l.zone_id !== zone.id);

      if (lgaSearch.trim()) {
        const search = lgaSearch.toLowerCase();
        filtered = filtered.filter((l: any) =>
          l.name?.toLowerCase().includes(search) ||
          l.state?.toLowerCase().includes(search)
        );
      }

      return filtered;
    },
    [allLGAs, lgaSearch, zone.id]
  );

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

  const handleChange = (field: keyof UpdateZoneInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateZone.mutateAsync(formData);
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

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

  const assignLGA = async (lgaId: string) => {
    setSaving(true);
    try {
      // Find the LGA name to match facilities
      const lga = allLGAs?.find((l: any) => l.id === lgaId);
      if (!lga) {
        toast.error('LGA not found');
        return;
      }

      // Use SECURITY DEFINER RPC to bypass RLS on global admin_units records
      const { error: lgaError } = await supabase.rpc('assign_lga_to_zone' as any, {
        p_lga_id: lgaId,
        p_zone_id: zone.id,
      });
      if (lgaError) throw lgaError;

      // Also assign all facilities with matching LGA name to the zone
      const facilitiesInLGA = allFacilities.filter(
        (f: any) => f.lga?.toLowerCase() === lga.name?.toLowerCase()
      );

      if (facilitiesInLGA.length > 0) {
        const facilityIds = facilitiesInLGA.map((f: any) => f.id);
        const { error: facilitiesError } = await supabase
          .from('facilities')
          .update({ zone_id: zone.id })
          .in('id', facilityIds);

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
      // Find the LGA name to match facilities
      const lga = zoneLGAs?.find((l: any) => l.id === lgaId);
      if (!lga) {
        toast.error('LGA not found');
        return;
      }

      // Use SECURITY DEFINER RPC to bypass RLS on global admin_units records
      const { error: lgaError } = await supabase.rpc('unassign_lga_from_zone' as any, {
        p_lga_id: lgaId,
        p_zone_id: zone.id,
      });
      if (lgaError) throw lgaError;

      // Also remove zone assignment from facilities with matching LGA name
      const facilitiesInLGA = allFacilities.filter(
        (f: any) =>
          f.lga?.toLowerCase() === lga.name?.toLowerCase() &&
          f.zone_id === zone.id
      );

      if (facilitiesInLGA.length > 0) {
        const facilityIds = facilitiesInLGA.map((f: any) => f.id);
        const { error: facilitiesError } = await supabase
          .from('facilities')
          .update({ zone_id: null })
          .in('id', facilityIds);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Edit Zone</DialogTitle>
          <DialogDescription>
            Update zone information and manage assigned resources.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
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

          {/* Overview Tab */}
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
                  <p className="text-xs text-muted-foreground">
                    Optional short code for easy reference
                  </p>
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
                        const lat = e.target.value ? parseFloat(e.target.value) : undefined;
                        handleChange('region_center', {
                          ...formData.region_center,
                          lat: lat || 0,
                          lng: formData.region_center?.lng || 0,
                        });
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Center latitude coordinate
                    </p>
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
                        const lng = e.target.value ? parseFloat(e.target.value) : undefined;
                        handleChange('region_center', {
                          lat: formData.region_center?.lat || 0,
                          lng: lng || 0,
                          ...formData.region_center,
                        });
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Center longitude coordinate
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="edit-is_active">Active</Label>
                    <p className="text-xs text-muted-foreground">
                      Enable this zone for operations
                    </p>
                  </div>
                  <Switch
                    id="edit-is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => handleChange('is_active', checked)}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={updateZone.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateZone.isPending}>
                    {updateZone.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </form>
          </TabsContent>

          {/* LGAs Tab */}
          <TabsContent value="lgas" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Assigned LGAs
                </CardTitle>
                <CardDescription>
                  {zoneLGAs?.length || 0} LGA(s) in this zone
                </CardDescription>
              </CardHeader>
              <CardContent>
                {zoneLGAs && zoneLGAs.length > 0 ? (
                  <div className="space-y-2">
                    {zoneLGAs.map((lga: any) => (
                      <div
                        key={lga.id}
                        className="flex items-center justify-between p-2.5 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-sm">{lga.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {lga.parent?.name ?? 'Unknown state'}
                            {lga.population && ` · Pop: ${lga.population.toLocaleString()}`}
                          </p>
                        </div>
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
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No LGAs assigned
                  </p>
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

          {/* Facilities Tab */}
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
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No facilities assigned
                  </p>
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

import { useState, useMemo } from 'react';
import { Loader2, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUpdateServiceArea, useServiceAreaFacilities, useAssignFacilitiesToServiceArea } from '@/hooks/useServiceAreas';
import { useFacilities } from '@/hooks/useFacilities';
import type { ServiceArea, ServiceType, DeliveryFrequency, ServicePriority } from '@/types/service-areas';

interface EditServiceAreaDialogProps {
  serviceArea: ServiceArea;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditServiceAreaDialog({ serviceArea, open, onOpenChange }: EditServiceAreaDialogProps) {
  const [form, setForm] = useState({
    name: serviceArea.name,
    service_type: serviceArea.service_type,
    priority: serviceArea.priority,
    delivery_frequency: serviceArea.delivery_frequency || '',
    max_distance_km: serviceArea.max_distance_km?.toString() || '',
    sla_hours: serviceArea.sla_hours?.toString() || '',
    description: serviceArea.description || '',
    is_active: serviceArea.is_active,
  });

  const [facilitySearch, setFacilitySearch] = useState('');
  const [facilityFilterLga, setFacilityFilterLga] = useState('all');
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[] | null>(null);

  const updateMutation = useUpdateServiceArea();
  const assignMutation = useAssignFacilitiesToServiceArea();

  const { data: saFacilities, isLoading: saFacilitiesLoading } = useServiceAreaFacilities(serviceArea.id);
  const { data: facilitiesData } = useFacilities();
  const allFacilities = facilitiesData?.facilities || [];

  const currentFacilityIds = useMemo(
    () => (saFacilities || []).map(saf => saf.facility_id),
    [saFacilities],
  );

  const effectiveSelectedIds = selectedFacilityIds ?? currentFacilityIds;

  const lgaOptions = useMemo(
    () => [...new Set(allFacilities.map((f: any) => f.lga).filter(Boolean))].sort() as string[],
    [allFacilities],
  );

  const visibleFacilities = useMemo(() => {
    const q = facilitySearch.toLowerCase();
    return allFacilities.filter((f: any) => {
      if (facilityFilterLga !== 'all' && f.lga !== facilityFilterLga) return false;
      if (q && !f.name.toLowerCase().includes(q) && !(f.lga || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allFacilities, facilitySearch, facilityFilterLga]);

  const toggleFacility = (id: string) => {
    setSelectedFacilityIds(prev => {
      const base = prev ?? currentFacilityIds;
      return base.includes(id) ? base.filter(x => x !== id) : [...base, id];
    });
  };

  const toggleVisible = () => {
    const visibleIds = visibleFacilities.map((f: any) => f.id);
    setSelectedFacilityIds(prev => {
      const base = prev ?? currentFacilityIds;
      const allSelected = visibleIds.every(id => base.includes(id));
      return allSelected
        ? base.filter(id => !visibleIds.includes(id))
        : [...new Set([...base, ...visibleIds])];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateMutation.mutateAsync({
      id: serviceArea.id,
      name: form.name,
      service_type: form.service_type as ServiceType,
      priority: form.priority as ServicePriority,
      delivery_frequency: form.delivery_frequency as DeliveryFrequency || undefined,
      max_distance_km: form.max_distance_km ? Number(form.max_distance_km) : undefined,
      sla_hours: form.sla_hours ? Number(form.sla_hours) : undefined,
      description: form.description || undefined,
      is_active: form.is_active,
    });

    if (selectedFacilityIds !== null) {
      await assignMutation.mutateAsync({
        serviceAreaId: serviceArea.id,
        facilityIds: selectedFacilityIds,
      });
    }

    onOpenChange(false);
  };

  const isSaving = updateMutation.isPending || assignMutation.isPending;
  const visibleIds = visibleFacilities.map((f: any) => f.id);
  const allVisibleSelected = !saFacilitiesLoading && visibleIds.length > 0 && visibleIds.every(id => effectiveSelectedIds.includes(id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Service Area</DialogTitle>
          <DialogDescription>Update service area configuration and facility assignments</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden gap-0">
          <Tabs defaultValue="details" className="flex flex-col flex-1 overflow-hidden">
            <TabsList className="grid grid-cols-2 shrink-0">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="facilities">
                Facilities ({effectiveSelectedIds.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="overflow-y-auto flex-1 space-y-4 mt-4 px-1">
              <div>
                <Label htmlFor="edit-sa-name">Name</Label>
                <Input
                  id="edit-sa-name"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Service Type</Label>
                  <Select
                    value={form.service_type}
                    onValueChange={(v) => setForm(prev => ({ ...prev, service_type: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="arv">ARV</SelectItem>
                      <SelectItem value="epi">EPI</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Priority</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => setForm(prev => ({ ...prev, priority: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Frequency</Label>
                  <Select
                    value={form.delivery_frequency}
                    onValueChange={(v) => setForm(prev => ({ ...prev, delivery_frequency: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Biweekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-max-dist">Max Distance (km)</Label>
                  <Input
                    id="edit-max-dist"
                    type="number"
                    value={form.max_distance_km}
                    onChange={(e) => setForm(prev => ({ ...prev, max_distance_km: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="edit-sla">SLA (hours)</Label>
                  <Input
                    id="edit-sla"
                    type="number"
                    value={form.sla_hours}
                    onChange={(e) => setForm(prev => ({ ...prev, sla_hours: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-sa-desc">Description</Label>
                <Textarea
                  id="edit-sa-desc"
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="edit-sa-active">Active</Label>
                <Switch
                  id="edit-sa-active"
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm(prev => ({ ...prev, is_active: v }))}
                />
              </div>
            </TabsContent>

            <TabsContent value="facilities" className="flex flex-col flex-1 overflow-hidden mt-4 gap-3">
              {saFacilitiesLoading ? (
                <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading current assignments…
                </div>
              ) : null}
              <div className={`flex items-center gap-2 shrink-0 ${saFacilitiesLoading ? 'pointer-events-none opacity-50' : ''}`}>
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or LGA…"
                    value={facilitySearch}
                    onChange={e => setFacilitySearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <Select value={facilityFilterLga} onValueChange={setFacilityFilterLga}>
                  <SelectTrigger className="h-8 text-xs w-[160px]">
                    <SelectValue placeholder="All LGAs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All LGAs</SelectItem>
                    {lgaOptions.map(lga => (
                      <SelectItem key={lga} value={lga}>{lga}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs shrink-0"
                  onClick={toggleVisible}
                >
                  {allVisibleSelected ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <ScrollArea className={`flex-1 border rounded-md ${saFacilitiesLoading ? 'pointer-events-none opacity-50' : ''}`}>
                <div className="p-2 space-y-0.5">
                  {visibleFacilities.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No facilities match the filter.
                    </p>
                  ) : (
                    visibleFacilities.map((f: any) => (
                      <div
                        key={f.id}
                        onClick={() => toggleFacility(f.id)}
                        className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${
                          effectiveSelectedIds.includes(f.id)
                            ? 'bg-primary/8 border border-primary/20'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <Checkbox
                          checked={effectiveSelectedIds.includes(f.id)}
                          onCheckedChange={() => toggleFacility(f.id)}
                          onClick={e => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{f.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {f.lga || '—'} · {f.level_of_care || 'N/A'}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t shrink-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !form.name}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

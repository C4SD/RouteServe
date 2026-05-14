import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOperationalZones } from '@/hooks/useOperationalZones';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useFacilities } from '@/hooks/useFacilities';
import { useCreateServiceArea } from '@/hooks/useServiceAreas';
import type { ServiceType, DeliveryFrequency, ServicePriority } from '@/types/service-areas';

type Step = 'zone' | 'warehouse' | 'config' | 'facilities' | 'review';

const STEPS: Step[] = ['zone', 'warehouse', 'config', 'facilities', 'review'];

const STEP_LABELS: Record<Step, string> = {
  zone: 'Select Zone',
  warehouse: 'Service Owner',
  config: 'Configuration',
  facilities: 'Assign Facilities',
  review: 'Review & Create',
};

interface FormData {
  zone_id: string;
  warehouse_id: string;
  name: string;
  service_type: ServiceType;
  delivery_frequency: DeliveryFrequency | '';
  priority: ServicePriority;
  max_distance_km: string;
  sla_hours: string;
  description: string;
  facility_ids: string[];
}

const INITIAL_FORM: FormData = {
  zone_id: '',
  warehouse_id: '',
  name: '',
  service_type: 'general',
  delivery_frequency: '',
  priority: 'standard',
  max_distance_km: '',
  sla_hours: '',
  description: '',
  facility_ids: [],
};

interface CreateServiceAreaWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateServiceAreaWizard({ open, onOpenChange }: CreateServiceAreaWizardProps) {
  const [step, setStep] = useState<Step>('zone');
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [facilityLoadMode, setFacilityLoadMode] = useState<'zone' | 'all'>('zone');
  const [facilityFilterLga, setFacilityFilterLga] = useState<string>('all');
  const [facilityFilterType, setFacilityFilterType] = useState<string>('all');
  const [facilityFilterLoc, setFacilityFilterLoc] = useState<string>('all');

  const { zones } = useOperationalZones();
  const { data: warehousesData } = useWarehouses();
  const warehouses = warehousesData?.warehouses || [];
  const { data: facilitiesData } = useFacilities();
  const facilities = facilitiesData?.facilities || [];
  const createMutation = useCreateServiceArea();

  const currentStepIndex = STEPS.indexOf(step);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;

  const selectedZone = zones?.find(z => z.id === form.zone_id);
  const selectedWarehouse = warehouses.find(w => w.id === form.warehouse_id);

  const canProceed = (): boolean => {
    switch (step) {
      case 'zone': return !!form.zone_id;
      case 'warehouse': return !!form.warehouse_id;
      case 'config': return !!form.name && !!form.service_type;
      case 'facilities': return form.facility_ids.length > 0;
      case 'review': return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (!isLastStep) {
      setStep(STEPS[currentStepIndex + 1]);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setStep(STEPS[currentStepIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    await createMutation.mutateAsync({
      name: form.name,
      zone_id: form.zone_id,
      warehouse_id: form.warehouse_id,
      service_type: form.service_type,
      description: form.description || undefined,
      max_distance_km: form.max_distance_km ? Number(form.max_distance_km) : undefined,
      delivery_frequency: form.delivery_frequency || undefined,
      priority: form.priority,
      sla_hours: form.sla_hours ? Number(form.sla_hours) : undefined,
      facility_ids: form.facility_ids,
    });
    setForm(INITIAL_FORM);
    setStep('zone');
    onOpenChange(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setForm(INITIAL_FORM);
      setStep('zone');
      setFacilityLoadMode('zone');
      setFacilityFilterLga('all');
      setFacilityFilterType('all');
      setFacilityFilterLoc('all');
    }
    onOpenChange(open);
  };

  const toggleFacility = (facilityId: string) => {
    setForm(prev => ({
      ...prev,
      facility_ids: prev.facility_ids.includes(facilityId)
        ? prev.facility_ids.filter(id => id !== facilityId)
        : [...prev.facility_ids, facilityId],
    }));
  };

  const allFacilities = Array.isArray(facilities) ? facilities : [];
  const lgaOptions = [...new Set(allFacilities.map((f: any) => f.lga).filter(Boolean))].sort();
  const typeOptions = [...new Set(allFacilities.map((f: any) => f.type).filter(Boolean))].sort();
  const locOptions = [...new Set(allFacilities.map((f: any) => f.level_of_care).filter(Boolean))].sort();

  const facilityList = allFacilities.filter((f: any) => {
    if (facilityLoadMode === 'zone' && form.zone_id) {
      if (f.zone_id !== form.zone_id) return false;
    }
    if (facilityFilterLga !== 'all' && f.lga !== facilityFilterLga) return false;
    if (facilityFilterType !== 'all' && f.type !== facilityFilterType) return false;
    if (facilityFilterLoc !== 'all' && f.level_of_care !== facilityFilterLoc) return false;
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Create Service Area</DialogTitle>
          <DialogDescription>
            Step {currentStepIndex + 1} of {STEPS.length}: {STEP_LABELS[step]}
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="flex items-center gap-1 mb-4">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full ${
                i <= currentStepIndex ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <ScrollArea className="flex-1 pr-4">
          {/* Step: Zone */}
          {step === 'zone' && (
            <div className="space-y-4">
              <Label>Select Zone</Label>
              <div className="grid gap-3 md:grid-cols-2">
                {zones?.map((zone) => (
                  <Card
                    key={zone.id}
                    className={`cursor-pointer transition-all ${
                      form.zone_id === zone.id
                        ? 'ring-2 ring-primary'
                        : 'hover:shadow-md'
                    }`}
                    onClick={() => setForm(prev => ({ ...prev, zone_id: zone.id, facility_ids: [] }))}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{zone.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">{zone.description || 'No description'}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step: Warehouse */}
          {step === 'warehouse' && (
            <div className="space-y-4">
              <Label>Select Service Owner (Warehouse)</Label>
              <div className="grid gap-3 md:grid-cols-2">
                {warehouses.map((wh) => (
                  <Card
                    key={wh.id}
                    className={`cursor-pointer transition-all ${
                      form.warehouse_id === wh.id
                        ? 'ring-2 ring-primary'
                        : 'hover:shadow-md'
                    }`}
                    onClick={() => setForm(prev => ({ ...prev, warehouse_id: wh.id }))}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{wh.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">{wh.address || 'No address'}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step: Config */}
          {step === 'config' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="sa-name">Name *</Label>
                <Input
                  id="sa-name"
                  placeholder="e.g., ARV - Central Warehouse"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Service Type *</Label>
                  <Select
                    value={form.service_type}
                    onValueChange={(v) => setForm(prev => ({ ...prev, service_type: v as ServiceType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                    onValueChange={(v) => setForm(prev => ({ ...prev, priority: v as ServicePriority }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Delivery Frequency</Label>
                  <Select
                    value={form.delivery_frequency}
                    onValueChange={(v) => setForm(prev => ({ ...prev, delivery_frequency: v as DeliveryFrequency }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Biweekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="max-dist">Max Distance (km)</Label>
                  <Input
                    id="max-dist"
                    type="number"
                    placeholder="e.g., 50"
                    value={form.max_distance_km}
                    onChange={(e) => setForm(prev => ({ ...prev, max_distance_km: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="sla">SLA (hours)</Label>
                  <Input
                    id="sla"
                    type="number"
                    placeholder="e.g., 24"
                    value={form.sla_hours}
                    onChange={(e) => setForm(prev => ({ ...prev, sla_hours: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="sa-desc">Description</Label>
                <Textarea
                  id="sa-desc"
                  placeholder="Optional description..."
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Step: Facilities */}
          {step === 'facilities' && (
            <div className="space-y-4">
              {/* Load mode toggle */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Load facilities from</p>
                <div className="flex gap-1 p-1 rounded-lg bg-muted">
                  <button
                    type="button"
                    onClick={() => setFacilityLoadMode('zone')}
                    className={`flex-1 text-xs py-1.5 px-2 rounded-md font-medium transition-colors ${
                      facilityLoadMode === 'zone'
                        ? 'bg-background shadow text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {selectedZone?.name ?? 'Zone'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFacilityLoadMode('all')}
                    className={`flex-1 text-xs py-1.5 px-2 rounded-md font-medium transition-colors ${
                      facilityLoadMode === 'all'
                        ? 'bg-background shadow text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    All Facilities / LGA
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>Assign Facilities ({form.facility_ids.length} selected)</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const visibleIds = facilityList.map((f: any) => f.id);
                    const allSelected = visibleIds.every((id: string) => form.facility_ids.includes(id));
                    setForm(prev => ({
                      ...prev,
                      facility_ids: allSelected
                        ? prev.facility_ids.filter((id) => !visibleIds.includes(id))
                        : [...new Set([...prev.facility_ids, ...visibleIds])],
                    }));
                  }}
                >
                  {facilityList.length > 0 && facilityList.every((f: any) => form.facility_ids.includes(f.id))
                    ? 'Deselect All'
                    : 'Select All'}
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Select value={facilityFilterLga} onValueChange={setFacilityFilterLga}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="LGA" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All LGAs</SelectItem>
                    {lgaOptions.map((lga) => (
                      <SelectItem key={lga} value={lga}>{lga}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={facilityFilterType} onValueChange={setFacilityFilterType}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Facility Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {typeOptions.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={facilityFilterLoc} onValueChange={setFacilityFilterLoc}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Level of Care" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    {locOptions.map((loc) => (
                      <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {facilityList.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {allFacilities.length === 0
                    ? 'No facilities found.'
                    : 'No facilities match the selected filters.'}
                </p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {facilityList.map((facility: any) => (
                    <div
                      key={facility.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        form.facility_ids.includes(facility.id)
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleFacility(facility.id)}
                    >
                      <Checkbox
                        checked={form.facility_ids.includes(facility.id)}
                        onCheckedChange={() => toggleFacility(facility.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{facility.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {facility.lga || facility.type || 'Unknown'} &middot; {facility.level_of_care || 'N/A'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step: Review */}
          {step === 'review' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Service Area Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{form.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Zone</span>
                    <span className="font-medium">{selectedZone?.name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Warehouse</span>
                    <span className="font-medium">{selectedWarehouse?.name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service Type</span>
                    <Badge variant="outline">{form.service_type.toUpperCase()}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Priority</span>
                    <Badge>{form.priority}</Badge>
                  </div>
                  {form.delivery_frequency && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frequency</span>
                      <span className="font-medium capitalize">{form.delivery_frequency}</span>
                    </div>
                  )}
                  {form.max_distance_km && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max Distance</span>
                      <span className="font-medium">{form.max_distance_km} km</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Facilities</span>
                    <span className="font-medium">{form.facility_ids.length}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </ScrollArea>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleBack} disabled={isFirstStep}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {isLastStep ? (
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Create Service Area
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

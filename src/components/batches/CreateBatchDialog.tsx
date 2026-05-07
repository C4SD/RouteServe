import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FacilityMapSelector } from './FacilityMapSelector';
import { VehicleSlotGrid } from './VehicleSlotGrid';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useDrivers } from '@/hooks/useDrivers';
import { useVehicles } from '@/hooks/useVehicles';
import { useFacilities } from '@/hooks/useFacilities';
import { useCreateDeliveryBatch } from '@/hooks/useDeliveryBatches';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CalendarIcon,
  Clock,
  Building2,
  MapPin,
  User,
  Truck,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormData {
  name: string;
  scheduledDate: Date | undefined;
  scheduledTime: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notes: string;
  warehouseId: string;
  facilityIds: string[];
  driverId: string;
  vehicleIds: string[];
}

// RFC-012: Vehicle-first selection flow
// Step order: Schedule → Vehicle → Route Planning → Review
const STEPS = [
  { id: 1, title: 'Schedule', icon: CalendarIcon },
  { id: 2, title: 'Vehicle', icon: Truck },
  { id: 3, title: 'Route Planning', icon: MapPin },
  { id: 4, title: 'Review', icon: Check },
];

export function CreateBatchDialog({ open, onOpenChange }: CreateBatchDialogProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    scheduledDate: undefined,
    scheduledTime: '08:00',
    priority: 'medium',
    notes: '',
    warehouseId: '',
    facilityIds: [],
    driverId: '',
    vehicleIds: [],
  });

  const { data: warehousesData } = useWarehouses();
  const { data: drivers = [] } = useDrivers();
  const { data: vehicles = [] } = useVehicles();
  const { data: facilitiesData } = useFacilities();
  const createBatch = useCreateDeliveryBatch();

  const warehouses = warehousesData?.warehouses || [];
  const facilities = facilitiesData?.facilities || [];

  // Get selected data for display
  const selectedWarehouse = warehouses.find(w => w.id === formData.warehouseId);
  const selectedDriver = drivers.find(d => d.id === formData.driverId);
  const selectedVehicles = vehicles.filter(v => formData.vehicleIds.includes(v.id));
  const selectedFacilities = facilities.filter(f => formData.facilityIds.includes(f.id));

  // Available drivers and vehicles
  const availableDrivers = drivers.filter(d => d.status === 'available');
  const availableVehicles = vehicles.filter(v => v.status === 'available');
  const inUseVehicles = vehicles.filter(v => v.status === 'in-use');
  const maintenanceVehicles = vehicles.filter(v => v.status === 'maintenance');

  const toggleVehicle = (vehicleId: string) => {
    setFormData(prev => ({
      ...prev,
      vehicleIds: prev.vehicleIds.includes(vehicleId)
        ? prev.vehicleIds.filter(id => id !== vehicleId)
        : [...prev.vehicleIds, vehicleId],
    }));
  };

  // Calculate slot validation across all selected vehicles (combined capacity)
  const slotValidation = useMemo(() => {
    if (selectedVehicles.length === 0 || formData.facilityIds.length === 0) {
      return { valid: true, totalSlots: 0, requiredSlots: 0 };
    }

    const totalSlots = selectedVehicles.reduce((sum, v) => {
      const tieredConfig = (v as any).tiered_config;
      if (tieredConfig?.tiers && Array.isArray(tieredConfig.tiers)) {
        return sum + tieredConfig.tiers.reduce((s: number, t: any) => s + (t.slot_count || 0), 0);
      }
      return sum;
    }, 0);

    const requiredSlots = formData.facilityIds.length;

    return {
      valid: totalSlots === 0 || requiredSlots <= totalSlots,
      totalSlots,
      requiredSlots,
      overflow: requiredSlots > totalSlots ? requiredSlots - totalSlots : 0,
    };
  }, [selectedVehicles, formData.facilityIds]);

  const handleNext = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!formData.scheduledDate || !formData.warehouseId || formData.facilityIds.length === 0) {
      return;
    }

    // Block if slot overflow and vehicles selected
    if (formData.vehicleIds.length > 0 && !slotValidation.valid) {
      return;
    }

    try {
      await createBatch.mutateAsync({
        name: formData.name || `Batch ${format(formData.scheduledDate, 'MMM d, yyyy')}`,
        warehouseId: formData.warehouseId,
        facilities: selectedFacilities,
        scheduledDate: format(formData.scheduledDate, 'yyyy-MM-dd'),
        scheduledTime: formData.scheduledTime,
        status: formData.driverId && formData.vehicleIds.length > 0 ? 'assigned' : 'planned',
        priority: formData.priority,
        totalDistance: 0,
        estimatedDuration: formData.facilityIds.length * 20,
        optimizedRoute: [],
        driverId: formData.driverId || undefined,
        vehicleIds: formData.vehicleIds.length > 0 ? formData.vehicleIds : undefined,
        vehicleId: formData.vehicleIds[0] || undefined,
        notes: formData.notes || undefined,
      });

      // Reset and close
      setFormData({
        name: '',
        scheduledDate: undefined,
        scheduledTime: '08:00',
        priority: 'medium',
        notes: '',
        warehouseId: '',
        facilityIds: [],
        driverId: '',
        vehicleIds: [],
      });
      setCurrentStep(1);
      onOpenChange(false);
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        // Schedule step
        return formData.scheduledDate && formData.scheduledTime;
      case 2:
        // Vehicle step - at least one vehicle required
        return formData.vehicleIds.length > 0;
      case 3:
        // Route Planning step - warehouse and at least 1 facility required
        if (!formData.warehouseId || formData.facilityIds.length === 0) {
          return false;
        }
        // If vehicles selected, must pass slot validation
        if (formData.vehicleIds.length > 0 && !slotValidation.valid) {
          return false;
        }
        return true;
      case 4:
        // Review step - all validations passed
        return true;
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Batch Name (optional)</Label>
              <Input
                id="name"
                placeholder="e.g., Morning Kano Deliveries"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to auto-generate from date
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Scheduled Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !formData.scheduledDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.scheduledDate
                        ? format(formData.scheduledDate, 'PPP')
                        : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.scheduledDate}
                      onSelect={(date) => setFormData({ ...formData, scheduledDate: date })}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="time">Start Time *</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="time"
                    type="time"
                    value={formData.scheduledTime}
                    onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: 'low' | 'medium' | 'high' | 'urgent') =>
                  setFormData({ ...formData, priority: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any special instructions or notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        );

      case 2:
        // STEP 2: Vehicle Selection (multi-vehicle, at least one required)
        return (
          <div className="space-y-4">
            <Alert className="bg-blue-500/10 border-blue-500/20">
              <Truck className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-600">
                Select one or more vehicles. Combined slot capacity determines how many facilities can be assigned.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Vehicles *
                {formData.vehicleIds.length > 0 && (
                  <Badge className="ml-1">{formData.vehicleIds.length} selected</Badge>
                )}
              </Label>

              {/* Selected vehicle chips */}
              {selectedVehicles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedVehicles.map(v => (
                    <Badge key={v.id} variant="secondary" className="gap-1 pr-1">
                      {v.model} · {v.plateNumber}
                      <button
                        onClick={() => toggleVehicle(v.id)}
                        className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <ScrollArea className="h-44 rounded-md border">
                <div className="p-2 space-y-0.5">
                  {availableVehicles.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                        Available ({availableVehicles.length})
                      </div>
                      {availableVehicles.map(v => {
                        const tieredConfig = (v as any).tiered_config;
                        const slots = tieredConfig?.tiers?.reduce((s: number, t: any) => s + (t.slot_count || 0), 0) ?? 0;
                        return (
                          <div
                            key={v.id}
                            className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted cursor-pointer"
                            onClick={() => toggleVehicle(v.id)}
                          >
                            <Checkbox checked={formData.vehicleIds.includes(v.id)} onCheckedChange={() => toggleVehicle(v.id)} />
                            <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm flex-1 truncate">{v.model} ({v.plateNumber})</span>
                            <Badge variant="outline" className="text-xs shrink-0">{v.capacity}m³</Badge>
                            {slots > 0 && <Badge variant="secondary" className="text-xs shrink-0">{slots} slots</Badge>}
                          </div>
                        );
                      })}
                    </>
                  )}
                  {inUseVehicles.length > 0 && (
                    <>
                      <Separator className="my-1" />
                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                        In Use ({inUseVehicles.length})
                      </div>
                      {inUseVehicles.map(v => (
                        <div
                          key={v.id}
                          className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted cursor-pointer"
                          onClick={() => toggleVehicle(v.id)}
                        >
                          <Checkbox checked={formData.vehicleIds.includes(v.id)} onCheckedChange={() => toggleVehicle(v.id)} />
                          <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm flex-1 truncate">{v.model} ({v.plateNumber})</span>
                          <Badge variant="outline" className="text-xs shrink-0">{v.capacity}m³</Badge>
                        </div>
                      ))}
                    </>
                  )}
                  {vehicles.length === 0 && (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">No vehicles found</div>
                  )}
                </div>
              </ScrollArea>

              {formData.vehicleIds.length === 0 && (
                <p className="text-xs text-destructive">At least one vehicle is required.</p>
              )}

              {/* Combined capacity summary */}
              {selectedVehicles.length > 0 && slotValidation.totalSlots > 0 && (
                <div className="rounded-md border p-3 text-xs text-muted-foreground space-y-1">
                  <span className="font-medium text-foreground">Combined capacity: </span>
                  {selectedVehicles.reduce((s, v) => s + (v.capacity || 0), 0)}m³ volume ·{' '}
                  {selectedVehicles.reduce((s, v) => s + (v.maxWeight || 0), 0)}kg ·{' '}
                  {slotValidation.totalSlots} slots
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Driver (optional)</Label>
              <Select
                value={formData.driverId || '__none__'}
                onValueChange={(value) => setFormData({ ...formData, driverId: value === '__none__' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select driver (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No driver assigned</SelectItem>
                  {availableDrivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {driver.name}
                        <Badge variant="secondary" className="text-xs">
                          {driver.licenseType}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 3:
        // STEP 3: Route Planning (warehouse + facilities)
        return (
          <div className="space-y-4">
            {/* Show vehicle capacity constraint */}
            {selectedVehicles.length > 0 && slotValidation.totalSlots > 0 && (
              <Alert className={formData.facilityIds.length > slotValidation.totalSlots ? 'bg-red-500/10 border-red-500/20' : 'bg-green-500/10 border-green-500/20'}>
                <AlertTriangle className={`h-4 w-4 ${formData.facilityIds.length > slotValidation.totalSlots ? 'text-red-600' : 'text-green-600'}`} />
                <AlertDescription className={formData.facilityIds.length > slotValidation.totalSlots ? 'text-red-600' : 'text-green-600'}>
                  {formData.facilityIds.length > slotValidation.totalSlots
                    ? `Slot overflow: ${formData.facilityIds.length} facilities selected but only ${slotValidation.totalSlots} combined slots available.`
                    : `Slot capacity: ${formData.facilityIds.length} / ${slotValidation.totalSlots} combined slots used`}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Origin Warehouse *</Label>
              <Select
                value={formData.warehouseId}
                onValueChange={(value) => setFormData({ ...formData, warehouseId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {warehouse.name}
                        {warehouse.code && (
                          <Badge variant="outline" className="text-xs">
                            {warehouse.code}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select Facilities * (Map-assisted)</Label>
                {slotValidation.totalSlots > 0 && (
                  <Badge variant={formData.facilityIds.length > slotValidation.totalSlots ? 'destructive' : 'secondary'}>
                    {formData.facilityIds.length} / {slotValidation.totalSlots} slots
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Select facilities from the map or list. Maximum {slotValidation.totalSlots || 'unlimited'} facilities based on vehicle capacity.
              </p>
              <FacilityMapSelector
                selectedFacilityIds={formData.facilityIds}
                onSelectionChange={(ids) => setFormData({ ...formData, facilityIds: ids })}
                warehouse={selectedWarehouse}
              />
            </div>

            {/* Zero facilities warning */}
            {formData.warehouseId && formData.facilityIds.length === 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  At least one facility must be selected to create a batch.
                </AlertDescription>
              </Alert>
            )}

            {/* Slot overflow blocking error */}
            {!slotValidation.valid && formData.facilityIds.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Required: {slotValidation.requiredSlots} slots | Available: {slotValidation.totalSlots} slots.
                  Remove {slotValidation.overflow} facilities or select a larger vehicle.
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 4:
        // STEP 4: Review
        return (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <h4 className="font-medium">Batch Summary</h4>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Name</p>
                  <p className="font-medium">
                    {formData.name || `Batch ${formData.scheduledDate ? format(formData.scheduledDate, 'MMM d, yyyy') : ''}`}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Priority</p>
                  <Badge
                    variant={
                      formData.priority === 'urgent'
                        ? 'destructive'
                        : formData.priority === 'high'
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {formData.priority}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Scheduled</p>
                  <p className="font-medium">
                    {formData.scheduledDate
                      ? format(formData.scheduledDate, 'PPP')
                      : 'Not set'}{' '}
                    at {formData.scheduledTime}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant="default">
                    {formData.driverId ? 'Assigned' : 'Vehicle Assigned'}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Vehicle & Driver Section */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Vehicles ({selectedVehicles.length})</p>
                  <div className="flex flex-col gap-1 mt-1">
                    {selectedVehicles.length > 0 ? selectedVehicles.map(v => (
                      <div key={v.id} className="flex items-center gap-2">
                        <Truck className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs">{v.model} ({v.plateNumber})</span>
                      </div>
                    )) : <span className="text-muted-foreground">None</span>}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">Driver</p>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="h-4 w-4" />
                    <p className="font-medium">{selectedDriver?.name || 'Not assigned'}</p>
                  </div>
                </div>
              </div>

              {/* Slot allocation summary with utilization metrics */}
              {selectedVehicles.length > 0 && (
                <div className="bg-muted/50 rounded-md p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground">Slot Utilization</p>
                    <Badge variant={slotValidation.valid ? 'secondary' : 'destructive'}>
                      {slotValidation.valid ? 'OK' : 'Overflow'}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold">{slotValidation.requiredSlots}</p>
                      <p className="text-xs text-muted-foreground">Required</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{slotValidation.totalSlots}</p>
                      <p className="text-xs text-muted-foreground">Available</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">
                        {slotValidation.totalSlots > 0
                          ? Math.round((slotValidation.requiredSlots / slotValidation.totalSlots) * 100)
                          : 0}%
                      </p>
                      <p className="text-xs text-muted-foreground">Utilization</p>
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">Origin Warehouse</p>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span>{selectedWarehouse?.name || 'Not selected'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">
                  Facilities ({formData.facilityIds.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {selectedFacilities.slice(0, 5).map((f) => (
                    <Badge key={f.id} variant="outline" className="text-xs">
                      <MapPin className="h-3 w-3 mr-1" />
                      {f.name}
                    </Badge>
                  ))}
                  {selectedFacilities.length > 5 && (
                    <Badge variant="secondary" className="text-xs">
                      +{selectedFacilities.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>

              {formData.notes && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">Notes</p>
                    <p className="text-sm">{formData.notes}</p>
                  </div>
                </>
              )}
            </div>

            {/* Final validation warnings */}
            {formData.facilityIds.length === 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Cannot create batch: No facilities selected. Go back and select at least one facility.
                </AlertDescription>
              </Alert>
            )}

            {formData.vehicleId && !slotValidation.valid && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Cannot create batch: slot overflow detected. Required: {slotValidation.requiredSlots} | Available: {slotValidation.totalSlots}
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // Determine dialog size based on step
  const getDialogClass = () => {
    if (currentStep === 3) {
      // Larger dialog for map-assisted facility selection (now step 3)
      return 'sm:max-w-[900px] max-h-[90vh]';
    }
    return 'sm:max-w-[600px] max-h-[90vh]';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(getDialogClass(), 'overflow-y-auto')}>
        <DialogHeader>
          <DialogTitle>Create Delivery Batch</DialogTitle>
          <DialogDescription>
            Plan a delivery route with map-assisted facility selection
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-between mb-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;

            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors',
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground'
                      : isCompleted
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-muted-foreground/30 text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={cn(
                    'ml-2 text-xs hidden sm:inline',
                    isActive ? 'text-primary font-medium' : 'text-muted-foreground'
                  )}
                >
                  {step.title}
                </span>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'w-8 h-0.5 mx-2',
                      isCompleted ? 'bg-primary' : 'bg-muted-foreground/30'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Step content */}
        <div className="py-4 min-h-[300px]">{renderStepContent()}</div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          {currentStep < 4 ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={createBatch.isPending || (formData.vehicleId && !slotValidation.valid)}
            >
              {createBatch.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Create Batch
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateBatchDialog;

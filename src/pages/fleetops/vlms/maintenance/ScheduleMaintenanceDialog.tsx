import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useMaintenanceStore } from '@/stores/vlms/maintenanceStore';
import { useVehicles } from '@/hooks/vlms/useVehicles';
import { MaintenanceFormData } from '@/types/vlms';

interface ScheduleMaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultVehicleId?: string;
}

export function ScheduleMaintenanceDialog({ open, onOpenChange, defaultVehicleId }: ScheduleMaintenanceDialogProps) {
  const { data: vehicles = [] } = useVehicles();
  const { createRecord, isLoading } = useMaintenanceStore();

  // Form state
  const [vehicleId, setVehicleId] = useState(defaultVehicleId || '');
  const [maintenanceType, setMaintenanceType] = useState<'scheduled' | 'repair' | 'inspection' | 'emergency'>('scheduled');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'critical'>('normal');
  const [scheduledDate, setScheduledDate] = useState('');
  const [description, setDescription] = useState('');
  const [serviceProvider, setServiceProvider] = useState('');
  const [serviceLocation, setServiceLocation] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [mileageAtService, setMileageAtService] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!vehicleId || !scheduledDate || !description.trim()) {
      return;
    }

    const formData: MaintenanceFormData = {
      vehicle_id: vehicleId,
      scheduled_date: scheduledDate,
      maintenance_type: maintenanceType,
      status: 'scheduled',
      priority,
      description,
      service_provider: serviceProvider || undefined,
      service_location: serviceLocation || undefined,
      labor_cost: estimatedCost ? parseFloat(estimatedCost) : undefined,
      mileage_at_service: mileageAtService ? parseInt(mileageAtService) : undefined,
    };

    try {
      await createRecord(formData);
      onOpenChange(false);

      // Reset form
      setVehicleId(defaultVehicleId || '');
      setMaintenanceType('scheduled');
      setPriority('normal');
      setScheduledDate('');
      setDescription('');
      setServiceProvider('');
      setServiceLocation('');
      setEstimatedCost('');
      setMileageAtService('');
    } catch (error) {
      // Error is handled by the store with toast
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Maintenance</DialogTitle>
          <DialogDescription>
            Schedule vehicle maintenance or service appointment
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {!defaultVehicleId && (
              <div className="col-span-2 space-y-2">
                <Label htmlFor="vehicle">Vehicle *</Label>
                <Select value={vehicleId} onValueChange={setVehicleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.make} {vehicle.model} - {vehicle.license_plate}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="maintenance-type">Maintenance Type *</Label>
              <Select
                value={maintenanceType}
                onValueChange={(value: any) => setMaintenanceType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled Maintenance</SelectItem>
                  <SelectItem value="repair">Repair</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority *</Label>
              <Select
                value={priority}
                onValueChange={(value: any) => setPriority(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduled-date">Scheduled Date *</Label>
              <Input
                id="scheduled-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mileage">Current Mileage</Label>
              <Input
                id="mileage"
                type="number"
                min="0"
                value={mileageAtService}
                onChange={(e) => setMileageAtService(e.target.value)}
                placeholder="e.g., 45000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-provider">Service Provider</Label>
              <Input
                id="service-provider"
                value={serviceProvider}
                onChange={(e) => setServiceProvider(e.target.value)}
                placeholder="e.g., AutoCare Services"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-location">Service Location</Label>
              <Input
                id="service-location"
                value={serviceLocation}
                onChange={(e) => setServiceLocation(e.target.value)}
                placeholder="e.g., 123 Main St, Kano"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="estimated-cost">Estimated Cost</Label>
              <Input
                id="estimated-cost"
                type="number"
                min="0"
                step="0.01"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                placeholder="e.g., 50000"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="description">Service Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the maintenance work to be performed..."
                rows={4}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!vehicleId || !scheduledDate || !description.trim() || isLoading}
            >
              {isLoading ? 'Scheduling...' : 'Schedule Maintenance'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

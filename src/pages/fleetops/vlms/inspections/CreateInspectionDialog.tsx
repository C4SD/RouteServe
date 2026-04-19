import { useState } from 'react';
import { useVehicles } from '@/hooks/useVehicles';
import { useInspectionsStore } from '@/stores/vlms/inspectionsStore';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface CreateInspectionDialogProps {
  open: boolean;
  onClose: () => void;
  defaultVehicleId?: string;
}

export function CreateInspectionDialog({ open, onClose, defaultVehicleId }: CreateInspectionDialogProps) {
  const { data: vehicles = [] } = useVehicles();
  const { createInspection, isCreating } = useInspectionsStore();

  const [formData, setFormData] = useState({
    vehicleId: defaultVehicleId || '',
    inspectionDate: new Date(),
    inspectionType: 'routine',
    inspectorName: '',
    overallStatus: 'pending',
    roadworthy: true,
    meetsSafetyStandards: true,
    odometerReading: '',
    notes: '',
    nextInspectionDate: undefined as Date | undefined,
  });

  const inspectionTypes = [
    { value: 'routine', label: 'Routine Inspection' },
    { value: 'pre_trip', label: 'Pre-Trip Inspection' },
    { value: 'post_trip', label: 'Post-Trip Inspection' },
    { value: 'annual', label: 'Annual Inspection' },
    { value: 'safety', label: 'Safety Inspection' },
  ];

  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'passed', label: 'Passed' },
    { value: 'passed with conditions', label: 'Passed with Conditions' },
    { value: 'failed', label: 'Failed' },
  ];

  const handleSubmit = async () => {
    if (!formData.vehicleId || !formData.inspectorName) {
      return;
    }

    const success = await createInspection({
      vehicle_id: formData.vehicleId,
      inspection_date: formData.inspectionDate.toISOString().split('T')[0],
      inspection_type: formData.inspectionType,
      inspector_name: formData.inspectorName,
      overall_status: formData.overallStatus,
      roadworthy: formData.roadworthy,
      meets_safety_standards: formData.meetsSafetyStandards,
      odometer_reading: formData.odometerReading ? parseInt(formData.odometerReading) : null,
      notes: formData.notes || null,
      next_inspection_date: formData.nextInspectionDate
        ? formData.nextInspectionDate.toISOString().split('T')[0]
        : null,
    });

    if (success) {
      handleClose();
    }
  };

  const handleClose = () => {
    setFormData({
      vehicleId: defaultVehicleId || '',
      inspectionDate: new Date(),
      inspectionType: 'routine',
      inspectorName: '',
      overallStatus: 'pending',
      roadworthy: true,
      meetsSafetyStandards: true,
      odometerReading: '',
      notes: '',
      nextInspectionDate: undefined,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Vehicle Inspection</DialogTitle>
          <DialogDescription>
            Record a new vehicle safety and compliance inspection
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Vehicle Selection */}
          {!defaultVehicleId && (
            <div className="grid gap-2">
              <Label htmlFor="vehicle">Vehicle *</Label>
              <Select
                value={formData.vehicleId}
                onValueChange={(value) => setFormData({ ...formData, vehicleId: value })}
              >
                <SelectTrigger id="vehicle">
                  <SelectValue placeholder="Select a vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.model} - {vehicle.plateNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Inspection Date */}
          <div className="grid gap-2">
            <Label>Inspection Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'justify-start text-left font-normal',
                    !formData.inspectionDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.inspectionDate ? (
                    format(formData.inspectionDate, 'PPP')
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.inspectionDate}
                  onSelect={(date) =>
                    date && setFormData({ ...formData, inspectionDate: date })
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Inspection Type */}
          <div className="grid gap-2">
            <Label htmlFor="type">Inspection Type *</Label>
            <Select
              value={formData.inspectionType}
              onValueChange={(value) => setFormData({ ...formData, inspectionType: value })}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {inspectionTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Inspector Name */}
          <div className="grid gap-2">
            <Label htmlFor="inspector">Inspector Name *</Label>
            <Input
              id="inspector"
              value={formData.inspectorName}
              onChange={(e) => setFormData({ ...formData, inspectorName: e.target.value })}
              placeholder="Enter inspector name"
            />
          </div>

          {/* Overall Status */}
          <div className="grid gap-2">
            <Label htmlFor="status">Overall Status *</Label>
            <Select
              value={formData.overallStatus}
              onValueChange={(value) => setFormData({ ...formData, overallStatus: value })}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Odometer Reading */}
          <div className="grid gap-2">
            <Label htmlFor="odometer">Odometer Reading (km)</Label>
            <Input
              id="odometer"
              type="number"
              value={formData.odometerReading}
              onChange={(e) => setFormData({ ...formData, odometerReading: e.target.value })}
              placeholder="Enter current odometer reading"
            />
          </div>

          {/* Switches */}
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="roadworthy">Roadworthy</Label>
                <p className="text-sm text-muted-foreground">
                  Vehicle is safe to operate on public roads
                </p>
              </div>
              <Switch
                id="roadworthy"
                checked={formData.roadworthy}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, roadworthy: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="safety">Meets Safety Standards</Label>
                <p className="text-sm text-muted-foreground">
                  Complies with all safety regulations
                </p>
              </div>
              <Switch
                id="safety"
                checked={formData.meetsSafetyStandards}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, meetsSafetyStandards: checked })
                }
              />
            </div>
          </div>

          {/* Next Inspection Date */}
          <div className="grid gap-2">
            <Label>Next Inspection Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'justify-start text-left font-normal',
                    !formData.nextInspectionDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.nextInspectionDate ? (
                    format(formData.nextInspectionDate, 'PPP')
                  ) : (
                    <span>Pick a date (optional)</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.nextInspectionDate}
                  onSelect={(date) =>
                    setFormData({ ...formData, nextInspectionDate: date })
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes or findings from the inspection"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isCreating || !formData.vehicleId || !formData.inspectorName}>
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Inspection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

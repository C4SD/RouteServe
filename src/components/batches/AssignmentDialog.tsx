import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDrivers } from '@/hooks/useDrivers';
import { useVehicles } from '@/hooks/useVehicles';
import { useBatchUpdate } from '@/hooks/useBatchUpdate';
import { User, Truck, Loader2, Clock, CheckCircle, AlertCircle, X } from 'lucide-react';
import type { DeliveryBatch, Driver, Vehicle } from '@/types';

interface AssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: DeliveryBatch | null;
}

export function AssignmentDialog({ open, onOpenChange, batch }: AssignmentDialogProps) {
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);

  const { data: drivers = [] } = useDrivers();
  const { data: vehicles = [] } = useVehicles();
  const batchUpdate = useBatchUpdate();

  useEffect(() => {
    if (batch) {
      setSelectedDriverId(batch.driverId || '');
      setSelectedVehicleIds(batch.vehicleIds ?? (batch.vehicleId ? [batch.vehicleId] : []));
    }
  }, [batch]);

  const selectedDriver = drivers.find(d => d.id === selectedDriverId);
  const selectedVehicles = vehicles.filter(v => selectedVehicleIds.includes(v.id));

  const availableDrivers = drivers.filter(d => d.status === 'available');
  const busyDrivers = drivers.filter(d => d.status === 'busy');
  const offlineDrivers = drivers.filter(d => d.status === 'offline');

  const availableVehicles = vehicles.filter(v => v.status === 'available');
  const inUseVehicles = vehicles.filter(v => v.status === 'in-use');
  const maintenanceVehicles = vehicles.filter(v => v.status === 'maintenance');

  const toggleVehicle = (vehicleId: string) => {
    setSelectedVehicleIds(prev =>
      prev.includes(vehicleId) ? prev.filter(id => id !== vehicleId) : [...prev, vehicleId]
    );
  };

  const removeVehicle = (vehicleId: string) => {
    setSelectedVehicleIds(prev => prev.filter(id => id !== vehicleId));
  };

  const handleSubmit = async () => {
    if (!batch) return;

    const updates: Partial<DeliveryBatch> = {
      driverId: selectedDriverId || undefined,
      vehicleIds: selectedVehicleIds,
    };

    if (selectedDriverId && selectedVehicleIds.length > 0 && batch.status === 'planned') {
      updates.status = 'assigned';
    }

    batchUpdate.mutate(
      { batchId: batch.id, updates },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const getDriverStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'busy': return <Clock className="h-3 w-3 text-yellow-500" />;
      case 'offline': return <AlertCircle className="h-3 w-3 text-gray-400" />;
      default: return null;
    }
  };

  const getVehicleStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'in-use': return <Clock className="h-3 w-3 text-yellow-500" />;
      case 'maintenance': return <AlertCircle className="h-3 w-3 text-red-500" />;
      default: return null;
    }
  };

  const renderDriverOption = (driver: Driver) => (
    <SelectItem key={driver.id} value={driver.id}>
      <div className="flex items-center gap-2">
        {getDriverStatusIcon(driver.status)}
        <span>{driver.name}</span>
        <Badge variant="outline" className="text-xs ml-auto">
          {driver.licenseType}
        </Badge>
      </div>
    </SelectItem>
  );

  const renderVehicleRow = (vehicle: Vehicle) => {
    const checked = selectedVehicleIds.includes(vehicle.id);
    return (
      <div
        key={vehicle.id}
        className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted cursor-pointer"
        onClick={() => toggleVehicle(vehicle.id)}
      >
        <Checkbox checked={checked} onCheckedChange={() => toggleVehicle(vehicle.id)} />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {getVehicleStatusIcon(vehicle.status)}
          <span className="text-sm truncate">
            {vehicle.model} ({vehicle.plateNumber})
          </span>
        </div>
        <Badge variant="outline" className="text-xs shrink-0">
          {vehicle.capacity}m³
        </Badge>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Assign Resources</DialogTitle>
          <DialogDescription>
            Assign a driver and one or more vehicles to batch: {batch?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Driver Selection */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Driver
            </Label>
            <Select
              value={selectedDriverId || '__unassigned__'}
              onValueChange={(v) => setSelectedDriverId(v === '__unassigned__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a driver" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassigned__">Unassigned</SelectItem>
                {availableDrivers.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      Available ({availableDrivers.length})
                    </div>
                    {availableDrivers.map(renderDriverOption)}
                  </>
                )}
                {busyDrivers.length > 0 && (
                  <>
                    <Separator className="my-1" />
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      Busy ({busyDrivers.length})
                    </div>
                    {busyDrivers.map(renderDriverOption)}
                  </>
                )}
                {offlineDrivers.length > 0 && (
                  <>
                    <Separator className="my-1" />
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      Offline ({offlineDrivers.length})
                    </div>
                    {offlineDrivers.map(renderDriverOption)}
                  </>
                )}
              </SelectContent>
            </Select>

            {selectedDriver && (
              <div className="rounded-lg border p-3 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{selectedDriver.name}</span>
                  <Badge
                    variant={
                      selectedDriver.status === 'available' ? 'default' :
                      selectedDriver.status === 'busy' ? 'secondary' : 'outline'
                    }
                  >
                    {selectedDriver.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div><span className="font-medium">License:</span> {selectedDriver.licenseType}</div>
                  <div><span className="font-medium">Phone:</span> {selectedDriver.phone}</div>
                  {selectedDriver.shiftStart && selectedDriver.shiftEnd && (
                    <div className="col-span-2">
                      <span className="font-medium">Shift:</span> {selectedDriver.shiftStart} - {selectedDriver.shiftEnd}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Vehicle Multi-Selection */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Vehicles
              {selectedVehicleIds.length > 0 && (
                <Badge className="ml-1">{selectedVehicleIds.length} selected</Badge>
              )}
            </Label>

            {/* Selected vehicles chips */}
            {selectedVehicles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedVehicles.map(v => (
                  <Badge key={v.id} variant="secondary" className="gap-1 pr-1">
                    {v.model} · {v.plateNumber}
                    <button
                      onClick={() => removeVehicle(v.id)}
                      className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Vehicle list with checkboxes */}
            <ScrollArea className="h-48 rounded-md border">
              <div className="p-2 space-y-0.5">
                {availableVehicles.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      Available ({availableVehicles.length})
                    </div>
                    {availableVehicles.map(renderVehicleRow)}
                  </>
                )}
                {inUseVehicles.length > 0 && (
                  <>
                    <Separator className="my-1" />
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      In Use ({inUseVehicles.length})
                    </div>
                    {inUseVehicles.map(renderVehicleRow)}
                  </>
                )}
                {maintenanceVehicles.length > 0 && (
                  <>
                    <Separator className="my-1" />
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      Maintenance ({maintenanceVehicles.length})
                    </div>
                    {maintenanceVehicles.map(renderVehicleRow)}
                  </>
                )}
                {vehicles.length === 0 && (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No vehicles found
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Combined capacity summary */}
            {selectedVehicles.length > 1 && (
              <div className="rounded-lg border p-3 text-xs space-y-1 text-muted-foreground">
                <div className="font-medium text-foreground text-sm">Combined Capacity</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-medium">Total Volume:</span>{' '}
                    {selectedVehicles.reduce((s, v) => s + (v.capacity || 0), 0)}m³
                  </div>
                  <div>
                    <span className="font-medium">Total Weight:</span>{' '}
                    {selectedVehicles.reduce((s, v) => s + (v.maxWeight || 0), 0)}kg
                  </div>
                </div>
              </div>
            )}

            {selectedVehicles.length === 1 && (
              <div className="rounded-lg border p-3 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {selectedVehicles[0].model} ({selectedVehicles[0].plateNumber})
                  </span>
                  <Badge
                    variant={
                      selectedVehicles[0].status === 'available' ? 'default' :
                      selectedVehicles[0].status === 'in-use' ? 'secondary' : 'destructive'
                    }
                  >
                    {selectedVehicles[0].status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div><span className="font-medium">Type:</span> {selectedVehicles[0].type}</div>
                  <div><span className="font-medium">Capacity:</span> {selectedVehicles[0].capacity}m³</div>
                  <div><span className="font-medium">Fuel:</span> {selectedVehicles[0].fuelType}</div>
                  <div><span className="font-medium">Max Weight:</span> {selectedVehicles[0].maxWeight}kg</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={batchUpdate.isPending}>
            {batchUpdate.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Assignment'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AssignmentDialog;

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
import { useIncidentsStore } from '@/stores/vlms/incidentsStore';
import { useVehicles } from '@/hooks/vlms/useVehicles';
import { useDrivers } from '@/hooks/useDrivers';
import { IncidentFormData, IncidentType, IncidentSeverity } from '@/types/vlms';

interface ReportIncidentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultVehicleId?: string;
}

export function ReportIncidentDialog({ open, onOpenChange, defaultVehicleId }: ReportIncidentDialogProps) {
  const { data: vehicles = [] } = useVehicles();
  const { data: drivers = [] } = useDrivers();
  const { createIncident, isLoading } = useIncidentsStore();

  // Form state
  const [vehicleId, setVehicleId] = useState(defaultVehicleId || '');
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split('T')[0]);
  const [incidentType, setIncidentType] = useState<IncidentType>('damage');
  const [severity, setSeverity] = useState<IncidentSeverity>('minor');
  const [location, setLocation] = useState('');
  const [driverId, setDriverId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [description, setDescription] = useState('');
  const [cause, setCause] = useState('');
  const [damagesDescription, setDamagesDescription] = useState('');
  const [passengers, setPassengers] = useState('');
  const [otherParties, setOtherParties] = useState('');
  const [odometerReading, setOdometerReading] = useState('');
  const [policeReportNumber, setPoliceReportNumber] = useState('');
  const [policeStation, setPoliceStation] = useState('');
  const [estimatedRepairCost, setEstimatedRepairCost] = useState('');

  // Update driver name when driver is selected
  const handleDriverChange = (selectedDriverId: string) => {
    setDriverId(selectedDriverId);
    if (selectedDriverId === 'none') {
      setDriverName('');
    } else {
      const driver = drivers.find((d) => d.id === selectedDriverId);
      if (driver) {
        setDriverName(driver.name);
      } else {
        setDriverName('');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!vehicleId || !incidentDate || !location.trim() || !description.trim() || !driverName.trim()) {
      return;
    }

    const formData: IncidentFormData = {
      vehicle_id: vehicleId,
      incident_date: incidentDate,
      incident_type: incidentType,
      severity,
      location,
      driver_name: driverName,
      description,
      driver_id: driverId && driverId !== 'none' ? driverId : undefined,
      cause: cause || undefined,
      damages_description: damagesDescription || undefined,
      passengers: passengers || undefined,
      other_parties: otherParties || undefined,
      odometer_reading: odometerReading ? parseInt(odometerReading) : undefined,
      police_report_number: policeReportNumber || undefined,
      police_station: policeStation || undefined,
      estimated_repair_cost: estimatedRepairCost ? parseFloat(estimatedRepairCost) : undefined,
    };

    try {
      await createIncident(formData);
      onOpenChange(false);

      // Reset form
      setVehicleId(defaultVehicleId || '');
      setIncidentDate(new Date().toISOString().split('T')[0]);
      setIncidentType('damage');
      setSeverity('minor');
      setLocation('');
      setDriverId('');
      setDriverName('');
      setDescription('');
      setCause('');
      setDamagesDescription('');
      setPassengers('');
      setOtherParties('');
      setOdometerReading('');
      setPoliceReportNumber('');
      setPoliceStation('');
      setEstimatedRepairCost('');
    } catch (error) {
      // Error is handled by the store with toast
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report Vehicle Incident</DialogTitle>
          <DialogDescription>
            Document a vehicle incident or accident
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
              <Label htmlFor="incident-date">Incident Date *</Label>
              <Input
                id="incident-date"
                type="date"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="odometer">Odometer Reading (km)</Label>
              <Input
                id="odometer"
                type="number"
                min="0"
                value={odometerReading}
                onChange={(e) => setOdometerReading(e.target.value)}
                placeholder="e.g., 45230"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="incident-type">Incident Type *</Label>
              <Select
                value={incidentType}
                onValueChange={(value: any) => setIncidentType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accident">Accident</SelectItem>
                  <SelectItem value="theft">Theft</SelectItem>
                  <SelectItem value="vandalism">Vandalism</SelectItem>
                  <SelectItem value="breakdown">Breakdown</SelectItem>
                  <SelectItem value="damage">Damage</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="severity">Severity *</Label>
              <Select
                value={severity}
                onValueChange={(value: any) => setSeverity(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">Minor</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                  <SelectItem value="total_loss">Total Loss</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="location">Incident Location *</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Airport Road, near Total Station, Kano"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="driver">Driver Involved</Label>
              <Select value={driverId} onValueChange={handleDriverChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select driver (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="driver-name">Driver Name *</Label>
              <Input
                id="driver-name"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Enter driver's name"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="description">Incident Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide a detailed description of what happened..."
                rows={4}
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="cause">Probable Cause</Label>
              <Textarea
                id="cause"
                value={cause}
                onChange={(e) => setCause(e.target.value)}
                placeholder="What caused the incident? (e.g., driver error, mechanical failure, road conditions)"
                rows={2}
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="damages">Damages Description</Label>
              <Textarea
                id="damages"
                value={damagesDescription}
                onChange={(e) => setDamagesDescription(e.target.value)}
                placeholder="Describe the damage to the vehicle..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimated-cost">Estimated Repair Cost</Label>
              <Input
                id="estimated-cost"
                type="number"
                min="0"
                step="0.01"
                value={estimatedRepairCost}
                onChange={(e) => setEstimatedRepairCost(e.target.value)}
                placeholder="e.g., 150000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="passengers">Passengers</Label>
              <Input
                id="passengers"
                value={passengers}
                onChange={(e) => setPassengers(e.target.value)}
                placeholder="Names of passengers (if any)"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="other-parties">Other Parties Involved</Label>
              <Textarea
                id="other-parties"
                value={otherParties}
                onChange={(e) => setOtherParties(e.target.value)}
                placeholder="Details of other vehicles or parties involved..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="police-report">Police Report Number</Label>
              <Input
                id="police-report"
                value={policeReportNumber}
                onChange={(e) => setPoliceReportNumber(e.target.value)}
                placeholder="e.g., PRN-2024-001234"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="police-station">Police Station</Label>
              <Input
                id="police-station"
                value={policeStation}
                onChange={(e) => setPoliceStation(e.target.value)}
                placeholder="e.g., Kano Central Police Station"
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
              disabled={
                !vehicleId ||
                !location.trim() ||
                !description.trim() ||
                !driverName.trim() ||
                isLoading
              }
            >
              {isLoading ? 'Reporting...' : 'Report Incident'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

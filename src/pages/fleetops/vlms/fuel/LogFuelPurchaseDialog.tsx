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
import { useFuelLogsStore } from '@/stores/vlms/fuelLogsStore';
import { useVehicles } from '@/hooks/vlms/useVehicles';
import { FuelLogFormData, FuelType, PaymentMethod } from '@/types/vlms';

interface LogFuelPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultVehicleId?: string;
}

export function LogFuelPurchaseDialog({ open, onOpenChange, defaultVehicleId }: LogFuelPurchaseDialogProps) {
  const { data: vehicles = [] } = useVehicles();
  const { createLog, isLoading } = useFuelLogsStore();

  // Form state
  const [vehicleId, setVehicleId] = useState(defaultVehicleId || '');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [stationName, setStationName] = useState('');
  const [stationLocation, setStationLocation] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('gasoline');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [odometerReading, setOdometerReading] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [notes, setNotes] = useState('');

  const totalCost = quantity && unitPrice ? (parseFloat(quantity) * parseFloat(unitPrice)).toFixed(2) : '0.00';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!vehicleId || !transactionDate || !quantity || !unitPrice || !odometerReading) {
      return;
    }

    const formData: FuelLogFormData = {
      vehicle_id: vehicleId,
      transaction_date: transactionDate,
      fuel_type: fuelType,
      quantity: parseFloat(quantity),
      unit_price: parseFloat(unitPrice),
      odometer_reading: parseInt(odometerReading),
      station_name: stationName || undefined,
      station_location: stationLocation || undefined,
      payment_method: paymentMethod,
      receipt_number: receiptNumber || undefined,
      notes: notes || undefined,
    };

    try {
      await createLog(formData);
      onOpenChange(false);

      // Reset form
      setVehicleId(defaultVehicleId || '');
      setTransactionDate(new Date().toISOString().split('T')[0]);
      setStationName('');
      setStationLocation('');
      setFuelType('gasoline');
      setQuantity('');
      setUnitPrice('');
      setOdometerReading('');
      setPaymentMethod('cash');
      setReceiptNumber('');
      setNotes('');
    } catch (error) {
      // Error is handled by the store with toast
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Fuel Purchase</DialogTitle>
          <DialogDescription>
            Record a fuel purchase transaction
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
              <Label htmlFor="transaction-date">Transaction Date *</Label>
              <Input
                id="transaction-date"
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fuel-type">Fuel Type *</Label>
              <Select
                value={fuelType}
                onValueChange={(value: any) => setFuelType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gasoline">Gasoline</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="cng">CNG</SelectItem>
                  <SelectItem value="lpg">LPG</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="station-name">Fuel Station Name</Label>
              <Input
                id="station-name"
                value={stationName}
                onChange={(e) => setStationName(e.target.value)}
                placeholder="e.g., Total Kano"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="station-location">Station Location</Label>
              <Input
                id="station-location"
                value={stationLocation}
                onChange={(e) => setStationLocation(e.target.value)}
                placeholder="e.g., Airport Road, Kano"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Fuel Quantity (Liters) *</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g., 45.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit-price">Unit Price (per litre) *</Label>
              <Input
                id="unit-price"
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="e.g., 617.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="total-cost">Total Cost</Label>
              <Input
                id="total-cost"
                type="text"
                value={totalCost}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="odometer">Odometer Reading (km) *</Label>
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
              <Label htmlFor="payment-method">Payment Method</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value: any) => setPaymentMethod(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="fuel_card">Fuel Card</SelectItem>
                  <SelectItem value="account">Account</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="receipt-number">Receipt Number</Label>
              <Input
                id="receipt-number"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder="e.g., RCP-123456"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about this fuel purchase..."
                rows={3}
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
              disabled={!vehicleId || !quantity || !unitPrice || !odometerReading || isLoading}
            >
              {isLoading ? 'Logging...' : 'Log Fuel Purchase'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * VLMS Vehicle Onboarding - Registration Form Component
 * Step 4: Enter vehicle registration and identification details
 */

import { useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, ArrowLeft, Satellite, Upload, X, FileText, Image as ImageIcon } from 'lucide-react';
import { useVehicleOnboardState } from '@/hooks/useVehicleOnboardState';
import { useOnboardingFilesStore } from '@/stores/vlms/onboardingFilesStore';

export function RegistrationForm() {
  const registrationData = useVehicleOnboardState((state) => state.registrationData);
  const updateRegistrationData = useVehicleOnboardState((state) => state.updateRegistrationData);
  const goToNextStep = useVehicleOnboardState((state) => state.goToNextStep);
  const goToPreviousStep = useVehicleOnboardState((state) => state.goToPreviousStep);
  const canGoNext = useVehicleOnboardState((state) => state.canGoNext());

  // File staging for documents and photos
  const {
    stagedDocuments,
    stagedPhotos,
    addDocuments,
    addPhotos,
    updateDocumentType,
    updatePhotoCaption,
    removeDocument,
    removePhoto,
  } = useOnboardingFilesStore();
  const docInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (field: string, value: any) => {
    updateRegistrationData({ [field]: value });
  };

  const handleDocumentSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      addDocuments(files);
      if (docInputRef.current) docInputRef.current.value = '';
    },
    [addDocuments]
  );

  const handlePhotoSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      addPhotos(files);
      if (photoInputRef.current) photoInputRef.current.value = '';
    },
    [addPhotos]
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Registration Details</CardTitle>
        <CardDescription>
          Enter vehicle identification, insurance, and operational information.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Basic Identification */}
        <div className="space-y-4">
          <h3 className="font-semibold">Basic Information</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="make">
                Make <span className="text-destructive">*</span>
              </Label>
              <Input
                id="make"
                placeholder="e.g., Toyota"
                value={registrationData.make}
                onChange={(e) => handleChange('make', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">
                Model <span className="text-destructive">*</span>
              </Label>
              <Input
                id="model"
                placeholder="e.g., Hiace"
                value={registrationData.model}
                onChange={(e) => handleChange('model', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">
                Year <span className="text-destructive">*</span>
              </Label>
              <Input
                id="year"
                type="number"
                placeholder={new Date().getFullYear().toString()}
                value={registrationData.year}
                onChange={(e) => handleChange('year', parseInt(e.target.value))}
                min={1900}
                max={new Date().getFullYear() + 1}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                placeholder="e.g., White"
                value={registrationData.color || ''}
                onChange={(e) => handleChange('color', e.target.value)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Registration & Identification */}
        <div className="space-y-4">
          <h3 className="font-semibold">Registration & Identification</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="license-plate">
                License Plate <span className="text-destructive">*</span>
              </Label>
              <Input
                id="license-plate"
                placeholder="e.g., ABC-123-XY"
                value={registrationData.license_plate}
                onChange={(e) => handleChange('license_plate', e.target.value.toUpperCase())}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vin">VIN (Vehicle Identification Number)</Label>
              <Input
                id="vin"
                placeholder="17-character VIN"
                value={registrationData.vin || ''}
                onChange={(e) => handleChange('vin', e.target.value.toUpperCase())}
                maxLength={17}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="registration-expiry">Registration Expiry</Label>
              <Input
                id="registration-expiry"
                type="date"
                value={registrationData.registration_expiry || ''}
                onChange={(e) => handleChange('registration_expiry', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="current-mileage">Current Mileage (km)</Label>
              <Input
                id="current-mileage"
                type="number"
                placeholder="0"
                value={registrationData.current_mileage || 0}
                onChange={(e) => handleChange('current_mileage', parseInt(e.target.value) || 0)}
                min={0}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Vehicle Specifications */}
        <div className="space-y-4">
          <h3 className="font-semibold">Specifications</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fuel-type">Fuel Type</Label>
              <Select
                value={registrationData.fuel_type || ''}
                onValueChange={(value) => handleChange('fuel_type', value)}
              >
                <SelectTrigger id="fuel-type">
                  <SelectValue placeholder="Select fuel type" />
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
              <Label htmlFor="transmission">Transmission</Label>
              <Select
                value={registrationData.transmission || ''}
                onValueChange={(value) => handleChange('transmission', value)}
              >
                <SelectTrigger id="transmission">
                  <SelectValue placeholder="Select transmission" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="automatic">Automatic</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="cvt">CVT</SelectItem>
                  <SelectItem value="dct">DCT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="engine-capacity">Engine Capacity (cc)</Label>
              <Input
                id="engine-capacity"
                type="number"
                placeholder="e.g., 2000"
                value={registrationData.engine_capacity || ''}
                onChange={(e) => handleChange('engine_capacity', parseFloat(e.target.value) || undefined)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seating-capacity">Seating Capacity</Label>
              <Input
                id="seating-capacity"
                type="number"
                placeholder="e.g., 2"
                value={registrationData.seating_capacity || ''}
                onChange={(e) => handleChange('seating_capacity', parseInt(e.target.value) || undefined)}
                min={1}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Acquisition Details */}
        <div className="space-y-4">
          <h3 className="font-semibold">Acquisition</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="acquisition-date">Acquisition Date</Label>
              <Input
                id="acquisition-date"
                type="date"
                value={registrationData.acquisition_date}
                onChange={(e) => handleChange('acquisition_date', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="acquisition-type">Acquisition Type</Label>
              <Select
                value={registrationData.acquisition_type}
                onValueChange={(value) => handleChange('acquisition_type', value)}
              >
                <SelectTrigger id="acquisition-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Purchase</SelectItem>
                  <SelectItem value="lease">Lease</SelectItem>
                  <SelectItem value="donation">Donation</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase-price">Purchase Price</Label>
              <Input
                id="purchase-price"
                type="number"
                placeholder="0.00"
                value={registrationData.purchase_price || ''}
                onChange={(e) => handleChange('purchase_price', parseFloat(e.target.value) || undefined)}
                min={0}
                step={0.01}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor-name">Vendor/Supplier Name</Label>
              <Input
                id="vendor-name"
                placeholder="e.g., ABC Motors"
                value={registrationData.vendor_name || ''}
                onChange={(e) => handleChange('vendor_name', e.target.value)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Insurance */}
        <div className="space-y-4">
          <h3 className="font-semibold">Insurance</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="insurance-provider">Insurance Provider</Label>
              <Input
                id="insurance-provider"
                placeholder="e.g., XYZ Insurance"
                value={registrationData.insurance_provider || ''}
                onChange={(e) => handleChange('insurance_provider', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="insurance-policy">Policy Number</Label>
              <Input
                id="insurance-policy"
                placeholder="Policy number"
                value={registrationData.insurance_policy_number || ''}
                onChange={(e) => handleChange('insurance_policy_number', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="insurance-expiry">Insurance Expiry</Label>
              <Input
                id="insurance-expiry"
                type="date"
                value={registrationData.insurance_expiry || ''}
                onChange={(e) => handleChange('insurance_expiry', e.target.value)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Telemetry / Tracker Configuration */}
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Satellite className="h-4 w-4" />
            Telemetry / Tracker Configuration
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure the GPS tracker and telematics device for real-time vehicle monitoring.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="telematics-provider">Telematics Provider</Label>
              <Select
                value={registrationData.telematics_provider || ''}
                onValueChange={(value) => handleChange('telematics_provider', value)}
              >
                <SelectTrigger id="telematics-provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="biko_native">Biko Native</SelectItem>
                  <SelectItem value="teltonika">Teltonika</SelectItem>
                  <SelectItem value="queclink">Queclink</SelectItem>
                  <SelectItem value="ruptela">Ruptela</SelectItem>
                  <SelectItem value="coban">Coban</SelectItem>
                  <SelectItem value="concox">Concox</SelectItem>
                  <SelectItem value="tramigo">Tramigo</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telematics-id">Device ID / IMEI</Label>
              <Input
                id="telematics-id"
                placeholder="e.g., 350544508537246"
                value={registrationData.telematics_id || ''}
                onChange={(e) => handleChange('telematics_id', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tracker-sim">SIM Card Number</Label>
              <Input
                id="tracker-sim"
                placeholder="e.g., +234 801 234 5678"
                value={registrationData.tracker_sim_number || ''}
                onChange={(e) => handleChange('tracker_sim_number', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tracker-protocol">Communication Protocol</Label>
              <Select
                value={registrationData.tracker_protocol || ''}
                onValueChange={(value) => handleChange('tracker_protocol', value)}
              >
                <SelectTrigger id="tracker-protocol">
                  <SelectValue placeholder="Select protocol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gprs">GPRS (2G)</SelectItem>
                  <SelectItem value="3g">3G</SelectItem>
                  <SelectItem value="4g">4G / LTE</SelectItem>
                  <SelectItem value="satellite">Satellite</SelectItem>
                  <SelectItem value="bluetooth">Bluetooth</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tracker Capabilities */}
          <div className="space-y-3">
            <Label>Tracker Capabilities</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { id: 'gps', label: 'GPS Location' },
                { id: 'speed', label: 'Speed Monitoring' },
                { id: 'fuel_level', label: 'Fuel Level Sensor' },
                { id: 'temperature', label: 'Temperature Sensor' },
                { id: 'door_sensor', label: 'Door Open/Close' },
                { id: 'engine_status', label: 'Engine Status (OBD)' },
              ].map((cap) => {
                const capabilities = registrationData.tracker_capabilities || [];
                const isChecked = capabilities.includes(cap.id as any);
                return (
                  <div key={cap.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`cap-${cap.id}`}
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        const updated = checked
                          ? [...capabilities, cap.id]
                          : capabilities.filter((c) => c !== cap.id);
                        handleChange('tracker_capabilities', updated);
                      }}
                    />
                    <Label htmlFor={`cap-${cap.id}`} className="text-sm font-normal cursor-pointer">
                      {cap.label}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <Separator />

        {/* Status & Notes */}
        <div className="space-y-4">
          <h3 className="font-semibold">Status & Notes</h3>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={registrationData.status}
                onValueChange={(value) => handleChange('status', value)}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="in_use">In Use</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="out_of_service">Out of Service</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes about this vehicle..."
                value={registrationData.notes || ''}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Documents & Photos Upload */}
        <div className="space-y-6">
          <h3 className="font-semibold flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Documents & Photos
          </h3>
          <p className="text-sm text-muted-foreground">
            Attach vehicle documents and photos now. They will be uploaded once the vehicle is created.
          </p>

          {/* Documents */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Documents</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => docInputRef.current?.click()}
              >
                <FileText className="mr-2 h-4 w-4" />
                Add Documents
              </Button>
              <input
                ref={docInputRef}
                type="file"
                className="hidden"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                onChange={handleDocumentSelect}
              />
            </div>

            {stagedDocuments.length > 0 ? (
              <div className="space-y-2">
                {stagedDocuments.map((staged, index) => (
                  <div
                    key={`${staged.file.name}-${index}`}
                    className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30"
                  >
                    <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{staged.file.name}</span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {formatFileSize(staged.file.size)}
                        </Badge>
                      </div>
                      <Select
                        value={staged.type}
                        onValueChange={(val) => updateDocumentType(index, val)}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="registration">Registration</SelectItem>
                          <SelectItem value="insurance">Insurance Certificate</SelectItem>
                          <SelectItem value="roadworthiness">Road Worthiness</SelectItem>
                          <SelectItem value="purchase">Purchase / Bill of Sale</SelectItem>
                          <SelectItem value="service_record">Service Record</SelectItem>
                          <SelectItem value="warranty">Warranty</SelectItem>
                          <SelectItem value="inspection_report">Inspection Report</SelectItem>
                          <SelectItem value="customs">Customs / Import</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => removeDocument(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                No documents added yet
              </p>
            )}
          </div>

          {/* Photos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Vehicle Photos</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => photoInputRef.current?.click()}
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Add Photos
              </Button>
              <input
                ref={photoInputRef}
                type="file"
                className="hidden"
                multiple
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handlePhotoSelect}
              />
            </div>

            {stagedPhotos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {stagedPhotos.map((staged, index) => (
                  <div key={`${staged.file.name}-${index}`} className="space-y-1.5">
                    <div className="relative group">
                      <img
                        src={URL.createObjectURL(staged.file)}
                        alt={staged.file.name}
                        className="w-full h-28 object-cover rounded-md border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removePhoto(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <input
                      type="text"
                      placeholder="Caption (optional)"
                      value={staged.caption}
                      onChange={(e) => updatePhotoCaption(index, e.target.value)}
                      className="w-full text-xs px-2 py-1 border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                No photos added yet
              </p>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={goToPreviousStep}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Button onClick={goToNextStep} disabled={!canGoNext} size="lg">
          Next: Review & Submit
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}

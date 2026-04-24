'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { VehicleFormData, vehicleFormSchema } from '@/lib/vlms/validationSchemas';
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
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useFacilities } from '@/hooks/useFacilities';
import { Vehicle } from '@/types/vlms';
import { Loader2, FileText, Image as ImageIcon } from 'lucide-react';
import { VehicleDocumentsTab } from './VehicleDocumentsTab';
import { VehiclePhotosTab } from './VehiclePhotosTab';

interface VehicleFormProps {
  vehicle?: Vehicle;
  onSubmit: (data: VehicleFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function VehicleForm({ vehicle, onSubmit, onCancel, isSubmitting }: VehicleFormProps) {
  const { data: facilitiesData } = useFacilities();
  const facilities = facilitiesData?.facilities;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: vehicle
      ? {
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          vin: vehicle.vin || '',
          license_plate: vehicle.license_plate,
          vehicle_type: vehicle.type as any,
          fuel_type: vehicle.fuel_type as any,
          transmission: vehicle.transmission as any,
          engine_capacity: vehicle.engine_capacity || undefined,
          color: vehicle.color || '',
          seating_capacity: vehicle.seating_capacity || undefined,
          cargo_capacity: vehicle.cargo_capacity || undefined,
          acquisition_date: vehicle.acquisition_date,
          acquisition_type: vehicle.acquisition_type as any,
          purchase_price: vehicle.purchase_price || undefined,
          vendor_name: vehicle.vendor_name || '',
          warranty_expiry: vehicle.warranty_expiry || '',
          status: vehicle.status as any,
          current_location_id: vehicle.current_location_id || '',
          current_driver_id: vehicle.current_driver_id || '',
          current_mileage: vehicle.current_mileage,
          insurance_provider: vehicle.insurance_provider || '',
          insurance_policy_number: vehicle.insurance_policy_number || '',
          insurance_expiry: vehicle.insurance_expiry || '',
          registration_expiry: vehicle.registration_expiry || '',
          depreciation_rate: vehicle.depreciation_rate || undefined,
          current_book_value: vehicle.current_book_value || undefined,
          notes: vehicle.notes || '',
          tags: vehicle.tags || [],
        }
      : {
          status: 'available',
          current_mileage: 0,
          acquisition_date: new Date().toISOString().split('T')[0],
        },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className={`grid w-full ${vehicle ? 'grid-cols-6' : 'grid-cols-4'}`}>
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="specs">Specifications</TabsTrigger>
          <TabsTrigger value="acquisition">Acquisition</TabsTrigger>
          <TabsTrigger value="insurance">Insurance & Reg</TabsTrigger>
          {vehicle && (
            <>
              <TabsTrigger value="documents">
                <FileText className="h-4 w-4 mr-1.5" />
                Documents
              </TabsTrigger>
              <TabsTrigger value="photos">
                <ImageIcon className="h-4 w-4 mr-1.5" />
                Photos
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Basic Info Tab */}
        <TabsContent value="basic">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="make">
                    Make <span className="text-destructive">*</span>
                  </Label>
                  <Input id="make" {...register('make')} placeholder="Toyota" />
                  {errors.make && (
                    <p className="text-sm text-destructive" role="alert">{errors.make.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">
                    Model <span className="text-destructive">*</span>
                  </Label>
                  <Input id="model" {...register('model')} placeholder="Hilux" />
                  {errors.model && (
                    <p className="text-sm text-destructive" role="alert">{errors.model.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="year">
                    Year <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="year"
                    type="number"
                    {...register('year', { valueAsNumber: true })}
                    placeholder="2023"
                  />
                  {errors.year && (
                    <p className="text-sm text-destructive" role="alert">{errors.year.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="license_plate">
                    License Plate <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="license_plate"
                    {...register('license_plate')}
                    placeholder="KN-1234-ABC"
                  />
                  {errors.license_plate && (
                    <p className="text-sm text-destructive" role="alert">{errors.license_plate.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vin">VIN (Optional)</Label>
                  <Input id="vin" {...register('vin')} placeholder="17-character VIN" />
                  {errors.vin && <p className="text-sm text-destructive" role="alert">{errors.vin.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicle_type">
                    Vehicle Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={watch('vehicle_type')}
                    onValueChange={(value) => setValue('vehicle_type', value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sedan">Sedan</SelectItem>
                      <SelectItem value="suv">SUV</SelectItem>
                      <SelectItem value="truck">Truck</SelectItem>
                      <SelectItem value="van">Van</SelectItem>
                      <SelectItem value="motorcycle">Motorcycle</SelectItem>
                      <SelectItem value="bus">Bus</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.vehicle_type && (
                    <p className="text-sm text-destructive" role="alert">{errors.vehicle_type.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fuel_type">
                    Fuel Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={watch('fuel_type')}
                    onValueChange={(value) => setValue('fuel_type', value as any)}
                  >
                    <SelectTrigger>
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
                  {errors.fuel_type && (
                    <p className="text-sm text-destructive" role="alert">{errors.fuel_type.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transmission">Transmission</Label>
                  <Select
                    value={watch('transmission')}
                    onValueChange={(value) => setValue('transmission', value as any)}
                  >
                    <SelectTrigger>
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={watch('status')}
                    onValueChange={(value) => setValue('status', value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="in_use">In Use</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="out_of_service">Out of Service</SelectItem>
                      <SelectItem value="disposed">Disposed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="current_location_id">Current Location</Label>
                  <Select
                    value={watch('current_location_id')}
                    onValueChange={(value) => setValue('current_location_id', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {facilities?.map((facility) => (
                        <SelectItem key={facility.id} value={facility.id}>
                          {facility.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Specifications Tab */}
        <TabsContent value="specs">
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Specifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="engine_capacity">Engine Capacity (L or kWh)</Label>
                  <Input
                    id="engine_capacity"
                    type="number"
                    step="0.1"
                    {...register('engine_capacity', { valueAsNumber: true })}
                    placeholder="2.8"
                  />
                  {errors.engine_capacity && (
                    <p className="text-sm text-destructive" role="alert">{errors.engine_capacity.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <Input id="color" {...register('color')} placeholder="White" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="seating_capacity">Seating Capacity</Label>
                  <Input
                    id="seating_capacity"
                    type="number"
                    {...register('seating_capacity', { valueAsNumber: true })}
                    placeholder="5"
                  />
                  {errors.seating_capacity && (
                    <p className="text-sm text-destructive" role="alert">{errors.seating_capacity.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cargo_capacity">Cargo Capacity (m³)</Label>
                  <Input
                    id="cargo_capacity"
                    type="number"
                    step="0.1"
                    {...register('cargo_capacity', { valueAsNumber: true })}
                    placeholder="1.2"
                  />
                  {errors.cargo_capacity && (
                    <p className="text-sm text-destructive" role="alert">{errors.cargo_capacity.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="current_mileage">Current Mileage (km)</Label>
                <Input
                  id="current_mileage"
                  type="number"
                  step="0.1"
                  {...register('current_mileage', { valueAsNumber: true })}
                  placeholder="15234.5"
                />
                {errors.current_mileage && (
                  <p className="text-sm text-destructive" role="alert">{errors.current_mileage.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  {...register('notes')}
                  placeholder="Additional notes about the vehicle..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Acquisition Tab */}
        <TabsContent value="acquisition">
          <Card>
            <CardHeader>
              <CardTitle>Acquisition Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="acquisition_date">
                    Acquisition Date <span className="text-destructive">*</span>
                  </Label>
                  <Input id="acquisition_date" type="date" {...register('acquisition_date')} />
                  {errors.acquisition_date && (
                    <p className="text-sm text-destructive">{errors.acquisition_date.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="acquisition_type">
                    Acquisition Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={watch('acquisition_type')}
                    onValueChange={(value) => setValue('acquisition_type', value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="purchase">Purchase</SelectItem>
                      <SelectItem value="lease">Lease</SelectItem>
                      <SelectItem value="donation">Donation</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.acquisition_type && (
                    <p className="text-sm text-destructive">{errors.acquisition_type.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchase_price">Purchase Price ($)</Label>
                  <Input
                    id="purchase_price"
                    type="number"
                    step="0.01"
                    {...register('purchase_price', { valueAsNumber: true })}
                    placeholder="45000.00"
                  />
                  {errors.purchase_price && (
                    <p className="text-sm text-destructive">{errors.purchase_price.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vendor_name">Vendor Name</Label>
                  <Input
                    id="vendor_name"
                    {...register('vendor_name')}
                    placeholder="Toyota Dealer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="warranty_expiry">Warranty Expiry</Label>
                  <Input id="warranty_expiry" type="date" {...register('warranty_expiry')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="current_book_value">Current Book Value ($)</Label>
                  <Input
                    id="current_book_value"
                    type="number"
                    step="0.01"
                    {...register('current_book_value', { valueAsNumber: true })}
                    placeholder="40000.00"
                  />
                  {errors.current_book_value && (
                    <p className="text-sm text-destructive">{errors.current_book_value.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="depreciation_rate">Depreciation Rate (%/year)</Label>
                <Input
                  id="depreciation_rate"
                  type="number"
                  step="0.1"
                  {...register('depreciation_rate', { valueAsNumber: true })}
                  placeholder="10.0"
                />
                {errors.depreciation_rate && (
                  <p className="text-sm text-destructive">{errors.depreciation_rate.message}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insurance & Registration Tab */}
        <TabsContent value="insurance">
          <Card>
            <CardHeader>
              <CardTitle>Insurance & Registration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="insurance_provider">Insurance Provider</Label>
                  <Input
                    id="insurance_provider"
                    {...register('insurance_provider')}
                    placeholder="Insurance Company"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="insurance_policy_number">Policy Number</Label>
                  <Input
                    id="insurance_policy_number"
                    {...register('insurance_policy_number')}
                    placeholder="POL-123456"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="insurance_expiry">Insurance Expiry</Label>
                  <Input id="insurance_expiry" type="date" {...register('insurance_expiry')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registration_expiry">Registration Expiry</Label>
                  <Input
                    id="registration_expiry"
                    type="date"
                    {...register('registration_expiry')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* Documents Tab — only for existing vehicles */}
        {vehicle && (
          <TabsContent value="documents">
            <VehicleDocumentsTab
              vehicleId={vehicle.id}
              documents={Array.isArray(vehicle.documents) ? vehicle.documents : []}
            />
          </TabsContent>
        )}

        {/* Photos Tab — only for existing vehicles */}
        {vehicle && (
          <TabsContent value="photos">
            <VehiclePhotosTab
              vehicleId={vehicle.id}
              photos={Array.isArray(vehicle.photos) ? vehicle.photos : []}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Form Actions */}
      <div className="flex justify-end gap-2 mt-6">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {vehicle ? 'Updating...' : 'Creating...'}
            </>
          ) : (
            <>{vehicle ? 'Update Vehicle' : 'Create Vehicle'}</>
          )}
        </Button>
      </div>
    </form>
  );
}

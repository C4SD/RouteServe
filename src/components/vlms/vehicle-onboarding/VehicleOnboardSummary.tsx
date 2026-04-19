/**
 * VLMS Vehicle Onboarding - Summary Component
 * Step 5: Review and submit vehicle onboarding data
 */

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, CheckCircle, AlertCircle, Loader2, Package, Weight, Ruler, Satellite, FileText, Image as ImageIcon } from 'lucide-react';
import { useVehicleOnboardState } from '@/hooks/useVehicleOnboardState';
import { useVehiclesStore } from '@/stores/vlms/vehiclesStore';
import { useOnboardingFilesStore } from '@/stores/vlms/onboardingFilesStore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { formatVolume, formatWeight, formatDimensions } from '@/lib/vlms/capacityCalculations';

export function VehicleOnboardSummary() {
  const navigate = useNavigate();

  const selectedCategory = useVehicleOnboardState((state) => state.selectedCategory);
  const selectedType = useVehicleOnboardState((state) => state.selectedType);
  const customTypeName = useVehicleOnboardState((state) => state.customTypeName);
  const capacityConfig = useVehicleOnboardState((state) => state.capacityConfig);
  const registrationData = useVehicleOnboardState((state) => state.registrationData);
  const getFormData = useVehicleOnboardState((state) => state.getFormData);
  const isLoading = useVehicleOnboardState((state) => state.isLoading);
  const setLoading = useVehicleOnboardState((state) => state.setLoading);
  const goToPreviousStep = useVehicleOnboardState((state) => state.goToPreviousStep);
  const reset = useVehicleOnboardState((state) => state.reset);

  const createVehicle = useVehiclesStore((state) => state.createVehicle);
  const uploadDocument = useVehiclesStore((state) => state.uploadDocument);
  const uploadPhoto = useVehiclesStore((state) => state.uploadPhoto);
  const { stagedDocuments, stagedPhotos, reset: resetFiles } = useOnboardingFilesStore();

  const handleSubmit = async () => {
    const formData = getFormData();

    if (!formData) {
      toast.error('Please complete all required fields');
      return;
    }

    setLoading(true);

    try {
      // Create the vehicle
      const newVehicle = await createVehicle(formData as any);

      // Upload staged documents and photos
      const uploadPromises: Promise<void>[] = [];

      for (const doc of stagedDocuments) {
        uploadPromises.push(uploadDocument(newVehicle.id, doc.file, doc.type));
      }
      for (const photo of stagedPhotos) {
        uploadPromises.push(uploadPhoto(newVehicle.id, photo.file, photo.caption || undefined));
      }

      if (uploadPromises.length > 0) {
        await Promise.allSettled(uploadPromises);
      }

      toast.success(`Vehicle ${newVehicle.license_plate} onboarded successfully!`);

      // Reset wizard and files
      reset();
      resetFiles();

      // Navigate to vehicle detail page
      navigate(`/fleetops/vlms/vehicles/${newVehicle.id}`);
    } catch (error) {
      console.error('Error creating vehicle:', error);
      toast.error('Failed to create vehicle. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedCategory) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Missing required data. Please start the onboarding process again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Review & Submit</CardTitle>
        <CardDescription>
          Please review all details before creating the vehicle record.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Category & Type */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-success" />
            Category & Type
          </h3>

          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Category</span>
              <Badge variant={selectedCategory.source === 'eu' ? 'default' : 'secondary'}>
                {selectedCategory.display_name}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Type</span>
              <span className="font-medium">
                {selectedType ? selectedType.name : customTypeName || 'Not specified'}
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Capacity Configuration */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-success" />
            Capacity Configuration
          </h3>

          <div className="p-4 bg-muted rounded-lg space-y-3">
            <div className="grid grid-cols-2 gap-4">
              {capacityConfig.capacity_kg && (
                <div className="flex items-center gap-2">
                  <Weight className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Weight Capacity</div>
                    <div className="font-medium">{formatWeight(capacityConfig.capacity_kg)}</div>
                  </div>
                </div>
              )}

              {capacityConfig.capacity_m3 && (
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Volume Capacity</div>
                    <div className="font-medium">{formatVolume(capacityConfig.capacity_m3)}</div>
                  </div>
                </div>
              )}
            </div>

            {capacityConfig.dimensions && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <Ruler className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Dimensions</div>
                  <div className="font-medium">{formatDimensions(capacityConfig.dimensions)}</div>
                </div>
              </div>
            )}

            {capacityConfig.tiered_config.length > 0 && (
              <div className="pt-2 border-t">
                <div className="text-xs text-muted-foreground mb-2">Tier Configuration</div>
                <div className="space-y-1">
                  {capacityConfig.tiered_config.map((tier, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-sm bg-background px-2 py-1 rounded"
                    >
                      <span>
                        <Badge variant="outline" className="mr-2">
                          {tier.tier_order}
                        </Badge>
                        {tier.tier_name}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {tier.max_weight_kg && formatWeight(tier.max_weight_kg)}
                        {tier.max_weight_kg && tier.max_volume_m3 && ' / '}
                        {tier.max_volume_m3 && formatVolume(tier.max_volume_m3)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Vehicle Details */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-success" />
            Vehicle Details
          </h3>

          <div className="p-4 bg-muted rounded-lg">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Make & Model:</span>
              </div>
              <div className="font-medium">
                {registrationData.make} {registrationData.model}
              </div>

              <div>
                <span className="text-muted-foreground">Year:</span>
              </div>
              <div className="font-medium">{registrationData.year}</div>

              <div>
                <span className="text-muted-foreground">License Plate:</span>
              </div>
              <div className="font-medium">{registrationData.license_plate}</div>

              {registrationData.vin && (
                <>
                  <div>
                    <span className="text-muted-foreground">VIN:</span>
                  </div>
                  <div className="font-medium font-mono text-xs">{registrationData.vin}</div>
                </>
              )}

              {registrationData.color && (
                <>
                  <div>
                    <span className="text-muted-foreground">Color:</span>
                  </div>
                  <div className="font-medium">{registrationData.color}</div>
                </>
              )}

              {registrationData.fuel_type && (
                <>
                  <div>
                    <span className="text-muted-foreground">Fuel Type:</span>
                  </div>
                  <div className="font-medium capitalize">{registrationData.fuel_type}</div>
                </>
              )}

              {registrationData.transmission && (
                <>
                  <div>
                    <span className="text-muted-foreground">Transmission:</span>
                  </div>
                  <div className="font-medium capitalize">{registrationData.transmission}</div>
                </>
              )}

              <div>
                <span className="text-muted-foreground">Status:</span>
              </div>
              <div>
                <Badge>{registrationData.status}</Badge>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Acquisition & Insurance */}
        <div className="space-y-3">
          <h3 className="font-semibold">Acquisition & Insurance</h3>

          <div className="p-4 bg-muted rounded-lg">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Acquisition Date:</span>
              </div>
              <div className="font-medium">{registrationData.acquisition_date}</div>

              <div>
                <span className="text-muted-foreground">Acquisition Type:</span>
              </div>
              <div className="font-medium capitalize">{registrationData.acquisition_type}</div>

              {registrationData.purchase_price && (
                <>
                  <div>
                    <span className="text-muted-foreground">Purchase Price:</span>
                  </div>
                  <div className="font-medium">${registrationData.purchase_price.toLocaleString()}</div>
                </>
              )}

              {registrationData.insurance_provider && (
                <>
                  <div>
                    <span className="text-muted-foreground">Insurance Provider:</span>
                  </div>
                  <div className="font-medium">{registrationData.insurance_provider}</div>
                </>
              )}

              {registrationData.insurance_expiry && (
                <>
                  <div>
                    <span className="text-muted-foreground">Insurance Expiry:</span>
                  </div>
                  <div className="font-medium">{registrationData.insurance_expiry}</div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Telemetry Configuration */}
        {(registrationData.telematics_provider || registrationData.telematics_id) && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Satellite className="h-4 w-4 text-success" />
                Telemetry Configuration
              </h3>
              <div className="p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {registrationData.telematics_provider && (
                    <>
                      <div><span className="text-muted-foreground">Provider:</span></div>
                      <div className="font-medium capitalize">{registrationData.telematics_provider.replace('_', ' ')}</div>
                    </>
                  )}
                  {registrationData.telematics_id && (
                    <>
                      <div><span className="text-muted-foreground">Device ID:</span></div>
                      <div className="font-medium font-mono text-xs">{registrationData.telematics_id}</div>
                    </>
                  )}
                  {registrationData.tracker_sim_number && (
                    <>
                      <div><span className="text-muted-foreground">SIM Number:</span></div>
                      <div className="font-medium">{registrationData.tracker_sim_number}</div>
                    </>
                  )}
                  {registrationData.tracker_protocol && (
                    <>
                      <div><span className="text-muted-foreground">Protocol:</span></div>
                      <div className="font-medium uppercase">{registrationData.tracker_protocol}</div>
                    </>
                  )}
                  {registrationData.tracker_capabilities && registrationData.tracker_capabilities.length > 0 && (
                    <>
                      <div><span className="text-muted-foreground">Capabilities:</span></div>
                      <div className="flex flex-wrap gap-1">
                        {registrationData.tracker_capabilities.map((cap) => (
                          <Badge key={cap} variant="secondary" className="text-xs">
                            {cap.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Staged Documents & Photos */}
        {(stagedDocuments.length > 0 || stagedPhotos.length > 0) && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                Documents & Photos
              </h3>
              <div className="p-4 bg-muted rounded-lg space-y-2 text-sm">
                {stagedDocuments.length > 0 && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{stagedDocuments.length} document{stagedDocuments.length > 1 ? 's' : ''} to upload</span>
                  </div>
                )}
                {stagedPhotos.length > 0 && (
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <span>{stagedPhotos.length} photo{stagedPhotos.length > 1 ? 's' : ''} to upload</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {registrationData.notes && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="font-semibold">Notes</h3>
              <p className="text-sm text-muted-foreground">{registrationData.notes}</p>
            </div>
          </>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={goToPreviousStep} disabled={isLoading}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Button onClick={handleSubmit} disabled={isLoading} size="lg">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Vehicle...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Create Vehicle
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

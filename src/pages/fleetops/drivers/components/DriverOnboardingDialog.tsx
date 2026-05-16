/**
 * Driver Onboarding Dialog - Single Window Layout
 * Full-featured driver onboarding with profile picture upload
 * Uses RouteServe design system branding and vehicle configurator pattern
 */

import React, { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, User, AlertCircle, Loader2 } from 'lucide-react';
import { useDriverManagement, type DriverFormData } from '@/hooks/useDriverManagement';
import { useUploadDriverDocument } from '@/hooks/useDriverDocuments';
import { useStates } from '@/hooks/useAdminUnits';
import { toast } from 'sonner';

interface DriverOnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver?: any; // If provided, dialog is in edit mode
  mode?: 'create' | 'edit';
}

interface OnboardingFormData {
  // Basic Information
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
  email: string;

  // Employment Details
  employer: string;
  position: string;
  employmentType: string;
  startDate: string;
  shiftStart: string;
  shiftEnd: string;
  maxHours: string;
  groupName: string;
  preferredServices: string;
  federalId: string;

  // License & Credentials
  licenseType: 'standard' | 'commercial';
  licenseNumber: string;
  licenseExpiry: string;
  licenseState: string;

  // Address & Contact
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  country: string;
  postalCode: string;
  emergencyContactName: string;
  emergencyContactPhone: string;

  // Profile Photo
  profilePhoto: File | null;
  profilePhotoPreview: string | null;
}

const initialFormData: OnboardingFormData = {
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  phone: '',
  email: '',
  employer: 'RouteServe Logistics',
  position: 'Driver',
  employmentType: 'full-time',
  startDate: '',
  shiftStart: '08:00',
  shiftEnd: '17:00',
  maxHours: '8',
  groupName: '',
  preferredServices: '',
  federalId: '',
  licenseType: 'standard',
  licenseNumber: '',
  licenseExpiry: '',
  licenseState: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  stateProvince: '',
  country: 'Nigeria',
  postalCode: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  profilePhoto: null,
  profilePhotoPreview: null,
};

// Common countries
const COUNTRIES = [
  'Nigeria',
  'United States',
  'United Kingdom',
  'Canada',
  'Ghana',
  'Kenya',
  'South Africa',
];

export function DriverOnboardingDialog({ open, onOpenChange, driver, mode = 'create' }: DriverOnboardingDialogProps) {
  const [formData, setFormData] = useState<OnboardingFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createDriver, updateDriver } = useDriverManagement();
  const uploadDocument = useUploadDriverDocument();

  // Fetch states for Nigeria
  const { data: nigeriaStates } = useStates();

  // Populate form when driver prop changes (edit mode)
  React.useEffect(() => {
    if (driver && mode === 'edit') {
      const nameParts = driver.name?.split(' ') || [];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(-1)[0] || '';
      const middleName = nameParts.slice(1, -1).join(' ') || '';

      setFormData({
        firstName,
        middleName,
        lastName,
        dateOfBirth: driver.dateOfBirth || driver.date_of_birth || '',
        phone: driver.phone || '',
        email: driver.email || '',
        employer: driver.employer || 'RouteServe Logistics',
        position: driver.position || 'Driver',
        employmentType: driver.employmentType || driver.employment_type || 'full-time',
        startDate: driver.startDate || driver.start_date || '',
        shiftStart: driver.shiftStart || driver.shift_start || '08:00',
        shiftEnd: driver.shiftEnd || driver.shift_end || '17:00',
        maxHours: String(driver.maxHours || driver.max_hours || 8),
        groupName: driver.groupName || driver.group_name || '',
        preferredServices: driver.preferredServices || driver.preferred_services || '',
        federalId: driver.federalId || driver.federal_id || '',
        licenseType: driver.licenseType || driver.license_type || 'standard',
        licenseNumber: driver.licenseNumber || driver.license_number || '',
        licenseExpiry: driver.licenseExpiry || driver.license_expiry || '',
        licenseState: driver.licenseState || driver.license_state || '',
        addressLine1: driver.addressLine1 || driver.address_line1 || '',
        addressLine2: driver.addressLine2 || driver.address_line2 || '',
        city: driver.city || '',
        stateProvince: driver.stateProvince || driver.state_province || '',
        country: driver.country || 'Nigeria',
        postalCode: driver.postalCode || driver.postal_code || '',
        emergencyContactName: driver.emergencyContactName || driver.emergency_contact_name || '',
        emergencyContactPhone: driver.emergencyContactPhone || driver.emergency_contact_phone || '',
        profilePhoto: null,
        profilePhotoPreview: driver.profilePhotoUrl || driver.profile_photo_url || null,
      });
    } else if (mode === 'create') {
      setFormData(initialFormData);
    }
  }, [driver, mode, open]);

  const updateField = (field: keyof OnboardingFormData, value: any) => {
    setFormData((prev) => {
      // Clear state when country changes
      if (field === 'country' && value !== prev.country) {
        return { ...prev, [field]: value, stateProvince: '' };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({
        ...prev,
        profilePhoto: file,
        profilePhotoPreview: reader.result as string,
      }));
    };
    reader.readAsDataURL(file);
  };

  const validateForm = (): string | null => {
    if (!formData.firstName.trim()) return 'First name is required';
    if (!formData.lastName.trim()) return 'Last name is required';
    if (!formData.phone.trim()) return 'Phone number is required';
    if (!formData.dateOfBirth) return 'Date of birth is required';
    if (!formData.startDate) return 'Start date is required';
    if (!formData.licenseNumber.trim()) return 'License number is required';
    if (!formData.addressLine1.trim()) return 'Address is required';
    if (!formData.city.trim()) return 'City is required';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      toast.error('Validation Error', { description: validationError });
      return;
    }

    setIsSubmitting(true);
    try {
      // Prepare driver data
      const driverData: DriverFormData = {
        name: `${formData.firstName} ${formData.middleName} ${formData.lastName}`.replace(
          /\s+/g,
          ' '
        ),
        phone: formData.phone,
        email: formData.email || undefined,
        middle_name: formData.middleName || undefined,
        date_of_birth: formData.dateOfBirth || undefined,
        license_type: formData.licenseType,
        license_number: formData.licenseNumber || undefined,
        license_state: formData.licenseState || undefined,
        license_expiry: formData.licenseExpiry || undefined,
        employer: formData.employer || undefined,
        position: formData.position || undefined,
        employment_type: formData.employmentType || undefined,
        group_name: formData.groupName || undefined,
        start_date: formData.startDate || undefined,
        preferred_services: formData.preferredServices || undefined,
        federal_id: formData.federalId || undefined,
        shift_start: formData.shiftStart,
        shift_end: formData.shiftEnd,
        max_hours: parseInt(formData.maxHours),
        address_line1: formData.addressLine1 || undefined,
        address_line2: formData.addressLine2 || undefined,
        city: formData.city || undefined,
        state_province: formData.stateProvince || undefined,
        country: formData.country || undefined,
        postal_code: formData.postalCode || undefined,
        emergency_contact_name: formData.emergencyContactName || undefined,
        emergency_contact_phone: formData.emergencyContactPhone || undefined,
      };

      if (mode === 'edit' && driver?.id) {
        // Update existing driver
        updateDriver({
          id: driver.id,
          data: driverData
        });

        // Upload profile photo if provided
        if (formData.profilePhoto) {
          await uploadDocument.mutateAsync({
            driverId: driver.id,
            file: formData.profilePhoto,
            documentType: 'profile_photo',
          });
        }
      } else {
        // Create new driver
        const newDriver = await new Promise<any>((resolve, reject) => {
          createDriver.mutate(driverData, {
            onSuccess: (data) => resolve(data),
            onError: (error) => reject(error),
          });
        });

        // Upload profile photo if provided
        if (formData.profilePhoto && newDriver?.id) {
          await uploadDocument.mutateAsync({
            driverId: newDriver.id,
            file: formData.profilePhoto,
            documentType: 'profile_photo',
          });
        }
      }

      // Reset form and close dialog
      setFormData(initialFormData);
      onOpenChange(false);
    } catch (error) {
      console.error('Driver operation error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = () => {
    const first = formData.firstName[0] || '';
    const last = formData.lastName[0] || '';
    return `${first}${last}`.toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1400px] max-h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-xl font-semibold">
            {mode === 'edit' ? 'Edit Driver' : 'Add New Driver'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {mode === 'edit'
              ? 'Update driver information below'
              : 'Complete all required fields to onboard a new driver'}
          </DialogDescription>
        </DialogHeader>

        {/* Main Content - Two Column Layout */}
        <div className="h-[calc(90vh-140px)] grid lg:grid-cols-[1fr_500px] gap-0">
          {/* LEFT PANEL - Profile Photo Upload */}
          <div className="flex flex-col items-center justify-center p-12 border-r border-border bg-muted/10">
            <div className="space-y-6 text-center">
              {/* Profile Photo Preview */}
              <Avatar className="h-48 w-48 border-4 border-background shadow-lg mx-auto">
                {formData.profilePhotoPreview ? (
                  <AvatarImage src={formData.profilePhotoPreview} alt="Profile" />
                ) : (
                  <AvatarFallback className="bg-primary/10 text-primary text-5xl font-semibold">
                    {getInitials() || <User className="h-20 w-20" />}
                  </AvatarFallback>
                )}
              </Avatar>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Profile Photo</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload a clear photo for driver identification
                </p>
              </div>

              {/* Upload Button */}
              <div>
                <input
                  type="file"
                  id="profile-photo"
                  accept="image/*"
                  onChange={handleProfilePhotoChange}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => document.getElementById('profile-photo')?.click()}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {formData.profilePhoto ? 'Change Photo' : 'Upload Photo'}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  PNG, JPG up to 5MB
                </p>
              </div>

              {formData.profilePhoto && (
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{formData.profilePhoto.name}</p>
                  <p>{(formData.profilePhoto.size / 1024).toFixed(1)} KB</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL - Scrollable Form */}
          <div className="flex flex-col overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Personal Information Section */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 tracking-wider uppercase">
                  Personal Information
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <FormField
                      label="First Name"
                      required
                      value={formData.firstName}
                      onChange={(e) => updateField('firstName', e.target.value)}
                      placeholder="John"
                    />
                    <FormField
                      label="Middle Name"
                      value={formData.middleName}
                      onChange={(e) => updateField('middleName', e.target.value)}
                      placeholder="Michael"
                    />
                    <FormField
                      label="Last Name"
                      required
                      value={formData.lastName}
                      onChange={(e) => updateField('lastName', e.target.value)}
                      placeholder="Doe"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      label="Date of Birth"
                      type="date"
                      required
                      value={formData.dateOfBirth}
                      onChange={(e) => updateField('dateOfBirth', e.target.value)}
                    />
                    <FormField
                      label="Phone Number"
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      placeholder="+234 800 000 0000"
                    />
                  </div>
                  <FormField
                    label="Email Address"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="driver@example.com"
                  />
                </div>
              </div>

              <Separator />

              {/* Employment Details Section */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 tracking-wider uppercase">
                  Employment Details
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      label="Employer"
                      value={formData.employer}
                      onChange={(e) => updateField('employer', e.target.value)}
                    />
                    <FormField
                      label="Position"
                      value={formData.position}
                      onChange={(e) => updateField('position', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Employment Type</Label>
                      <Select
                        value={formData.employmentType}
                        onValueChange={(v) => updateField('employmentType', v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full-time">Full-time</SelectItem>
                          <SelectItem value="part-time">Part-time</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <FormField
                      label="Start Date"
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) => updateField('startDate', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <FormField
                      label="Shift Start"
                      type="time"
                      value={formData.shiftStart}
                      onChange={(e) => updateField('shiftStart', e.target.value)}
                    />
                    <FormField
                      label="Shift End"
                      type="time"
                      value={formData.shiftEnd}
                      onChange={(e) => updateField('shiftEnd', e.target.value)}
                    />
                    <FormField
                      label="Max Hours/Day"
                      type="number"
                      value={formData.maxHours}
                      onChange={(e) => updateField('maxHours', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      label="Group Name"
                      value={formData.groupName}
                      onChange={(e) => updateField('groupName', e.target.value)}
                      placeholder="Full Time"
                    />
                    <FormField
                      label="Preferred Services"
                      value={formData.preferredServices}
                      onChange={(e) => updateField('preferredServices', e.target.value)}
                      placeholder="Local Delivery"
                    />
                  </div>
                  <FormField
                    label="Federal ID Number"
                    value={formData.federalId}
                    onChange={(e) => updateField('federalId', e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              {/* License & Credentials Section */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 tracking-wider uppercase">
                  License & Credentials
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      License Type <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.licenseType}
                      onValueChange={(v: 'standard' | 'commercial') => updateField('licenseType', v)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="commercial">Commercial (CDL)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      label="License Number"
                      required
                      value={formData.licenseNumber}
                      onChange={(e) => updateField('licenseNumber', e.target.value)}
                    />
                    <FormField
                      label="License State"
                      value={formData.licenseState}
                      onChange={(e) => updateField('licenseState', e.target.value)}
                    />
                  </div>
                  <FormField
                    label="License Expiry Date"
                    type="date"
                    value={formData.licenseExpiry}
                    onChange={(e) => updateField('licenseExpiry', e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              {/* Address & Contact Section */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 tracking-wider uppercase">
                  Address & Contact
                </h3>
                <div className="space-y-4">
                  <FormField
                    label="Address Line 1"
                    required
                    value={formData.addressLine1}
                    onChange={(e) => updateField('addressLine1', e.target.value)}
                    placeholder="Street address"
                  />
                  <FormField
                    label="Address Line 2"
                    value={formData.addressLine2}
                    onChange={(e) => updateField('addressLine2', e.target.value)}
                    placeholder="Apartment, suite, etc."
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      label="City"
                      required
                      value={formData.city}
                      onChange={(e) => updateField('city', e.target.value)}
                    />
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Country</Label>
                      <Select value={formData.country} onValueChange={(v) => updateField('country', v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map((country) => (
                            <SelectItem key={country} value={country}>
                              {country}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Conditional State/Province field based on country */}
                    {formData.country === 'Nigeria' && nigeriaStates ? (
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">State</Label>
                        <Select
                          value={formData.stateProvince}
                          onValueChange={(v) => updateField('stateProvince', v)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent>
                            {nigeriaStates.map((state) => (
                              <SelectItem key={state.id} value={state.name}>
                                {state.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <FormField
                        label="State/Province"
                        value={formData.stateProvince}
                        onChange={(e) => updateField('stateProvince', e.target.value)}
                      />
                    )}
                    <FormField
                      label="Postal Code"
                      value={formData.postalCode}
                      onChange={(e) => updateField('postalCode', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Emergency Contact Section */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 tracking-wider uppercase">
                  Emergency Contact
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      label="Contact Name"
                      value={formData.emergencyContactName}
                      onChange={(e) => updateField('emergencyContactName', e.target.value)}
                      placeholder="Full name"
                    />
                    <FormField
                      label="Contact Phone"
                      type="tel"
                      value={formData.emergencyContactPhone}
                      onChange={(e) => updateField('emergencyContactPhone', e.target.value)}
                      placeholder="+234 800 000 0000"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer - Sticky at bottom */}
            <div className="mt-auto p-6 border-t border-border bg-background">
              {/* Validation Alert */}
              {(() => {
                const error = validateForm();
                if (error && formData.firstName) {
                  return (
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  );
                }
                return null;
              })()}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSubmitting
                    ? (mode === 'edit' ? 'Updating Driver...' : 'Adding Driver...')
                    : (mode === 'edit' ? 'Update Driver' : 'Add Driver')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper component for form fields
function FormField({
  label,
  required,
  ...props
}: {
  label: string;
  required?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input className="h-9" {...props} />
    </div>
  );
}

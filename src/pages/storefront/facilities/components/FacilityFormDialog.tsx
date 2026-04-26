import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Facility } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, X } from 'lucide-react';
import { useCreateFacility, useUpdateFacility } from '@/hooks/useFacilities';
import { useFacilityTypes } from '@/hooks/useFacilityTypes';
import { useLevelsOfCare } from '@/hooks/useLevelsOfCare';
import { useOperationalZones } from '@/hooks/useOperationalZones';
import { useStates, useLGAsByState, useFindAdminUnitByPoint } from '@/hooks/useAdminUnits';
import { facilityFormSchema, FacilityFormData } from '@/lib/facility-validation';
import { detectCoordinateIssues, CoordinateIssue } from '@/lib/geo-bounds';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { DEFAULT_COUNTRY_ID } from '@/lib/constants';
import { useFundingSources } from '@/hooks/useFundingSources';
import { useImplementingPartners } from '@/hooks/useImplementingPartners';
import { useProgrammeCategories } from '@/hooks/useProgrammeCategories';

interface FacilityFormDialogProps {
  facility?: Facility;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FacilityFormDialog({
  facility,
  open,
  onOpenChange,
}: FacilityFormDialogProps) {
  const isEdit = !!facility;
  const createMutation = useCreateFacility();
  const updateMutation = useUpdateFacility();

  // Fetch DB reference data for dropdowns
  const { data: facilityTypes = [], isLoading: loadingTypes } = useFacilityTypes();
  const { data: levelsOfCare = [], isLoading: loadingLevels } = useLevelsOfCare();
  const { data: zones = [], isLoading: loadingZones } = useOperationalZones();
  const { data: fundingSources = [] } = useFundingSources();
  const { data: implementingPartners = [] } = useImplementingPartners();
  const { data: programmeCategories = [] } = useProgrammeCategories();

  // New admin_units model - cascading State → LGA selection
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
  const { data: states = [], isLoading: loadingStates } = useStates();
  const { data: lgasByState = [], isLoading: loadingLGAsByState } = useLGAsByState(selectedStateId);

  // Initialize form BEFORE using it
  const form = useForm<FacilityFormData>({
    resolver: zodResolver(facilityFormSchema),
    defaultValues: {
      name: '',
      address: '',
      lat: 0,
      lng: 0,
      state: 'kano',
      pcr_service: false,
      cd4_service: false,
      ip_names: [],
      funding_sources: [],
      programmes: [],
    },
  });

  // Get lat/lng from form for reverse geocoding
  const formLat = form.watch('lat');
  const formLng = form.watch('lng');

  // Real-time coordinate geo-validation
  const formState = form.watch('state');
  const coordinateIssues = useMemo<CoordinateIssue[]>(() => {
    if (!formLat || !formLng || isNaN(formLat) || isNaN(formLng)) return [];
    return detectCoordinateIssues(formLat, formLng, formState);
  }, [formLat, formLng, formState]);

  // Reverse geocoding: Auto-fill LGA based on lat/lng
  const { data: adminUnitByPoint } = useFindAdminUnitByPoint(
    formLat || null,
    formLng || null,
    6, // LGA level
    DEFAULT_COUNTRY_ID
  );

  // Auto-fill LGA when reverse geocoding finds a match
  useEffect(() => {
    if (adminUnitByPoint && !isEdit) {
      form.setValue('lga', adminUnitByPoint.name);
      // Also set the state if available from parent
      if (adminUnitByPoint.parent_id) {
        setSelectedStateId(adminUnitByPoint.parent_id);
      }
    }
  }, [adminUnitByPoint, isEdit, form]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset();
      setSelectedStateId(null);
    }
  }, [open, form]);

  // Populate form when editing a facility
  useEffect(() => {
    if (facility && open) {
      form.reset({
        name: facility.name,
        address: facility.address,
        lat: facility.lat,
        lng: facility.lng,
        type: facility.type,
        phone: facility.phone,
        contactPerson: facility.contactPerson,
        capacity: facility.capacity,
        operatingHours: facility.operatingHours,
        warehouse_code: facility.warehouse_code,
        state: facility.state,
        ip_name: facility.ip_name,
        funding_source: facility.funding_source,
        programme: facility.programme,
        ip_names: facility.ip_names ?? [],
        funding_sources: facility.funding_sources ?? [],
        programmes: facility.programmes ?? [],
        pcr_service: facility.pcr_service,
        cd4_service: facility.cd4_service,
        type_of_service: facility.type_of_service,
        service_zone: facility.service_zone,
        level_of_care: facility.level_of_care,
        lga: facility.lga,
        ward: facility.ward,
        contact_name_pharmacy: facility.contact_name_pharmacy,
        designation: facility.designation,
        phone_pharmacy: facility.phone_pharmacy,
        email: facility.email,
        storage_capacity: facility.storage_capacity,
      });
    }
  }, [facility, open, form]);

  // Pre-select state for cascading LGA dropdown when editing
  useEffect(() => {
    if (facility && open && facility.state && states.length > 0) {
      const matchingState = states.find(
        (s) => s.name.toLowerCase() === facility.state?.toLowerCase()
      );
      if (matchingState) {
        setSelectedStateId(matchingState.id);
      }
    }
  }, [facility, open, states]);

  const onSubmit = async (data: FacilityFormData) => {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          id: facility.id,
          updates: data as Partial<Facility>,
        });
      } else {
        await createMutation.mutateAsync(data as Partial<Facility>);
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Facility' : 'Add New Facility'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update facility information' : 'Enter the details for the new facility'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Accordion type="multiple" defaultValue={['basic', 'location']} className="w-full">
              {/* Basic Information */}
              <AccordionItem value="basic">
                <AccordionTrigger>Basic Information</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Facility Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Health Clinic Chula" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="warehouse_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Warehouse Code</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="PSM/KAN/01/001 (auto-generated if empty)"
                            className="font-mono"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Leave empty to auto-generate
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field}) => (
                        <FormItem>
                          <FormLabel>Facility Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={loadingTypes}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={loadingTypes ? "Loading..." : "Select type"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {facilityTypes.filter((type) => type.name).map((type) => (
                                <SelectItem key={type.id} value={type.name}>
                                  {type.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="level_of_care"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Level of Care</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={loadingLevels}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={loadingLevels ? "Loading..." : "Select level"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {levelsOfCare.filter((level) => level.name).map((level) => (
                                <SelectItem key={level.id} value={level.name}>
                                  {level.name}
                                  {level.description && (
                                    <span className="text-xs text-muted-foreground ml-2">
                                      ({level.description.substring(0, 30)}...)
                                    </span>
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Location */}
              <AccordionItem value="location">
                <AccordionTrigger>Location</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address *</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Chula Near Secondary School" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    {/* State Dropdown (NEW - Cascading Selection) */}
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <Select
                        value={selectedStateId || undefined}
                        onValueChange={(value) => {
                          setSelectedStateId(value);
                          // Set the state name on the form field
                          const stateName = states.find((s) => s.id === value)?.name;
                          if (stateName) form.setValue('state', stateName);
                          // Clear LGA when state changes
                          form.setValue('lga', '');
                        }}
                        disabled={loadingStates}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={loadingStates ? "Loading..." : "Select State"} />
                        </SelectTrigger>
                        <SelectContent>
                          {states.filter((state) => state.id).map((state) => (
                            <SelectItem key={state.id} value={state.id}>
                              {state.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {adminUnitByPoint && "Auto-detected from coordinates"}
                      </p>
                    </FormItem>

                    {/* LGA Dropdown (UPDATED - Cascading from State) */}
                    <FormField
                      control={form.control}
                      name="lga"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>LGA *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={!selectedStateId || loadingLGAsByState}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={
                                  !selectedStateId
                                    ? "Select State first"
                                    : loadingLGAsByState
                                      ? "Loading..."
                                      : "Select LGA"
                                } />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {lgasByState.filter((lga) => lga.name).map((lga) => (
                                <SelectItem key={lga.id} value={lga.name}>
                                  {lga.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                          {adminUnitByPoint && (
                            <p className="text-xs text-success">
                              Auto-filled from coordinates
                            </p>
                          )}
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ward"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ward</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Chula" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="service_zone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service Zone</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={loadingZones}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={loadingZones ? "Loading..." : "Select zone"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {zones.filter((zone) => zone.name).map((zone) => (
                                <SelectItem key={zone.id} value={zone.name}>
                                  {zone.name}
                                  {zone.code && (
                                    <span className="text-xs text-muted-foreground ml-2">
                                      ({zone.code})
                                    </span>
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="lat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Latitude *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="any"
                              placeholder="8.97058"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lng"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Longitude *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="any"
                              placeholder="8.97058"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Coordinate geo-validation warnings */}
                  {coordinateIssues.length > 0 && (
                    <div className="space-y-2">
                      {coordinateIssues.map((issue, i) => (
                        <div
                          key={i}
                          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                            issue.type === 'outside_nigeria' || issue.type === 'likely_swapped'
                              ? 'border-destructive/40 bg-destructive/10 text-destructive'
                              : 'border-yellow-400/40 bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                          }`}
                        >
                          <span className="mt-0.5 shrink-0">
                            {issue.type === 'outside_state' ? '⚠' : '✕'}
                          </span>
                          <div className="flex-1">
                            <p>{issue.message}</p>
                            {issue.suggestion && (
                              <p className="mt-0.5 opacity-80">{issue.suggestion}</p>
                            )}
                            {issue.type === 'likely_swapped' && formLat && formLng && (
                              <button
                                type="button"
                                className="mt-1 underline text-xs font-medium"
                                onClick={() => {
                                  form.setValue('lat', formLng);
                                  form.setValue('lng', formLat);
                                }}
                              >
                                Swap lat/lng
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* Program Information */}
              <AccordionItem value="program">
                <AccordionTrigger>Program Information</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* IP Name — multi-select */}
                    <FormField
                      control={form.control}
                      name="ip_names"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IP Name</FormLabel>
                          <MultiSelect
                            options={implementingPartners.filter((ip) => ip.code).map((ip) => ({ value: ip.code, label: ip.name }))}
                            selected={field.value ?? []}
                            onChange={field.onChange}
                            placeholder="Select IPs"
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Funding Source — multi-select */}
                    <FormField
                      control={form.control}
                      name="funding_sources"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Funding Source</FormLabel>
                          <MultiSelect
                            options={fundingSources.filter((fs) => fs.code).map((fs) => ({ value: fs.code, label: fs.name }))}
                            selected={field.value ?? []}
                            onChange={field.onChange}
                            placeholder="Select funding sources"
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Programme — multi-select */}
                    <FormField
                      control={form.control}
                      name="programmes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Programme</FormLabel>
                          <MultiSelect
                            options={programmeCategories.filter((pc) => pc.name).map((pc) => ({ value: pc.name, label: pc.name }))}
                            selected={field.value ?? []}
                            onChange={field.onChange}
                            placeholder="Select programmes"
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="type_of_service"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type of Service</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="ART, Malaria Management, PMTCT"
                              {...field}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormDescription>Comma-separated</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex gap-6">
                    <FormField
                      control={form.control}
                      name="pcr_service"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">
                            PCR Service Available
                          </FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cd4_service"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">
                            CD4 Service Available
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Contact Information */}
              <AccordionItem value="contact">
                <AccordionTrigger>Contact Information</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="contact_name_pharmacy"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Person (Pharmacy)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Nafisa Mohd Ishaq"
                              {...field}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="designation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Designation</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., In-Charge"
                              {...field}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone_pharmacy"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number (Pharmacy)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="08139111131"
                              {...field}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="facility@example.com"
                              {...field}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Capacity */}
              <AccordionItem value="capacity">
                <AccordionTrigger>Capacity</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="storage_capacity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Storage Capacity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="1000"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="capacity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>General Capacity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="500"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving...'
                  : isEdit
                  ? 'Update Facility'
                  : 'Create Facility'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MultiSelect — popover with checkboxes for selecting multiple values
// ─────────────────────────────────────────────────────────────────────────────

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

function MultiSelect({ options, selected, onChange, placeholder = 'Select...' }: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const remove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((v) => v !== value));
  };

  const labelFor = (value: string) =>
    options.find((o) => o.value === value)?.label ?? value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {selected.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            selected.map((v) => (
              <Badge key={v} variant="secondary" className="gap-1 pr-1">
                {labelFor(v)}
                <X className="h-3 w-3 cursor-pointer" onClick={(e) => remove(v, e)} />
              </Badge>
            ))
          )}
          <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        {options.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-1">No options available</p>
        ) : (
          options.map((opt) => (
            <div
              key={opt.value}
              className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer"
              onClick={() => toggle(opt.value)}
            >
              <Checkbox
                checked={selected.includes(opt.value)}
                onCheckedChange={() => toggle(opt.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-sm">{opt.label}</span>
            </div>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}

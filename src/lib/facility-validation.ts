import { z } from 'zod';

// =====================================================
// Enum Schemas — DB-driven
// =====================================================
// These fields are now populated from lookup tables
// (facility_types, implementing_partners, funding_sources,
// programme_categories, levels_of_care, zones).
// Validation accepts any string; actual values are
// constrained by the dropdown options fetched from the DB.

export const facilityTypeSchema = z.string();
export const ipNameSchema = z.string();
export const fundingSourceSchema = z.string();
export const programmeSchema = z.string();
export const levelOfCareSchema = z.string();
export const serviceZoneSchema = z.string();

// =====================================================
// Warehouse Code Validation
// =====================================================

export const warehouseCodeRegex = /^PSM\/[A-Z]{3}\/\d{2}\/\d{3}$/;

export const warehouseCodeSchema = z
  .string()
  .regex(warehouseCodeRegex, 'Warehouse code must follow format: PSM/KAN/##/###')
  .optional();

// =====================================================
// Facility Form Schema
// =====================================================

export const facilityFormSchema = z.object({
  // Basic Info (required)
  name: z.string().min(3, 'Name must be at least 3 characters'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  lat: z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  lng: z.number().min(-180).max(180, 'Longitude must be between -180 and 180'),

  // Basic Info (optional legacy fields)
  type: facilityTypeSchema.optional(),
  phone: z.string().optional(),
  contactPerson: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  operatingHours: z.string().optional(),

  // New 19 Data Points
  warehouse_code: warehouseCodeSchema,
  state: z.string().min(1, 'State is required').default('kano'),
  ip_name: ipNameSchema.optional(), // legacy — kept for compat
  funding_source: fundingSourceSchema.optional(), // legacy
  programme: programmeSchema.optional(), // legacy
  ip_names: z.array(z.string()).optional().default([]),
  funding_sources: z.array(z.string()).optional().default([]),
  programmes: z.array(z.string()).optional().default([]),
  pcr_service: z.boolean().default(false),
  cd4_service: z.boolean().default(false),
  type_of_service: z.string().optional(),
  service_zone: serviceZoneSchema.optional(),
  level_of_care: levelOfCareSchema.optional(),
  lga: z.string().optional(),
  ward: z.string().optional(),
  contact_name_pharmacy: z.string().optional(),
  designation: z.string().optional(),
  phone_pharmacy: z.string().optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  storage_capacity: z.number().int().positive().optional(),
});

export type FacilityFormData = z.infer<typeof facilityFormSchema>;

// =====================================================
// Facility Service Schema
// =====================================================

export const serviceNameSchema = z.enum([
  'Medical Services',
  'Surgical Services',
  'Pediatrics Services',
  'Ambulance Services',
  'Special Clinical Services',
  'Obstetrics & Gynecology Services',
  'Dental Services',
  'Onsite Laboratory',
  'Mortuary Services',
  'Onsite Imaging',
  'Onsite Pharmacy',
]);

export const facilityServiceSchema = z.object({
  service_name: serviceNameSchema,
  availability: z.boolean().default(false),
  notes: z.string().optional(),
});

export type FacilityServiceFormData = z.infer<typeof facilityServiceSchema>;

// =====================================================
// Facility Stock Schema
// =====================================================

export const facilityStockSchema = z.object({
  product_name: z.string().min(1, 'Product name is required'),
  quantity: z.number().int().min(0, 'Quantity cannot be negative'),
  unit: z.string().optional(),
});

export type FacilityStockFormData = z.infer<typeof facilityStockSchema>;

// =====================================================
// CSV Import Schema
// =====================================================

export const csvFacilitySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  latitude: z.string().refine((val) => !isNaN(parseFloat(val)) && Math.abs(parseFloat(val)) <= 90, {
    message: 'Invalid latitude',
  }),
  longitude: z.string().refine((val) => !isNaN(parseFloat(val)) && Math.abs(parseFloat(val)) <= 180, {
    message: 'Invalid longitude',
  }),

  // Optional fields
  type: z.string().optional(),
  phone: z.string().optional(),
  contactPerson: z.string().optional(),
  capacity: z.string().optional(),
  operatingHours: z.string().optional(),

  // New fields
  warehouse_code: z.string().optional(),
  state: z.string().optional(),
  ip_name: z.string().optional(),
  funding_source: z.string().optional(),
  programme: z.string().optional(),
  pcr_service: z.string().optional(), // "Yes"/"No" in CSV
  cd4_service: z.string().optional(), // "Yes"/"No" in CSV
  type_of_service: z.string().optional(),
  service_zone: z.string().optional(),
  level_of_care: z.string().optional(),
  lga: z.string().optional(),
  ward: z.string().optional(),
  contact_name_pharmacy: z.string().optional(),
  designation: z.string().optional(),
  phone_pharmacy: z.string().optional(),
  email: z.string().optional(),
  storage_capacity: z.string().optional(),
});

export type CSVFacilityData = z.infer<typeof csvFacilitySchema>;

// =====================================================
// Filter Schema
// =====================================================

export const facilityFilterSchema = z.object({
  search: z.string().optional(),
  state: z.string().optional(),
  ip_name: z.string().optional(), // filters on ip_names array (contains)
  funding_source: z.string().optional(), // filters on funding_sources array
  programme: z.string().optional(), // filters on programmes array
  zone_id: z.string().optional(),
  service_zone: z.string().optional(),
  level_of_care: z.string().optional(),
  lga: z.string().optional(),
  type: facilityTypeSchema.optional(),
  pcr_service: z.boolean().optional(),
  cd4_service: z.boolean().optional(),
  // New map-specific filters
  ward: z.string().optional(),
  warehouseCodeSearch: z.string().optional(),
  storageCapacityMin: z.number().optional(),
  storageCapacityMax: z.number().optional(),
  capacityMin: z.number().optional(),
  capacityMax: z.number().optional(),
});

export type FacilityFilters = z.infer<typeof facilityFilterSchema>;

// =====================================================
// Utility Functions
// =====================================================

/**
 * Validates warehouse code format
 */
export function validateWarehouseCode(code: string): boolean {
  return warehouseCodeRegex.test(code);
}

/**
 * Converts CSV boolean strings to boolean
 */
export function parseCsvBoolean(value?: string): boolean {
  if (!value) return false;
  const lower = value.toLowerCase().trim();
  return lower === 'yes' || lower === 'true' || lower === '1';
}

/**
 * Converts CSV number strings to number
 */
export function parseCsvNumber(value?: string): number | undefined {
  if (!value || value.trim() === '') return undefined;
  const num = parseFloat(value);
  return isNaN(num) ? undefined : num;
}

/**
 * Transforms CSV data to facility form data
 */
export function transformCsvToFacility(csv: CSVFacilityData): Partial<FacilityFormData> {
  return {
    name: csv.name,
    address: csv.address,
    lat: parseFloat(csv.latitude),
    lng: parseFloat(csv.longitude),
    type: csv.type,
    phone: csv.phone,
    contactPerson: csv.contactPerson,
    capacity: parseCsvNumber(csv.capacity),
    operatingHours: csv.operatingHours,
    warehouse_code: csv.warehouse_code,
    state: csv.state || 'kano',
    ip_name: csv.ip_name,
    funding_source: csv.funding_source,
    programme: csv.programme,
    pcr_service: parseCsvBoolean(csv.pcr_service),
    cd4_service: parseCsvBoolean(csv.cd4_service),
    type_of_service: csv.type_of_service,
    service_zone: csv.service_zone,
    level_of_care: csv.level_of_care,
    lga: csv.lga,
    ward: csv.ward,
    contact_name_pharmacy: csv.contact_name_pharmacy,
    designation: csv.designation,
    phone_pharmacy: csv.phone_pharmacy,
    email: csv.email,
    storage_capacity: parseCsvNumber(csv.storage_capacity),
  };
}

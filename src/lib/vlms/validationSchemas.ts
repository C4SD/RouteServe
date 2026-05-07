/**
 * VLMS Validation Schemas using Zod
 * Comprehensive validation for all VLMS form data
 */

import { z } from 'zod';

// =====================================================
// Enum Schemas
// =====================================================

export const vehicleStatusSchema = z.enum([
  'available',
  'in_use',
  'maintenance',
  'out_of_service',
  'disposed',
]);

export const vehicleTypeSchema = z.enum([
  'sedan',
  'suv',
  'truck',
  'van',
  'motorcycle',
  'bus',
  'other',
]);

export const fuelTypeSchema = z.enum([
  'gasoline',
  'diesel',
  'electric',
  'hybrid',
  'cng',
  'lpg',
]);

export const transmissionTypeSchema = z.enum([
  'automatic',
  'manual',
  'cvt',
  'dct',
]);

export const acquisitionTypeSchema = z.enum([
  'purchase',
  'lease',
  'donation',
  'transfer',
]);

export const maintenanceStatusSchema = z.enum([
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
]);

export const maintenanceTypeSchema = z.enum([
  'routine',
  'repair',
  'inspection',
  'emergency',
  'recall',
]);

export const maintenancePrioritySchema = z.enum([
  'low',
  'normal',
  'high',
  'critical',
]);

export const assignmentTypeSchema = z.enum([
  'permanent',
  'temporary',
  'pool',
  'project',
]);

export const assignmentStatusSchema = z.enum([
  'active',
  'completed',
  'cancelled',
  'overdue',
]);

export const incidentTypeSchema = z.enum([
  'accident',
  'theft',
  'vandalism',
  'breakdown',
  'damage',
]);

export const incidentSeveritySchema = z.enum([
  'minor',
  'moderate',
  'major',
  'total_loss',
]);

export const incidentStatusSchema = z.enum([
  'reported',
  'investigating',
  'resolved',
  'closed',
]);

export const inspectionTypeSchema = z.enum([
  'routine',
  'annual',
  'pre_trip',
  'post_trip',
  'safety',
  'compliance',
]);

export const inspectionStatusSchema = z.enum([
  'pass',
  'fail',
  'conditional',
]);

export const paymentMethodSchema = z.enum([
  'cash',
  'card',
  'fuel_card',
  'account',
  'mobile_money',
]);

// =====================================================
// JSON Field Schemas
// =====================================================

export const documentFileSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  type: z.string(),
  uploaded_at: z.string(),
  size: z.number().optional(),
});

export const photoFileSchema = z.object({
  url: z.string().url(),
  caption: z.string().optional(),
  uploaded_at: z.string(),
  thumbnail_url: z.string().url().optional(),
});

export const partReplacedSchema = z.object({
  part_name: z.string().min(1, 'Part name is required'),
  part_number: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be positive'),
  cost: z.number().nonnegative('Cost cannot be negative'),
  supplier: z.string().optional(),
});

export const invoiceFileSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  amount: z.number().nonnegative(),
  uploaded_at: z.string(),
});

export const witnessStatementSchema = z.object({
  name: z.string().min(1, 'Witness name is required'),
  contact: z.string(),
  statement: z.string().min(1, 'Statement is required'),
  recorded_at: z.string(),
});

export const inspectionChecklistItemSchema = z.object({
  item: z.string().min(1, 'Item name is required'),
  category: z.string(),
  status: z.enum(['pass', 'fail', 'na']),
  notes: z.string().optional(),
});

export const inspectionCategorySchema = z.object({
  status: z.enum(['pass', 'fail', 'conditional']),
  notes: z.string().optional(),
  issues: z.array(z.string()).optional(),
});

// =====================================================
// Vehicle Form Schema
// =====================================================

export const vehicleFormSchema = z.object({
  // Basic Info (required)
  make: z.string().min(1, 'Make is required').max(100),
  model: z.string().min(1, 'Model is required').max(100),
  year: z
    .number()
    .int()
    .min(1900, 'Year must be 1900 or later')
    .max(new Date().getFullYear() + 1, 'Year cannot be in the future'),
  vin: z
    .string()
    .length(17, 'VIN must be exactly 17 characters')
    .optional()
    .or(z.literal('')),
  license_plate: z.string().min(1, 'License plate is required').max(20),

  // Classification
  vehicle_type: vehicleTypeSchema,
  fuel_type: fuelTypeSchema,
  transmission: transmissionTypeSchema.optional(),

  // Specifications
  engine_capacity: z
    .number()
    .positive('Engine capacity must be positive')
    .optional(),
  color: z.string().max(50).optional(),
  seating_capacity: z
    .number()
    .int()
    .positive('Seating capacity must be positive')
    .optional(),
  cargo_capacity: z
    .number()
    .positive('Cargo capacity must be positive')
    .optional(),

  // Acquisition
  acquisition_date: z.string().min(1, 'Acquisition date is required'),
  acquisition_type: acquisitionTypeSchema,
  purchase_price: z
    .number()
    .positive('Purchase price must be positive')
    .optional(),
  vendor_name: z.string().max(255).optional(),
  warranty_expiry: z.string().optional(),

  // Current Status
  status: vehicleStatusSchema.default('available'),
  current_location_id: z.string().uuid().optional().or(z.literal('')).transform(v => v || undefined),
  current_driver_id: z.string().uuid().optional().or(z.literal('')).transform(v => v || undefined),

  // Operational Metrics
  current_mileage: z
    .number()
    .nonnegative('Mileage cannot be negative')
    .default(0),

  // Insurance & Registration
  insurance_provider: z.string().max(255).optional(),
  insurance_policy_number: z.string().max(100).optional(),
  insurance_expiry: z.string().optional(),
  registration_expiry: z.string().optional(),

  // Financial
  depreciation_rate: z
    .number()
    .min(0, 'Depreciation rate cannot be negative')
    .max(100, 'Depreciation rate cannot exceed 100%')
    .optional(),
  current_book_value: z
    .number()
    .nonnegative('Book value cannot be negative')
    .optional(),

  // Capacity & Payload
  capacity_kg: z.number().positive('Must be positive').optional(),
  capacity_m3: z.number().positive('Must be positive').optional(),
  gross_vehicle_weight_kg: z.number().positive('Must be positive').optional(),

  // Cargo Hold Dimensions (cm)
  length_cm: z.number().int().positive('Must be positive').optional(),
  width_cm: z.number().int().positive('Must be positive').optional(),
  height_cm: z.number().int().positive('Must be positive').optional(),

  // Metadata
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type VehicleFormData = z.infer<typeof vehicleFormSchema>;

// =====================================================
// Maintenance Form Schema
// =====================================================

export const maintenanceFormSchema = z.object({
  vehicle_id: z.string().uuid('Valid vehicle is required'),
  scheduled_date: z.string().optional(),
  actual_date: z.string().optional(),
  status: maintenanceStatusSchema.default('scheduled'),
  maintenance_type: maintenanceTypeSchema,
  category: z.string().max(100).optional(),
  priority: maintenancePrioritySchema.default('normal'),

  // Service Details
  service_provider: z.string().max(255).optional(),
  service_location: z.string().max(255).optional(),
  technician_name: z.string().max(255).optional(),
  work_order_number: z.string().max(100).optional(),

  // Metrics
  mileage_at_service: z
    .number()
    .nonnegative('Mileage cannot be negative')
    .optional(),
  labor_hours: z.number().nonnegative('Labor hours cannot be negative').optional(),

  // Costs
  labor_cost: z.number().nonnegative('Labor cost cannot be negative').default(0),
  parts_cost: z.number().nonnegative('Parts cost cannot be negative').default(0),

  // Details
  description: z.string().min(1, 'Description is required'),
  parts_replaced: z.array(partReplacedSchema).optional(),
  issues_found: z.string().optional(),
  recommendations: z.string().optional(),

  // Follow-up
  next_service_date: z.string().optional(),
  next_service_mileage: z.number().nonnegative().optional(),
});

export type MaintenanceFormData = z.infer<typeof maintenanceFormSchema>;

// =====================================================
// Fuel Log Form Schema
// =====================================================

export const fuelLogFormSchema = z.object({
  vehicle_id: z.string().uuid('Valid vehicle is required'),
  transaction_date: z.string().min(1, 'Transaction date is required'),
  transaction_number: z.string().max(100).optional(),

  // Location
  station_name: z.string().max(255).optional(),
  station_location: z.string().max(255).optional(),
  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90')
    .optional(),
  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
    .optional(),

  // Fuel Details
  fuel_type: fuelTypeSchema,
  quantity: z.number().positive('Quantity must be positive'),
  unit_price: z.number().positive('Unit price must be positive'),

  // Vehicle State
  odometer_reading: z.number().nonnegative('Odometer reading cannot be negative'),
  trip_distance: z.number().nonnegative('Trip distance cannot be negative').optional(),

  // Payment
  payment_method: paymentMethodSchema.optional(),
  fuel_card_number: z.string().max(50).optional(),
  receipt_number: z.string().max(100).optional(),

  // Personnel
  driver_id: z.string().uuid().optional(),
  driver_name: z.string().max(255).optional(),

  // Metadata
  notes: z.string().optional(),
});

export type FuelLogFormData = z.infer<typeof fuelLogFormSchema>;

// =====================================================
// Assignment Form Schema
// =====================================================

export const assignmentFormSchema = z
  .object({
    vehicle_id: z.string().uuid('Valid vehicle is required'),
    assigned_to_id: z.string().uuid().optional(),
    assigned_location_id: z.string().uuid().optional(),
    assignment_type: assignmentTypeSchema,

    // Dates
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string().optional(),

    // Purpose
    purpose: z.string().min(1, 'Purpose is required'),
    project_name: z.string().max(255).optional(),
    authorization_number: z.string().max(100).optional(),
    authorized_by_id: z.string().uuid().optional(),

    // Handover Details
    odometer_start: z.number().nonnegative('Odometer reading cannot be negative').optional(),
    fuel_level_start: z
      .number()
      .min(0, 'Fuel level must be between 0 and 100')
      .max(100, 'Fuel level must be between 0 and 100')
      .optional(),
    condition_start: z.string().optional(),

    // Metadata
    notes: z.string().optional(),
  })
  .refine(
    (data) => {
      // Must assign to either a person or a location
      return data.assigned_to_id || data.assigned_location_id;
    },
    {
      message: 'Must assign to either a driver or a location',
      path: ['assigned_to_id'],
    }
  );

export type AssignmentFormData = z.infer<typeof assignmentFormSchema>;

// =====================================================
// Incident Form Schema
// =====================================================

export const incidentFormSchema = z.object({
  vehicle_id: z.string().uuid('Valid vehicle is required'),

  // When & Where
  incident_date: z.string().min(1, 'Incident date is required'),
  location: z.string().min(1, 'Location is required').max(255),
  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90')
    .optional(),
  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
    .optional(),

  // Classification
  incident_type: incidentTypeSchema,
  severity: incidentSeveritySchema,

  // People Involved
  driver_id: z.string().uuid().optional(),
  driver_name: z.string().min(1, 'Driver name is required').max(255),
  passengers: z.string().optional(),
  other_parties: z.string().optional(),

  // Vehicle State
  odometer_reading: z.number().nonnegative('Odometer reading cannot be negative').optional(),

  // Description
  description: z.string().min(1, 'Description is required'),
  cause: z.string().optional(),
  damages_description: z.string().optional(),

  // Official Reports
  police_report_number: z.string().max(100).optional(),
  police_station: z.string().max(255).optional(),

  // Financial Impact
  estimated_repair_cost: z.number().nonnegative('Cost cannot be negative').optional(),
});

export type IncidentFormData = z.infer<typeof incidentFormSchema>;

// =====================================================
// Inspection Form Schema
// =====================================================

export const inspectionFormSchema = z.object({
  vehicle_id: z.string().uuid('Valid vehicle is required'),

  // Scheduling
  inspection_date: z.string().min(1, 'Inspection date is required'),
  inspection_type: inspectionTypeSchema,

  // Inspector
  inspector_id: z.string().uuid().optional(),
  inspector_name: z.string().min(1, 'Inspector name is required').max(255),
  inspector_certification: z.string().max(100).optional(),

  // Vehicle State
  odometer_reading: z.number().nonnegative('Odometer reading cannot be negative').optional(),

  // Inspection Results
  overall_status: inspectionStatusSchema,
  checklist: z
    .array(inspectionChecklistItemSchema)
    .min(1, 'At least one checklist item is required'),

  // Categories
  exterior_condition: inspectionCategorySchema.optional(),
  interior_condition: inspectionCategorySchema.optional(),
  engine_mechanical: inspectionCategorySchema.optional(),
  electrical_system: inspectionCategorySchema.optional(),
  brakes: inspectionCategorySchema.optional(),
  tires: inspectionCategorySchema.optional(),
  lights_signals: inspectionCategorySchema.optional(),
  safety_equipment: inspectionCategorySchema.optional(),
  fluid_levels: inspectionCategorySchema.optional(),

  // Follow-up
  recommendations: z.string().optional(),
  next_inspection_date: z.string().optional(),

  // Compliance
  meets_safety_standards: z.boolean(),
  roadworthy: z.boolean(),

  // Metadata
  notes: z.string().optional(),
});

export type InspectionFormData = z.infer<typeof inspectionFormSchema>;

// =====================================================
// Filter Schemas
// =====================================================

export const vehicleFiltersSchema = z.object({
  search: z.string().optional(),
  status: vehicleStatusSchema.optional(),
  vehicle_type: vehicleTypeSchema.optional(),
  fuel_type: fuelTypeSchema.optional(),
  current_location_id: z.string().uuid().optional(),
  current_driver_id: z.string().uuid().optional(),
  make: z.string().optional(),
  year_from: z.number().int().optional(),
  year_to: z.number().int().optional(),
  acquisition_type: acquisitionTypeSchema.optional(),
  tags: z.array(z.string()).optional(),
});

export const maintenanceFiltersSchema = z.object({
  search: z.string().optional(),
  vehicle_id: z.string().uuid().optional(),
  status: maintenanceStatusSchema.optional(),
  maintenance_type: maintenanceTypeSchema.optional(),
  priority: maintenancePrioritySchema.optional(),
  scheduled_date_from: z.string().optional(),
  scheduled_date_to: z.string().optional(),
  service_provider: z.string().optional(),
});

export const fuelLogFiltersSchema = z.object({
  vehicle_id: z.string().uuid().optional(),
  driver_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  fuel_type: fuelTypeSchema.optional(),
  station_name: z.string().optional(),
  payment_method: paymentMethodSchema.optional(),
});

export const assignmentFiltersSchema = z.object({
  search: z.string().optional(),
  vehicle_id: z.string().uuid().optional(),
  assigned_to_id: z.string().uuid().optional(),
  assigned_location_id: z.string().uuid().optional(),
  assignment_type: assignmentTypeSchema.optional(),
  status: assignmentStatusSchema.optional(),
  start_date_from: z.string().optional(),
  start_date_to: z.string().optional(),
});

export const incidentFiltersSchema = z.object({
  search: z.string().optional(),
  vehicle_id: z.string().uuid().optional(),
  driver_id: z.string().uuid().optional(),
  incident_type: incidentTypeSchema.optional(),
  severity: incidentSeveritySchema.optional(),
  status: incidentStatusSchema.optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

export const inspectionFiltersSchema = z.object({
  search: z.string().optional(),
  vehicle_id: z.string().uuid().optional(),
  inspector_id: z.string().uuid().optional(),
  inspection_type: inspectionTypeSchema.optional(),
  overall_status: inspectionStatusSchema.optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  roadworthy: z.boolean().optional(),
});

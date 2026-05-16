/**
 * VLMS Vehicle Onboarding - Type Definitions
 * Types for vehicle taxonomy, onboarding wizard, and capacity configuration
 */

// =====================================================
// DATABASE TYPES (from Supabase schema)
// =====================================================

export type CategorySource = 'eu' | 'biko';

export interface VehicleCategory {
  id: string;
  code: string;
  name: string;
  display_name: string;
  source: CategorySource;
  default_tier_config: TierConfig[];
  description?: string;
  icon_name?: string;
  created_at: string;
  updated_at: string;
}

export interface VehicleType {
  id: string;
  category_id: string | null;
  code: string | null;
  name: string;
  description?: string;
  default_capacity_kg?: number;
  default_capacity_m3?: number;
  default_tier_config: TierConfig[];
  icon_name?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface VehicleTypeWithCategory extends VehicleType {
  category?: VehicleCategory;
}

export interface VehicleTier {
  id: string;
  vehicle_id: string;
  tier_name: string;
  tier_order: number;
  max_weight_kg?: number;
  max_volume_m3?: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// TIER CONFIGURATION TYPES
// =====================================================

export interface TierConfig {
  tier_name: string;
  tier_order: number;
  max_weight_kg?: number;
  max_volume_m3?: number;
  weight_pct?: number; // Percentage of total capacity (for defaults)
  volume_pct?: number; // Percentage of total volume (for defaults)
  slot_count?: number; // Number of cargo slots (1-12)
}

export interface TierValidationResult {
  is_valid: boolean;
  total_weight_kg: number;
  validation_message: string;
}

// =====================================================
// CAPACITY CONFIGURATION TYPES
// =====================================================

export interface DimensionalConfig {
  length_cm: number;
  width_cm: number;
  height_cm: number;
  calculated_volume_m3: number;
}

export interface CapacityConfig {
  capacity_kg?: number;
  capacity_m3?: number;
  /** Overall vehicle body dimensions */
  vehicle_dimensions?: DimensionalConfig;
  /** Cargo hold / usable cargo area dimensions */
  dimensions?: DimensionalConfig;
  tiered_config: TierConfig[];
  use_dimensions: boolean; // Toggle between manual capacity vs. calculated from dimensions
}

// =====================================================
// ONBOARDING WIZARD TYPES
// =====================================================

export type OnboardingStep =
  | 'category'
  | 'type'
  | 'capacity'
  | 'registration'
  | 'review';

export interface OnboardingStepConfig {
  id: OnboardingStep;
  title: string;
  description: string;
  icon: string; // Lucide icon name
}

export interface OnboardingState {
  // Current step
  currentStep: OnboardingStep;

  // Step 1: Category selection
  selectedCategory: VehicleCategory | null;

  // Step 2: Type selection
  selectedType: VehicleType | null;
  customTypeName: string;

  // Step 3: Capacity configuration
  capacityConfig: CapacityConfig;

  // Step 4: Registration details
  registrationData: VehicleRegistrationData;

  // Metadata
  isLoading: boolean;
  errors: Record<string, string>;
}

export interface VehicleRegistrationData {
  // Basic identification
  make: string;
  model: string;
  year: number;
  license_plate: string;
  vin?: string;
  color?: string;

  // Fleet assignment
  fleet_id?: string;
  vendor_id?: string;
  current_location_id?: string;

  // Acquisition
  acquisition_date: string;
  acquisition_type: 'purchase' | 'lease' | 'donation' | 'transfer';
  purchase_price?: number;
  vendor_name?: string;

  // Insurance & Registration
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_expiry?: string;
  registration_expiry?: string;

  // Specs
  fuel_type?: 'gasoline' | 'diesel' | 'electric' | 'hybrid' | 'cng' | 'lpg';
  transmission?: 'automatic' | 'manual' | 'cvt' | 'dct';
  engine_capacity?: number;
  seating_capacity?: number;

  // Status
  status: 'available' | 'in_use' | 'maintenance' | 'out_of_service';
  current_mileage?: number;

  // Telemetry / Tracker Configuration
  telematics_provider?: string;
  telematics_id?: string;
  tracker_sim_number?: string;
  tracker_protocol?: 'gprs' | '3g' | '4g' | 'satellite' | 'bluetooth';
  tracker_capabilities?: ('gps' | 'fuel_level' | 'speed' | 'temperature' | 'door_sensor' | 'engine_status')[];

  // Metadata
  notes?: string;
  tags?: string[];
}

// =====================================================
// ONBOARDING FORM DATA (complete vehicle payload)
// =====================================================

export interface VehicleOnboardingFormData extends VehicleRegistrationData {
  // Taxonomy
  category_id: string;
  vehicle_type_id?: string; // Optional if custom type

  // Capacity
  capacity_kg?: number;
  capacity_m3?: number;
  // Overall vehicle body dimensions
  vehicle_length_cm?: number;
  vehicle_width_cm?: number;
  vehicle_height_cm?: number;
  // Cargo hold dimensions
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  tiered_config: TierConfig[];
}

// =====================================================
// API PAYLOADS
// =====================================================

export interface CreateVehicleTypePayload {
  category_id: string;
  name: string;
  description?: string;
  default_capacity_kg?: number;
  default_capacity_m3?: number;
  default_tier_config?: TierConfig[];
}

export interface CreateVehiclePayload {
  // Taxonomy
  category_id: string;
  vehicle_type_id?: string;

  // Basic info
  make: string;
  model: string;
  year: number;
  license_plate: string;
  vin?: string;

  // Classification
  vehicle_type?: string; // Old field for backward compatibility
  fuel_type?: string;
  transmission?: string;

  // Capacity
  capacity_kg?: number;
  capacity_m3?: number;
  cargo_capacity?: number; // Old field for backward compatibility
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  tiered_config?: TierConfig[];

  // Fleet assignment
  fleet_id?: string;
  vendor_id?: string;
  current_location_id?: string;

  // Acquisition
  acquisition_date: string;
  acquisition_type: string;
  purchase_price?: number;
  vendor_name?: string;

  // Insurance
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_expiry?: string;
  registration_expiry?: string;

  // Specs
  engine_capacity?: number;
  color?: string;
  seating_capacity?: number;

  // Telemetry
  telematics_provider?: string;
  telematics_id?: string;
  tracker_sim_number?: string;
  tracker_protocol?: string;
  tracker_capabilities?: string[];

  // Status
  status: string;
  current_mileage?: number;

  // Metadata
  notes?: string;
  tags?: string[];
}

// =====================================================
// UI COMPONENT PROPS
// =====================================================

export interface CategorySelectorProps {
  selectedCategory: VehicleCategory | null;
  onSelectCategory: (category: VehicleCategory) => void;
  onNext: () => void;
}

export interface TypeSelectorProps {
  category: VehicleCategory;
  selectedType: VehicleType | null;
  customTypeName: string;
  onSelectType: (type: VehicleType) => void;
  onCustomTypeChange: (name: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export interface CapacityConfiguratorProps {
  capacityConfig: CapacityConfig;
  vehicleType: VehicleType | null;
  onConfigChange: (config: CapacityConfig) => void;
  onBack: () => void;
  onNext: () => void;
}

export interface RegistrationFormProps {
  data: VehicleRegistrationData;
  onChange: (data: VehicleRegistrationData) => void;
  onBack: () => void;
  onNext: () => void;
}

export interface OnboardingSummaryProps {
  category: VehicleCategory;
  vehicleType: VehicleType | null;
  customTypeName: string;
  capacityConfig: CapacityConfig;
  registrationData: VehicleRegistrationData;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

// =====================================================
// HELPER TYPE GUARDS
// =====================================================

export function isEUCategory(category: VehicleCategory): boolean {
  return category.source === 'eu';
}

export function isRouteServeCategory(category: VehicleCategory): boolean {
  return category.source === 'biko';
}

export function hasTiers(config: TierConfig[]): boolean {
  return Array.isArray(config) && config.length > 0;
}

export function hasMultipleTiers(config: TierConfig[]): boolean {
  return Array.isArray(config) && config.length > 1;
}

// =====================================================
// CONSTANTS
// =====================================================

export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  {
    id: 'category',
    title: 'Select Vehicle Category',
    description: 'Choose the vehicle classification (EU or RouteServe)',
    icon: 'LayoutGrid',
  },
  {
    id: 'type',
    title: 'Select Vehicle Type',
    description: 'Choose a specific vehicle model or create custom',
    icon: 'Truck',
  },
  {
    id: 'capacity',
    title: 'Configure Capacity',
    description: 'Set cargo dimensions and tier configuration',
    icon: 'Package',
  },
  {
    id: 'registration',
    title: 'Registration Details',
    description: 'Enter vehicle identification and insurance info',
    icon: 'FileText',
  },
  {
    id: 'review',
    title: 'Review & Submit',
    description: 'Review all details before creating the vehicle',
    icon: 'CheckCircle',
  },
];

export const DEFAULT_TIER_CONFIG: TierConfig[] = [
  { tier_name: 'Lower', tier_order: 1, weight_pct: 30, volume_pct: 30 },
  { tier_name: 'Middle', tier_order: 2, weight_pct: 40, volume_pct: 40 },
  { tier_name: 'Upper', tier_order: 3, weight_pct: 30, volume_pct: 30 },
];

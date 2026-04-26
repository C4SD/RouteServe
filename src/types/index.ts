// Facility Types — now DB-driven via lookup tables.
// These type aliases are kept as `string` for backward compatibility.
// Actual values come from: facility_types, implementing_partners,
// funding_sources, programme_categories, levels_of_care, zones tables.
export type FacilityType = string;
export type IPName = string;
export type FundingSource = string;
export type Programme = string;
export type LevelOfCare = string;
export type ServiceZone = string;

export interface Facility {
  id: string;
  // Basic Info (legacy fields)
  name: string;
  address: string;
  lat: number;
  lng: number;
  type?: FacilityType;
  phone?: string;
  contactPerson?: string;
  capacity?: number;
  operatingHours?: string;

  // New Data Points (19 total)
  warehouse_code: string; // Format: PSM/KAN/##/### (1)
  state: string; // Default: 'kano' (2)
  ip_name?: IPName; // (3) legacy single value — kept for backward compat
  funding_source?: FundingSource; // (4) legacy single value
  programme?: Programme; // (5) legacy single value
  ip_names?: string[]; // (3) multiple implementing partners
  funding_sources?: string[]; // (4) multiple funding sources
  programmes?: string[]; // (5) multiple programme categories
  pcr_service: boolean; // (6)
  cd4_service: boolean; // (7)
  type_of_service?: string; // (8) - can be multiple, comma-separated
  service_zone?: ServiceZone; // (10)
  level_of_care?: LevelOfCare; // (11)
  lga?: string; // (12)
  ward?: string; // (13)
  // address is (14)
  contact_name_pharmacy?: string; // (15)
  designation?: string; // (16)
  phone_pharmacy?: string; // (17)
  email?: string; // (18)
  // lat/lng are (19)
  storage_capacity?: number; // Additional field
  zone_id?: string; // Operational zone assignment
  workspace_id?: string; // Workspace isolation

  // Metadata
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export interface FacilityService {
  id: string;
  facility_id: string;
  service_name: string;
  availability: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FacilityDelivery {
  id: string;
  facility_id: string;
  batch_id?: string;
  delivery_date: string;
  items_delivered: number;
  driver_id?: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'failed';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FacilityStock {
  id: string;
  facility_id: string;
  product_id?: string;
  product_name: string;
  quantity: number;
  unit?: string;
  last_updated: string;
  updated_by?: string;
  created_at?: string;
}

export interface FacilityAuditLog {
  id: string;
  facility_id?: string;
  user_id?: string;
  action: 'created' | 'updated' | 'deleted' | 'restored';
  changes?: Record<string, any>;
  timestamp: string;
}

export interface Warehouse {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: 'central' | 'zonal';
  capacity: number;
  operatingHours: string;
}

export interface Delivery {
  id: string;
  facilityId: string;
  facilityName: string;
  warehouseId: string;
  warehouseName: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  driver?: string;
  medicationType: string;
  quantity: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
  estimatedDuration: number; // in minutes
  distance?: number; // in kilometers
  createdAt: string;
}

export interface Driver {
  id: string;
  // Basic Information
  name: string;
  phone: string;
  email?: string;
  middleName?: string;
  dateOfBirth?: string;

  // License & Credentials
  licenseType: 'standard' | 'commercial';
  licenseNumber?: string;
  licenseState?: string;
  licenseExpiry?: string;
  licenseVerified?: boolean;

  // Employment Details
  employer?: string;
  position?: string;
  employmentType?: string;
  groupName?: string;
  startDate?: string;
  preferredServices?: string;
  federalId?: string;

  // Shift & Hours
  shiftStart: string;
  shiftEnd: string;
  maxHours: number;

  // Address & Contact
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  country?: string;
  postalCode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;

  // Profile & Documents
  profilePhotoUrl?: string;
  documentsComplete?: boolean;

  // Status & Performance
  status: 'available' | 'busy' | 'offline';
  currentLocation?: {
    lat: number;
    lng: number;
  };
  performanceScore?: number;
  totalDeliveries?: number;
  onTimePercentage?: number;
  onboardingCompleted?: boolean;
  locationUpdatedAt?: string;
}

export interface DriverVehicleHistory {
  vehicleId: string;
  plateNumber: string;
  model: string;
  type: string;
  photoUrl?: string;
  thumbnailUrl?: string;
  aiGenerated?: boolean;
  capacity: number;
  fuelType: string;
  avgSpeed: number;
  isCurrent: boolean;
  assignedAt: string;
  totalTrips: number;
}

export interface Route {
  id: string;
  driverId: string;
  packageCount: number;
  address: string;
  destination: string;
  distance: number;
  timeLeft: number;
  weight: number;
  volume: number;
  date: string;
  status: 'on_the_way' | 'loading' | 'unloading' | 'waiting' | 'completed';
  mapPoints: { lat: number; lng: number }[];
}

export interface TimeCategory {
  onTheWay: number;
  unloading: number;
  loading: number;
  waiting: number;
}

export interface WorkingTimeData {
  date: string;
  workingTime: number;
  averageTime: number;
}

export interface DriverStatistics {
  timeCategories: TimeCategory;
  workingTimeData: WorkingTimeData[];
  totalDistance: number;
  totalDeliveries: number;
  averageRating: number;
}

export interface Vehicle {
  id: string;
  type: string; // Now supports custom types
  model: string;
  plateNumber: string;
  capacity: number; // in cubic meters
  maxWeight: number; // in kg
  fuelType: 'diesel' | 'petrol' | 'electric';
  avgSpeed: number; // km/h average speed
  status: 'available' | 'in-use' | 'maintenance';
  currentDriverId?: string;
  fuelEfficiency: number; // km per liter
  photo_url?: string;
  thumbnail_url?: string;
  photo_uploaded_at?: string;
  ai_generated?: boolean;
}

export interface DeliveryBatch {
  id: string;
  name: string;
  facilities: Facility[];
  warehouseId: string;
  warehouseName: string;
  driverId?: string;
  vehicleId?: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'planned' | 'assigned' | 'in-progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  totalDistance: number;
  estimatedDuration: number; // in minutes
  actualStartTime?: string;
  actualEndTime?: string;
  // NOTE: medicationType and totalQuantity are now optional per RFC-012
  // These values are derived from requisitions, not set at batch creation
  medicationType?: string;
  totalQuantity?: number;
  optimizedRoute: [number, number][]; // lat, lng coordinates
  notes?: string;
  createdAt: string;
  // Batch integrity indicator
  hasIntegrity?: boolean;
}

export interface RouteOptimization {
  warehouseId: string;
  facilities: Facility[];
  totalDistance: number;
  estimatedDuration: number;
  optimizedRoute: [number, number][];
  vehicleType?: 'truck' | 'van' | 'pickup' | 'car';
  driverId?: string;
  vehicleId?: string;
}

export interface CSVFacility {
  // Legacy fields
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  type?: string;
  phone?: string;
  contactPerson?: string;
  capacity?: string;
  operatingHours?: string;

  // New 19 data point fields
  warehouse_code?: string;
  state?: string;
  ip_name?: string;
  funding_source?: string;
  programme?: string;
  pcr_service?: string; // "Yes" or "No" in CSV
  cd4_service?: string; // "Yes" or "No" in CSV
  type_of_service?: string;
  service_zone?: string;
  level_of_care?: string;
  lga?: string;
  ward?: string;
  contact_name_pharmacy?: string;
  designation?: string;
  phone_pharmacy?: string;
  email?: string;
  storage_capacity?: string;
}

// Auth & IAM Types

export interface Profile {
  id: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

// Stock Analytics Types
export interface StockStatus {
  total_products: number;
  total_facilities_with_stock: number;
  total_stock_items: number;
  low_stock_count: number;
  out_of_stock_count: number;
}

export interface StockBalance {
  product_name: string;
  total_quantity: number;
  allocated_quantity: number;
  available_quantity: number;
  facilities_count: number;
}

export interface StockPerformance {
  product_name: string;
  turnover_rate: number;
  avg_days_supply: number | null;
  total_delivered: number;
  current_stock: number;
}

export interface StockByZone {
  zone: string;
  total_products: number;
  total_quantity: number;
  facilities_count: number;
  low_stock_facilities: number;
}

export interface LowStockAlert {
  facility_id: string;
  facility_name: string;
  zone: string;
  product_name: string;
  current_quantity: number;
  days_supply_remaining: number | null;
  last_delivery_date: string | null;
}

// Resource Utilization Analytics Types
export interface VehiclePayloadUtilization {
  vehicle_id: string;
  plate_number: string;
  vehicle_type: string;
  vehicle_capacity_kg: number;
  max_weight_kg: number;
  total_deliveries: number;
  total_items_delivered: number;
  total_weight_kg: number | null;
  avg_payload_utilization_pct: number;
  avg_weight_utilization_pct: number | null;
  max_payload_utilization_pct: number;
  max_weight_utilization_pct: number | null;
  underutilized_deliveries: number;
}

export interface ProgramPerformance {
  programme: string;
  total_deliveries: number;
  total_facilities_served: number;
  total_items_delivered: number;
  avg_items_per_delivery: number;
  on_time_deliveries: number;
  on_time_rate_pct: number;
  total_distance_km: number;
  avg_distance_per_delivery_km: number;
}

export interface DriverUtilization {
  driver_id: string;
  driver_name: string;
  total_deliveries: number;
  avg_deliveries_per_week: number;
  total_items_delivered: number;
  total_distance_km: number;
  avg_items_per_delivery: number;
  utilization_status: 'High' | 'Medium' | 'Low' | 'Underutilized';
}

export interface RouteEfficiency {
  batch_id: string;
  batch_name: string;
  vehicle_plate: string;
  estimated_distance_km: number;
  actual_distance_km: number;
  distance_variance_pct: number;
  estimated_duration_min: number;
  actual_duration_min: number;
  duration_variance_pct: number;
  efficiency_rating: 'Excellent' | 'Good' | 'Fair' | 'Poor';
}

export interface FacilityCoverage {
  total_facilities: number;
  facilities_served: number;
  facilities_not_served: number;
  coverage_pct: number;
  programme: string | null;
  program_total_facilities: number | null;
  program_facilities_served: number | null;
  program_coverage_pct: number | null;
  unserved_facility_names: string[];
}

export interface CostByProgram {
  programme: string;
  total_deliveries: number;
  total_fuel_cost: number;
  total_maintenance_cost: number;
  total_cost: number;
  cost_per_delivery: number;
  cost_per_item: number;
  cost_per_km: number;
}
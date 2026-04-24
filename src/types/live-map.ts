/**
 * Live Map Type Definitions
 * Hybrid data model combining driver_events (state) + driver_gps_events (position)
 */

// Driver status from the state machine (driver_events.driver_status)
export type DriverStatus =
  | 'INACTIVE'
  | 'ACTIVE'
  | 'EN_ROUTE'
  | 'AT_STOP'
  | 'DELAYED'
  | 'COMPLETED'
  | 'SUSPENDED';

// Event types from the state machine (driver_events.event_type)
export type EventType =
  | 'ROUTE_STARTED'
  | 'ARRIVED_AT_STOP'
  | 'DEPARTED_STOP'
  | 'PROOF_CAPTURED'
  | 'DELAY_REPORTED'
  | 'ROUTE_COMPLETED'
  | 'ROUTE_CANCELLED'
  | 'SUPERVISOR_OVERRIDE';

// Entity types for selection
export type EntityType = 'driver' | 'vehicle' | 'delivery' | 'facility' | 'warehouse';

// Live driver data (hybrid: GPS position + state machine status)
export interface LiveDriver {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  status: DriverStatus;
  position: [number, number]; // [lng, lat] from driver_gps_events
  batchId: string | null;
  vehicleId: string | null;
  sessionId: string | null;
  lastUpdate: Date;
  speed: number; // m/s from GPS
  heading: number; // degrees
  accuracy: number; // meters
  batteryLevel?: number;
  isOnline: boolean;
}

// Live vehicle data
export interface LiveVehicle {
  id: string;
  plate: string;
  type: string;
  make?: string;
  model?: string;
  position: [number, number];
  capacity: number;
  utilization: number; // percentage
  driverId: string | null;
  driverName?: string;
  batchId: string | null;
  lastUpdate: Date;
  speed: number;
  heading: number;
  fuelLevel?: number;
  isActive: boolean;
}

// Live delivery batch data
export interface LiveDelivery {
  id: string;
  batchId: string;
  name: string;
  driverId: string | null;
  driverName?: string;
  vehicleId: string | null;
  status: string;
  driverStatus: DriverStatus;
  currentStopIndex: number;
  totalStops: number;
  completedStops: number;
  route: [number, number][];
  facilities: LiveFacility[];
  warehouseId?: string;
  startTime: Date | null;
  endTime: Date | null;
  estimatedEndTime?: Date;
  progress: number; // percentage
}

// Facility in a delivery route
export interface LiveFacility {
  id: string;
  name: string;
  position: [number, number];
  address?: string;
  stopIndex: number;
  status: 'pending' | 'arrived' | 'completed' | 'skipped';
  arrivalTime?: Date;
  departureTime?: Date;
  proofCaptured: boolean;
}

// GPS event from driver_gps_events table
export interface GPSEvent {
  id: string;
  driverId: string;
  sessionId: string | null;
  deviceId: string;
  lat: number;
  lng: number;
  altitude?: number;
  accuracy: number;
  heading?: number;
  speed?: number;
  capturedAt: Date;
  receivedAt: Date;
  batchId?: string;
  tripId?: string;
  batteryLevel?: number;
  networkType?: string;
  isBackground?: boolean;
}

// Driver event from driver_events table (state transitions)
export interface DriverEvent {
  id: string;
  driverId: string;
  batchId: string;
  sessionId: string | null;
  eventType: EventType;
  driverStatus: DriverStatus;
  location: [number, number] | null;
  metadata: Record<string, unknown>;
  recordedAt: Date;
  syncedAt: Date;
  flaggedForReview: boolean;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
}

// Playback event for historical replay
export interface PlaybackEvent {
  id: string;
  timestamp: Date;
  eventType: EventType;
  driverStatus: DriverStatus;
  location: [number, number];
  driverId: string;
  driverName?: string;
  batchId: string;
  facilityId?: string;
  facilityName?: string;
  metadata: Record<string, unknown>;
}

// Stop analytics for playback mode
export interface StopAnalytics {
  facilityId: string;
  facilityName: string;
  stopIndex: number;
  arrivalTime: Date;
  departureTime: Date | null;
  duration: number; // seconds
  proofCaptured: boolean;
  delayed: boolean;
  delayDuration?: number; // seconds
}

// Trip analytics summary
export interface TripAnalytics {
  batchId: string;
  driverId: string;
  vehicleId?: string;
  startTime: Date;
  endTime: Date | null;
  totalDuration: number; // seconds
  movingTime: number; // seconds
  idleTime: number; // seconds
  totalDistance: number; // meters
  stopsCount: number;
  completedStops: number;
  avgStopDuration: number; // seconds
  maxStopDuration: number; // seconds
  delays: number;
  stops: StopAnalytics[];
}

// Filter state for the live map
export interface LiveMapFilters {
  showDrivers: boolean;
  showVehicles: boolean;
  showDeliveries: boolean;
  showRoutes: boolean;
  showFacilities: boolean;
  showWarehouses: boolean;
  showZones: boolean;
  statusFilter: DriverStatus | 'all';
  vehicleTypeFilter: string | 'all';
  priorityFilter: string | 'all';
  searchQuery: string;
}

// Selected entity state
export interface SelectedEntity {
  id: string;
  type: EntityType;
}

// Map view state
export interface MapViewState {
  center: [number, number];
  zoom: number;
  bounds?: [[number, number], [number, number]];
}

// GeoJSON feature for map layers
export interface MapFeature<T = Record<string, unknown>> {
  type: 'Feature';
  geometry: {
    type: 'Point' | 'LineString' | 'Polygon';
    coordinates: number[] | number[][] | number[][][];
  };
  properties: T;
}

// GeoJSON feature collection
export interface MapFeatureCollection<T = Record<string, unknown>> {
  type: 'FeatureCollection';
  features: MapFeature<T>[];
}

// Driver marker properties
export interface DriverMarkerProperties {
  id: string;
  name: string;
  status: DriverStatus;
  heading: number;
  isOnline: boolean;
  batchId: string | null;
}

// Vehicle marker properties
export interface VehicleMarkerProperties {
  id: string;
  plate: string;
  type: string;
  utilization: number;
  isActive: boolean;
  driverId: string | null;
}

// Delivery marker properties
export interface DeliveryMarkerProperties {
  id: string;
  name: string;
  status: DriverStatus;
  progress: number;
  stopsCount: number;
  currentStopIndex: number;
}

// Route line properties
export interface RouteLineProperties {
  id: string;
  batchId: string;
  driverId: string | null;
  progress: number;
  status: DriverStatus;
}

// ============================================================================
// PLAYBACK ENGINE TYPES - Production-grade time-synchronized playback
// ============================================================================

// Normalized trip data structure for playback engine
export interface NormalizedTrip {
  id: string;
  batchId: string;
  startTime: number; // Unix timestamp (ms)
  endTime: number; // Unix timestamp (ms)
  gps: IndexedPosition[];
  events: IndexedEvent[];
  stops: EnhancedStop[];
  plannedRoute: Polyline | null;
  analytics: TripAnalytics;

  // Precomputed for O(1) lookups during playback
  cumulativeDistances: number[]; // Cumulative distance at each GPS point
  eventStartMap: Map<number, IndexedEvent[]>; // Events starting at timestamp
  eventEndMap: Map<number, IndexedEvent[]>; // Events ending at timestamp
}

// Time-indexed GPS position (sorted by timestamp)
export interface IndexedPosition {
  timestamp: number; // Unix timestamp (ms)
  lat: number;
  lng: number;
  heading: number; // degrees (0-360)
  speed: number; // m/s
  accuracy: number; // meters
}

// Interpolated position between two GPS points
export interface InterpolatedPosition {
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  timestamp: number;
  index: number; // Index of previous GPS point
  ratio: number; // Interpolation ratio (0-1)
}

// Time-windowed event for playback
export interface IndexedEvent {
  id: string;
  type: 'delay' | 'arrival' | 'departure' | 'deviation' | 'proof';
  startTime: number; // Unix timestamp (ms)
  endTime?: number; // Unix timestamp (ms) - undefined means instant event
  location: [number, number]; // [lng, lat]
  metadata: {
    stopId?: string;
    facilityName?: string;
    reason?: string;
    duration?: number; // seconds
    severity?: 'low' | 'medium' | 'high';
  };
}

// Enhanced stop with additional playback metadata
export interface EnhancedStop extends StopAnalytics {
  location: [number, number]; // [lng, lat]
  plannedArrival?: Date;
  actualArrival: Date;
  dwellTime: number; // seconds
  status: 'completed' | 'missed' | 'delayed';
  variance?: number; // seconds difference from planned
}

// Route variance analytics
export interface RouteVariance {
  plannedDistance: number; // meters
  actualDistance: number; // meters
  variance: number; // meters (actual - planned)
  variancePercent: number; // percentage
}

// Delay breakdown by category
export interface DelayBreakdown {
  traffic: number; // seconds
  roadworks: number; // seconds
  weather: number; // seconds
  mechanical: number; // seconds
  other: number; // seconds
  total: number; // seconds
}

// Polyline type (GeoJSON LineString coordinates)
export type Polyline = [number, number][]; // Array of [lng, lat] points

// Deviation segment (where actual route deviates from planned)
export interface DeviationSegment {
  id: string;
  startIndex: number; // Index in GPS array
  endIndex: number; // Index in GPS array
  startTime: number; // Unix timestamp (ms)
  endTime: number; // Unix timestamp (ms)
  coordinates: Polyline; // Actual route coordinates
  plannedCoordinates: Polyline; // Planned route coordinates
  maxDeviation: number; // Maximum distance from planned route (meters)
  totalDeviation: number; // Total cumulative deviation (meters)
}

// Speed zone analytics
export interface SpeedZone {
  id: string;
  name: string;
  startIndex: number;
  endIndex: number;
  avgSpeed: number; // km/h
  maxSpeed: number; // km/h
  minSpeed: number; // km/h
  duration: number; // seconds
  distance: number; // meters
}

// Dwell time bucket for histogram
export interface DwellTimeBucket {
  label: string; // e.g., "0-10min"
  min: number; // seconds
  max: number; // seconds
  count: number; // number of stops in this bucket
  stops: string[]; // stop IDs
}

// Stop compliance status
export type StopComplianceStatus = 'on-time' | 'delayed' | 'missed' | 'excessive-dwell';

// Stop compliance entry for table
export interface StopCompliance {
  stopId: string;
  facilityName: string;
  status: StopComplianceStatus;
  plannedArrival: Date | null;
  actualArrival: Date;
  plannedDwell: number | null; // seconds
  actualDwell: number; // seconds
  variance: number | null; // seconds
}

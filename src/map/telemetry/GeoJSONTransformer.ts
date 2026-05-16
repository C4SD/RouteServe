/**
 * GeoJSONTransformer.ts
 *
 * Transforms RouteServe entity data to GeoJSON FeatureCollections
 * for use with MapLibre GL JS sources
 */

import type { FeatureCollection, Feature, Point } from 'geojson';
import type { Vehicle, Facility, Driver, DeliveryBatch, Warehouse } from '@/types';

/**
 * Base transformer options
 */
interface TransformerOptions {
  /** Include properties that might be undefined */
  includeOptional?: boolean;
}

/**
 * Transform vehicles to GeoJSON
 */
export function vehiclesToGeoJSON(
  vehicles: Vehicle[],
  options: TransformerOptions = {}
): FeatureCollection<Point> {
  const features: Feature<Point>[] = vehicles
    .filter((v) => v.currentLocation?.lat && v.currentLocation?.lng)
    .map((vehicle) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [vehicle.currentLocation!.lng, vehicle.currentLocation!.lat],
      },
      properties: {
        id: vehicle.id,
        type: 'vehicle',
        plateNumber: vehicle.plateNumber,
        vehicleType: vehicle.type,
        status: vehicle.status,
        capacity: vehicle.capacity,
        maxWeight: vehicle.maxWeight,
        currentDriverId: vehicle.currentDriverId,
        fuelType: vehicle.fuelType,

        // State encoding (for marker color)
        // Calculate risk based on payload utilization (if available)
        markerColor: getVehicleMarkerColor(vehicle),

        // Optional properties
        ...(options.includeOptional && {
          model: vehicle.model,
          avgSpeed: vehicle.avgSpeed,
          fuelEfficiency: vehicle.fuelEfficiency,
        }),
      },
      id: vehicle.id,
    }));

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Transform facilities to GeoJSON
 */
export function facilitiesToGeoJSON(
  facilities: Facility[],
  options: TransformerOptions = {}
): FeatureCollection<Point> {
  const features: Feature<Point>[] = facilities
    .filter((f) => f.lat && f.lng)
    .map((facility) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [facility.lng, facility.lat],
      },
      properties: {
        id: facility.id,
        type: 'facility',
        name: facility.name,
        address: facility.address,
        facilityType: facility.type || 'other',
        programme: facility.programme,
        serviceZone: facility.service_zone,
        levelOfCare: facility.level_of_care,

        // State encoding (for marker color)
        markerColor: getFacilityMarkerColor(facility),

        // Optional properties
        ...(options.includeOptional && {
          phone: facility.phone,
          contactPerson: facility.contactPerson,
          capacity: facility.capacity,
          warehouseCode: facility.warehouse_code,
          state: facility.state,
          lga: facility.lga,
          ward: facility.ward,
        }),
      },
      id: facility.id,
    }));

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Transform drivers to GeoJSON
 */
export function driversToGeoJSON(
  drivers: Driver[],
  options: TransformerOptions = {}
): FeatureCollection<Point> {
  const features: Feature<Point>[] = drivers
    .filter((d) => d.currentLocation?.lat && d.currentLocation?.lng)
    .map((driver) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [driver.currentLocation!.lng, driver.currentLocation!.lat],
      },
      properties: {
        id: driver.id,
        type: 'driver',
        name: driver.name,
        phone: driver.phone,
        status: driver.status,
        initials: getDriverInitials(driver.name),
        locationUpdatedAt: driver.locationUpdatedAt,

        // State encoding (for marker color)
        markerColor: getDriverMarkerColor(driver),

        // Optional properties
        ...(options.includeOptional && {
          email: driver.email,
          licenseType: driver.licenseType,
          licenseNumber: driver.licenseNumber,
          shiftStart: driver.shiftStart,
          shiftEnd: driver.shiftEnd,
          performanceScore: driver.performanceScore,
          totalDeliveries: driver.totalDeliveries,
        }),
      },
      id: driver.id,
    }));

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Transform warehouses to GeoJSON
 */
export function warehousesToGeoJSON(
  warehouses: Warehouse[],
  options: TransformerOptions = {}
): FeatureCollection<Point> {
  const features: Feature<Point>[] = warehouses
    .filter((w) => w.lat && w.lng)
    .map((warehouse) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [warehouse.lng, warehouse.lat],
      },
      properties: {
        id: warehouse.id,
        type: 'warehouse',
        name: warehouse.name,
        address: warehouse.address,
        warehouseType: warehouse.type,
        capacity: warehouse.capacity,

        // Warehouses use consistent color (teal)
        markerColor: '#14b8a6', // teal-500

        // Optional properties
        ...(options.includeOptional && {
          operatingHours: warehouse.operatingHours,
        }),
      },
      id: warehouse.id,
    }));

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Transform delivery batch routes to GeoJSON LineString
 */
export function batchRoutesToGeoJSON(
  batches: DeliveryBatch[]
): FeatureCollection {
  const features: Feature[] = batches
    .filter((b) => b.optimizedRoute && b.optimizedRoute.length > 1)
    .map((batch) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: batch.optimizedRoute.map(([lat, lng]) => [lng, lat]),
      },
      properties: {
        id: batch.id,
        type: 'batch-route',
        name: batch.name,
        status: batch.status,
        priority: batch.priority,
        totalDistance: batch.totalDistance,
        estimatedDuration: batch.estimatedDuration,
        vehicleId: batch.vehicleId,
        driverId: batch.driverId,

        // State encoding (for line color)
        lineColor: getBatchLineColor(batch),
        lineWidth: getBatchLineWidth(batch),
      },
      id: batch.id,
    }));

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Helper: Get vehicle marker color based on status/payload
 */
function getVehicleMarkerColor(vehicle: Vehicle): string {
  // In operational mode, this would be based on payload utilization
  // For now, use status
  switch (vehicle.status) {
    case 'in-use':
      return '#f59e0b'; // amber-500
    case 'maintenance':
      return '#ef4444'; // red-500
    case 'available':
    default:
      return '#10b981'; // green-500
  }
}

/**
 * Helper: Get facility marker color based on type
 */
function getFacilityMarkerColor(facility: Facility): string {
  const type = facility.type || 'other';

  const colorMap: Record<string, string> = {
    hospital: '#ef4444',      // red-500
    clinic: '#3b82f6',        // blue-500
    pharmacy: '#10b981',      // green-500
    health_center: '#a855f7', // purple-500
    lab: '#06b6d4',           // cyan-500
    other: '#6b7280',         // gray-500
  };

  return colorMap[type] || colorMap.other;
}

/**
 * Helper: Get driver marker color based on status
 */
function getDriverMarkerColor(driver: Driver): string {
  switch (driver.status) {
    case 'available':
      return '#10b981'; // green-500
    case 'busy':
      return '#f59e0b'; // amber-500
    case 'offline':
    default:
      return '#6b7280'; // gray-500
  }
}

/**
 * Helper: Get batch route line color based on status
 */
function getBatchLineColor(batch: DeliveryBatch): string {
  switch (batch.status) {
    case 'planned':
      return '#9ca3af'; // gray-400
    case 'assigned':
      return '#3b82f6'; // blue-500
    case 'in-progress':
      return '#f59e0b'; // amber-500
    case 'completed':
      return '#10b981'; // green-500
    case 'cancelled':
      return '#ef4444'; // red-400
    default:
      return '#6b7280'; // gray-500
  }
}

/**
 * Helper: Get batch route line width based on priority
 */
function getBatchLineWidth(batch: DeliveryBatch): number {
  switch (batch.priority) {
    case 'urgent':
      return 5;
    case 'high':
      return 4;
    case 'medium':
      return 3;
    case 'low':
    default:
      return 2;
  }
}

/**
 * Helper: Get driver initials from name
 */
function getDriverInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

/**
 * Generic transformer for any entity with lat/lng
 */
export function entityToGeoJSON<T extends { id: string; lat?: number; lng?: number }>(
  entities: T[],
  propertyMapper?: (entity: T) => Record<string, any>
): FeatureCollection<Point> {
  const features: Feature<Point>[] = entities
    .filter((e) => e.lat && e.lng)
    .map((entity) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [entity.lng!, entity.lat!],
      },
      properties: propertyMapper ? propertyMapper(entity) : { ...entity },
      id: entity.id,
    }));

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Merge multiple FeatureCollections into one
 */
export function mergeFeatureCollections(
  ...collections: FeatureCollection[]
): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: collections.flatMap((c) => c.features),
  };
}

/**
 * Filter FeatureCollection by property
 */
export function filterFeatureCollection(
  collection: FeatureCollection,
  predicate: (properties: any) => boolean
): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: collection.features.filter((f) => predicate(f.properties)),
  };
}

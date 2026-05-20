/**
 * useLiveTracking - Main aggregation hook for Live Map
 * Combines GPS positions, driver events, delivery batches, and vehicles
 * into a unified data model for the map layers
 */

import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDriverGPS } from './useDriverGPS';
import { useDriverEvents } from './useDriverEvents';
import { useLiveMapStore } from '@/stores/liveMapStore';
import { useRealtimeBatches } from './useRealtimeBatches';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type {
  LiveDriver,
  LiveVehicle,
  LiveDelivery,
  LiveFacility,
  DriverStatus,
  MapFeatureCollection,
  DriverMarkerProperties,
  VehicleMarkerProperties,
  DeliveryMarkerProperties,
  RouteLineProperties,
} from '@/types/live-map';
import type { FacilityMarkerProperties } from '@/maps-v3/layers/FacilityMarkerLayer';
import type { WarehouseMarkerProperties } from '@/maps-v3/layers/WarehouseMarkerLayer';
import type { ZoneMarkerProperties } from '@/maps-v3/layers/ZoneMarkerLayer';

interface UseLiveTrackingOptions {
  enabled?: boolean;
}

// Fetch active delivery batches with driver status
async function fetchActiveBatches(workspaceId: string) {
  const { data, error } = await supabase
    .from('delivery_batches')
    .select(`
      *,
      driver:drivers!delivery_batches_driver_id_fkey(id, name, phone),
      vehicle:vehicles(id, plate_number, type, make, model, capacity),
      warehouse:warehouses(id, name, address, lat, lng)
    `)
    .eq('workspace_id', workspaceId)
    .in('status', ['planned', 'assigned', 'in-progress'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Fetch active drivers (available or busy, not offline)
async function fetchActiveDrivers(workspaceId: string) {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('workspace_id', workspaceId)
    .in('status', ['available', 'busy']);

  if (error) throw error;
  return data || [];
}

// Fetch active drivers with positions via RPC (handles auth.users → mod4_driver_links → drivers chain)
interface ActiveDriverPosition {
  driver_id: string;
  driver_name: string;
  session_id: string;
  vehicle_id: string | null;
  vehicle_plate: string | null;
  current_lat: number | null;
  current_lng: number | null;
  heading: number | null;
  speed_mps: number | null;
  last_update: string | null;
  current_batch_id: string | null;
  batch_name: string | null;
  session_started_at: string;
  battery_level: number | null;
}

async function fetchActiveDriverPositions(): Promise<ActiveDriverPosition[]> {
  const { data, error } = await supabase.rpc('get_active_drivers_with_positions');
  if (error) {
    console.error('Error fetching active driver positions:', error);
    return [];
  }
  return (data || []) as ActiveDriverPosition[];
}

// Fetch active vehicles (available or in-use, not in maintenance)
async function fetchActiveVehicles(workspaceId: string) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('workspace_id', workspaceId)
    .in('status', ['available', 'in-use']);

  if (error) throw error;
  return data || [];
}

// Fetch all facilities with coordinates
async function fetchFacilitiesForMap(workspaceId: string) {
  const { data, error } = await supabase
    .from('facilities')
    .select('id, name, lat, lng, type, lga')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .not('lat', 'is', null)
    .not('lng', 'is', null);

  if (error) throw error;
  return data || [];
}

// Fetch all warehouses with coordinates
async function fetchWarehousesForMap(workspaceId: string) {
  const { data, error } = await supabase
    .from('warehouses')
    .select('id, name, code, lat, lng, is_active')
    .eq('workspace_id', workspaceId)
    .not('lat', 'is', null)
    .not('lng', 'is', null);

  if (error) throw error;
  return data || [];
}

// Fetch operational zones — include metadata so we can compute centroids for
// zones that have polygon geometry but no region_center (user-created zones).
async function fetchZonesForMap(workspaceId: string) {
  const { data, error } = await supabase
    .from('zones' as any)
    .select('id, name, code, region_center, is_active, metadata')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  if (error) throw error;
  return (data || []) as {
    id: string;
    name: string;
    code: string | null;
    region_center: { lat: number; lng: number } | null;
    is_active: boolean;
    metadata: Record<string, any> | null;
  }[];
}

export function useLiveTracking(options: UseLiveTrackingOptions = {}) {
  const { enabled = true } = options;
  const filters = useLiveMapStore((s) => s.filters);
  const { workspaceId } = useWorkspace();

  const isEnabled = enabled && !!workspaceId;

  // Real-time subscriptions
  useRealtimeBatches();

  // Fetch base data
  const batchesQuery = useQuery({
    queryKey: ['delivery-batches', 'active-planned', workspaceId],
    queryFn: () => fetchActiveBatches(workspaceId!),
    enabled: isEnabled,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const driversQuery = useQuery({
    queryKey: ['active-drivers', workspaceId],
    queryFn: () => fetchActiveDrivers(workspaceId!),
    enabled: isEnabled,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // RPC-based active driver positions (handles auth.users → mod4_driver_links → drivers chain)
  const activeDriverPositionsQuery = useQuery({
    queryKey: ['active-driver-positions'],
    queryFn: fetchActiveDriverPositions,
    enabled: isEnabled,
    refetchInterval: 15000,
    staleTime: 5000,
  });

  const vehiclesQuery = useQuery({
    queryKey: ['active-vehicles', workspaceId],
    queryFn: () => fetchActiveVehicles(workspaceId!),
    enabled: isEnabled,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const facilitiesQuery = useQuery({
    queryKey: ['map-facilities', workspaceId],
    queryFn: () => fetchFacilitiesForMap(workspaceId!),
    enabled: isEnabled,
    staleTime: 60000,
    gcTime: 300000,
  });

  const warehousesQuery = useQuery({
    queryKey: ['map-warehouses', workspaceId],
    queryFn: () => fetchWarehousesForMap(workspaceId!),
    enabled: isEnabled,
    staleTime: 60000,
    gcTime: 300000,
  });

  const zonesQuery = useQuery({
    queryKey: ['map-zones', workspaceId],
    queryFn: () => fetchZonesForMap(workspaceId!),
    enabled: isEnabled,
    staleTime: 60000,
    gcTime: 300000,
  });

  // Real-time GPS positions
  const gpsData = useDriverGPS({ enabled });

  // Real-time driver events (state transitions)
  const eventsData = useDriverEvents({ enabled });

  // Transform to LiveDriver objects
  const liveDrivers = useMemo((): LiveDriver[] => {
    const drivers = driversQuery.data || [];
    const rpcPositions = activeDriverPositionsQuery.data || [];

    // Build map of RPC positions by driver_id for quick lookup
    const rpcByDriverId = new Map<string, ActiveDriverPosition>();
    for (const pos of rpcPositions) {
      if (pos.driver_id) rpcByDriverId.set(pos.driver_id, pos);
    }

    // Start with drivers from the drivers table query
    const driverIds = new Set<string>();
    const result: LiveDriver[] = drivers.map((driver): LiveDriver => {
      driverIds.add(driver.id);
      const gps = gpsData.positions[driver.id];
      const rpc = rpcByDriverId.get(driver.id);
      const latestEvent = eventsData.latestByDriver[driver.id];

      // Find batch this driver is assigned to
      const batch = (batchesQuery.data || []).find(
        (b) => b.driver_id === driver.id
      );

      // Use GPS realtime data first, then RPC data, then drivers table
      const hasGps = !!gps;
      const hasRpc = !!rpc && rpc.current_lat != null && rpc.current_lng != null;
      const hasDriverCoords = !!driver.current_lng && !!driver.current_lat;

      const position: [number, number] = hasGps
        ? [gps.lng, gps.lat]
        : hasRpc
          ? [rpc.current_lng!, rpc.current_lat!]
          : hasDriverCoords
            ? [Number(driver.current_lng), Number(driver.current_lat)]
            : [0, 0];

      return {
        id: driver.id,
        name: driver.name || 'Unknown Driver',
        phone: driver.phone,
        status: (latestEvent?.driverStatus || 'INACTIVE') as DriverStatus,
        position,
        batchId: batch?.id || rpc?.current_batch_id || null,
        vehicleId: batch?.vehicle_id || rpc?.vehicle_id || null,
        sessionId: gps?.sessionId || rpc?.session_id || null,
        lastUpdate: gps?.capturedAt || (rpc?.last_update ? new Date(rpc.last_update) : new Date(driver.updated_at || '')),
        speed: gps?.speed || rpc?.speed_mps || 0,
        heading: gps?.heading || rpc?.heading || 0,
        accuracy: gps?.accuracy || 0,
        batteryLevel: gps?.batteryLevel ?? rpc?.battery_level ?? undefined,
        isOnline: hasGps
          ? Date.now() - gps.capturedAt.getTime() < 5 * 60 * 1000
          : hasRpc && rpc.last_update
            ? Date.now() - new Date(rpc.last_update).getTime() < 5 * 60 * 1000
            : false,
      };
    });

    // Add drivers from RPC that aren't in the drivers table query
    // (e.g., drivers with active sessions whose status wasn't updated)
    for (const rpc of rpcPositions) {
      if (rpc.driver_id && !driverIds.has(rpc.driver_id)) {
        const gps = gpsData.positions[rpc.driver_id];
        const hasGps = !!gps;
        const hasRpc = rpc.current_lat != null && rpc.current_lng != null;

        result.push({
          id: rpc.driver_id,
          name: rpc.driver_name || 'Unknown Driver',
          phone: undefined,
          status: 'ACTIVE' as DriverStatus,
          position: hasGps
            ? [gps.lng, gps.lat]
            : hasRpc
              ? [rpc.current_lng!, rpc.current_lat!]
              : [0, 0],
          batchId: rpc.current_batch_id || null,
          vehicleId: rpc.vehicle_id || null,
          sessionId: gps?.sessionId || rpc.session_id || null,
          lastUpdate: gps?.capturedAt || (rpc.last_update ? new Date(rpc.last_update) : new Date()),
          speed: gps?.speed || rpc.speed_mps || 0,
          heading: gps?.heading || rpc.heading || 0,
          accuracy: gps?.accuracy || 0,
          batteryLevel: gps?.batteryLevel ?? rpc.battery_level ?? undefined,
          isOnline: hasGps
            ? Date.now() - gps.capturedAt.getTime() < 5 * 60 * 1000
            : rpc.last_update
              ? Date.now() - new Date(rpc.last_update).getTime() < 5 * 60 * 1000
              : true, // Has active session, assume online
        });
      }
    }

    return result;
  }, [driversQuery.data, activeDriverPositionsQuery.data, batchesQuery.data, gpsData.positions, eventsData.latestByDriver]);

  // Transform to LiveVehicle objects
  const liveVehicles = useMemo((): LiveVehicle[] => {
    const vehicles = vehiclesQuery.data || [];

    return vehicles.map((vehicle): LiveVehicle => {
      // Find batch and driver for this vehicle
      const batch = (batchesQuery.data || []).find(
        (b) => b.vehicle_id === vehicle.id
      );
      const driver = batch?.driver as { id: string; name: string; phone: string } | null | undefined;
      const gps = driver?.id ? gpsData.positions[driver.id] : null;

      return {
        id: vehicle.id,
        plate: vehicle.plate_number || 'Unknown',
        type: vehicle.type || 'truck',
        make: vehicle.make,
        model: vehicle.model,
        position: gps
          ? [gps.lng, gps.lat]
          : [0, 0],
        capacity: vehicle.capacity || 100,
        utilization: batch ? calculateBatchUtilization(batch as any) : 0,
        driverId: driver?.id || null,
        driverName: driver?.name,
        batchId: batch?.id || null,
        lastUpdate: gps?.capturedAt || new Date(vehicle.updated_at || ''),
        speed: gps?.speed || 0,
        heading: gps?.heading || 0,
        fuelLevel: (vehicle as any).fuel_level,
        isActive: !!batch,
      };
    });
  }, [vehiclesQuery.data, batchesQuery.data, gpsData.positions]);

  // Transform to LiveDelivery objects
  const liveDeliveries = useMemo((): LiveDelivery[] => {
    const batches = batchesQuery.data || [];

    return batches.map((batch): LiveDelivery => {
      const latestEvent = eventsData.latestByBatch[batch.id];
      const facilities: LiveFacility[] = (batch.facility_ids || []).map(
        (id: string, index: number): LiveFacility => {
          // Try to find stop info in optimized_route
          const stopInfo = batch.optimized_route?.stops?.find((s: any) => s.id === id);

          return {
            id,
            name: stopInfo?.name || `Stop ${index + 1}`,
            position: stopInfo?.lng && stopInfo?.lat ? [stopInfo.lng, stopInfo.lat] : [0, 0],
            address: stopInfo?.address,
            stopIndex: index,
            status: getStopStatus(index, 0, batch.status),
            proofCaptured: eventsData.events.some(
              (e) =>
                e.batchId === batch.id &&
                e.eventType === 'PROOF_CAPTURED' &&
                e.metadata?.facilityId === id
            ),
          };
        }
      );

      const currentStopIndex = 0;
      const totalStops = facilities.length;
      const completedStops = Math.min(currentStopIndex, totalStops);

      return {
        id: batch.id,
        batchId: batch.id,
        name: batch.name || `Batch ${batch.id.slice(0, 8)}`,
        driverId: batch.driver_id,
        driverName: (batch.driver as any)?.name,
        vehicleId: batch.vehicle_id,
        status: batch.status,
        driverStatus: (latestEvent?.driverStatus || 'INACTIVE') as DriverStatus,
        currentStopIndex,
        totalStops,
        completedStops,
        progress: totalStops > 0 ? (completedStops / totalStops) * 100 : 0,
        facilities,
        route: extractRoutePath(batch as any, facilities),
        warehouseId: batch.warehouse_id,
        startTime: batch.actual_start_time ? new Date(batch.actual_start_time) : null,
        endTime: batch.actual_end_time ? new Date(batch.actual_end_time) : null,
      };
    });
  }, [batchesQuery.data, eventsData.latestByBatch]);

  // Apply filters
  const filteredDrivers = useMemo(() => {
    if (!filters.showDrivers) return [];

    return liveDrivers.filter((driver) => {
      if (filters.statusFilter !== 'all' && driver.status !== filters.statusFilter) {
        return false;
      }
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        return (
          driver.name.toLowerCase().includes(query) ||
          driver.email?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [liveDrivers, filters]);

  const filteredVehicles = useMemo(() => {
    if (!filters.showVehicles) return [];

    return liveVehicles.filter((vehicle) => {
      if (filters.vehicleTypeFilter !== 'all' && vehicle.type !== filters.vehicleTypeFilter) {
        return false;
      }
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        return (
          vehicle.plate.toLowerCase().includes(query) ||
          vehicle.driverName?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [liveVehicles, filters]);

  const filteredDeliveries = useMemo(() => {
    if (!filters.showDeliveries) return [];

    return liveDeliveries.filter((delivery) => {
      if (filters.statusFilter !== 'all' && delivery.driverStatus !== filters.statusFilter) {
        return false;
      }
      if (filters.priorityFilter !== 'all') {
        const batch = (batchesQuery.data || []).find(b => b.id === delivery.id);
        if (batch && batch.priority?.toLowerCase() !== filters.priorityFilter.toLowerCase()) {
          return false;
        }
      }
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        return (
          delivery.name.toLowerCase().includes(query) ||
          delivery.driverName?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [liveDeliveries, filters]);

  // Convert to GeoJSON for map layers
  const driverGeoJSON = useMemo(
    (): MapFeatureCollection<DriverMarkerProperties> => ({
      type: 'FeatureCollection',
      features: filteredDrivers
        .filter((d) => d.position[0] !== 0 && d.position[1] !== 0)
        .map((driver) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: driver.position,
          },
          properties: {
            id: driver.id,
            name: driver.name,
            status: driver.status,
            heading: driver.heading,
            isOnline: driver.isOnline,
            batchId: driver.batchId,
          },
        })),
    }),
    [filteredDrivers]
  );

  const vehicleGeoJSON = useMemo(
    (): MapFeatureCollection<VehicleMarkerProperties> => ({
      type: 'FeatureCollection',
      features: filteredVehicles
        .filter((v) => v.position[0] !== 0 && v.position[1] !== 0)
        .map((vehicle) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: vehicle.position,
          },
          properties: {
            id: vehicle.id,
            plate: vehicle.plate,
            type: vehicle.type,
            utilization: vehicle.utilization,
            isActive: vehicle.isActive,
            driverId: vehicle.driverId,
          },
        })),
    }),
    [filteredVehicles]
  );

  const deliveryGeoJSON = useMemo(
    (): MapFeatureCollection<DeliveryMarkerProperties> => ({
      type: 'FeatureCollection',
      features: filteredDeliveries
        .filter((d) => d.facilities.length > 0)
        .flatMap((delivery) =>
          delivery.facilities
            .filter((f) => f.position[0] !== 0 && f.position[1] !== 0)
            .map((facility) => ({
              type: 'Feature' as const,
              geometry: {
                type: 'Point' as const,
                coordinates: facility.position,
              },
              properties: {
                id: facility.id,
                name: facility.name,
                status: delivery.driverStatus,
                progress: delivery.progress,
                stopsCount: delivery.totalStops,
                currentStopIndex: delivery.currentStopIndex,
              },
            }))
        ),
    }),
    [filteredDeliveries]
  );

  const routeGeoJSON = useMemo(
    (): MapFeatureCollection<RouteLineProperties> => {
      if (!filters.showRoutes) {
        return { type: 'FeatureCollection', features: [] };
      }

      return {
        type: 'FeatureCollection',
        features: filteredDeliveries
          .filter((d) => d.route.length > 1)
          .map((delivery) => ({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: delivery.route,
            },
            properties: {
              id: delivery.id,
              batchId: delivery.batchId,
              driverId: delivery.driverId,
              progress: delivery.progress,
              status: delivery.driverStatus,
            },
          })),
      };
    },
    [filteredDeliveries, filters.showRoutes]
  );

  // Facility GeoJSON
  const facilityGeoJSON = useMemo(
    (): MapFeatureCollection<FacilityMarkerProperties> => {
      if (!filters.showFacilities) return { type: 'FeatureCollection', features: [] };
      const facilities = facilitiesQuery.data || [];
      return {
        type: 'FeatureCollection',
        features: facilities
          .filter((f) => f.lat && f.lng)
          .map((f) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [Number(f.lng), Number(f.lat)] },
            properties: {
              id: f.id,
              name: f.name,
              type: f.type || 'facility',
              lga: f.lga || undefined,
            },
          })),
      };
    },
    [facilitiesQuery.data, filters.showFacilities]
  );

  // Warehouse GeoJSON
  const warehouseGeoJSON = useMemo(
    (): MapFeatureCollection<WarehouseMarkerProperties> => {
      if (!filters.showWarehouses) return { type: 'FeatureCollection', features: [] };
      const warehouses = warehousesQuery.data || [];
      return {
        type: 'FeatureCollection',
        features: warehouses
          .filter((w) => w.lat && w.lng)
          .map((w) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [Number(w.lng), Number(w.lat)] },
            properties: {
              id: w.id,
              name: w.name,
              code: w.code || '',
              isActive: w.is_active ?? true,
            },
          })),
      };
    },
    [warehousesQuery.data, filters.showWarehouses]
  );

  // Zone GeoJSON — use region_center if available, otherwise compute centroid
  // from the zone's polygon geometry (stored in metadata.geometry).
  const zoneGeoJSON = useMemo(
    (): MapFeatureCollection<ZoneMarkerProperties> => {
      if (!filters.showZones) return { type: 'FeatureCollection', features: [] };
      const zones = zonesQuery.data || [];
      const features: MapFeatureCollection<ZoneMarkerProperties>['features'] = [];

      for (const z of zones) {
        let lng: number | null = null;
        let lat: number | null = null;

        if (z.region_center?.lng && z.region_center?.lat) {
          lng = z.region_center.lng;
          lat = z.region_center.lat;
        } else {
          // Compute centroid from polygon geometry if available
          const coords: [number, number][] | undefined =
            z.metadata?.geometry?.coordinates?.[0];
          if (coords && coords.length > 0) {
            lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
            lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
          }
        }

        if (!lng || !lat) continue;

        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: { id: z.id, name: z.name, code: z.code, isActive: z.is_active },
        });
      }

      return { type: 'FeatureCollection', features };
    },
    [zonesQuery.data, filters.showZones]
  );

  // Get entity by ID
  const getDriver = useCallback(
    (id: string) => liveDrivers.find((d) => d.id === id),
    [liveDrivers]
  );

  const getVehicle = useCallback(
    (id: string) => liveVehicles.find((v) => v.id === id),
    [liveVehicles]
  );

  const getDelivery = useCallback(
    (id: string) => liveDeliveries.find((d) => d.id === id),
    [liveDeliveries]
  );

  const getFacility = useCallback(
    (id: string) => {
      const f = (facilitiesQuery.data || []).find((f) => f.id === id);
      if (!f) return undefined;
      return { id: f.id, name: f.name, type: f.type, lga: f.lga, lat: f.lat, lng: f.lng };
    },
    [facilitiesQuery.data]
  );

  // Loading state — include facilities, warehouses, and zones
  const isLoading =
    batchesQuery.isLoading ||
    driversQuery.isLoading ||
    vehiclesQuery.isLoading ||
    activeDriverPositionsQuery.isLoading ||
    facilitiesQuery.isLoading ||
    warehousesQuery.isLoading ||
    zonesQuery.isLoading;

  // Error state — include facilities, warehouses, and zones so failures are visible
  const error =
    batchesQuery.error ||
    driversQuery.error ||
    vehiclesQuery.error ||
    facilitiesQuery.error ||
    warehousesQuery.error ||
    zonesQuery.error;

  return {
    // Raw data
    drivers: liveDrivers,
    vehicles: liveVehicles,
    deliveries: liveDeliveries,
    facilities: facilitiesQuery.data || [],
    warehouses: warehousesQuery.data || [],
    zones: zonesQuery.data || [],

    // Filtered data
    filteredDrivers,
    filteredVehicles,
    filteredDeliveries,

    // GeoJSON for layers
    driverGeoJSON,
    vehicleGeoJSON,
    deliveryGeoJSON,
    routeGeoJSON,
    facilityGeoJSON,
    warehouseGeoJSON,
    zoneGeoJSON,

    // Getters
    getDriver,
    getVehicle,
    getDelivery,
    getFacility,

    // Status
    isLoading,
    error,

    // Counts
    counts: {
      drivers: filteredDrivers.length,
      vehicles: filteredVehicles.length,
      deliveries: filteredDeliveries.length,
      facilities: (facilitiesQuery.data || []).length,
      warehouses: (warehousesQuery.data || []).length,
      zones: (zonesQuery.data || []).length,
      activeDrivers: filteredDrivers.filter((d) => d.status === 'EN_ROUTE' || d.status === 'AT_STOP').length,
      delayedDrivers: filteredDrivers.filter((d) => d.status === 'DELAYED').length,
    },
  };
}

// Helper functions
function getStopStatus(
  index: number,
  currentIndex: number,
  batchStatus: string
): 'pending' | 'arrived' | 'completed' | 'skipped' {
  if (index < currentIndex) return 'completed';
  if (index === currentIndex && batchStatus === 'in-progress') return 'arrived';
  return 'pending';
}

function calculateBatchUtilization(batch: {
  payload_utilization_pct?: number | null;
  facilities?: any[];
}): number {
  if (batch.payload_utilization_pct !== undefined && batch.payload_utilization_pct !== null) {
    return batch.payload_utilization_pct;
  }
  // Fallback to rough estimate based on facilities
  const facilities = batch.facilities;
  if (!facilities?.length) return 0;
  return Math.min(facilities.length * 15, 100);
}

function extractRoutePath(batch: any, facilities: LiveFacility[] = []): [number, number][] {
  // 1. Try to get detailed road path from optimized_route (if available)
  if (batch.optimized_route) {
    const routeData = batch.optimized_route;

    // Check if it's a GeoJSON LineString
    if (routeData.type === 'LineString' && Array.isArray(routeData.coordinates)) {
      return routeData.coordinates;
    }

    // Check if it's a nested structure like { geometry: { coordinates: [...] } }
    if (routeData.geometry?.type === 'LineString' && Array.isArray(routeData.geometry.coordinates)) {
      return routeData.geometry.coordinates;
    }
  }

  // 2. Fallback: Build straight-line route from components
  return buildRouteFromFacilities(batch.warehouse, facilities);
}

function buildRouteFromFacilities(
  warehouse: any,
  facilities: LiveFacility[]
): [number, number][] {
  const route: [number, number][] = [];

  // Start from warehouse
  if (warehouse && warehouse.lng && warehouse.lat) {
    route.push([warehouse.lng, warehouse.lat]);
  }

  // If we have facilities with positions, add them
  if (facilities.length > 0) {
    const sortedFacilities = [...facilities].sort((a, b) => a.stopIndex - b.stopIndex);
    for (const facility of sortedFacilities) {
      if (facility.position[0] !== 0 && facility.position[1] !== 0) {
        route.push(facility.position);
      }
    }
  }

  return route;
}

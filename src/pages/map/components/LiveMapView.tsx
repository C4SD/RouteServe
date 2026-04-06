/**
 * LiveMapView - Main map container for Live tracking mode
 * Connects data hooks to map layers with real-time updates
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { LiveMapKernel } from '@/maps-v3/core/LiveMapKernel';
import { DriverMarkerLayer } from '@/maps-v3/layers/DriverMarkerLayer';
import { VehicleMarkerLayer } from '@/maps-v3/layers/VehicleMarkerLayer';
import { RouteLineLayer } from '@/maps-v3/layers/RouteLineLayer';
import { DeliveryMarkerLayer } from '@/maps-v3/layers/DeliveryMarkerLayer';
import { FacilityMarkerLayer } from '@/maps-v3/layers/FacilityMarkerLayer';
import { WarehouseMarkerLayer } from '@/maps-v3/layers/WarehouseMarkerLayer';
import { ZoneMarkerLayer } from '@/maps-v3/layers/ZoneMarkerLayer';
import { useLiveTracking } from '@/hooks/useLiveTracking';
import { useLiveMapStore } from '@/stores/liveMapStore';
import { useDebouncedCallback } from 'use-debounce';
import { useMapSettings } from '@/hooks/settings/useMapSettings';

interface LiveMapViewProps {
  onEntitySelect?: (entityId: string, entityType: 'driver' | 'vehicle' | 'delivery' | 'facility') => void;
}

export function LiveMapView({ onEntitySelect }: LiveMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const kernelRef = useRef<LiveMapKernel | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const initializedRef = useRef(false);

  // Workspace map settings (center, zoom, basemap style, layer defaults)
  const { settings: mapSettings } = useMapSettings();
  // Capture latest settings in a ref so the init effect can read them without re-running
  const mapSettingsRef = useRef(mapSettings);
  useEffect(() => { mapSettingsRef.current = mapSettings; }, [mapSettings]);

  // Get filter state
  const filters = useLiveMapStore((s) => s.filters);
  const viewState = useLiveMapStore((s) => s.viewState);
  const setViewState = useLiveMapStore((s) => s.setViewState);
  const selectEntity = useLiveMapStore((s) => s.selectEntity);

  // Layer refs
  const layersRef = useRef<{
    driver: DriverMarkerLayer;
    vehicle: VehicleMarkerLayer;
    route: RouteLineLayer;
    delivery: DeliveryMarkerLayer;
    facility: FacilityMarkerLayer;
    warehouse: WarehouseMarkerLayer;
    zone: ZoneMarkerLayer;
  } | null>(null);

  // Get live tracking data
  const {
    driverGeoJSON,
    vehicleGeoJSON,
    routeGeoJSON,
    deliveryGeoJSON,
    facilityGeoJSON,
    warehouseGeoJSON,
    zoneGeoJSON,
    isLoading,
    counts,
  } = useLiveTracking({ enabled: true });

  // Debounced layer updates to prevent excessive re-renders
  const updateDriverLayer = useDebouncedCallback((data) => {
    layersRef.current?.driver.update(data);
  }, 300);

  const updateVehicleLayer = useDebouncedCallback((data) => {
    layersRef.current?.vehicle.update(data);
  }, 300);

  const updateRouteLayer = useDebouncedCallback((data) => {
    layersRef.current?.route.update(data);
  }, 500);

  const updateDeliveryLayer = useDebouncedCallback((data) => {
    layersRef.current?.delivery.update(data);
  }, 300);

  const updateFacilityLayer = useDebouncedCallback((data) => {
    layersRef.current?.facility.update(data);
  }, 500);

  const updateWarehouseLayer = useDebouncedCallback((data) => {
    layersRef.current?.warehouse.update(data);
  }, 500);

  const updateZoneLayer = useDebouncedCallback((data) => {
    layersRef.current?.zone.update(data);
  }, 500);

  // Initialize map kernel — uses workspace settings if already cached, otherwise
  // falls back to defaults from mapSettingsRef (computed at render time).
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const s = mapSettingsRef.current;

    const kernel = new LiveMapKernel({
      onReady: () => {
        setMapReady(true);
        console.log('[LiveMapView] Map ready');
      },
      onError: (error) => {
        console.error('[LiveMapView] Map error:', error);
      },
    });

    // Create layers
    const layers = {
      driver: new DriverMarkerLayer(),
      vehicle: new VehicleMarkerLayer(),
      route: new RouteLineLayer(),
      delivery: new DeliveryMarkerLayer(),
      facility: new FacilityMarkerLayer(),
      warehouse: new WarehouseMarkerLayer(),
      zone: new ZoneMarkerLayer(),
    };

    // Register layers (zones first so they render below other markers)
    kernel.registerLayer('zone', layers.zone);
    kernel.registerLayer('facility', layers.facility);
    kernel.registerLayer('warehouse', layers.warehouse);
    kernel.registerLayer('route', layers.route);
    kernel.registerLayer('delivery', layers.delivery);
    kernel.registerLayer('driver', layers.driver);
    kernel.registerLayer('vehicle', layers.vehicle);

    // Apply default layer visibility from workspace settings
    layers.zone.setVisibility(s.layers.showZones);
    layers.facility.setVisibility(s.layers.showFacilities);
    layers.route.setVisibility(s.layers.showRoutes);

    // Initialize map with workspace-configured center, zoom and basemap
    kernel.init({
      container: containerRef.current,
      center: s.center,
      zoom: s.zoom,
      style: s.resolvedStyleUrl,
    });

    kernelRef.current = kernel;
    layersRef.current = layers;

    return () => {
      kernel.destroy();
      kernelRef.current = null;
      layersRef.current = null;
      initializedRef.current = false;
      setMapReady(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update layers when data changes
  useEffect(() => {
    if (!mapReady) return;
    updateDriverLayer(driverGeoJSON);
  }, [driverGeoJSON, mapReady, updateDriverLayer]);

  useEffect(() => {
    if (!mapReady) return;
    updateVehicleLayer(vehicleGeoJSON);
  }, [vehicleGeoJSON, mapReady, updateVehicleLayer]);

  useEffect(() => {
    if (!mapReady) return;
    updateRouteLayer(routeGeoJSON);
  }, [routeGeoJSON, mapReady, updateRouteLayer]);

  useEffect(() => {
    if (!mapReady) return;
    updateDeliveryLayer(deliveryGeoJSON);
  }, [deliveryGeoJSON, mapReady, updateDeliveryLayer]);

  useEffect(() => {
    if (!mapReady) return;
    updateFacilityLayer(facilityGeoJSON);
  }, [facilityGeoJSON, mapReady, updateFacilityLayer]);

  useEffect(() => {
    if (!mapReady) return;
    updateWarehouseLayer(warehouseGeoJSON);
  }, [warehouseGeoJSON, mapReady, updateWarehouseLayer]);

  useEffect(() => {
    if (!mapReady) return;
    updateZoneLayer(zoneGeoJSON);
  }, [zoneGeoJSON, mapReady, updateZoneLayer]);

  // Update layer visibility when filters change
  useEffect(() => {
    if (!mapReady || !layersRef.current) return;

    layersRef.current.driver.setVisibility(filters.showDrivers);
    layersRef.current.vehicle.setVisibility(filters.showVehicles);
    layersRef.current.route.setVisibility(filters.showRoutes);
    layersRef.current.delivery.setVisibility(filters.showDeliveries);
    layersRef.current.facility.setVisibility(filters.showFacilities);
    layersRef.current.warehouse.setVisibility(filters.showWarehouses);
    layersRef.current.zone.setVisibility(filters.showZones);
  }, [filters, mapReady]);

  // Handle entity click events from layers
  const handleEntityClick = useCallback(
    (entityId: string, entityType: 'driver' | 'vehicle' | 'delivery' | 'facility') => {
      selectEntity(entityId, entityType);
      onEntitySelect?.(entityId, entityType);
    },
    [selectEntity, onEntitySelect]
  );

  // Listen for custom events from layers
  useEffect(() => {
    const handleDriverClick = (e: CustomEvent) => {
      handleEntityClick(e.detail.driverId, 'driver');
    };
    const handleVehicleClick = (e: CustomEvent) => {
      handleEntityClick(e.detail.vehicleId, 'vehicle');
    };
    const handleDeliveryClick = (e: CustomEvent) => {
      handleEntityClick(e.detail.facilityId, 'delivery');
    };
    const handleRouteClick = (e: CustomEvent) => {
      handleEntityClick(e.detail.batchId, 'delivery');
    };
    const handleFacilityClick = (e: CustomEvent) => {
      handleEntityClick(e.detail.facilityId, 'facility');
    };

    window.addEventListener('driver-marker-click', handleDriverClick as EventListener);
    window.addEventListener('vehicle-marker-click', handleVehicleClick as EventListener);
    window.addEventListener('delivery-marker-click', handleDeliveryClick as EventListener);
    window.addEventListener('route-line-click', handleRouteClick as EventListener);
    window.addEventListener('facility-marker-click', handleFacilityClick as EventListener);

    return () => {
      window.removeEventListener('driver-marker-click', handleDriverClick as EventListener);
      window.removeEventListener('vehicle-marker-click', handleVehicleClick as EventListener);
      window.removeEventListener('delivery-marker-click', handleDeliveryClick as EventListener);
      window.removeEventListener('route-line-click', handleRouteClick as EventListener);
      window.removeEventListener('facility-marker-click', handleFacilityClick as EventListener);
    };
  }, [handleEntityClick]);

  // Fly to location method
  const flyTo = useCallback((center: [number, number], zoom?: number) => {
    kernelRef.current?.flyTo(center, zoom);
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Map container */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute top-4 left-4 bg-card border px-3 py-2 rounded-md shadow-md">
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      )}

      {/* Stats badge */}
      {mapReady && (
        <div className="absolute bottom-4 left-4 bg-card border px-3 py-2 rounded-md shadow-md space-x-3 text-xs">
          {filters.showDrivers && (
            <span>
              <span className="font-medium">{counts.drivers}</span> Drivers
              {counts.activeDrivers > 0 && (
                <span className="text-green-600 ml-1">({counts.activeDrivers} active)</span>
              )}
            </span>
          )}
          {filters.showVehicles && (
            <span>
              <span className="font-medium">{counts.vehicles}</span> Vehicles
            </span>
          )}
          {filters.showDeliveries && (
            <span>
              <span className="font-medium">{counts.deliveries}</span> Deliveries
            </span>
          )}
          {filters.showFacilities && (
            <span>
              <span className="font-medium">{counts.facilities}</span> Facilities
            </span>
          )}
          {filters.showWarehouses && (
            <span>
              <span className="font-medium">{counts.warehouses}</span> Warehouses
            </span>
          )}
          {filters.showZones && (
            <span>
              <span className="font-medium">{counts.zones}</span> Zones
            </span>
          )}
        </div>
      )}
    </div>
  );
}

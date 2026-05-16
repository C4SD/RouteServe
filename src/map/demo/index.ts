/**
 * RouteServe Map Demo System
 *
 * Production-grade simulation environment for MapRuntime validation
 *
 * Usage:
 *   import { getDemoEngine } from '@/map/demo';
 *
 *   const engine = getDemoEngine({ mode: 'operational', seed: 42 });
 *   engine.start();
 */

export { DemoDataEngine, getDemoEngine, destroyDemoEngine, type DemoMode, type DemoEngineConfig } from './DemoDataEngine';

// Export demo datasets
export { facilities, type DemoFacility } from './kano/facilities';
export { warehouses, type DemoWarehouse } from './kano/warehouses';
export { vehicles, simulationVehicles, type SimulationVehicle } from './kano/vehicles';
export { routes, type DemoRoute } from './kano/routes';

// Export simulation utilities
export { trafficZones, type TrafficZone } from './simulator/trafficZones';
export { haversineMeters, calculateBearing } from './simulator/geoUtils';

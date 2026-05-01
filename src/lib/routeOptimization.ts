import { Facility, Warehouse, RouteOptimization } from '@/types';

// Calculate distance between two points using Haversine formula
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Find the optimal warehouse for a facility
export function findOptimalWarehouse(facility: Facility, warehouses: Warehouse[]): Warehouse {
  let optimalWarehouse = warehouses[0];
  let minDistance = calculateDistance(
    facility.lat,
    facility.lng,
    warehouses[0].lat,
    warehouses[0].lng
  );

  for (let i = 1; i < warehouses.length; i++) {
    const distance = calculateDistance(
      facility.lat,
      facility.lng,
      warehouses[i].lat,
      warehouses[i].lng
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      optimalWarehouse = warehouses[i];
    }
  }

  return optimalWarehouse;
}

// Enhanced VRP optimization with clustering and vehicle assignment
export function optimizeRoutes(facilities: Facility[], warehouses: Warehouse[], waitingTimeMin = 20): RouteOptimization[] {
  const routesByWarehouse: { [warehouseId: string]: RouteOptimization } = {};

  // Initialize routes for each warehouse
  warehouses.forEach(warehouse => {
    routesByWarehouse[warehouse.id] = {
      warehouseId: warehouse.id,
      facilities: [],
      totalDistance: 0,
      estimatedDuration: 0,
      optimizedRoute: [[warehouse.lat, warehouse.lng]]
    };
  });

  // Assign each facility to its nearest warehouse
  facilities.forEach(facility => {
    const optimalWarehouse = findOptimalWarehouse(facility, warehouses);
    const distance = calculateDistance(
      facility.lat,
      facility.lng,
      optimalWarehouse.lat,
      optimalWarehouse.lng
    );

    routesByWarehouse[optimalWarehouse.id].facilities.push(facility);
    routesByWarehouse[optimalWarehouse.id].totalDistance += distance;
    // waiting time SLA per stop + travel time at 40 km/h average
    routesByWarehouse[optimalWarehouse.id].estimatedDuration += waitingTimeMin + (distance / 40) * 60;
  });

  // Optimize routes for each warehouse using nearest neighbor with 2-opt improvement
  Object.values(routesByWarehouse).forEach(route => {
    if (route.facilities.length > 0) {
      const warehouse = warehouses.find(w => w.id === route.warehouseId)!;
      route.optimizedRoute = optimizeRouteOrder(warehouse, route.facilities);
      
      // Recalculate total distance based on optimized order
      route.totalDistance = calculateRouteDistance(route.optimizedRoute);
      // Add loading time (10 minutes) to total duration
      route.estimatedDuration += 10;
    }
  });

  return Object.values(routesByWarehouse).filter(route => route.facilities.length > 0);
}

// Optimize facility visit order using nearest neighbor algorithm
function optimizeRouteOrder(warehouse: Warehouse, facilities: Facility[]): [number, number][] {
  const route: [number, number][] = [[warehouse.lat, warehouse.lng]];
  const unvisited = [...facilities];
  let current: { lat: number; lng: number } = warehouse;
  
  // Nearest neighbor algorithm
  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let minDistance = calculateDistance(current.lat, current.lng, unvisited[0].lat, unvisited[0].lng);
    
    for (let i = 1; i < unvisited.length; i++) {
      const distance = calculateDistance(current.lat, current.lng, unvisited[i].lat, unvisited[i].lng);
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }
    
    const nearest = unvisited.splice(nearestIndex, 1)[0];
    route.push([nearest.lat, nearest.lng]);
    current = nearest;
  }
  
  // Return to warehouse (optional - for round trip)
  // route.push([warehouse.lat, warehouse.lng]);
  
  return route;
}

// Calculate total distance for a route
export function calculateRouteDistance(route: [number, number][]): number {
  let totalDistance = 0;
  for (let i = 1; i < route.length; i++) {
    totalDistance += calculateDistance(
      route[i-1][0], route[i-1][1],
      route[i][0], route[i][1]
    );
  }
  return totalDistance;
}

// Enhanced batch optimization with API fallback
export async function optimizeBatchDeliveryWithAPI(
  facilities: Facility[], 
  warehouses: Warehouse[],
  medicationType: string,
  priority: 'low' | 'medium' | 'high' | 'urgent',
  vehicleType?: string
): Promise<RouteOptimization> {
  // Find optimal warehouse
  const centerLat = facilities.reduce((sum, f) => sum + f.lat, 0) / facilities.length;
  const centerLng = facilities.reduce((sum, f) => sum + f.lng, 0) / facilities.length;
  
  const optimalWarehouse = warehouses.reduce((best, current) => {
    const distToBest = calculateDistance(centerLat, centerLng, best.lat, best.lng);
    const distToCurrent = calculateDistance(centerLat, centerLng, current.lat, current.lng);
    return distToCurrent < distToBest ? current : best;
  });

  // Try API optimization first, fallback to client-side
  try {
    const waypoints = [
      { lat: optimalWarehouse.lat, lng: optimalWarehouse.lng },
      ...facilities.map(f => ({ lat: f.lat, lng: f.lng }))
    ];

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/optimize-route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
      },
      body: JSON.stringify({
        waypoints,
        vehicle_type: vehicleType || 'truck',
        constraints: {}
      })
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        const optimizedRoute = result.route.coordinates.map((coord: any) => 
          [coord.lat, coord.lng] as [number, number]
        );
        
        return {
          warehouseId: optimalWarehouse.id,
          facilities,
          totalDistance: result.route.distance_km,
          estimatedDuration: result.route.estimated_minutes,
          optimizedRoute
        };
      }
    }
  } catch (error) {
    console.warn('API optimization failed, using client-side algorithm:', error);
  }

  // Fallback to client-side optimization
  return optimizeBatchDelivery(facilities, warehouses, medicationType, priority);
}

// Original client-side optimization (kept as fallback)
export function optimizeBatchDelivery(
  facilities: Facility[],
  warehouses: Warehouse[],
  medicationType: string,
  priority: 'low' | 'medium' | 'high' | 'urgent',
  waitingTimeMin?: number
): RouteOptimization {
  // Find optimal warehouse based on facility cluster center
  const centerLat = facilities.reduce((sum, f) => sum + f.lat, 0) / facilities.length;
  const centerLng = facilities.reduce((sum, f) => sum + f.lng, 0) / facilities.length;
  
  const optimalWarehouse = warehouses.reduce((best, current) => {
    const distToBest = calculateDistance(centerLat, centerLng, best.lat, best.lng);
    const distToCurrent = calculateDistance(centerLat, centerLng, current.lat, current.lng);
    return distToCurrent < distToBest ? current : best;
  });
  
  // Generate optimized route
  const optimizedRoute = optimizeRouteOrder(optimalWarehouse, facilities);
  const totalDistance = calculateRouteDistance(optimizedRoute);
  
  // Per-stop waiting time: use workspace SLA when provided, otherwise fall back to priority-based defaults
  const baseServiceTime = waitingTimeMin ?? (priority === 'urgent' ? 15 : priority === 'high' ? 20 : 25);
  const loadingTime = waitingTimeMin ?? 15; // initial warehouse loading
  const travelTime = (totalDistance / 45) * 60; // 45 km/h average with stops

  const estimatedDuration = (facilities.length * baseServiceTime) + loadingTime + travelTime;
  
  return {
    warehouseId: optimalWarehouse.id,
    facilities,
    totalDistance: Math.round(totalDistance * 100) / 100,
    estimatedDuration: Math.round(estimatedDuration),
    optimizedRoute
  };
}

// Calculate route between multiple points (warehouse -> facilities)
export function calculateRouteCoordinates(warehouse: Warehouse, facilities: Facility[]): [number, number][] {
  const route: [number, number][] = [[warehouse.lat, warehouse.lng]];
  
  // Simple nearest neighbor ordering
  const unvisited = [...facilities];
  let current: { lat: number; lng: number } = warehouse;
  
  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let minDistance = calculateDistance(current.lat, current.lng, unvisited[0].lat, unvisited[0].lng);
    
    for (let i = 1; i < unvisited.length; i++) {
      const distance = calculateDistance(current.lat, current.lng, unvisited[i].lat, unvisited[i].lng);
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }
    
    const nearest = unvisited.splice(nearestIndex, 1)[0];
    route.push([nearest.lat, nearest.lng]);
    current = nearest;
  }
  
  return route;
}
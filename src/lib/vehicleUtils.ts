/**
 * Vehicle Utility Functions
 * Helper functions for vehicle-related operations
 */

/**
 * Get vehicle silhouette image path based on vehicle type
 * Maps vehicle types to their corresponding silhouette images
 *
 * Vehicle Classification System:
 * - M1: Passenger cars (sedan, suv, hatchback)
 * - M2: Large passenger vehicles (minibus, van with seats)
 * - N1: Light commercial vehicles (pickup, small truck)
 * - N2: Medium trucks
 * - N3: Heavy trucks
 * - L1: Motorcycles/mopeds
 * - L2: Three-wheelers (keke, rickshaw)
 * - BIKO_*: Custom BIKO vehicle types
 */
export function getVehicleSilhouette(vehicleType?: string | null, make?: string | null, model?: string | null): string {
  const type = vehicleType?.toLowerCase() || '';
  const makeLower = make?.toLowerCase() || '';
  const modelLower = model?.toLowerCase() || '';

  console.log('getVehicleSilhouette called:', { vehicleType, type, make, makeLower, model, modelLower });

  // Map vehicle types and category codes to silhouette files
  const typeMapping: Record<string, string> = {
    // EU Category codes (M/N/L classification)
    'm1': '/assets/vehicles/silhouettes/M1.webp',
    'm2': '/assets/vehicles/silhouettes/M2.webp',
    'n1': '/assets/vehicles/silhouettes/N1.webp',
    'n2': '/assets/vehicles/silhouettes/N2.webp',
    'n3': '/assets/vehicles/silhouettes/N3.webp',
    'l1': '/assets/vehicles/silhouettes/L1.webp',
    'l2': '/assets/vehicles/silhouettes/L2.webp',

    // BIKO taxonomy category codes (stored from onboarding wizard)
    'light_mobility': '/assets/vehicles/silhouettes/L1.webp',
    'passenger': '/assets/vehicles/silhouettes/M1.webp',
    'lcv': '/assets/vehicles/silhouettes/N1.webp',
    'heavy_truck': '/assets/vehicles/silhouettes/N3.webp',
    'specialized': '/assets/vehicles/silhouettes/BIKO_COLDCHAIN.webp',

    // BIKO taxonomy subtype codes
    'motorcycle': '/assets/vehicles/silhouettes/L1.webp',
    'scooter': '/assets/vehicles/silhouettes/L1.webp',
    'moped': '/assets/vehicles/silhouettes/BIKO_MOPED.webp',
    'three_wheeler': '/assets/vehicles/silhouettes/BIKO_KEKE.webp',
    'cargo_tricycle': '/assets/vehicles/silhouettes/BIKO_KEKE.webp',
    'sedan': '/assets/vehicles/silhouettes/M1.webp',
    'suv': '/assets/vehicles/silhouettes/M1.webp',
    'hatchback': '/assets/vehicles/silhouettes/M1.webp',
    'wagon': '/assets/vehicles/silhouettes/M1.webp',
    'minivan_mpv': '/assets/vehicles/silhouettes/BIKO_MINIVAN.webp',
    'panel_van': '/assets/vehicles/silhouettes/M2.webp',
    'minibus': '/assets/vehicles/silhouettes/BIKO_MINIVAN.webp',
    'pickup_truck': '/assets/vehicles/silhouettes/N1.webp',
    'light_box_truck': '/assets/vehicles/silhouettes/N1.webp',
    'refrigerated_van': '/assets/vehicles/silhouettes/BIKO_COLDCHAIN.webp',
    'box_truck': '/assets/vehicles/silhouettes/N2.webp',
    'flatbed_truck': '/assets/vehicles/silhouettes/N2.webp',
    'semi_trailer': '/assets/vehicles/silhouettes/N3.webp',
    'tipper_truck': '/assets/vehicles/silhouettes/N2.webp',
    'tanker_truck': '/assets/vehicles/silhouettes/N3.webp',
    'refrigerated_truck': '/assets/vehicles/silhouettes/BIKO_COLDCHAIN.webp',
    'ambulance': '/assets/vehicles/silhouettes/M2.webp',
    'mobile_clinic': '/assets/vehicles/silhouettes/M2.webp',
    'cold_chain': '/assets/vehicles/silhouettes/BIKO_COLDCHAIN.webp',

    // Generic type names (legacy / manual entry)
    'car': '/assets/vehicles/silhouettes/M1.webp',
    'cr-v': '/assets/vehicles/silhouettes/M1.webp',
    'crv': '/assets/vehicles/silhouettes/M1.webp',
    'patrol': '/assets/vehicles/silhouettes/M1.webp',
    'corolla': '/assets/vehicles/silhouettes/M1.webp',
    'camry': '/assets/vehicles/silhouettes/M1.webp',
    'van': '/assets/vehicles/silhouettes/M2.webp',
    'minivan': '/assets/vehicles/silhouettes/M2.webp',
    'bus': '/assets/vehicles/silhouettes/M2.webp',
    'hiace': '/assets/vehicles/silhouettes/M2.webp',
    'quantum': '/assets/vehicles/silhouettes/M2.webp',
    'biko_minivan': '/assets/vehicles/silhouettes/BIKO_MINIVAN.webp',
    'pickup': '/assets/vehicles/silhouettes/N1.webp',
    'light_truck': '/assets/vehicles/silhouettes/N1.webp',
    'small_truck': '/assets/vehicles/silhouettes/N1.webp',
    'hilux': '/assets/vehicles/silhouettes/N1.webp',
    'ranger': '/assets/vehicles/silhouettes/N1.webp',
    'l200': '/assets/vehicles/silhouettes/N1.webp',
    'navara': '/assets/vehicles/silhouettes/N1.webp',
    'truck': '/assets/vehicles/silhouettes/N2.webp',
    'medium_truck': '/assets/vehicles/silhouettes/N2.webp',
    'delivery_truck': '/assets/vehicles/silhouettes/N2.webp',
    'canter': '/assets/vehicles/silhouettes/N2.webp',
    'dyna': '/assets/vehicles/silhouettes/N2.webp',
    'large_truck': '/assets/vehicles/silhouettes/N3.webp',
    'lorry': '/assets/vehicles/silhouettes/N3.webp',
    'bike': '/assets/vehicles/silhouettes/L1.webp',
    'motorbike': '/assets/vehicles/silhouettes/L1.webp',
    'biko_moped': '/assets/vehicles/silhouettes/BIKO_MOPED.webp',
    'tricycle': '/assets/vehicles/silhouettes/L2.webp',
    'keke': '/assets/vehicles/silhouettes/BIKO_KEKE.webp',
    'rickshaw': '/assets/vehicles/silhouettes/BIKO_KEKE.webp',
    'biko_keke': '/assets/vehicles/silhouettes/BIKO_KEKE.webp',
    'refrigerated': '/assets/vehicles/silhouettes/BIKO_COLDCHAIN.webp',
    'biko_coldchain': '/assets/vehicles/silhouettes/BIKO_COLDCHAIN.webp',
  };

  // Try exact match first
  if (type && typeMapping[type]) {
    return typeMapping[type];
  }

  // Try partial match on vehicle type (only when type is non-empty; empty string matches every key)
  if (type) {
    for (const [key, path] of Object.entries(typeMapping)) {
      if (type.includes(key) || key.includes(type)) {
        return path;
      }
    }
  }

  // Try matching on model name (e.g., "Hilux", "Hiace", "Patrol")
  if (modelLower) {
    console.log('Checking model name matching for:', modelLower);
    for (const [key, path] of Object.entries(typeMapping)) {
      if (modelLower.includes(key) || key.includes(modelLower)) {
        console.log(`Model match found! ${modelLower} matched with ${key} -> ${path}`);
        return path;
      }
    }
    console.log('No model match found');
  }

  // Try matching on make (less reliable, but worth a shot)
  // Known SUV/Truck makes
  if (makeLower) {
    if (['toyota', 'nissan', 'mitsubishi', 'ford', 'isuzu'].includes(makeLower)) {
      // These brands are commonly trucks/pickups in fleet context
      if (modelLower.includes('truck') || modelLower.includes('pickup')) {
        return '/assets/vehicles/silhouettes/N1.webp';
      }
    }
  }

  // Default fallback to M1 (sedan)
  return '/assets/vehicles/silhouettes/M1.webp';
}

/**
 * Get vehicle type display name
 */
export function getVehicleTypeDisplayName(vehicleType: string): string {
  const displayNames: Record<string, string> = {
    'sedan': 'Sedan',
    'suv': 'SUV',
    'van': 'Van',
    'truck': 'Truck',
    'pickup': 'Pickup Truck',
    'motorcycle': 'Motorcycle',
    'keke': 'Keke (Tricycle)',
    'moped': 'Moped',
    'minivan': 'Minivan',
    'cold_chain': 'Cold Chain Vehicle',
  };

  return displayNames[vehicleType.toLowerCase()] || vehicleType;
}

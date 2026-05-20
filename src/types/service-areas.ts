export type ServiceType = 'arv' | 'epi' | 'general' | 'mixed';
export type DeliveryFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
export type ServicePriority = 'critical' | 'high' | 'standard' | 'low';

export interface ServiceArea {
  id: string;
  name: string;
  zone_id: string;
  warehouse_id: string;
  service_type: ServiceType;
  description: string | null;
  max_distance_km: number | null;
  delivery_frequency: DeliveryFrequency | null;
  priority: ServicePriority;
  sla_hours: number | null;
  is_active: boolean;
  metadata: Record<string, any>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  zones?: { id: string; name: string; code: string | null } | null;
  warehouses?: { id: string; name: string; lat: number | null; lng: number | null } | null;
  facility_count?: number;
}

export interface ServiceAreaFacility {
  id: string;
  service_area_id: string;
  facility_id: string;
  assigned_at: string;
  assigned_by: string | null;
  // Joined
  facilities?: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    type: string;
    level_of_care: string | null;
    lga: string | null;
  } | null;
}

export interface CreateServiceAreaInput {
  name: string;
  zone_id: string;
  warehouse_id: string;
  service_type: ServiceType;
  description?: string;
  max_distance_km?: number;
  delivery_frequency?: DeliveryFrequency;
  priority?: ServicePriority;
  sla_hours?: number;
  facility_ids: string[];
  metadata?: Record<string, any>;
}

export interface UpdateServiceAreaInput {
  id: string;
  name?: string;
  warehouse_id?: string;
  service_type?: ServiceType;
  description?: string;
  max_distance_km?: number;
  delivery_frequency?: DeliveryFrequency;
  priority?: ServicePriority;
  sla_hours?: number;
  is_active?: boolean;
}

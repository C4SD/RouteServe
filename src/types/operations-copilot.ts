export type CopilotWizardStep = 1 | 2 | 3 | 4 | 5;

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type ZoneStatus = 'valid' | 'overflow' | 'sparse' | 'out_of_coverage';

export type AcceptanceStatus = 'pending' | 'accepted' | 'rejected';

// ─── Constraints ────────────────────────────────────────────────────────────

export interface CopilotConstraints {
  max_radius_km: number;
  max_facilities_per_zone: number;
  max_service_areas_per_warehouse: number;
}

export const DEFAULT_COPILOT_CONSTRAINTS: CopilotConstraints = {
  max_radius_km: 30,
  max_facilities_per_zone: 12,
  max_service_areas_per_warehouse: 5,
};

// ─── Slim facility model used inside copilot ─────────────────────────────────

export interface CopilotFacility {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lga?: string;
  ward?: string;
  state?: string;
}

// ─── Slim warehouse model used inside copilot ────────────────────────────────

export interface CopilotWarehouse {
  id: string;
  name: string;
  lat: number;
  lng: number;
  code?: string;
  state?: string;
}

// ─── Generated entities ──────────────────────────────────────────────────────

export interface SuggestedPolicy {
  id: string;
  type: 'dispatch_frequency' | 'sla_window' | 'service_cadence' | 'operational_category';
  label: string;
  value: string;
}

export interface SuggestedRouteGroup {
  id: string;
  name: string;
  facilities: CopilotFacility[];
}

export interface SuggestedZone {
  id: string;
  warehouse_id: string;
  /** Auto-generated name, user may override */
  name: string;
  facilities: CopilotFacility[];
  metrics: {
    facility_count: number;
    avg_distance_km: number;
    max_distance_km: number;
  };
  confidence_score: number;
  confidence_level: ConfidenceLevel;
  status: ZoneStatus;
  acceptance: AcceptanceStatus;
  /** User-edited name override */
  user_name?: string;
}

export interface SuggestedServiceArea {
  id: string;
  warehouse_id: string;
  zone_id: string;
  name: string;
  facilities: CopilotFacility[];
  policies: SuggestedPolicy[];
  route_groups: SuggestedRouteGroup[];
  acceptance: AcceptanceStatus;
  user_name?: string;
}

// ─── Per-warehouse structure ──────────────────────────────────────────────────

export interface SuggestedOperationalStructure {
  warehouse: CopilotWarehouse;
  zones: SuggestedZone[];
  service_areas: SuggestedServiceArea[];
  out_of_coverage: CopilotFacility[];
}

// ─── Full generation result ───────────────────────────────────────────────────

export interface CopilotGenerationResult {
  structures: SuggestedOperationalStructure[];
  global_out_of_coverage: CopilotFacility[];
  generated_at: string;
  constraints: CopilotConstraints;
}

// ─── Inspector selection ──────────────────────────────────────────────────────

export type InspectorSelection =
  | { type: 'warehouse'; warehouse: CopilotWarehouse }
  | { type: 'zone'; zone: SuggestedZone; warehouse: CopilotWarehouse }
  | { type: 'facility'; facility: CopilotFacility; zone?: SuggestedZone }
  | null;

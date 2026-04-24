export type ClusteringMode = 'manual' | 'lga' | 'proximity';
export type PolicyStatus = 'active' | 'draft' | 'archived';

export interface PolicyConstraints {
  radius_km?: number;
  max_facilities_per_cluster?: number;
}

// ─── DB shapes ───────────────────────────────────────────────────────────────

export interface ServicePolicy {
  id: string;
  workspace_id: string;
  service_area_id: string;
  name: string;
  code: string | null;
  clustering_mode: ClusteringMode;
  constraints: PolicyConstraints;
  status: PolicyStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  cluster_count?: number;
  facility_count?: number;
}

export interface PolicyCluster {
  id: string;
  service_policy_id: string;
  code: string;
  name: string | null;
  facility_count: number;
  centroid_lat: number | null;
  centroid_lng: number | null;
  avg_distance_km: number | null;
  sort_order: number;
  created_at: string;
  // Joined
  facilities?: PolicyClusterFacility[];
}

export interface PolicyClusterFacility {
  id: string;
  cluster_id: string;
  facility_id: string;
  assigned_at: string;
  // Joined
  facilities?: {
    id: string;
    name: string;
    lat: number | null;
    lng: number | null;
    type: string | null;
    level_of_care: string | null;
    lga: string | null;
  } | null;
}

// ─── Client-side working types (wizard) ─────────────────────────────────────

export interface ClusterDraft {
  code: string;           // Z1, Z2, …
  facilityIds: string[];
  name?: string;
}

// ─── API input shapes ────────────────────────────────────────────────────────

export interface CreateServicePolicyInput {
  name: string;
  code?: string;
  service_area_id: string;
  clustering_mode: ClusteringMode;
  constraints: PolicyConstraints;
  clusters: Array<{
    code: string;
    name?: string;
    facility_ids: string[];
  }>;
}

// ─── Anomaly flags ───────────────────────────────────────────────────────────

export interface ClusterAnomaly {
  clusterCode: string;
  type: 'too_large' | 'outlier_facility' | 'far_centroid';
  message: string;
}

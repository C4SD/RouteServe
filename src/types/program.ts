export interface Program {
  id: string;
  name: string;
  code: string;
  description?: string;
  funding_source?: string;
  priority_tier: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  requires_cold_chain: boolean;
  sla_days?: number;
  status: 'active' | 'paused' | 'closed';
  created_at: string;
  updated_at: string;
  metrics?: ProgramMetrics;
}

export interface ProgramMetrics {
  facility_count?: number;
  active_requisitions?: number;
  active_schedules?: number;
  active_batches?: number;
  pending_batches?: number;
  stockout_count?: number;
  fulfillment_rate?: number;
  avg_delivery_time?: number;
}

export interface ProgramFormData {
  name: string;
  code: string;
  description?: string;
  funding_source?: string;
  priority_tier: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  requires_cold_chain: boolean;
  sla_days?: number;
  status: 'active' | 'paused' | 'closed';
}

export interface ProgramFilters {
  search?: string;
  status?: string;
  funding_source?: string;
  priority_tier?: string;
  skipMetrics?: boolean;
}

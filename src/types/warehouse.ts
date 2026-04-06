export interface StorageZone {
  id: string;
  name: string;
  type: 'cold' | 'ambient' | 'controlled' | 'hazardous' | 'general';
  temp_range?: string;
  capacity_m3: number;
  used_m3: number;
}

export interface NodeCapabilities {
  can_receive: boolean;
  can_dispatch: boolean;
  can_store: boolean;
}

export type StorageMode = 'active' | 'passive';

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  parent_id?: string | null;
  storage_mode: StorageMode;
  activated_at?: string | null;
  capabilities: NodeCapabilities;
  storage_conditions: string[];
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  lat?: number;
  lng?: number;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  operating_hours?: string;
  total_capacity_m3?: number;
  used_capacity_m3?: number;
  storage_zones?: StorageZone[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  children?: Warehouse[];
}

export interface WarehouseFilters {
  search?: string;
  state?: string;
  is_active?: boolean;
  parent_id?: string | null;
  can_dispatch?: boolean;
}

export interface WarehouseFormData {
  name: string;
  code: string;
  parent_id?: string | null;
  storage_mode?: StorageMode;
  capabilities?: NodeCapabilities;
  storage_conditions?: string[];
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  lat?: number;
  lng?: number;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  operating_hours?: string;
  total_capacity_m3?: number;
  storage_zones?: Omit<StorageZone, 'id'>[];
}

export interface WarehouseStats {
  total_warehouses: number;
  active_warehouses: number;
  total_capacity_m3: number;
  used_capacity_m3: number;
  utilization_pct: number;
}

// Inventory at a specific node
export interface WarehouseInventoryItem {
  id: string;
  node_id: string;
  item_id: string;
  quantity: number;
  reserved_qty: number;
  available_qty: number; // computed: quantity - reserved_qty
  item?: {
    id: string;
    description: string;
    serial_number: string;
    category: string;
    unit_pack?: string;
  };
}

// Transfer types
export type TransferStatus = 'draft' | 'in_transit' | 'completed' | 'partial' | 'cancelled';

export interface InventoryTransfer {
  id: string;
  workspace_id: string;
  transfer_number: string;
  correlation_id?: string;
  from_node_id: string;
  to_node_id: string;
  status: TransferStatus;
  initiated_by?: string;
  dispatched_at?: string;
  completed_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  items?: InventoryTransferItem[];
  from_warehouse?: Pick<Warehouse, 'id' | 'name' | 'code'>;
  to_warehouse?: Pick<Warehouse, 'id' | 'name' | 'code'>;
}

export interface InventoryTransferItem {
  id: string;
  transfer_id: string;
  item_id: string;
  quantity_sent: number;
  quantity_received: number;
  notes?: string;
  item?: {
    id: string;
    description: string;
    serial_number: string;
    category: string;
  };
}

export interface TransferFilters {
  search?: string;
  status?: TransferStatus;
  from_node_id?: string;
  to_node_id?: string;
}

// Allocation result from RPC
export interface AllocationResult {
  node_id: string;
  quantity_allocated: number;
}

export const STORAGE_ZONE_TYPES = [
  { value: 'cold', label: 'Cold Storage', color: 'bg-blue-100 text-blue-800' },
  { value: 'ambient', label: 'Ambient', color: 'bg-green-100 text-green-800' },
  { value: 'controlled', label: 'Controlled', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'hazardous', label: 'Hazardous', color: 'bg-red-100 text-red-800' },
  { value: 'general', label: 'General', color: 'bg-gray-100 text-gray-800' },
] as const;

export const STORAGE_CONDITIONS = [
  { value: 'cold_chain', label: 'Cold Chain', color: 'bg-blue-100 text-blue-800' },
  { value: 'ambient', label: 'Ambient', color: 'bg-green-100 text-green-800' },
  { value: 'hazardous', label: 'Hazardous', color: 'bg-red-100 text-red-800' },
  { value: 'quarantine', label: 'Quarantine', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'infusion', label: 'Infusion', color: 'bg-purple-100 text-purple-800' },
] as const;

export const WAREHOUSE_CAPABILITIES = [
  { key: 'can_receive' as const, label: 'Can Receive', description: 'Node can receive incoming stock' },
  { key: 'can_dispatch' as const, label: 'Can Dispatch', description: 'Node can dispatch outbound stock' },
  { key: 'can_store' as const, label: 'Can Store', description: 'Node can hold inventory' },
] as const;

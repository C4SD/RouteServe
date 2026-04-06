import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { Warehouse, WarehouseFilters, WarehouseFormData, WarehouseStats, NodeCapabilities, StorageMode } from '@/types/warehouse';
import { toast } from 'sonner';

// ========================================
// Helper Functions
// ========================================

const DEFAULT_CAPABILITIES: NodeCapabilities = {
  can_receive: true,
  can_dispatch: true,
  can_store: true,
};

function mapDbToWarehouse(dbWarehouse: any): Warehouse {
  return {
    id: dbWarehouse.id,
    name: dbWarehouse.name,
    code: dbWarehouse.code || '',
    parent_id: dbWarehouse.parent_id || null,
    storage_mode: (dbWarehouse.storage_mode as StorageMode) || 'active',
    activated_at: dbWarehouse.activated_at || null,
    capabilities: dbWarehouse.capabilities || DEFAULT_CAPABILITIES,
    storage_conditions: dbWarehouse.storage_conditions || [],
    address: dbWarehouse.address || undefined,
    city: dbWarehouse.city || undefined,
    state: dbWarehouse.state || undefined,
    country: dbWarehouse.country || undefined,
    lat: dbWarehouse.lat ? Number(dbWarehouse.lat) : undefined,
    lng: dbWarehouse.lng ? Number(dbWarehouse.lng) : undefined,
    contact_name: dbWarehouse.contact_name || undefined,
    contact_phone: dbWarehouse.contact_phone || undefined,
    contact_email: dbWarehouse.contact_email || undefined,
    operating_hours: dbWarehouse.operating_hours || undefined,
    total_capacity_m3: dbWarehouse.total_capacity_m3 ? Number(dbWarehouse.total_capacity_m3) : undefined,
    used_capacity_m3: dbWarehouse.used_capacity_m3 ? Number(dbWarehouse.used_capacity_m3) : undefined,
    storage_zones: dbWarehouse.storage_zones || [],
    is_active: dbWarehouse.is_active ?? true,
    created_at: dbWarehouse.created_at,
    updated_at: dbWarehouse.updated_at,
    created_by: dbWarehouse.created_by || undefined,
  };
}

function mapWarehouseToDb(warehouse: WarehouseFormData) {
  return {
    name: warehouse.name,
    code: warehouse.code || null,
    parent_id: warehouse.parent_id || null,
    storage_mode: warehouse.storage_mode || 'active',
    capabilities: warehouse.capabilities || DEFAULT_CAPABILITIES,
    storage_conditions: warehouse.storage_conditions || [],
    address: warehouse.address || null,
    city: warehouse.city || null,
    state: warehouse.state || null,
    country: warehouse.country || null,
    lat: warehouse.lat || null,
    lng: warehouse.lng || null,
    contact_name: warehouse.contact_name || null,
    contact_phone: warehouse.contact_phone || null,
    contact_email: warehouse.contact_email || null,
    operating_hours: warehouse.operating_hours || null,
    total_capacity_m3: warehouse.total_capacity_m3 || null,
    capacity: warehouse.total_capacity_m3 ? Math.round(warehouse.total_capacity_m3) : null, // Map to original capacity field
    storage_zones: warehouse.storage_zones || [],
    warehouse_type: 'zonal', // Add default warehouse_type
  };
}

// Build warehouse tree from flat list
function buildWarehouseTree(warehouses: Warehouse[]): Warehouse[] {
  const map = new Map<string, Warehouse>();
  const roots: Warehouse[] = [];

  // First pass: index all warehouses
  for (const w of warehouses) {
    map.set(w.id, { ...w, children: [] });
  }

  // Second pass: build parent-child relationships
  for (const w of map.values()) {
    if (w.parent_id && map.has(w.parent_id)) {
      map.get(w.parent_id)!.children!.push(w);
    } else {
      roots.push(w);
    }
  }

  return roots;
}

// Get all descendants of a warehouse (for cycle prevention in selectors)
function getDescendantIds(warehouse: Warehouse): Set<string> {
  const ids = new Set<string>();
  function walk(node: Warehouse) {
    ids.add(node.id);
    for (const child of node.children || []) {
      walk(child);
    }
  }
  walk(warehouse);
  return ids;
}

export { buildWarehouseTree, getDescendantIds };

// ========================================
// Core CRUD Hooks
// ========================================

export function useWarehouses(filters?: WarehouseFilters, page?: number, pageSize: number = 50) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['warehouses', workspaceId, filters, page, pageSize],
    enabled: !!workspaceId,
    staleTime: 30000,
    gcTime: 300000,
    queryFn: async () => {
      let query = supabase
        .from('warehouses')
        .select('*', { count: 'exact' })
        .eq('workspace_id', workspaceId!)
        .order('name');

      // Apply filters
      if (filters?.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,code.ilike.%${filters.search}%,address.ilike.%${filters.search}%`
        );
      }

      if (filters?.state) {
        query = query.eq('state', filters.state);
      }

      if (filters?.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }

      if (filters?.parent_id !== undefined) {
        if (filters.parent_id === null) {
          query = query.is('parent_id', null);
        } else {
          query = query.eq('parent_id', filters.parent_id);
        }
      }

      if (filters?.can_dispatch) {
        query = query.contains('capabilities', { can_dispatch: true });
      }

      // Pagination
      if (page !== undefined && pageSize) {
        const from = page * pageSize;
        query = query.range(from, from + pageSize - 1);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        warehouses: (data || []).map(mapDbToWarehouse),
        total: count || 0,
      };
    },
  });
}

export function useWarehouse(id: string | undefined) {
  return useQuery({
    queryKey: ['warehouses', id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data ? mapDbToWarehouse(data) : null;
    },
  });
}

// Fetch all warehouses and build tree structure
export function useWarehouseTree() {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['warehouses', 'tree', workspaceId],
    enabled: !!workspaceId,
    staleTime: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('workspace_id', workspaceId!)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const warehouses = (data || []).map(mapDbToWarehouse);
      return buildWarehouseTree(warehouses);
    },
  });
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (warehouse: WarehouseFormData) => {
      const { data, error } = await supabase
        .from('warehouses')
        .insert({ ...mapWarehouseToDb(warehouse), workspace_id: workspaceId })
        .select()
        .single();

      if (error) throw error;
      return mapDbToWarehouse(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Warehouse created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create warehouse: ${error.message}`);
    },
  });
}

export function useUpdateWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WarehouseFormData> }) => {
      const { data: updated, error } = await supabase
        .from('warehouses')
        .update({
          ...mapWarehouseToDb(data as WarehouseFormData),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return mapDbToWarehouse(updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Warehouse updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update warehouse: ${error.message}`);
    },
  });
}

export function useDeleteWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('warehouses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Warehouse deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete warehouse: ${error.message}`);
    },
  });
}

// ========================================
// Stats Hook
// ========================================

export function useWarehousesStats(): { data: WarehouseStats | undefined; isLoading: boolean } {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['warehouses', 'stats', workspaceId],
    enabled: !!workspaceId,
    queryFn: async (): Promise<WarehouseStats> => {
      const { data, error, count } = await supabase
        .from('warehouses')
        .select('is_active, total_capacity_m3, used_capacity_m3', { count: 'exact' })
        .eq('workspace_id', workspaceId!);

      if (error) throw error;

      const warehouses = data || [];
      const active = warehouses.filter(w => w.is_active).length;
      const totalCapacity = warehouses.reduce((sum, w) => sum + (Number(w.total_capacity_m3) || 0), 0);
      const usedCapacity = warehouses.reduce((sum, w) => sum + (Number(w.used_capacity_m3) || 0), 0);

      return {
        total_warehouses: count || 0,
        active_warehouses: active,
        total_capacity_m3: totalCapacity,
        used_capacity_m3: usedCapacity,
        utilization_pct: totalCapacity > 0 ? (usedCapacity / totalCapacity) * 100 : 0,
      };
    },
  });
}

// ========================================
// Storage Mode Mutations
// ========================================

export function useActivateWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (warehouseId: string) => {
      const { error } = await supabase.rpc('activate_warehouse', { p_warehouse_id: warehouseId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Storage activated — this node can now hold inventory');
    },
    onError: (error: Error) => {
      toast.error(`Failed to activate storage: ${error.message}`);
    },
  });
}

export function useDeactivateWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (warehouseId: string) => {
      const { error } = await supabase.rpc('deactivate_warehouse', { p_warehouse_id: warehouseId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Storage deactivated — this node is now structural only');
    },
    onError: (error: Error) => {
      toast.error(`Failed to deactivate storage: ${error.message}`);
    },
  });
}

// ========================================
// Warehouse Inventory Hook (legacy - items table)
// ========================================

export function useWarehouseInventory(warehouseId: string | undefined) {
  return useQuery({
    queryKey: ['warehouses', warehouseId, 'inventory'],
    enabled: !!warehouseId,
    queryFn: async () => {
      if (!warehouseId) return { items: [], total: 0 };

      const { data, error, count } = await supabase
        .from('items')
        .select('*', { count: 'exact' })
        .eq('warehouse_id', warehouseId)
        .order('description');

      if (error) throw error;

      return {
        items: data || [],
        total: count || 0,
      };
    },
  });
}

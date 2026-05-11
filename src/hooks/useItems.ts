import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { Item, ItemFilters, ItemFormData, ItemAnalytics, ItemShipmentHistory } from '@/types/items';
import { ITEM_CATEGORIES } from '@/types/items';
import { toast } from 'sonner';

// ========================================
// Helper Functions
// ========================================

function mapDbToItem(dbItem: any): Item {
  return {
    id: dbItem.id,
    product_code: dbItem.product_code || dbItem.serial_number || '',
    item_name: dbItem.item_name || dbItem.description || '',
    unit_pack: dbItem.unit_pack || '',
    category: dbItem.category,
    program: dbItem.program || undefined,
    weight_kg: dbItem.weight_kg ? Number(dbItem.weight_kg) : undefined,
    volume_m3: dbItem.volume_m3 ? Number(dbItem.volume_m3) : undefined,
    is_active: dbItem.is_active !== undefined ? dbItem.is_active : true,
    // Legacy fields for backward compatibility
    serial_number: dbItem.serial_number || undefined,
    description: dbItem.description || undefined,
    batch_number: dbItem.batch_number || undefined,
    mfg_date: dbItem.mfg_date || undefined,
    expiry_date: dbItem.expiry_date || undefined,
    store_address: dbItem.store_address || undefined,
    lot_number: dbItem.lot_number || undefined,
    stock_on_hand: dbItem.stock_on_hand || 0,
    unit_price: Number(dbItem.unit_price) || 0,
    total_price: (dbItem.stock_on_hand || 0) * (Number(dbItem.unit_price) || 0),
    warehouse_id: dbItem.warehouse_id || undefined,
    created_at: dbItem.created_at,
    updated_at: dbItem.updated_at,
    created_by: dbItem.created_by || undefined,
    warehouse: dbItem.warehouses ? {
      id: dbItem.warehouses.id,
      name: dbItem.warehouses.name,
      code: dbItem.warehouses.code,
    } : undefined,
  };
}

function mapItemToDb(item: ItemFormData) {
  return {
    serial_number: item.serial_number || item.product_code,
    description: item.description || item.item_name,
    unit_pack: item.unit_pack || null,
    category: item.category,
    program: item.program || null,
    weight_kg: item.weight_kg || null,
    volume_m3: item.volume_m3 || null,
    batch_number: item.batch_number || null,
    mfg_date: item.mfg_date || null,
    expiry_date: item.expiry_date || null,
    store_address: item.store_address || null,
    lot_number: item.lot_number || null,
    stock_on_hand: item.stock_on_hand || 0,
    unit_price: item.unit_price || 0,
    warehouse_id: item.warehouse_id || null,
  };
}

// ========================================
// Core CRUD Hooks
// ========================================

export function useItems(filters?: ItemFilters, page?: number, pageSize: number = 50) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['items', workspaceId, filters, page, pageSize],
    enabled: !!workspaceId,
    staleTime: 30000,
    gcTime: 300000,
    queryFn: async () => {
      let query = supabase
        .from('items')
        .select('*, warehouses(id, name, code)', { count: 'exact' })
        .eq('workspace_id', workspaceId!)
        .order('description');

      // Apply filters
      if (filters?.search) {
        query = query.or(
          `description.ilike.%${filters.search}%,serial_number.ilike.%${filters.search}%,batch_number.ilike.%${filters.search}%`
        );
      }

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      if (filters?.program) {
        query = query.eq('program', filters.program);
      }

      if (filters?.warehouse_id) {
        query = query.eq('warehouse_id', filters.warehouse_id);
      }

      if (filters?.expiry_before) {
        query = query.lte('expiry_date', filters.expiry_before);
      }

      if (filters?.expiry_after) {
        query = query.gte('expiry_date', filters.expiry_after);
      }

      if (filters?.low_stock) {
        query = query.lte('stock_on_hand', 10).gt('stock_on_hand', 0);
      }

      if (filters?.out_of_stock) {
        query = query.eq('stock_on_hand', 0);
      }

      if (filters?.min_stock !== undefined) {
        query = query.gte('stock_on_hand', filters.min_stock);
      }

      if (filters?.max_stock !== undefined) {
        query = query.lte('stock_on_hand', filters.max_stock);
      }

      // Expiry filters
      if (filters?.expiring_soon) {
        const now = new Date().toISOString().split('T')[0];
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];
        query = query.gt('expiry_date', now).lte('expiry_date', thirtyDaysStr);
      }

      if (filters?.expired) {
        const now = new Date().toISOString().split('T')[0];
        query = query.lte('expiry_date', now);
      }

      // Pagination
      if (page !== undefined && pageSize) {
        const from = page * pageSize;
        query = query.range(from, from + pageSize - 1);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        items: (data || []).map(mapDbToItem),
        total: count || 0,
      };
    },
  });
}

export function useItem(id: string | undefined) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['items', id, workspaceId],
    enabled: !!id && !!workspaceId,
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('items')
        .select('*, warehouses(id, name, code)')
        .eq('id', id)
        .eq('workspace_id', workspaceId!)
        .single();

      if (error) throw error;
      return data ? mapDbToItem(data) : null;
    },
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (item: ItemFormData) => {
      if (!workspaceId) throw new Error('No active workspace selected');

      const { data, error } = await supabase
        .from('items')
        .insert({ ...mapItemToDb(item), workspace_id: workspaceId })
        .select()
        .single();

      if (error) throw error;
      return mapDbToItem(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Item created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create item: ${error.message}`);
    },
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ItemFormData> }) => {
      const { data: updated, error } = await supabase
        .from('items')
        .update(mapItemToDb(data as ItemFormData))
        .eq('id', id)
        .eq('workspace_id', workspaceId!)
        .select()
        .single();

      if (error) throw error;
      return mapDbToItem(updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Item updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update item: ${error.message}`);
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('items').delete().eq('id', id).eq('workspace_id', workspaceId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Item deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete item: ${error.message}`);
    },
  });
}

export function useBulkCreateItems() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (items: ItemFormData[]) => {
      if (!workspaceId) throw new Error('No active workspace selected');

      const dbItems = items.map(item => ({ ...mapItemToDb(item), workspace_id: workspaceId }));

      const { data, error } = await supabase
        .from('items')
        .insert(dbItems)
        .select();

      if (error) throw error;
      return (data || []).map(mapDbToItem);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['items-for-diff'] });
      toast.success(`Successfully uploaded ${data.length} items`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload items: ${error.message}`);
    },
  });
}

// ========================================
// Analytics & History Hooks
// ========================================

export function useItemAnalytics(itemId: string | undefined) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['items', itemId, 'analytics', workspaceId],
    enabled: !!itemId && !!workspaceId,
    queryFn: async (): Promise<ItemAnalytics | null> => {
      if (!itemId) return null;

      // For now, return mock analytics until we have actual shipment data
      const { data: item } = await supabase
        .from('items')
        .select('*')
        .eq('id', itemId)
        .eq('workspace_id', workspaceId!)
        .single();

      if (!item) return null;

      const daysUntilExpiry = item.expiry_date
        ? Math.ceil((new Date(item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : undefined;

      return {
        item_id: itemId,
        total_shipments: 0,
        total_quantity_shipped: 0,
        last_shipment_date: undefined,
        average_monthly_usage: 0,
        stock_turnover_rate: 0,
        days_until_expiry: daysUntilExpiry,
      };
    },
  });
}

export function useItemShipmentHistory(itemId: string | undefined) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ['items', itemId, workspaceId, 'shipments'],
    enabled: !!itemId && !!workspaceId,
    queryFn: async (): Promise<ItemShipmentHistory[]> => {
      if (!itemId) return [];

      // Once we have invoice_line_items table, we can query actual shipments
      // For now, return empty array
      return [];
    },
  });
}

// ========================================
// Utility Hooks
// ========================================

export function useItemCategories() {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['items', 'categories', workspaceId],
    enabled: !!workspaceId,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('category')
        .eq('workspace_id', workspaceId!)
        .order('category');

      if (error) throw error;

      // Get unique categories from existing items
      const existingCategories = [...new Set((data || []).map(d => d.category))].filter(Boolean);
      
      // If no items exist, return the default categories from the constant
      if (existingCategories.length === 0) {
        return ITEM_CATEGORIES;
      }
      
      return existingCategories;
    },
    // Fallback to default categories if query fails
    retry: 1,
    retryDelay: 1000,
  });
}

export function useItemsStats() {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['items', 'stats', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: false })
        .eq('workspace_id', workspaceId!);

      if (error) throw error;

      const items = data || [];
      const totalValue = items.reduce((sum, item) => {
        return sum + (item.stock_on_hand || 0) * (Number(item.unit_price) || 0);
      }, 0);

      const lowStockCount = items.filter(item => (item.stock_on_hand || 0) <= 10).length;

      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const expiringCount = items.filter(item => {
        if (!item.expiry_date) return false;
        const expiryDate = new Date(item.expiry_date);
        return expiryDate <= thirtyDaysFromNow && expiryDate > now;
      }).length;

      return {
        total_items: count || 0,
        total_value: totalValue,
        low_stock_count: lowStockCount,
        expiring_soon_count: expiringCount,
      };
    },
  });
}

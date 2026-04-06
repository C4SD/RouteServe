import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { InventoryTransfer, InventoryTransferItem, TransferFilters } from '@/types/warehouse';
import { toast } from 'sonner';

// ========================================
// Helper
// ========================================

function mapDbToTransfer(row: any): InventoryTransfer {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    transfer_number: row.transfer_number,
    correlation_id: row.correlation_id || undefined,
    from_node_id: row.from_node_id,
    to_node_id: row.to_node_id,
    status: row.status,
    initiated_by: row.initiated_by || undefined,
    dispatched_at: row.dispatched_at || undefined,
    completed_at: row.completed_at || undefined,
    notes: row.notes || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    from_warehouse: row.from_warehouse || undefined,
    to_warehouse: row.to_warehouse || undefined,
    items: row.inventory_transfer_items?.map((item: any) => ({
      id: item.id,
      transfer_id: item.transfer_id,
      item_id: item.item_id,
      quantity_sent: item.quantity_sent,
      quantity_received: item.quantity_received,
      notes: item.notes || undefined,
      item: item.items || undefined,
    })) || undefined,
  };
}

// ========================================
// List Transfers
// ========================================

export function useInventoryTransfers(filters?: TransferFilters, page?: number, pageSize: number = 50) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['inventory-transfers', workspaceId, filters, page, pageSize],
    enabled: !!workspaceId,
    staleTime: 15000,
    queryFn: async () => {
      let query = supabase
        .from('inventory_transfers')
        .select(`
          *,
          from_warehouse:from_node_id (id, name, code),
          to_warehouse:to_node_id (id, name, code)
        `, { count: 'exact' })
        .eq('workspace_id', workspaceId!)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.from_node_id) {
        query = query.eq('from_node_id', filters.from_node_id);
      }

      if (filters?.to_node_id) {
        query = query.eq('to_node_id', filters.to_node_id);
      }

      if (filters?.search) {
        query = query.ilike('transfer_number', `%${filters.search}%`);
      }

      if (page !== undefined && pageSize) {
        const from = page * pageSize;
        query = query.range(from, from + pageSize - 1);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        transfers: (data || []).map(mapDbToTransfer),
        total: count || 0,
      };
    },
  });
}

// ========================================
// Single Transfer with Items
// ========================================

export function useInventoryTransfer(id: string | undefined) {
  return useQuery({
    queryKey: ['inventory-transfers', id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('inventory_transfers')
        .select(`
          *,
          from_warehouse:from_node_id (id, name, code),
          to_warehouse:to_node_id (id, name, code),
          inventory_transfer_items (
            id,
            transfer_id,
            item_id,
            quantity_sent,
            quantity_received,
            notes,
            items:item_id (id, description, serial_number, category)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data ? mapDbToTransfer(data) : null;
    },
  });
}

// ========================================
// Create Transfer (draft)
// ========================================

export function useCreateTransfer() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      fromNodeId,
      toNodeId,
      notes,
      items,
    }: {
      fromNodeId: string;
      toNodeId: string;
      notes?: string;
      items: { item_id: string; quantity_sent: number; notes?: string }[];
    }) => {
      // Generate transfer number
      const transferNumber = `TRF-${Date.now().toString(36).toUpperCase()}`;

      // Insert transfer
      const { data: transfer, error: transferError } = await supabase
        .from('inventory_transfers')
        .insert({
          workspace_id: workspaceId!,
          transfer_number: transferNumber,
          from_node_id: fromNodeId,
          to_node_id: toNodeId,
          status: 'draft',
          initiated_by: (await supabase.auth.getUser()).data.user?.id,
          notes: notes || null,
        })
        .select()
        .single();

      if (transferError) throw transferError;

      // Insert transfer items
      const transferItems = items.map(item => ({
        transfer_id: transfer.id,
        item_id: item.item_id,
        quantity_sent: item.quantity_sent,
        notes: item.notes || null,
      }));

      const { error: itemsError } = await supabase
        .from('inventory_transfer_items')
        .insert(transferItems);

      if (itemsError) throw itemsError;

      return transfer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] });
      toast.success('Transfer created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create transfer: ${error.message}`);
    },
  });
}

// ========================================
// Dispatch Transfer (RPC)
// ========================================

export function useDispatchTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transferId: string) => {
      const { data, error } = await supabase.rpc('dispatch_transfer', {
        p_transfer_id: transferId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-inventory'] });
      toast.success('Transfer dispatched');
    },
    onError: (error: Error) => {
      toast.error(`Dispatch failed: ${error.message}`);
    },
  });
}

// ========================================
// Receive Transfer (RPC)
// ========================================

export function useReceiveTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transferId,
      items,
    }: {
      transferId: string;
      items: { item_id: string; quantity_received: number }[];
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('receive_transfer', {
        p_transfer_id: transferId,
        p_items: items,
      });

      if (error) throw error;
      return data as string;
    },
    onSuccess: (_data, _variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-inventory'] });
      toast.success('Transfer received');
    },
    onError: (error: Error) => {
      toast.error(`Receive failed: ${error.message}`);
    },
  });
}

// ========================================
// Cancel Transfer
// ========================================

export function useCancelTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transferId: string) => {
      const { error } = await supabase
        .from('inventory_transfers')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', transferId)
        .eq('status', 'draft'); // Can only cancel drafts

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] });
      toast.success('Transfer cancelled');
    },
    onError: (error: Error) => {
      toast.error(`Failed to cancel transfer: ${error.message}`);
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { WarehouseInventoryItem, AllocationResult } from '@/types/warehouse';
import { toast } from 'sonner';

// ========================================
// Node Inventory Hook
// ========================================

export function useNodeInventory(nodeId: string | undefined) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['warehouse-inventory', nodeId, workspaceId],
    enabled: !!nodeId && !!workspaceId,
    staleTime: 15000,
    queryFn: async (): Promise<WarehouseInventoryItem[]> => {
      if (!nodeId) return [];

      const { data, error } = await supabase
        .from('warehouse_inventory')
        .select(`
          id,
          node_id,
          item_id,
          quantity,
          reserved_qty,
          items:item_id (
            id,
            description,
            serial_number,
            category,
            unit_pack
          )
        `)
        .eq('node_id', nodeId)
        .eq('workspace_id', workspaceId!)
        .order('quantity', { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        node_id: row.node_id,
        item_id: row.item_id,
        quantity: row.quantity,
        reserved_qty: row.reserved_qty,
        available_qty: row.quantity - row.reserved_qty,
        item: row.items || undefined,
      }));
    },
  });
}

// ========================================
// Allocate Inventory (RPC)
// ========================================

export function useAllocateInventory() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      nodeId,
      itemId,
      quantity,
    }: {
      nodeId: string;
      itemId: string;
      quantity: number;
    }): Promise<AllocationResult[]> => {
      const { data, error } = await supabase.rpc('allocate_inventory', {
        p_workspace_id: workspaceId!,
        p_node_id: nodeId,
        p_item_id: itemId,
        p_quantity: quantity,
      });

      if (error) throw error;
      return data as AllocationResult[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-inventory'] });
      toast.success('Inventory allocated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Allocation failed: ${error.message}`);
    },
  });
}

// ========================================
// Release Reservation (RPC)
// ========================================

export function useReleaseReservation() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      nodeId,
      itemId,
      quantity,
    }: {
      nodeId: string;
      itemId: string;
      quantity: number;
    }) => {
      const { data, error } = await supabase.rpc('release_reservation', {
        p_workspace_id: workspaceId!,
        p_node_id: nodeId,
        p_item_id: itemId,
        p_quantity: quantity,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-inventory'] });
      toast.success('Reservation released');
    },
    onError: (error: Error) => {
      toast.error(`Failed to release reservation: ${error.message}`);
    },
  });
}

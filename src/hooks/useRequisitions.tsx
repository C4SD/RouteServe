import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Requisition, CreateRequisitionData, RequisitionStatus } from '@/types/requisitions';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function useRequisitions(status?: RequisitionStatus) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['requisitions', workspaceId, status],
    enabled: !!workspaceId,
    queryFn: async () => {
      let query = supabase
        .from('requisitions')
        .select('*')
        .eq('workspace_id', workspaceId!)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Fetch facilities, warehouses, and item counts separately
      const requisitions = data || [];
      const facilityIds = [...new Set(requisitions.map(r => r.facility_id))];
      const warehouseIds = [...new Set(requisitions.map(r => r.warehouse_id))];
      const requisitionIds = requisitions.map(r => r.id);

      const [facilitiesData, warehousesData, itemsData] = await Promise.all([
        supabase.from('facilities').select('id, name, address').in('id', facilityIds.length > 0 ? facilityIds : ['']),
        supabase.from('warehouses').select('id, name').in('id', warehouseIds.length > 0 ? warehouseIds : ['']),
        supabase.from('requisition_items').select('requisition_id').in('requisition_id', requisitionIds.length > 0 ? requisitionIds : ['']),
      ]);

      const facilitiesMap = new Map(facilitiesData.data?.map(f => [f.id, f]));
      const warehousesMap = new Map(warehousesData.data?.map(w => [w.id, w]));

      // Count items per requisition
      const itemCountMap = new Map<string, number>();
      itemsData.data?.forEach(item => {
        itemCountMap.set(item.requisition_id, (itemCountMap.get(item.requisition_id) || 0) + 1);
      });

      return requisitions.map(req => ({
        ...req,
        facility: facilitiesMap.get(req.facility_id),
        warehouse: warehousesMap.get(req.warehouse_id),
        item_count: itemCountMap.get(req.id) || 0,
      })) as Requisition[];
    }
  });
}

export function useRequisition(id: string) {
  return useQuery({
    queryKey: ['requisition', id],
    queryFn: async () => {
      const [reqData, itemsData] = await Promise.all([
        supabase.from('requisitions').select('*').eq('id', id).single(),
        supabase.from('requisition_items').select('*').eq('requisition_id', id)
      ]);

      if (reqData.error) throw reqData.error;

      const requisition = reqData.data;
      
      // Fetch facility and warehouse
      const [facilityData, warehouseData] = await Promise.all([
        supabase.from('facilities').select('id, name, address').eq('id', requisition.facility_id).single(),
        supabase.from('warehouses').select('id, name').eq('id', requisition.warehouse_id).single()
      ]);

      return {
        ...requisition,
        facility: facilityData.data,
        warehouse: warehouseData.data,
        items: itemsData.data || []
      } as Requisition;
    },
    enabled: !!id
  });
}

export function useCreateRequisition() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (data: CreateRequisitionData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      if (!workspaceId) throw new Error('No workspace selected');

      // Generate requisition number
      const reqNumber = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Create requisition
      const { data: requisition, error: reqError } = await supabase
        .from('requisitions')
        .insert({
          requisition_number: reqNumber,
          facility_id: data.facility_id,
          warehouse_id: data.warehouse_id,
          requested_by: user.id,
          priority: data.priority,
          requested_delivery_date: data.requested_delivery_date,
          notes: data.notes,
          status: 'pending',
          workspace_id: workspaceId
        })
        .select()
        .single();

      if (reqError) throw reqError;

      // Create requisition items
      if (data.items.length > 0) {
        const items = data.items.map(item => ({
          ...item,
          requisition_id: requisition.id
        }));

        const { error: itemsError } = await supabase
          .from('requisition_items')
          .insert(items);

        if (itemsError) throw itemsError;
      }

      return requisition;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisitions'] });
      toast.success('Requisition created successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to create requisition: ' + error.message);
    }
  });
}

export function useUpdateRequisitionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      rejection_reason 
    }: { 
      id: string; 
      status: RequisitionStatus; 
      rejection_reason?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const updates: Record<string, unknown> = { status };

      if (status === 'approved') {
        updates.approved_by = user.id;
        updates.approved_at = new Date().toISOString();
      } else if (status === 'rejected') {
        updates.rejection_reason = rejection_reason;
      } else if (status === 'fulfilled') {
        updates.fulfilled_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('requisitions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisitions'] });
      toast.success('Requisition status updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update requisition: ' + error.message);
    }
  });
}

export function useDeleteRequisition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('requisitions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisitions'] });
      toast.success('Requisition deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete requisition: ' + error.message);
    }
  });
}

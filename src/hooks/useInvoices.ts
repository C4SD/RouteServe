import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Invoice, InvoiceFilters, InvoiceFormData, InvoiceStatus } from '@/types/invoice';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';

// ========================================
// Helper Functions
// ========================================

function mapDbToInvoice(dbInvoice: any, items?: any[]): Invoice {
  return {
    id: dbInvoice.id,
    invoice_number: dbInvoice.invoice_number,
    ref_number: dbInvoice.ref_number || undefined,
    requisition_id: dbInvoice.requisition_id || undefined,
    program: dbInvoice.program || undefined,
    warehouse_id: dbInvoice.warehouse_id,
    facility_id: dbInvoice.facility_id,
    status: dbInvoice.status || 'draft',
    total_weight_kg: dbInvoice.total_weight_kg ? Number(dbInvoice.total_weight_kg) : undefined,
    total_volume_m3: dbInvoice.total_volume_m3 ? Number(dbInvoice.total_volume_m3) : undefined,
    total_price: Number(dbInvoice.total_price) || 0,
    packaging_required: dbInvoice.packaging_required || false,
    notes: dbInvoice.notes || undefined,
    created_at: dbInvoice.created_at,
    updated_at: dbInvoice.updated_at,
    created_by: dbInvoice.created_by || undefined,
    warehouse: dbInvoice.warehouses ? {
      id: dbInvoice.warehouses.id,
      name: dbInvoice.warehouses.name,
    } : undefined,
    facility: dbInvoice.facilities ? {
      id: dbInvoice.facilities.id,
      name: dbInvoice.facilities.name,
      address: dbInvoice.facilities.address,
      lga: dbInvoice.facilities.lga,
    } : undefined,
    items: items || [],
  };
}

function generateInvoiceNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${year}${month}-${random}`;
}

// ========================================
// Core CRUD Hooks
// ========================================

export function useInvoices(filters?: InvoiceFilters, page?: number, pageSize: number = 50) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['invoices', workspaceId, filters, page, pageSize],
    staleTime: 30000,
    gcTime: 300000,
    enabled: !!workspaceId,
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select('*, warehouses(id, name), facilities(id, name, address, lga)', { count: 'exact' })
        .eq('workspace_id', workspaceId!)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.search) {
        query = query.or(
          `invoice_number.ilike.%${filters.search}%,ref_number.ilike.%${filters.search}%`
        );
      }

      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      if (filters?.warehouse_id) {
        query = query.eq('warehouse_id', filters.warehouse_id);
      }

      if (filters?.facility_id) {
        query = query.eq('facility_id', filters.facility_id);
      }

      if (filters?.program) {
        query = query.eq('program', filters.program);
      }

      if (filters?.date_from) {
        query = query.gte('created_at', filters.date_from);
      }

      if (filters?.date_to) {
        query = query.lte('created_at', filters.date_to);
      }

      // Pagination
      if (page !== undefined && pageSize) {
        const from = page * pageSize;
        query = query.range(from, from + pageSize - 1);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        invoices: (data || []).map(invoice => mapDbToInvoice(invoice)),
        total: count || 0,
      };
    },
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ['invoices', id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null;

      const [invoiceData, itemsData] = await Promise.all([
        supabase
          .from('invoices')
          .select('*, warehouses(id, name), facilities(id, name, address, lga)')
          .eq('id', id)
          .single(),
        supabase
          .from('invoice_line_items')
          .select('*')
          .eq('invoice_id', id)
      ]);

      if (invoiceData.error) throw invoiceData.error;

      return mapDbToInvoice(invoiceData.data, itemsData.data || []);
    },
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      if (!workspaceId) throw new Error('No workspace selected');

      const invoiceData = {
        invoice_number: data.invoice_number || generateInvoiceNumber(),
        ref_number: data.ref_number || null,
        requisition_id: data.requisition_id || null,
        program: data.program || null,
        warehouse_id: data.warehouse_id,
        facility_id: data.facility_id,
        status: 'draft' as InvoiceStatus,
        total_price: data.items.reduce((sum, item) => sum + item.total_price, 0),
        notes: data.notes || null,
        workspace_id: workspaceId,
      };

      const { data: invoice, error } = await supabase
        .from('invoices')
        .insert(invoiceData)
        .select()
        .single();

      if (error) throw error;

      // Insert line items if provided
      if (data.items.length > 0) {
        const lineItems = data.items.map(item => ({
          invoice_id: invoice.id,
          item_id: item.item_id || null,
          serial_number: item.serial_number || null,
          description: item.description,
          unit_pack: item.unit_pack || null,
          category: item.category || null,
          weight_kg: item.weight_kg || null,
          volume_m3: item.volume_m3 || null,
          batch_number: item.batch_number || null,
          mfg_date: item.mfg_date || null,
          expiry_date: item.expiry_date || null,
          unit_price: item.unit_price,
          quantity: item.quantity,
          total_price: item.total_price,
        }));

        const { error: itemsError } = await supabase
          .from('invoice_line_items')
          .insert(lineItems);

        if (itemsError) throw itemsError;
      }

      return mapDbToInvoice(invoice);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create invoice: ${error.message}`);
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Invoice> }) => {
      const { data: updated, error } = await supabase
        .from('invoices')
        .update({
          ref_number: data.ref_number,
          status: data.status,
          total_weight_kg: data.total_weight_kg,
          total_volume_m3: data.total_volume_m3,
          total_price: data.total_price,
          packaging_required: data.packaging_required,
          notes: data.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return mapDbToInvoice(updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update invoice: ${error.message}`);
    },
  });
}

export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: InvoiceStatus }) => {
      const { data: updated, error } = await supabase
        .from('invoices')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return mapDbToInvoice(updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice status updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete invoice: ${error.message}`);
    },
  });
}

// ========================================
// Stats Hook
// ========================================

export function useInvoicesStats() {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['invoices', 'stats', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('invoices')
        .select('status, total_price', { count: 'exact' })
        .eq('workspace_id', workspaceId!);

      if (error) throw error;

      const invoices = data || [];
      const statusCounts = invoices.reduce((acc, inv) => {
        acc[inv.status] = (acc[inv.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const totalValue = invoices.reduce((sum, inv) => sum + (Number(inv.total_price) || 0), 0);

      return {
        total_invoices: count || 0,
        total_value: totalValue,
        by_status: statusCounts,
        draft_count: statusCounts['draft'] || 0,
        ready_count: statusCounts['ready'] || 0,
        dispatched_count: statusCounts['dispatched'] || 0,
        completed_count: statusCounts['completed'] || 0,
      };
    },
  });
}

// ========================================
// Ready Requisitions Hook (for Ready Request mode)
// ========================================

export function useInvoiceByRequisitionId(requisitionId: string | undefined) {
  return useQuery({
    queryKey: ['invoices', 'by-requisition', requisitionId],
    enabled: !!requisitionId,
    queryFn: async () => {
      if (!requisitionId) return null;
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, status')
        .eq('requisition_id', requisitionId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// ========================================
// Ready Requisitions Hook (for Ready Request mode)
// ========================================

export function useReadyRequisitions() {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['requisitions', 'ready', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data: requisitions, error } = await supabase
        .from('requisitions')
        .select('*')
        .eq('workspace_id', workspaceId!)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!requisitions?.length) return [];

      // Fetch facilities separately (no FK relationship on requisitions table)
      const facilityIds = [...new Set(requisitions.map(r => r.facility_id))];
      const { data: facilities } = await supabase
        .from('facilities')
        .select('id, name, address, lga')
        .in('id', facilityIds);

      const facilitiesMap = new Map(facilities?.map(f => [f.id, f]));

      return requisitions.map(req => ({
        ...req,
        facility: facilitiesMap.get(req.facility_id) || null,
      }));
    },
  });
}

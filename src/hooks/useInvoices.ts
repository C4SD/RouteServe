import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Invoice, InvoiceFilters, InvoiceFormData, InvoiceStatus } from '@/types/invoice';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';

// ========================================
// Helper Functions
// ========================================

function mapDbToInvoice(dbInvoice: any, items?: any[]): Invoice {
  const pkgRow = Array.isArray(dbInvoice.invoice_packaging)
    ? dbInvoice.invoice_packaging[0]
    : dbInvoice.invoice_packaging;

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
    packaging: pkgRow ? {
      id: pkgRow.id,
      invoice_id: pkgRow.invoice_id,
      packaging_mode: pkgRow.packaging_mode,
      total_packages: pkgRow.total_packages,
      packages: pkgRow.package_items || [],
      created_at: pkgRow.created_at,
    } : undefined,
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
        .select('*, warehouses(id, name), facilities(id, name, address, lga), invoice_packaging(*, package_items(*))', { count: 'exact' })
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
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['invoices', id, workspaceId],
    enabled: !!id && !!workspaceId,
    queryFn: async () => {
      if (!id || !workspaceId) return null;

      const [invoiceData, itemsData] = await Promise.all([
        supabase
          .from('invoices')
          .select('*, warehouses(id, name), facilities(id, name, address, lga), invoice_packaging(*, package_items(*))')
          .eq('id', id)
          .eq('workspace_id', workspaceId)
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
  const { workspaceId } = useWorkspace();

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
        .eq('workspace_id', workspaceId!)
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

export function useFullUpdateInvoice() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: InvoiceFormData }) => {
      const totalPrice = formData.items.reduce((sum, item) => sum + item.total_price, 0);
      const totalWeight = formData.items.reduce((sum, item) => sum + (item.weight_kg || 0), 0) || null;
      const totalVolume = formData.items.reduce((sum, item) => sum + (item.volume_m3 || 0), 0) || null;

      const { data: invoice, error } = await supabase
        .from('invoices')
        .update({
          ref_number: formData.ref_number || null,
          program: formData.program || null,
          warehouse_id: formData.warehouse_id,
          facility_id: formData.facility_id,
          notes: formData.notes || null,
          total_price: totalPrice,
          total_weight_kg: totalWeight,
          total_volume_m3: totalVolume,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('workspace_id', workspaceId!)
        .select()
        .single();

      if (error) throw error;

      const { error: deleteError } = await supabase
        .from('invoice_line_items')
        .delete()
        .eq('invoice_id', id);

      if (deleteError) throw deleteError;

      if (formData.items.length > 0) {
        const lineItems = formData.items.map(item => ({
          invoice_id: id,
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

        const { error: itemsError } = await supabase.from('invoice_line_items').insert(lineItems);
        if (itemsError) throw itemsError;
      }

      return mapDbToInvoice(invoice);
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
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: InvoiceStatus }) => {
      const { data: updated, error } = await supabase
        .from('invoices')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('workspace_id', workspaceId!)
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

export function useSaveInvoicePackaging() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      packagingRequired,
      counts,
      totalWeight,
      totalVolume,
    }: {
      invoiceId: string;
      packagingRequired: boolean;
      counts: Record<string, number>;
      totalWeight: number;
      totalVolume: number;
    }) => {
      const totalPackages = Object.values(counts).reduce((s, c) => s + c, 0);

      // 1. Update the invoice itself
      const newStatus = packagingRequired && totalPackages > 0 ? 'packaged' : undefined;
      const invoiceUpdate: Record<string, any> = {
        packaging_required: packagingRequired,
        updated_at: new Date().toISOString(),
      };
      if (totalWeight > 0) invoiceUpdate.total_weight_kg = totalWeight;
      if (totalVolume > 0) invoiceUpdate.total_volume_m3 = totalVolume;
      if (newStatus) invoiceUpdate.status = newStatus;

      const { error: invoiceErr } = await supabase
        .from('invoices')
        .update(invoiceUpdate)
        .eq('id', invoiceId)
        .eq('workspace_id', workspaceId!);
      if (invoiceErr) throw invoiceErr;

      if (!packagingRequired || totalPackages === 0) return;

      // 2. Upsert invoice_packaging record
      // Delete existing first (simpler than true upsert given no unique index)
      await supabase.from('invoice_packaging').delete().eq('invoice_id', invoiceId);

      const { data: pkgRecord, error: pkgErr } = await supabase
        .from('invoice_packaging')
        .insert({
          invoice_id: invoiceId,
          packaging_mode: Object.entries(counts).some(
            ([k, v]) => v > 0 && (k.startsWith('box') || k.startsWith('carton') || k.startsWith('crate'))
          ) ? 'box' : 'bag',
          total_packages: totalPackages,
        })
        .select()
        .single();
      if (pkgErr) throw pkgErr;

      // 3. Insert package_items rows (one row per package unit)
      // DB check constraint: package_type IN ('box', 'bag') only
      const TYPE_MAP: Record<string, { package_type: 'box' | 'bag'; size: string }> = {
        // Bag matrix
        bag_s:     { package_type: 'bag', size: 'S'      },
        bag_m:     { package_type: 'bag', size: 'M'      },
        bag_l:     { package_type: 'bag', size: 'L'      },
        bag_xl:    { package_type: 'bag', size: 'XL'     },
        // Box matrix
        box_s:     { package_type: 'box', size: 'S'      },
        box_m:     { package_type: 'box', size: 'M'      },
        box_l:     { package_type: 'box', size: 'L'      },
        box_xl:    { package_type: 'box', size: 'XL'     },
        // Carton maps to box (rigid container)
        carton_s:  { package_type: 'box', size: 'S'      },
        carton_m:  { package_type: 'box', size: 'M'      },
        carton_l:  { package_type: 'box', size: 'L'      },
        carton_xl: { package_type: 'box', size: 'XL'     },
        // Legacy / other
        crate_xl:  { package_type: 'box', size: 'XL'     },
        custom:    { package_type: 'box', size: 'custom' },
      };

      const packageRows: any[] = [];
      let packageNumber = 1;

      for (const [typeKey, count] of Object.entries(counts)) {
        if (count === 0) continue;
        const typeInfo = TYPE_MAP[typeKey];
        if (!typeInfo) continue;
        for (let i = 0; i < count; i++) {
          packageRows.push({
            packaging_id: pkgRecord.id,
            package_type: typeInfo.package_type,
            size: typeInfo.size,
            package_number: packageNumber++,
          });
        }
      }

      if (packageRows.length > 0) {
        const { error: itemsErr } = await supabase
          .from('package_items')
          .insert(packageRows);
        if (itemsErr) throw itemsErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Packaging saved');
    },
    onError: (error: Error) => {
      toast.error(`Failed to save packaging: ${error.message}`);
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id)
        .eq('workspace_id', workspaceId!);
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
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ['invoices', 'by-requisition', workspaceId, requisitionId],
    enabled: !!requisitionId && !!workspaceId,
    queryFn: async () => {
      if (!requisitionId || !workspaceId) return null;
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, status')
        .eq('requisition_id', requisitionId)
        .eq('workspace_id', workspaceId)
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
        .in('id', facilityIds)
        .eq('workspace_id', workspaceId!);

      const facilitiesMap = new Map(facilities?.map(f => [f.id, f]));

      return requisitions.map(req => ({
        ...req,
        facility: facilitiesMap.get(req.facility_id) || null,
      }));
    },
  });
}

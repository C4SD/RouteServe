/**
 * Workflow Status Transitions
 *
 * Simple status transition hooks and metadata for requisitions,
 * invoices, batches, and scheduler batches.
 * Extracted from the legacy RBAC workflow guards module.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// =====================================================
// REQUISITION WORKFLOW
// =====================================================

export function useTransitionRequisitionStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      requisitionId,
      newStatus,
      notes,
    }: {
      requisitionId: string;
      newStatus: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('requisitions')
        .update({
          status: newStatus,
          ...(notes && { notes }),
        })
        .eq('id', requisitionId)
        .select()
        .single();

      if (error) {
        if (error.message.includes('Permission denied')) throw new Error(error.message);
        if (error.message.includes('Invalid state transition')) throw new Error(error.message);
        throw error;
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['requisition', variables.requisitionId] });
      queryClient.invalidateQueries({ queryKey: ['requisitions'] });
      toast({ title: 'Status updated', description: `Requisition status changed to ${variables.newStatus}` });
    },
    onError: (error: Error) => {
      toast({ title: 'Status update failed', description: error.message, variant: 'destructive' });
    },
  });
}

// =====================================================
// INVOICE WORKFLOW
// =====================================================

export function useTransitionInvoiceStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      newStatus,
      notes,
    }: {
      invoiceId: string;
      newStatus: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('invoices')
        .update({
          status: newStatus,
          ...(notes && { notes }),
        })
        .eq('id', invoiceId)
        .select()
        .single();

      if (error) {
        if (error.message.includes('Permission denied')) throw new Error(error.message);
        if (error.message.includes('Invalid state transition')) throw new Error(error.message);
        throw error;
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Status updated', description: `Invoice status changed to ${variables.newStatus}` });
    },
    onError: (error: Error) => {
      toast({ title: 'Status update failed', description: error.message, variant: 'destructive' });
    },
  });
}

// =====================================================
// BATCH WORKFLOW
// =====================================================

export function useTransitionBatchStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      batchId,
      newStatus,
    }: {
      batchId: string;
      newStatus: 'planned' | 'assigned' | 'in-progress' | 'completed' | 'cancelled';
    }) => {
      const { data, error } = await supabase
        .from('delivery_batches')
        .update({ status: newStatus })
        .eq('id', batchId)
        .select()
        .single();

      if (error) {
        if (error.message.includes('Permission denied')) throw new Error(error.message);
        if (error.message.includes('Invalid state transition')) throw new Error(error.message);
        throw error;
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['batch', variables.batchId] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      toast({ title: 'Status updated', description: `Batch status changed to ${variables.newStatus}` });
    },
    onError: (error: Error) => {
      toast({ title: 'Status update failed', description: error.message, variant: 'destructive' });
    },
  });
}

// =====================================================
// SCHEDULER BATCH WORKFLOW
// =====================================================

export function useTransitionSchedulerBatchStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const toPreBatchStatus = (uiStatus: string): string => {
    const map: Record<string, string> = {
      draft: 'draft',
      ready: 'ready',
      scheduled: 'converted',
      published: 'converted',
      cancelled: 'cancelled',
    };
    return map[uiStatus] || uiStatus;
  };

  return useMutation({
    mutationFn: async ({
      batchId,
      newStatus,
      notes,
    }: {
      batchId: string;
      newStatus: string;
      notes?: string;
    }) => {
      const preBatchStatus = toPreBatchStatus(newStatus);
      const { data, error } = await supabase
        .from('scheduler_pre_batches')
        .update({ status: preBatchStatus, ...(notes ? { notes } : {}) })
        .eq('id', batchId)
        .select()
        .single();

      if (error) {
        if (error.message.includes('Permission denied')) throw new Error(error.message);
        if (error.message.includes('Invalid state transition')) throw new Error(error.message);
        throw error;
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pre-batches'] });
      toast({ title: 'Status updated', description: `Schedule status changed to ${variables.newStatus}` });
    },
    onError: (error: Error) => {
      toast({ title: 'Status update failed', description: error.message, variant: 'destructive' });
    },
  });
}

// =====================================================
// STATUS METADATA
// =====================================================

export const REQUISITION_STATUS_META = {
  pending: { label: 'Pending', color: 'gray', description: 'Awaiting approval' },
  approved: { label: 'Approved', color: 'green', description: 'Approved by warehouse' },
  packaged: { label: 'Packaged', color: 'blue', description: 'Packaging computed' },
  ready_for_dispatch: { label: 'Ready for Dispatch', color: 'cyan', description: 'Ready for batch assignment' },
  assigned_to_batch: { label: 'Assigned to Batch', color: 'purple', description: 'Assigned to delivery batch' },
  in_transit: { label: 'In Transit', color: 'indigo', description: 'Delivery in progress' },
  fulfilled: { label: 'Fulfilled', color: 'green', description: 'Successfully delivered' },
  partially_delivered: { label: 'Partially Delivered', color: 'yellow', description: 'Partially completed' },
  failed: { label: 'Failed', color: 'red', description: 'Delivery failed' },
  rejected: { label: 'Rejected', color: 'red', description: 'Rejected by warehouse' },
  cancelled: { label: 'Cancelled', color: 'gray', description: 'Cancelled before delivery' },
} as const;

export const INVOICE_STATUS_META = {
  draft: { label: 'Draft', color: 'gray', description: 'Being prepared' },
  ready: { label: 'Ready', color: 'blue', description: 'Ready for packaging' },
  packaging_pending: { label: 'Packaging Pending', color: 'yellow', description: 'Awaiting packaging' },
  packaged: { label: 'Packaged', color: 'purple', description: 'Packaged and ready for dispatch' },
  dispatched: { label: 'Dispatched', color: 'indigo', description: 'In transit to facility' },
  completed: { label: 'Completed', color: 'green', description: 'Delivered successfully' },
  cancelled: { label: 'Cancelled', color: 'gray', description: 'Cancelled' },
} as const;

export const BATCH_STATUS_META = {
  planned: { label: 'Planned', color: 'gray', description: 'Being planned' },
  assigned: { label: 'Assigned', color: 'blue', description: 'Driver assigned' },
  'in-progress': { label: 'In Progress', color: 'purple', description: 'Delivery underway' },
  completed: { label: 'Completed', color: 'green', description: 'Delivery completed' },
  cancelled: { label: 'Cancelled', color: 'gray', description: 'Cancelled' },
} as const;

export const SCHEDULER_STATUS_META = {
  draft: { label: 'Draft', color: 'gray', description: 'Being drafted' },
  ready: { label: 'Ready', color: 'blue', description: 'Ready for optimization' },
  scheduled: { label: 'Scheduled', color: 'purple', description: 'Optimized and scheduled' },
  published: { label: 'Published', color: 'green', description: 'Published to drivers' },
  cancelled: { label: 'Cancelled', color: 'gray', description: 'Cancelled' },
} as const;

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Aggregates distinct programs for a set of delivery batch IDs from both
 * requisitions (direct link via batch_id) and invoices (via requisition_id).
 * Returns a map of deliveryBatchId → string[].
 */
export function useBatchPrograms(batchIds: string[]) {
  return useQuery({
    queryKey: ['batch-programs', batchIds],
    enabled: batchIds.length > 0,
    queryFn: () => fetchProgramsForBatches(batchIds),
  });
}

export async function fetchProgramsForBatches(
  batchIds: string[]
): Promise<Record<string, string[]>> {
  if (batchIds.length === 0) return {};

  const [{ data: reqData }, ] = await Promise.all([
    supabase
      .from('requisitions')
      .select('id, batch_id, program')
      .in('batch_id', batchIds)
      .not('program', 'is', null),
  ]);

  const reqToBatch: Record<string, string> = {};
  const batchPrograms = new Map<string, Set<string>>();

  reqData?.forEach((r) => {
    if (r.batch_id && r.program) {
      reqToBatch[r.id] = r.batch_id;
      if (!batchPrograms.has(r.batch_id)) batchPrograms.set(r.batch_id, new Set());
      batchPrograms.get(r.batch_id)!.add(r.program);
    }
  });

  const reqIds = Object.keys(reqToBatch);
  if (reqIds.length > 0) {
    const { data: invData } = await supabase
      .from('invoices')
      .select('requisition_id, program')
      .in('requisition_id', reqIds)
      .not('program', 'is', null);

    invData?.forEach((inv) => {
      if (inv.requisition_id && inv.program) {
        const batchId = reqToBatch[inv.requisition_id];
        if (batchId) {
          if (!batchPrograms.has(batchId)) batchPrograms.set(batchId, new Set());
          batchPrograms.get(batchId)!.add(inv.program);
        }
      }
    });
  }

  const result: Record<string, string[]> = {};
  batchPrograms.forEach((programs, batchId) => {
    result[batchId] = Array.from(programs).sort();
  });
  return result;
}

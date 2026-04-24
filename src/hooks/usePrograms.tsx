import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { Program, ProgramFormData, ProgramFilters, ProgramMetrics } from '@/types/program';

const EMPTY_METRICS: ProgramMetrics = {
  facility_count: 0,
  active_requisitions: 0,
  active_schedules: 0,
  active_batches: 0,
  pending_batches: 0,
  stockout_count: 0,
  fulfillment_rate: 0,
  avg_delivery_time: 0,
};

// Fetch programs with filters
export function usePrograms(filters?: ProgramFilters) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['programs', workspaceId, filters],
    enabled: !!workspaceId,
    queryFn: async () => {
      let query = supabase
        .from('programs')
        .select('*')
        .eq('workspace_id', workspaceId!)
        .order('created_at', { ascending: false });

      if (filters?.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`
        );
      }

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.funding_source) {
        query = query.eq('funding_source', filters.funding_source);
      }

      if (filters?.priority_tier) {
        query = query.eq('priority_tier', filters.priority_tier);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch metrics for each program from DB
      const programsWithMetrics = await Promise.all(
        (data || []).map(async (program) => {
          const { data: metrics, error: metricsError } = await supabase.rpc('get_program_metrics', {
            _program_code: program.code || program.name,
            _workspace_id: workspaceId!,
          });

          if (metricsError) {
            console.warn(`Failed to fetch metrics for program ${program.code}:`, metricsError.message);
          }

          return {
            ...program,
            metrics: (metricsError ? EMPTY_METRICS : (metrics as ProgramMetrics)) || EMPTY_METRICS,
          } as Program;
        })
      );

      return { programs: programsWithMetrics };
    },
  });
}

// Get single program
export function useProgram(id: string) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['programs', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Fetch metrics from DB
      const { data: metrics, error: metricsError } = await supabase.rpc('get_program_metrics', {
        _program_code: data.code || data.name,
        _workspace_id: data.workspace_id,
      });

      if (metricsError) {
        console.warn(`Failed to fetch metrics for program ${data.code}:`, metricsError.message);
      }

      const programWithMetrics: Program = {
        ...data,
        metrics: (metricsError ? EMPTY_METRICS : (metrics as ProgramMetrics)) || EMPTY_METRICS,
      };

      return programWithMetrics;
    },
    enabled: !!id,
  });
}

// Create program
export function useCreateProgram() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (data: ProgramFormData) => {
      const { data: program, error } = await supabase
        .from('programs')
        .insert([
          {
            name: data.name,
            code: data.code,
            description: data.description,
            funding_source: data.funding_source,
            priority_tier: data.priority_tier,
            requires_cold_chain: data.requires_cold_chain,
            sla_days: data.sla_days,
            status: data.status,
            workspace_id: workspaceId,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return program;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
  });
}

// Update program
export function useUpdateProgram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: ProgramFormData & { id: string }) => {
      const { data: program, error } = await supabase
        .from('programs')
        .update({
          name: data.name,
          code: data.code,
          description: data.description,
          funding_source: data.funding_source,
          priority_tier: data.priority_tier,
          requires_cold_chain: data.requires_cold_chain,
          sla_days: data.sla_days,
          status: data.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return program;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      queryClient.invalidateQueries({ queryKey: ['programs', variables.id] });
    },
  });
}

// Delete program
export function useDeleteProgram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('programs').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
  });
}

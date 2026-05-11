/**
 * RFC-012 Phase 6: Requisition Workflow Analytics Hooks
 *
 * React Query hooks for fetching requisition workflow analytics
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import {
  analyticsAPI,
  type StorefrontRequisitionAnalytics,
  type FleetOpsDispatchAnalytics,
  type PackagingTypeDistribution,
} from '@/integrations/supabase/analytics';
import { useWorkspace } from '@/contexts/WorkspaceContext';

// ============================================================================
// Query Key Factory
// ============================================================================

export const requisitionAnalyticsKeys = {
  all: ['requisition-analytics'] as const,
  storefront: (workspaceId: string | null, startDate?: string | null, endDate?: string | null) =>
    [...requisitionAnalyticsKeys.all, 'storefront', workspaceId, { startDate, endDate }] as const,
  fleetops: (workspaceId: string | null, startDate?: string | null, endDate?: string | null) =>
    [...requisitionAnalyticsKeys.all, 'fleetops', workspaceId, { startDate, endDate }] as const,
  packaging: (workspaceId: string | null, startDate?: string | null, endDate?: string | null) =>
    [...requisitionAnalyticsKeys.all, 'packaging', workspaceId, { startDate, endDate }] as const,
};

// ============================================================================
// Hooks
// ============================================================================

export function useStorefrontRequisitionAnalytics(
  startDate?: string | null,
  endDate?: string | null
): UseQueryResult<StorefrontRequisitionAnalytics, Error> {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: requisitionAnalyticsKeys.storefront(workspaceId, startDate, endDate),
    enabled: !!workspaceId,
    queryFn: () => analyticsAPI.getStorefrontRequisitionAnalytics(workspaceId!, startDate, endDate),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useFleetOpsDispatchAnalytics(
  startDate?: string | null,
  endDate?: string | null
): UseQueryResult<FleetOpsDispatchAnalytics, Error> {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: requisitionAnalyticsKeys.fleetops(workspaceId, startDate, endDate),
    enabled: !!workspaceId,
    queryFn: () => analyticsAPI.getFleetOpsDispatchAnalytics(workspaceId!, startDate, endDate),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function usePackagingTypeDistribution(
  startDate?: string | null,
  endDate?: string | null
): UseQueryResult<PackagingTypeDistribution[], Error> {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: requisitionAnalyticsKeys.packaging(workspaceId, startDate, endDate),
    enabled: !!workspaceId,
    queryFn: () => analyticsAPI.getPackagingTypeDistribution(workspaceId!, startDate, endDate),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

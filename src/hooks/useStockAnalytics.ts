/**
 * Stock Analytics Hooks
 * React Query hooks for stock reporting and analytics
 */

import { useQuery } from '@tanstack/react-query';
import {
  getStockStatus,
  getStockBalance,
  getStockPerformance,
  getStockByZone,
  getLowStockAlerts,
} from '@/integrations/supabase/analytics';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type {
  StockStatus,
  StockBalance,
  StockPerformance,
  StockByZone,
  LowStockAlert,
} from '@/types';

export function useStockStatus() {
  const { workspaceId } = useWorkspace();

  return useQuery<StockStatus, Error>({
    queryKey: ['stock-status', workspaceId],
    enabled: !!workspaceId,
    queryFn: () => getStockStatus(workspaceId!),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useStockBalance(productName?: string) {
  const { workspaceId } = useWorkspace();

  return useQuery<StockBalance[], Error>({
    queryKey: ['stock-balance', workspaceId, productName],
    enabled: !!workspaceId,
    queryFn: () => getStockBalance(workspaceId!, productName),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useStockPerformance(startDate?: string, endDate?: string) {
  const { workspaceId } = useWorkspace();

  return useQuery<StockPerformance[], Error>({
    queryKey: ['stock-performance', workspaceId, startDate, endDate],
    enabled: !!workspaceId,
    queryFn: () => getStockPerformance(workspaceId!, startDate, endDate),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useStockByZone() {
  const { workspaceId } = useWorkspace();

  return useQuery<StockByZone[], Error>({
    queryKey: ['stock-by-zone', workspaceId],
    enabled: !!workspaceId,
    queryFn: () => getStockByZone(workspaceId!),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useLowStockAlerts(thresholdDays: number = 7) {
  const { workspaceId } = useWorkspace();

  return useQuery<LowStockAlert[], Error>({
    queryKey: ['low-stock-alerts', workspaceId, thresholdDays],
    enabled: !!workspaceId,
    queryFn: () => getLowStockAlerts(workspaceId!, thresholdDays),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

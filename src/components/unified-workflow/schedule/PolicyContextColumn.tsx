/**
 * =====================================================
 * Policy Context Column
 * =====================================================
 * Left column for the "Service Policy" source method.
 * Cascades: Service Area → Policy → Cluster
 * Auto-loads cluster facilities into the working set.
 */

import * as React from 'react';
import {
  ChevronRight,
  LayoutGrid,
  MapPin,
  Loader2,
  AlertTriangle,
  Check,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useServiceAreas } from '@/hooks/useServiceAreas';
import { useServicePolicies, useServicePolicyDetail } from '@/hooks/useServicePolicies';
import type { WorkingSetItem, PolicyContext } from '@/types/unified-workflow';

interface PolicyContextColumnProps {
  policyContext: PolicyContext | null;
  workingSet: WorkingSetItem[];
  onPolicyContextChange: (context: PolicyContext | null) => void;
  onSetWorkingSet: (items: WorkingSetItem[]) => void;
  onWarehouseAutoSet?: (warehouseId: string | null) => void;
}

export function PolicyContextColumn({
  policyContext,
  workingSet,
  onPolicyContextChange,
  onSetWorkingSet,
  onWarehouseAutoSet,
}: PolicyContextColumnProps) {
  const [selectedServiceAreaId, setSelectedServiceAreaId] = React.useState<string>(
    policyContext?.service_area_id ?? ''
  );
  const [selectedPolicyId, setSelectedPolicyId] = React.useState<string>(
    policyContext?.policy_id ?? ''
  );
  const [selectedClusterId, setSelectedClusterId] = React.useState<string>(
    policyContext?.cluster_id ?? ''
  );

  // Data fetching
  const { data: serviceAreas = [], isLoading: saLoading } = useServiceAreas();
  const { data: policies = [], isLoading: policiesLoading } = useServicePolicies(
    selectedServiceAreaId || undefined
  );
  const { data: policyDetail, isLoading: detailLoading } = useServicePolicyDetail(
    selectedPolicyId || undefined
  );

  const clusters = policyDetail?.clusters ?? [];
  const selectedCluster = clusters.find((c) => c.id === selectedClusterId) ?? null;

  // ── Auto-load cluster facilities into working set ──────────────────────────
  const handleClusterSelect = React.useCallback(
    (clusterId: string) => {
      setSelectedClusterId(clusterId);

      const cluster = clusters.find((c) => c.id === clusterId);
      if (!cluster) return;

      const sa = serviceAreas.find((s) => s.id === selectedServiceAreaId);
      const policy = policies.find((p) => p.id === selectedPolicyId);

      // Build new policy context
      const context: PolicyContext = {
        service_area_id: selectedServiceAreaId,
        service_area_name: sa?.name ?? '',
        policy_id: selectedPolicyId,
        policy_name: policy?.name ?? '',
        cluster_id: clusterId,
        cluster_code: cluster.code,
        cluster_name: cluster.name ?? null,
      };
      onPolicyContextChange(context);

      // Map cluster facilities → WorkingSetItem[]
      if (cluster.facilities && cluster.facilities.length > 0) {
        const items: WorkingSetItem[] = cluster.facilities
          .filter((cf) => cf.facilities)
          .map((cf, idx) => ({
            facility_id: cf.facility_id,
            facility_name: cf.facilities!.name,
            lga: cf.facilities!.lga ?? undefined,
            requisition_ids: [],
            slot_demand: 1,
            sequence: idx + 1,
          }));
        onSetWorkingSet(items);
      }
    },
    [
      clusters,
      serviceAreas,
      policies,
      selectedServiceAreaId,
      selectedPolicyId,
      onPolicyContextChange,
      onSetWorkingSet,
    ]
  );

  // Reload cluster facilities (manual refresh)
  const handleReload = React.useCallback(() => {
    if (selectedClusterId) handleClusterSelect(selectedClusterId);
  }, [selectedClusterId, handleClusterSelect]);

  // Reset downstream when SA changes
  const handleServiceAreaChange = (id: string) => {
    setSelectedServiceAreaId(id);
    setSelectedPolicyId('');
    setSelectedClusterId('');
    onPolicyContextChange(null);
    onSetWorkingSet([]);

    // Auto-set start location to the service area's warehouse
    const sa = serviceAreas.find((s) => s.id === id);
    onWarehouseAutoSet?.(sa?.warehouse_id ?? null);
  };

  // Reset downstream when Policy changes
  const handlePolicyChange = (id: string) => {
    setSelectedPolicyId(id);
    setSelectedClusterId('');
    onPolicyContextChange(null);
    onSetWorkingSet([]);
  };

  return (
    <div className="flex flex-col gap-5 py-2 px-1">
      {/* ── Service Area ─────────────────────────────── */}
      <CascadeStep
        step={1}
        label="Service Area"
        active
        completed={!!selectedServiceAreaId}
      >
        {saLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Select value={selectedServiceAreaId} onValueChange={handleServiceAreaChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select service area…" />
            </SelectTrigger>
            <SelectContent>
              {serviceAreas.map((sa) => (
                <SelectItem key={sa.id} value={sa.id}>
                  {sa.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CascadeStep>

      {/* ── Policy ───────────────────────────────────── */}
      <CascadeStep
        step={2}
        label="Service Policy"
        active={!!selectedServiceAreaId}
        completed={!!selectedPolicyId}
      >
        {policiesLoading && selectedServiceAreaId ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Select
            value={selectedPolicyId}
            onValueChange={handlePolicyChange}
            disabled={!selectedServiceAreaId}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select policy…" />
            </SelectTrigger>
            <SelectContent>
              {policies.length === 0 && selectedServiceAreaId ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No policies for this service area
                </div>
              ) : (
                policies.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="font-medium">{p.name}</span>
                    {p.code && (
                      <span className="ml-2 text-xs text-muted-foreground">({p.code})</span>
                    )}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}
      </CascadeStep>

      {/* ── Cluster ──────────────────────────────────── */}
      <CascadeStep
        step={3}
        label="Cluster"
        active={!!selectedPolicyId}
        completed={!!selectedClusterId}
      >
        {detailLoading && selectedPolicyId ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-2">
            {clusters.length === 0 && selectedPolicyId ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                No clusters found
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {clusters.map((cluster) => (
                  <button
                    key={cluster.id}
                    onClick={() => handleClusterSelect(cluster.id)}
                    disabled={!selectedPolicyId}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all',
                      selectedClusterId === cluster.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50',
                      !selectedPolicyId && 'opacity-40 cursor-not-allowed'
                    )}
                  >
                    <LayoutGrid className="h-3 w-3" />
                    {cluster.code}
                    {cluster.name && (
                      <span className="opacity-70 text-xs">— {cluster.name}</span>
                    )}
                    <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                      {cluster.facility_count}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </CascadeStep>

      {/* ── Cluster Summary ──────────────────────────── */}
      {selectedCluster && policyContext && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Check className="h-4 w-4 text-primary" />
              <span>
                {policyContext.cluster_code}
                {policyContext.cluster_name && ` — ${policyContext.cluster_name}`}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={handleReload}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reload
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />
              <span>{workingSet.length} facilities loaded</span>
            </div>
            {selectedCluster.avg_distance_km != null && (
              <div className="flex items-center gap-1.5">
                <ChevronRight className="h-3 w-3" />
                <span>~{selectedCluster.avg_distance_km.toFixed(1)} km avg</span>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            From <span className="font-medium">{policyContext.policy_name}</span> ·{' '}
            {policyContext.service_area_name}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Cascade Step wrapper ───────────────────────────────────────────────────────

interface CascadeStepProps {
  step: number;
  label: string;
  active: boolean;
  completed: boolean;
  children: React.ReactNode;
}

function CascadeStep({ step, label, active, completed, children }: CascadeStepProps) {
  return (
    <div className={cn('space-y-2', !active && 'opacity-40 pointer-events-none')}>
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold shrink-0',
            completed
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {completed ? <Check className="h-3 w-3" /> : step}
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

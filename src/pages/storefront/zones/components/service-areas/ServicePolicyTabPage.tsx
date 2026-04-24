import { useState } from 'react';
import { Layers, Building2, Eye, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAllServicePolicies } from '@/hooks/useServicePolicies';
import { useServiceAreas } from '@/hooks/useServiceAreas';
import { ServiceArea } from '@/types/service-areas';
import { ServicePolicyDetailDialog } from './ServicePolicyDetailDialog';
import { CreateServicePolicyWizard } from './CreateServicePolicyWizard';

const modeLabels: Record<string, string> = {
  manual: 'Manual',
  lga: 'LGA-based',
  proximity: 'Proximity',
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  archived: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

function toServiceArea(sa: any): ServiceArea | null {
  if (!sa) return null;
  return {
    id: sa.id,
    name: sa.name,
    zone_id: sa.zone_id,
    warehouse_id: sa.warehouse_id,
    service_type: sa.service_type,
    description: sa.description ?? null,
    max_distance_km: sa.max_distance_km ?? null,
    delivery_frequency: sa.delivery_frequency ?? null,
    priority: sa.priority,
    sla_hours: sa.sla_hours ?? null,
    is_active: sa.is_active ?? true,
    metadata: sa.metadata ?? {},
    created_by: sa.created_by ?? null,
    updated_by: sa.updated_by ?? null,
    created_at: sa.created_at,
    updated_at: sa.updated_at,
    zones: sa.zones ?? null,
    warehouses: sa.warehouses ?? null,
  };
}

// ─── Service Area Picker ──────────────────────────────────────────────────────

interface ServiceAreaPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (sa: ServiceArea) => void;
}

function ServiceAreaPicker({ open, onOpenChange, onSelect }: ServiceAreaPickerProps) {
  const { data: serviceAreas, isLoading } = useServiceAreas({ is_active: true });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Service Area</DialogTitle>
          <DialogDescription>
            Choose the service area this policy will belong to.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2 py-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !serviceAreas || serviceAreas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No active service areas found. Create a service area first.
          </p>
        ) : (
          <div className="space-y-1 max-h-[320px] overflow-y-auto py-1">
            {serviceAreas.map(sa => (
              <button
                key={sa.id}
                onClick={() => onSelect(sa)}
                className="w-full text-left px-3 py-2.5 rounded-md hover:bg-muted transition-colors flex items-center justify-between group"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{sa.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {sa.zones?.name || '—'} · {sa.warehouses?.name || '—'}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                  {sa.service_type.toUpperCase()}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ServicePolicyTabPage() {
  const [selected, setSelected] = useState<{ policyId: string; serviceArea: ServiceArea } | null>(
    null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createForSA, setCreateForSA] = useState<ServiceArea | null>(null);

  const { data: policies, isLoading } = useAllServicePolicies();

  function handleSASelected(sa: ServiceArea) {
    setPickerOpen(false);
    setCreateForSA(sa);
  }

  function handleWizardClose(open: boolean) {
    if (!open) setCreateForSA(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? 'Loading…'
            : `${policies?.length ?? 0} ${(policies?.length ?? 0) === 1 ? 'policy' : 'policies'} across all service areas`}
        </p>
        <Button size="sm" onClick={() => setPickerOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Policy
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : !policies || policies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="rounded-full bg-muted p-4">
            <Layers className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium">No service policies yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a policy to define cluster sequences for your service areas.
            </p>
          </div>
          <Button size="sm" onClick={() => setPickerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Policy
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Policy Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Service Area</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-center">Clusters</TableHead>
                <TableHead className="text-center">Facilities</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((policy: any) => {
                const serviceArea = toServiceArea(policy.service_areas);

                return (
                  <TableRow
                    key={policy.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      serviceArea && setSelected({ policyId: policy.id, serviceArea })
                    }
                  >
                    <TableCell className="font-medium">{policy.name}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {policy.code || '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {policy.service_areas?.name || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {modeLabels[policy.clustering_mode] || policy.clustering_mode}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="flex items-center justify-center gap-1">
                        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                        {policy.cluster_count ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="flex items-center justify-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {policy.facility_count ?? 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${statusColors[policy.status] || ''}`}>
                        {policy.status}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={!serviceArea}
                        onClick={() =>
                          serviceArea && setSelected({ policyId: policy.id, serviceArea })
                        }
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Service area picker → wizard */}
      <ServiceAreaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleSASelected}
      />

      {createForSA && (
        <CreateServicePolicyWizard
          open={!!createForSA}
          onOpenChange={handleWizardClose}
          serviceArea={createForSA}
        />
      )}

      {/* Detail view */}
      {selected && (
        <ServicePolicyDetailDialog
          policyId={selected.policyId}
          open={!!selected}
          onOpenChange={open => !open && setSelected(null)}
          serviceArea={selected.serviceArea}
        />
      )}
    </div>
  );
}

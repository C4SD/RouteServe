import { useState } from 'react';
import { Plus, Layers, Building2, AlertTriangle, MoreHorizontal, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useServicePolicies, useDeleteServicePolicy } from '@/hooks/useServicePolicies';
import { ServiceArea } from '@/types/service-areas';
import { ServicePolicy } from '@/types/service-policies';
import { CreateServicePolicyWizard } from './CreateServicePolicyWizard';
import { ServicePolicyDetailDialog } from './ServicePolicyDetailDialog';

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

interface ServicePoliciesTabProps {
  serviceArea: ServiceArea;
}

export function ServicePoliciesTab({ serviceArea }: ServicePoliciesTabProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<ServicePolicy | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServicePolicy | null>(null);

  const { data: policies, isLoading } = useServicePolicies(serviceArea.id);
  const deleteMutation = useDeleteServicePolicy();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-2 pt-2">
        {[1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (!policies || policies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="rounded-full bg-muted p-4">
          <Layers className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="font-medium">No service policies yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create a policy to group facilities into operational clusters (Z1, Z2…)
          </p>
        </div>
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Policy
        </Button>

        <CreateServicePolicyWizard
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          serviceArea={serviceArea}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {policies.length} {policies.length === 1 ? 'policy' : 'policies'} defined
        </p>
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Policy
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Policy Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead className="text-center">Clusters</TableHead>
              <TableHead className="text-center">Facilities</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {policies.map(policy => (
              <TableRow
                key={policy.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setSelectedPolicy(policy)}
              >
                <TableCell className="font-medium">{policy.name}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {policy.code || '—'}
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedPolicy(policy)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteTarget(policy)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create wizard */}
      <CreateServicePolicyWizard
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        serviceArea={serviceArea}
      />

      {/* Detail dialog */}
      {selectedPolicy && (
        <ServicePolicyDetailDialog
          policyId={selectedPolicy.id}
          open={!!selectedPolicy}
          onOpenChange={open => !open && setSelectedPolicy(null)}
          serviceArea={serviceArea}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent onPointerDownOutside={e => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Policy</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{deleteTarget?.name}&quot;? All clusters and facility assignments will be
              removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState } from 'react';
import { Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { tw } from '@/lib/colors';
import { useServicePolicies, useServicePolicyDetail } from '@/hooks/useServicePolicies';
import { ServiceArea } from '@/types/service-areas';

const CLUSTER_COLORS = [
  tw.blue[500],
  tw.emerald[500],
  tw.violet[500],
  tw.orange[500],
  tw.pink[500],
  tw.cyan[500],
  tw.amber[500],
  tw.red[500],
];

function clusterColor(idx: number) {
  return CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
}

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  archived: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

interface PolicySequenceTabProps {
  serviceArea: ServiceArea;
}

export function PolicySequenceTab({ serviceArea }: PolicySequenceTabProps) {
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);

  const { data: policies, isLoading: policiesLoading } = useServicePolicies(serviceArea.id);

  const activePolicyId =
    selectedPolicyId ??
    policies?.find(p => p.status === 'active')?.id ??
    policies?.[0]?.id ??
    null;

  const { data: detail, isLoading: detailLoading } = useServicePolicyDetail(
    policies && policies.length > 0 ? activePolicyId : null,
  );

  const isLoading = policiesLoading || (!!activePolicyId && detailLoading);

  if (policiesLoading) {
    return (
      <div className="space-y-2 pt-2">
        {[1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (!policies || policies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="rounded-full bg-muted p-4">
          <Layers className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="font-medium">No policy sequence defined</p>
          <p className="text-sm text-muted-foreground mt-1">
            Go to the Service Policy tab to create a policy for this area.
          </p>
        </div>
      </div>
    );
  }

  const clusters = detail?.clusters ?? [];
  const policy = detail?.policy;

  // Flat list of all facilities ordered by cluster sequence
  const rows = clusters.flatMap((cluster, clusterIdx) =>
    (cluster.facilities || []).map(pcf => ({
      id: pcf.id,
      name: pcf.facilities?.name ?? '—',
      type: pcf.facilities?.type ?? '—',
      levelOfCare: pcf.facilities?.level_of_care ?? '—',
      lga: pcf.facilities?.lga ?? '—',
      clusterCode: cluster.code,
      clusterIdx,
    })),
  );

  return (
    <div className="space-y-3">
      {/* Policy selector */}
      <div className="flex items-center gap-2">
        {policies.length > 1 ? (
          <Select
            value={activePolicyId ?? ''}
            onValueChange={setSelectedPolicyId}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Select policy" />
            </SelectTrigger>
            <SelectContent>
              {policies.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-sm truncate">{policy?.name}</span>
            {policy?.code && (
              <span className="font-mono text-xs text-muted-foreground shrink-0">
                {policy.code}
              </span>
            )}
          </div>
        )}
        {policy && (
          <Badge className={`text-xs shrink-0 ${statusColors[policy.status] || ''}`}>
            {policy.status}
          </Badge>
        )}
      </div>

      {/* Facility sequence table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No clusters defined in this policy.
        </p>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Facility Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Level of Care</TableHead>
                <TableHead>LGA</TableHead>
                <TableHead>Sequence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="capitalize text-sm">{row.type}</TableCell>
                  <TableCell className="text-sm">{row.levelOfCare}</TableCell>
                  <TableCell className="text-sm">{row.lga}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="font-mono text-xs font-semibold"
                      style={{ color: clusterColor(row.clusterIdx), borderColor: clusterColor(row.clusterIdx) }}
                    >
                      {row.clusterCode}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

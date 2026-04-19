import { useState } from 'react';
import { Search, MoreHorizontal, Eye, Lock, Trash2, AlertCircle, Pencil, TriangleAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRoutes, useDeleteRoute, useLockRoute } from '@/hooks/useRoutes';
import { useOperationalZones } from '@/hooks/useOperationalZones';
import type { Route } from '@/types/routes';

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  locked: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  archived: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const sourceLabels: Record<string, string> = {
  service_policy: 'Policy',
  facility_list: 'Manual',
  upload: 'Upload',
  sandbox: 'Sandbox',
};

const algorithmLabels: Record<string, string> = {
  nearest_neighbor: 'NN',
  two_opt: '2-opt',
  osrm: 'OSRM',
  nearest_neighbor_2opt: '2-opt',
};

interface RouteTableProps {
  onViewDetail: (route: Route) => void;
  onEdit?: (route: Route) => void;
}

export function RouteTable({ onViewDetail, onEdit }: RouteTableProps) {
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const { zones } = useOperationalZones();
  const { data: routes, isLoading, error } = useRoutes({
    zone_id: zoneFilter !== 'all' ? zoneFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: search || undefined,
  });
  const deleteMutation = useDeleteRoute();
  const lockMutation = useLockRoute();

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this route?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleLock = (id: string) => {
    if (confirm('Lock this route? Locked routes cannot be modified or deleted.')) {
      lockMutation.mutate(id);
    }
  };

  const filteredRoutes = sourceFilter === 'all'
    ? routes
    : routes?.filter(r => r.creation_mode === sourceFilter);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search routes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={zoneFilter} onValueChange={setZoneFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {zones?.map((zone) => (
                <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="locked">Locked</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="service_policy">Policy</SelectItem>
              <SelectItem value="facility_list">Manual</SelectItem>
              <SelectItem value="upload">Upload</SelectItem>
              <SelectItem value="sandbox">Sandbox</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Service Area</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Policy / Cluster</TableHead>
                <TableHead className="text-center">Facilities</TableHead>
                <TableHead>Distance</TableHead>
                <TableHead>Algorithm</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2 text-destructive">
                      <AlertCircle className="h-5 w-5" />
                      <span>Failed to load routes: {error.message}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredRoutes && filteredRoutes.length > 0 ? (
                filteredRoutes.map((route) => {
                  const isPolicyRoute = route.creation_mode === 'service_policy';
                  const policyMeta = route.policy_metadata;
                  // Out-of-sync detection in table is shown via metadata only (lightweight).
                  // Full sync check happens in RouteDetailDialog.
                  return (
                    <TableRow
                      key={route.id}
                      className="cursor-pointer"
                      onClick={() => onViewDetail(route)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {route.name}
                          {route.is_sandbox && (
                            <Badge variant="outline" className="text-xs">Sandbox</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{route.zones?.name || '—'}</TableCell>
                      <TableCell>{route.service_areas?.name || '—'}</TableCell>

                      {/* Source */}
                      <TableCell>
                        <Badge
                          variant={isPolicyRoute ? 'default' : 'outline'}
                          className="text-xs"
                        >
                          {sourceLabels[route.creation_mode] ?? route.creation_mode}
                        </Badge>
                      </TableCell>

                      {/* Policy / Cluster */}
                      <TableCell>
                        {isPolicyRoute && policyMeta ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-muted-foreground truncate max-w-[120px]">
                              {policyMeta.service_policy_name}
                            </span>
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {policyMeta.cluster_code}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">{route.facility_count || 0}</TableCell>

                      <TableCell>
                        {route.total_distance_km ? `${route.total_distance_km} km` : '—'}
                      </TableCell>

                      {/* Algorithm */}
                      <TableCell>
                        {route.algorithm_used ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-xs cursor-default">
                                {algorithmLabels[route.algorithm_used] ?? route.algorithm_used}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>{route.algorithm_used}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge className={statusColors[route.status] || ''}>
                          {route.status === 'locked' && <Lock className="mr-1 h-3 w-3" />}
                          {route.status}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewDetail(route); }}>
                              <Eye className="mr-2 h-4 w-4" /> View
                            </DropdownMenuItem>
                            {route.status !== 'locked' && onEdit && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(route); }}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                            )}
                            {route.status !== 'locked' && !route.is_sandbox && (
                              <>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleLock(route.id); }}>
                                  <Lock className="mr-2 h-4 w-4" /> Lock
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={(e) => { e.stopPropagation(); handleDelete(route.id); }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </>
                            )}
                            {route.is_sandbox && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => { e.stopPropagation(); handleDelete(route.id); }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No routes found. Create one to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}

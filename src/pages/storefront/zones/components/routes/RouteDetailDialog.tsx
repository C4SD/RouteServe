import { useMemo } from 'react';
import { Lock, Trash2, Archive, Clock, MapPin, Activity, TriangleAlert, RefreshCw, Loader2, Network } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useRouteFacilities, useDeleteRoute, useLockRoute, useUpdateRoute, useRoutePolicySync } from '@/hooks/useRoutes';
import type { Route, RouteFacility } from '@/types/routes';
import { calculateDistance } from '@/lib/routeOptimization';

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  locked: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  archived: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

interface RouteDetailDialogProps {
  route: Route;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RouteDetailDialog({ route, open, onOpenChange }: RouteDetailDialogProps) {
  const { data: facilities, isLoading: facilitiesLoading } = useRouteFacilities(route.id);
  const deleteMutation = useDeleteRoute();
  const lockMutation = useLockRoute();
  const updateMutation = useUpdateRoute();
  const { isServicePolicy, syncResult, isLoading: syncLoading, policyName, clusterCode } =
    useRoutePolicySync(open ? route : null);

  const isLocked = route.status === 'locked';
  const isSandbox = route.is_sandbox;

  // Compute distances from warehouse → first facility, then between consecutive facilities
  const facilityDistances = useMemo(() => {
    if (!facilities || facilities.length === 0) return new Map<string, number>();
    const distances = new Map<string, number>();
    const warehouseLat = route.warehouses?.lat;
    const warehouseLng = route.warehouses?.lng;

    facilities.forEach((rf: RouteFacility, idx: number) => {
      // Use stored distance if available
      if (rf.distance_from_previous_km != null) {
        distances.set(rf.id, rf.distance_from_previous_km);
        return;
      }
      const fLat = rf.facilities?.lat;
      const fLng = rf.facilities?.lng;
      if (fLat == null || fLng == null) return;

      if (idx === 0) {
        // Distance from warehouse to first facility
        if (warehouseLat != null && warehouseLng != null) {
          distances.set(rf.id, Math.round(calculateDistance(warehouseLat, warehouseLng, fLat, fLng) * 10) / 10);
        }
      } else {
        // Distance from previous facility
        const prev = facilities[idx - 1];
        const pLat = prev.facilities?.lat;
        const pLng = prev.facilities?.lng;
        if (pLat != null && pLng != null) {
          distances.set(rf.id, Math.round(calculateDistance(pLat, pLng, fLat, fLng) * 10) / 10);
        }
      }
    });
    return distances;
  }, [facilities, route.warehouses]);

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this route?')) {
      deleteMutation.mutate(route.id, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  const handleLock = () => {
    if (confirm('Lock this route? Locked routes cannot be modified or deleted.')) {
      lockMutation.mutate(route.id);
    }
  };

  const handleArchive = () => {
    updateMutation.mutate({ id: route.id, data: { status: 'archived' } as any });
  };

  const handleActivate = () => {
    updateMutation.mutate({ id: route.id, data: { status: 'active' } as any });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2">
                {route.name}
                {isSandbox && <Badge variant="outline">Sandbox</Badge>}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {route.zones?.name || '—'} &middot; {route.service_areas?.name || '—'}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {!isLocked && !isSandbox && route.status === 'draft' && (
                <Button variant="outline" size="sm" onClick={handleActivate}>
                  <Activity className="mr-2 h-4 w-4" /> Activate
                </Button>
              )}
              {!isLocked && !isSandbox && (
                <Button variant="outline" size="sm" onClick={handleLock}>
                  <Lock className="mr-2 h-4 w-4" /> Lock
                </Button>
              )}
              {!isLocked && (
                <>
                  <Button variant="outline" size="sm" onClick={handleArchive}>
                    <Archive className="mr-2 h-4 w-4" /> Archive
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDelete}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Out-of-sync banner for policy routes */}
        {isServicePolicy && (
          <div className="mb-4">
            {syncLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking policy sync…
              </div>
            ) : syncResult?.isOutOfSync ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 font-medium text-sm">
                  <TriangleAlert className="h-4 w-4 shrink-0" />
                  This route is out of sync with its Service Policy
                </div>
                <div className="text-xs text-amber-700 dark:text-amber-500 space-y-0.5">
                  {syncResult.removed.length > 0 && (
                    <p>• {syncResult.removed.length} facilit{syncResult.removed.length === 1 ? 'y' : 'ies'} removed from policy cluster</p>
                  )}
                  {syncResult.added.length > 0 && (
                    <p>• {syncResult.added.length} new facilit{syncResult.added.length === 1 ? 'y' : 'ies'} added to policy cluster</p>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-amber-300 text-amber-800 hover:bg-amber-100 dark:text-amber-400"
                    onClick={() => {
                      // Close dialog — user will create a new route from the policy
                      onOpenChange(false);
                    }}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Re-run Optimization
                  </Button>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Re-running creates a new route version — this route is preserved as-is.
                </p>
              </div>
            ) : syncResult && !syncResult.isOutOfSync ? (
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20 border border-green-200 rounded-lg px-3 py-2">
                <Network className="h-4 w-4" />
                In sync with policy <span className="font-medium">{policyName}</span> / cluster{' '}
                <Badge variant="outline" className="text-xs ml-1">{clusterCode}</Badge>
              </div>
            ) : null}
          </div>
        )}

        <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="facilities">Facility Sequence ({facilities?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4 overflow-y-auto flex-1">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge className={`text-base ${statusColors[route.status] || ''}`}>
                    {route.status === 'locked' && <Lock className="mr-1 h-3 w-3" />}
                    {route.status}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Distance</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{route.total_distance_km ? `${route.total_distance_km} km` : 'Not calculated'}</span>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Est. Duration</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{route.estimated_duration_min ? `${route.estimated_duration_min} min` : 'Not calculated'}</span>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Route Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Source</span>
                  <Badge variant={route.creation_mode === 'service_policy' ? 'default' : 'outline'} className="text-xs">
                    {route.creation_mode === 'service_policy' ? 'Service Policy'
                      : route.creation_mode === 'facility_list' ? 'Manual'
                      : route.creation_mode === 'upload' ? 'Upload'
                      : 'Sandbox'}
                  </Badge>
                </div>
                {route.policy_metadata && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Policy</span>
                      <span className="font-medium">{route.policy_metadata.service_policy_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cluster</span>
                      <Badge variant="secondary" className="text-xs">{route.policy_metadata.cluster_code}</Badge>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Warehouse</span>
                  <span>{route.warehouses?.name || '—'}</span>
                </div>
                {route.algorithm_used && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Algorithm</span>
                    <Badge variant="outline" className="text-xs">{route.algorithm_used}</Badge>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{new Date(route.created_at).toLocaleDateString()}</span>
                </div>
                {route.locked_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Locked</span>
                    <span>{new Date(route.locked_at).toLocaleDateString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="facilities" className="mt-4 overflow-y-auto flex-1">
            {facilitiesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : facilities && facilities.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">Order</TableHead>
                      <TableHead>Facility</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Level of Care</TableHead>
                      <TableHead>LGA</TableHead>
                      <TableHead>Distance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {facilities.map((rf) => (
                      <TableRow key={rf.id}>
                        <TableCell className="font-mono text-center">{rf.sequence_order}</TableCell>
                        <TableCell className="font-medium">{rf.facilities?.name || '—'}</TableCell>
                        <TableCell className="capitalize">{rf.facilities?.type || '—'}</TableCell>
                        <TableCell>{rf.facilities?.level_of_care || '—'}</TableCell>
                        <TableCell>{rf.facilities?.lga || '—'}</TableCell>
                        <TableCell>
                          {(() => {
                            const dist = facilityDistances.get(rf.id);
                            if (dist == null) return '—';
                            return `${dist} km`;
                          })()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No facilities assigned to this route.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

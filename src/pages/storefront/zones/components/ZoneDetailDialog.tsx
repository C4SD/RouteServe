import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, Edit, Trash2, TrendingUp, Globe } from 'lucide-react';
import { OperationalZone } from '@/types/zones';
import { useZoneSummary } from '@/hooks/useOperationalZones';
import { useAllLGAsWithZones } from '@/hooks/useAdminUnits';
import { useFacilities } from '@/hooks/useFacilities';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useDeleteZone } from '@/hooks/useOperationalZones';

interface ZoneDetailDialogProps {
  zone: OperationalZone;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditRequest?: () => void;
}

export function ZoneDetailDialog({ zone, open, onOpenChange, onEditRequest }: ZoneDetailDialogProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const { data: summary, isLoading: summaryLoading } = useZoneSummary(zone.id);
  const { data: lgas, isLoading: lgasLoading } = useAllLGAsWithZones({ zone_id: zone.id });
  const { data: facilitiesData, isLoading: facilitiesLoading } = useFacilities({ zone_id: zone.id });

  const deleteZone = useDeleteZone();

  const zoneFacilities = facilitiesData?.facilities || [];

  const handleDelete = async () => {
    try {
      await deleteZone.mutateAsync(zone.id);
      // Close AlertDialog first, then the parent Dialog to avoid focus-trap conflicts
      setIsDeleteDialogOpen(false);
      onOpenChange(false);
    } catch {
      // Error toast handled by the mutation's onError callback
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-2xl flex items-center gap-2">
              {zone.name}
              {!zone.is_active && <Badge variant="secondary">Inactive</Badge>}
            </DialogTitle>
            {zone.code && (
              <DialogDescription className="text-base">
                Code: {zone.code}
              </DialogDescription>
            )}
            {zone.description && (
              <DialogDescription className="text-base">
                {zone.description}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onEditRequest?.();
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>

          <Tabs defaultValue="overview" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="lgas">LGAs</TabsTrigger>
              <TabsTrigger value="facilities">Facilities</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Summary Stats */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">LGAs</CardTitle>
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {summaryLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      <div className="text-2xl font-bold">{summary?.lga_count || 0}</div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Facilities</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {summaryLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      <div className="text-2xl font-bold">{summary?.facility_count || 0}</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Active Operations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Active Operations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Active Dispatches</span>
                      {summaryLoading ? (
                        <Skeleton className="h-6 w-12" />
                      ) : (
                        <span className="text-2xl font-bold">{summary?.active_dispatches || 0}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Fleets Assigned</span>
                      {summaryLoading ? (
                        <Skeleton className="h-6 w-12" />
                      ) : (
                        <span className="text-2xl font-bold">{summary?.fleet_count || 0}</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Geometry Summary */}
              {zone.metadata?.geometry_summary && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      Geometry Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Area</span>
                        <span className="text-lg font-semibold">
                          {(zone.metadata.geometry_summary as any).areaKm2} km<sup>2</sup>
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Vertices</span>
                        <span className="text-lg font-semibold">
                          {(zone.metadata.geometry_summary as any).vertices}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Center</span>
                        <span className="text-lg font-semibold">
                          {(zone.metadata.geometry_summary as any).center?.lat},{' '}
                          {(zone.metadata.geometry_summary as any).center?.lng}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="lgas" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>LGAs in {zone.name}</CardTitle>
                  <CardDescription>
                    {lgas?.length || 0} Local Government Area(s) in this zone
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {lgasLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : lgas && lgas.length > 0 ? (
                    <div className="space-y-3">
                      {lgas.map((lga) => (
                        <div
                          key={lga.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div>
                            <p className="font-medium">{lga.name}</p>
                            <p className="text-sm text-muted-foreground">
                              State: {(lga as any).parent?.name || 'N/A'}
                              {lga.population && ` • Population: ${lga.population.toLocaleString()}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No LGAs in this zone yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="facilities" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Facilities in {zone.name}</CardTitle>
                  <CardDescription>
                    {zoneFacilities.length} facilit{zoneFacilities.length === 1 ? 'y' : 'ies'} in this zone
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {facilitiesLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : zoneFacilities.length > 0 ? (
                    <div className="space-y-3">
                      {zoneFacilities.map((facility) => (
                        <div
                          key={facility.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex-1">
                            <p className="font-medium">{facility.name}</p>
                            <p className="text-sm text-muted-foreground">{facility.address}</p>
                            {facility.lga && (
                              <p className="text-xs text-muted-foreground mt-1">LGA: {facility.lga}</p>
                            )}
                          </div>
                          <Badge variant="outline">{facility.type || 'facility'}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No facilities in this zone yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation — rendered outside the Dialog portal to avoid focus-trap conflicts */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent onPointerDownOutside={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Zone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{zone.name}&quot;? This action cannot be undone.
              All warehouses and facilities will be unassigned from this zone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteZone.isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteZone.isPending}
            >
              {deleteZone.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

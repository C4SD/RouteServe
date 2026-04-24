import { useState } from 'react';
import { Building2, MapPin, Clock, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { useServiceAreaFacilities, useDeleteServiceArea } from '@/hooks/useServiceAreas';
import { ServiceArea } from '@/types/service-areas';
import { PolicySequenceTab } from './PolicySequenceTab';

const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  standard: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

interface ServiceAreaDetailDialogProps {
  serviceArea: ServiceArea;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (sa: ServiceArea) => void;
}

export function ServiceAreaDetailDialog({
  serviceArea,
  open,
  onOpenChange,
  onEdit,
}: ServiceAreaDetailDialogProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { data: facilities, isLoading: facilitiesLoading } = useServiceAreaFacilities(serviceArea.id);
  const deleteMutation = useDeleteServiceArea();

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(serviceArea.id);
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">{serviceArea.name}</DialogTitle>
              <DialogDescription className="mt-1">
                {serviceArea.zones?.name || 'Unknown zone'} &middot; {serviceArea.warehouses?.name || 'Unknown warehouse'}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onEdit(serviceArea)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setIsDeleteDialogOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="facilities">Facilities ({facilities?.length || 0})</TabsTrigger>
            <TabsTrigger value="policies">Policy Sequence</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4 overflow-y-auto flex-1">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Service Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline" className="text-base">
                    {serviceArea.service_type.toUpperCase()}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Priority</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge className={`text-base ${priorityColors[serviceArea.priority] || ''}`}>
                    {serviceArea.priority}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Delivery Frequency</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="capitalize">{serviceArea.delivery_frequency || 'Not set'}</span>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Max Distance</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{serviceArea.max_distance_km ? `${serviceArea.max_distance_km} km` : 'Not set'}</span>
                </CardContent>
              </Card>

              {serviceArea.sla_hours && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">SLA</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    <span>{serviceArea.sla_hours} hours</span>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Warehouse</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{serviceArea.warehouses?.name || '—'}</span>
                </CardContent>
              </Card>
            </div>

            {serviceArea.description && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{serviceArea.description}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="policies" className="mt-4 overflow-y-auto flex-1">
            <PolicySequenceTab serviceArea={serviceArea} />
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
                      <TableHead>#</TableHead>
                      <TableHead>Facility Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Level of Care</TableHead>
                      <TableHead>LGA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {facilities.map((saf, idx) => (
                      <TableRow key={saf.id}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{saf.facilities?.name || '—'}</TableCell>
                        <TableCell className="capitalize">{saf.facilities?.type || '—'}</TableCell>
                        <TableCell>{saf.facilities?.level_of_care || '—'}</TableCell>
                        <TableCell>{saf.facilities?.lga || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No facilities assigned to this service area.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    {/* Delete Confirmation — rendered outside the Dialog portal to avoid focus-trap conflicts */}
    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <AlertDialogContent onPointerDownOutside={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Service Area</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{serviceArea.name}&quot;? This action cannot be undone.
            This will also remove all facility assignments.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
}

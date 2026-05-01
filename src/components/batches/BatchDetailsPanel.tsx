import { useState } from 'react';
import { format } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BatchRouteMap } from './BatchRouteMap';
import { AssignmentDialog } from './AssignmentDialog';
import { BatchStatusActions } from './BatchStatusActions';
import { BatchOptimizationPanel } from './BatchOptimizationPanel';
import { useDrivers } from '@/hooks/useDrivers';
import { useVehicles } from '@/hooks/useVehicles';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useBatchUpdate } from '@/hooks/useBatchUpdate';
import {
  Package,
  MapPin,
  Clock,
  User,
  Truck,
  Building2,
  Route,
  FileText,
  Edit,
  Save,
  X,
  Loader2,
  Calendar,
  Hash,
} from 'lucide-react';
import type { DeliveryBatch } from '@/types';

interface BatchDetailsPanelProps {
  batch: DeliveryBatch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BatchDetailsPanel({ batch, open, onOpenChange }: BatchDetailsPanelProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [isAssignmentOpen, setIsAssignmentOpen] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  const { data: drivers = [] } = useDrivers();
  const { data: vehicles = [] } = useVehicles();
  const { data: warehousesData, isLoading: warehousesLoading } = useWarehouses();
  const warehouses = warehousesData?.warehouses || [];
  const batchUpdate = useBatchUpdate();

  if (!batch) return null;

  const driver = drivers.find((d) => d.id === batch.driverId);
  const vehicle = vehicles.find((v) => v.id === batch.vehicleId);
  const rawWarehouse = warehouses.find((w) => w.id === batch.warehouseId);
  // Only pass warehouse to map if it has valid coordinates
  const warehouse = rawWarehouse && rawWarehouse.lat != null && rawWarehouse.lng != null
    ? { lat: rawWarehouse.lat, lng: rawWarehouse.lng, name: rawWarehouse.name }
    : null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned':
        return 'secondary';
      case 'assigned':
        return 'default';
      case 'in-progress':
        return 'default';
      case 'completed':
        return 'default';
      case 'cancelled':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'destructive';
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const handleSaveNotes = () => {
    batchUpdate.mutate(
      { batchId: batch.id, updates: { notes: editedNotes } },
      {
        onSuccess: () => {
          setIsEditingNotes(false);
        },
      }
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col">
          <SheetHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <SheetTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {batch.name}
                </SheetTitle>
                <SheetDescription className="flex items-center gap-2">
                  <Badge variant={getStatusColor(batch.status)}>{batch.status}</Badge>
                  <Badge variant={getPriorityColor(batch.priority)}>{batch.priority}</Badge>
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="route">Route</TabsTrigger>
              <TabsTrigger value="facilities">Facilities</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="overview" className="h-full mt-4">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-6">
                    {/* Schedule Info */}
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Schedule
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Date</p>
                          <p className="font-medium">
                            {format(new Date(batch.scheduledDate), 'PPP')}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Time</p>
                          <p className="font-medium">{batch.scheduledTime}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Distance</p>
                          <p className="font-medium">{batch.totalDistance} km</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Est. Duration</p>
                          <p className="font-medium">{Math.round(batch.estimatedDuration)} min</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Cargo Info */}
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Cargo
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Medication Type</p>
                          <p className="font-medium">{batch.medicationType || 'General'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Quantity</p>
                          <p className="font-medium">{batch.totalQuantity} units</p>
                        </div>
                      </div>
                      {batch.programs && batch.programs.length > 0 && (
                        <div>
                          <p className="text-muted-foreground text-sm mb-1.5">Programs</p>
                          <div className="flex flex-wrap gap-1.5">
                            {batch.programs.slice(0, 2).map((p) => (
                              <Badge key={p} variant="outline" className="text-xs px-2 py-0.5">
                                {p}
                              </Badge>
                            ))}
                            {batch.programs.length > 2 && (
                              <span className="text-xs text-muted-foreground self-center">
                                +{batch.programs.length - 2} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Origin */}
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Origin Warehouse
                      </h4>
                      <div className="rounded-lg border p-3">
                        <p className="font-medium">{rawWarehouse?.name || batch.warehouseName}</p>
                        {rawWarehouse?.address && (
                          <p className="text-sm text-muted-foreground">{rawWarehouse.address}</p>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Assignment */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Assignment
                        </h4>
                        {(batch.status === 'planned' || batch.status === 'assigned') && (
                          <Button variant="outline" size="sm" onClick={() => setIsAssignmentOpen(true)}>
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground mb-1">Driver</p>
                          {driver ? (
                            <>
                              <p className="font-medium">{driver.name}</p>
                              <p className="text-xs text-muted-foreground">{driver.phone}</p>
                              <Badge variant="outline" className="text-xs mt-1">
                                {driver.licenseType}
                              </Badge>
                            </>
                          ) : (
                            <p className="text-muted-foreground">Not assigned</p>
                          )}
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground mb-1">Vehicle</p>
                          {vehicle ? (
                            <>
                              <p className="font-medium">{vehicle.model}</p>
                              <p className="text-xs text-muted-foreground">{vehicle.plateNumber}</p>
                              <Badge variant="outline" className="text-xs mt-1">
                                {vehicle.capacity}m³
                              </Badge>
                            </>
                          ) : (
                            <p className="text-muted-foreground">Not assigned</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Timeline */}
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Timeline
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                          <span className="text-muted-foreground">Created:</span>
                          <span>{format(new Date(batch.createdAt), 'PPP p')}</span>
                        </div>
                        {batch.actualStartTime && (
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="text-muted-foreground">Started:</span>
                            <span>{format(new Date(batch.actualStartTime), 'PPP p')}</span>
                          </div>
                        )}
                        {batch.actualEndTime && (
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-muted-foreground">Completed:</span>
                            <span>{format(new Date(batch.actualEndTime), 'PPP p')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Actions */}
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-muted-foreground">Status</h4>
                      <BatchStatusActions
                        batchId={batch.id}
                        currentStatus={batch.status}
                        batchName={batch.name}
                      />
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="route" className="h-full mt-4">
                <div className="flex flex-col h-full gap-4">
                  <div
                    className={
                      isMapFullscreen
                        ? 'fixed inset-0 z-50 bg-background'
                        : 'h-[300px] rounded-lg overflow-hidden border relative shrink-0'
                    }
                  >
                    <BatchRouteMap
                      facilities={batch.facilities}
                      warehouse={warehouse}
                      optimizedRoute={batch.optimizedRoute}
                      enableControls
                      isFullscreen={isMapFullscreen}
                      onToggleFullscreen={() => setIsMapFullscreen(v => !v)}
                    />
                  </div>
                  {!isMapFullscreen && (
                    <ScrollArea className="flex-1 min-h-0">
                      <div className="space-y-4 pr-4">
                        <div className="text-sm text-muted-foreground">
                          <p className="flex items-center gap-2">
                            <Route className="h-4 w-4" />
                            {batch.facilities.length} stops • {batch.totalDistance} km total distance
                          </p>
                        </div>
                        <BatchOptimizationPanel batch={batch} depot={warehouse} />
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="facilities" className="h-full mt-4">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {batch.facilities.length} facilities in delivery sequence
                    </p>
                    {batch.facilities.map((facility, index) => (
                      <div
                        key={facility.id}
                        className="flex items-start gap-3 p-3 rounded-lg border"
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-medium text-sm shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{facility.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {facility.address || 'No address'}
                          </p>
                          <div className="flex gap-2 mt-1">
                            {facility.type && (
                              <Badge variant="outline" className="text-xs">
                                {facility.type}
                              </Badge>
                            )}
                            {facility.warehouse_code && (
                              <Badge variant="secondary" className="text-xs">
                                {facility.warehouse_code}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {batch.facilities.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <MapPin className="mx-auto h-8 w-8 mb-2 opacity-50" />
                        <p>No facilities assigned to this batch</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="notes" className="h-full mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Notes
                    </h4>
                    {!isEditingNotes && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditedNotes(batch.notes || '');
                          setIsEditingNotes(true);
                        }}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>

                  {isEditingNotes ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editedNotes}
                        onChange={(e) => setEditedNotes(e.target.value)}
                        placeholder="Add notes about this batch..."
                        rows={6}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveNotes}
                          disabled={batchUpdate.isPending}
                        >
                          {batchUpdate.isPending ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 mr-1" />
                          )}
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditingNotes(false)}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border p-4 min-h-[150px]">
                      {batch.notes ? (
                        <p className="text-sm whitespace-pre-wrap">{batch.notes}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">No notes added yet</p>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Assignment Dialog */}
      <AssignmentDialog
        open={isAssignmentOpen}
        onOpenChange={setIsAssignmentOpen}
        batch={batch}
      />
    </>
  );
}

export default BatchDetailsPanel;

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVehicle } from '@/hooks/vlms/useVehicles';
import { useVehicleMaintenance } from '@/hooks/vlms/useMaintenance';
import { useVehicleFuelLogs } from '@/hooks/vlms/useFuelLogs';
import { useVehicleIncidents } from '@/hooks/vlms/useIncidents';
import { useVehicleInspections } from '@/hooks/vlms/useInspections';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  ArrowLeft,
  Edit,
  Loader2,
  Car,
  FileText,
  Image as ImageIcon,
  Package,
  Wrench,
  Fuel,
  AlertTriangle,
  ClipboardCheck,
  Plus,
} from 'lucide-react';
import { VehicleCapacityTab } from '@/components/vlms/vehicles/VehicleCapacityTab';
import { VehicleDocumentsTab } from '@/components/vlms/vehicles/VehicleDocumentsTab';
import { VehiclePhotosTab } from '@/components/vlms/vehicles/VehiclePhotosTab';
import { ScheduleMaintenanceDialog } from '../../maintenance/ScheduleMaintenanceDialog';
import { LogFuelPurchaseDialog } from '../../fuel/LogFuelPurchaseDialog';
import { ReportIncidentDialog } from '../../incidents/ReportIncidentDialog';
import { CreateInspectionDialog } from '../../inspections/CreateInspectionDialog';
import { EmptyState } from '@/components/ui/empty-state';

export default function VehicleDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const vehicleId = params.id as string;

  const { data: vehicle, isLoading } = useVehicle(vehicleId);
  const { data: maintenanceRecords = [], isLoading: loadingMaintenance } = useVehicleMaintenance(vehicleId);
  const { data: fuelLogs = [], isLoading: loadingFuel } = useVehicleFuelLogs(vehicleId);
  const { data: incidents = [], isLoading: loadingIncidents } = useVehicleIncidents(vehicleId);
  const { data: inspections = [], isLoading: loadingInspections } = useVehicleInspections(vehicleId);

  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [fuelDialogOpen, setFuelDialogOpen] = useState(false);
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="text-center py-12">
        <p>Vehicle not found</p>
        <Button onClick={() => navigate('/fleetops/vlms/vehicles')} className="mt-4">
          Back to Vehicles
        </Button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      available: { variant: 'default', label: 'Available' },
      in_use: { variant: 'secondary', label: 'In Use' },
      maintenance: { variant: 'outline', label: 'Maintenance' },
      out_of_service: { variant: 'destructive', label: 'Out of Service' },
      disposed: { variant: 'outline', label: 'Disposed' },
    };
    const config = variants[status] || { variant: 'default', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getMaintenanceStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      scheduled: 'default',
      in_progress: 'secondary',
      completed: 'outline',
      cancelled: 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, any> = {
      low: 'outline',
      normal: 'default',
      high: 'secondary',
      critical: 'destructive',
    };
    return <Badge variant={variants[priority] || 'default'}>{priority}</Badge>;
  };

  const getIncidentStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      reported: 'default',
      investigating: 'secondary',
      resolved: 'outline',
      closed: 'outline',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, any> = {
      minor: 'outline',
      moderate: 'default',
      major: 'secondary',
      total_loss: 'destructive',
    };
    return <Badge variant={variants[severity] || 'default'}>{severity}</Badge>;
  };

  const getInspectionStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      passed: 'default',
      'passed with conditions': 'secondary',
      failed: 'destructive',
      pending: 'outline',
    };
    return <Badge variant={variants[status.toLowerCase()] || 'default'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/fleetops/vlms/vehicles')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">
                {vehicle.make} {vehicle.model}
              </h1>
              {getStatusBadge(vehicle.status)}
            </div>
            <p className="text-muted-foreground">
              {vehicle.license_plate}
              {vehicle.year && ` • ${vehicle.year}`}
            </p>
          </div>
        </div>
        <Button onClick={() => navigate(`/fleetops/vlms/vehicles/${vehicle.id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Vehicle
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Mileage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vehicle.current_mileage?.toLocaleString()} km</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Maintenance Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${vehicle.total_maintenance_cost?.toLocaleString() || '0'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${vehicle.current_book_value?.toLocaleString() || 'N/A'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Next Service
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vehicle.next_service_date
                ? new Date(vehicle.next_service_date).toLocaleDateString()
                : 'Not scheduled'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">
            <Car className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="maintenance">
            <Wrench className="h-4 w-4 mr-2" />
            Maintenance
            {maintenanceRecords.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {maintenanceRecords.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="fuel">
            <Fuel className="h-4 w-4 mr-2" />
            Fuel
            {fuelLogs.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {fuelLogs.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="incidents">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Incidents
            {incidents.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {incidents.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="inspections">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Inspections
            {inspections.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {inspections.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="capacity">
            <Package className="h-4 w-4 mr-2" />
            Capacity
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="h-4 w-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="photos">
            <ImageIcon className="h-4 w-4 mr-2" />
            Photos
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Make</div>
                  <div className="font-medium">{vehicle.make}</div>

                  <div className="text-muted-foreground">Model</div>
                  <div className="font-medium">{vehicle.model}</div>

                  <div className="text-muted-foreground">Year</div>
                  <div className="font-medium">{vehicle.year}</div>

                  <div className="text-muted-foreground">VIN</div>
                  <div className="font-medium">{vehicle.vin || 'N/A'}</div>

                  <div className="text-muted-foreground">License Plate</div>
                  <div className="font-medium">{vehicle.license_plate}</div>

                  <div className="text-muted-foreground">Type</div>
                  <div className="font-medium capitalize">
                    {vehicle.type ? vehicle.type.replace(/_/g, ' ') : '-'}
                  </div>

                  <div className="text-muted-foreground">Fuel Type</div>
                  <div className="font-medium capitalize">{vehicle.fuel_type}</div>

                  <div className="text-muted-foreground">Transmission</div>
                  <div className="font-medium capitalize">{vehicle.transmission || 'N/A'}</div>
                </div>
              </CardContent>
            </Card>

            {/* Specifications */}
            <Card>
              <CardHeader>
                <CardTitle>Specifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Engine Capacity</div>
                  <div className="font-medium">
                    {vehicle.engine_capacity ? `${vehicle.engine_capacity} L` : 'N/A'}
                  </div>

                  <div className="text-muted-foreground">Color</div>
                  <div className="font-medium">{vehicle.color || 'N/A'}</div>

                  <div className="text-muted-foreground">Seating Capacity</div>
                  <div className="font-medium">
                    {vehicle.seating_capacity ? `${vehicle.seating_capacity} seats` : 'N/A'}
                  </div>

                  <div className="text-muted-foreground">Cargo Capacity</div>
                  <div className="font-medium">
                    {vehicle.capacity_kg ? `${vehicle.capacity_kg} kg` : 'N/A'}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Acquisition Info */}
            <Card>
              <CardHeader>
                <CardTitle>Acquisition</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Acquisition Date</div>
                  <div className="font-medium">
                    {vehicle.acquisition_date || vehicle.date_acquired
                      ? new Date(vehicle.acquisition_date || vehicle.date_acquired).toLocaleDateString()
                      : 'N/A'}
                  </div>

                  <div className="text-muted-foreground">Acquisition Type</div>
                  <div className="font-medium capitalize">
                    {vehicle.acquisition_type || vehicle.acquisition_mode
                      ? (vehicle.acquisition_type || vehicle.acquisition_mode).replace(/_/g, ' ')
                      : 'N/A'}
                  </div>

                  <div className="text-muted-foreground">Purchase Price</div>
                  <div className="font-medium">
                    {vehicle.purchase_price ? `$${vehicle.purchase_price.toLocaleString()}` : 'N/A'}
                  </div>

                  <div className="text-muted-foreground">Vendor</div>
                  <div className="font-medium">{vehicle.vendor_name || 'N/A'}</div>
                </div>
              </CardContent>
            </Card>

            {/* Insurance & Registration */}
            <Card>
              <CardHeader>
                <CardTitle>Insurance & Registration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Insurance Provider</div>
                  <div className="font-medium">{vehicle.insurance_provider || 'N/A'}</div>

                  <div className="text-muted-foreground">Policy Number</div>
                  <div className="font-medium">{vehicle.insurance_policy_number || 'N/A'}</div>

                  <div className="text-muted-foreground">Insurance Expiry</div>
                  <div className="font-medium">
                    {vehicle.insurance_expiry
                      ? new Date(vehicle.insurance_expiry).toLocaleDateString()
                      : 'N/A'}
                  </div>

                  <div className="text-muted-foreground">Registration Expiry</div>
                  <div className="font-medium">
                    {vehicle.registration_expiry
                      ? new Date(vehicle.registration_expiry).toLocaleDateString()
                      : 'N/A'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Notes */}
          {vehicle.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{vehicle.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Maintenance Records</h2>
              <p className="text-sm text-muted-foreground">Service history for this vehicle</p>
            </div>
            <Button size="sm" onClick={() => setMaintenanceDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Schedule Maintenance
            </Button>
          </div>

          <Card>
            {loadingMaintenance ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : maintenanceRecords.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Record ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Scheduled Date</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintenanceRecords.map((record: any) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.record_id}</TableCell>
                      <TableCell className="capitalize">
                        {record.maintenance_type?.replace('_', ' ')}
                      </TableCell>
                      <TableCell>{getMaintenanceStatusBadge(record.status)}</TableCell>
                      <TableCell>{getPriorityBadge(record.priority)}</TableCell>
                      <TableCell>
                        {record.scheduled_date
                          ? new Date(record.scheduled_date).toLocaleDateString()
                          : 'Not scheduled'}
                      </TableCell>
                      <TableCell>{record.service_provider || '—'}</TableCell>
                      <TableCell>${record.total_cost?.toLocaleString() || '0'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                icon={Wrench}
                title="No maintenance records"
                description="No maintenance has been scheduled or recorded for this vehicle."
                variant="dashed"
              />
            )}
          </Card>
        </TabsContent>

        {/* Fuel Tab */}
        <TabsContent value="fuel" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Fuel Logs</h2>
              <p className="text-sm text-muted-foreground">Fuel purchases and consumption history</p>
            </div>
            <Button size="sm" onClick={() => setFuelDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Log Fuel Purchase
            </Button>
          </div>

          {fuelLogs.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Fuel Cost</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">
                    ${fuelLogs.reduce((sum: number, l: any) => sum + (l.total_cost || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">
                    {fuelLogs.reduce((sum: number, l: any) => sum + (l.quantity || 0), 0).toFixed(1)} L
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Avg Efficiency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">
                    {(() => {
                      const withEff = fuelLogs.filter((l: any) => l.fuel_efficiency);
                      return withEff.length > 0
                        ? (withEff.reduce((s: number, l: any) => s + l.fuel_efficiency, 0) / withEff.length).toFixed(1) + ' km/L'
                        : 'N/A';
                    })()}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            {loadingFuel ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : fuelLogs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Station</TableHead>
                    <TableHead>Fuel Type</TableHead>
                    <TableHead>Qty (L)</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Odometer</TableHead>
                    <TableHead>Efficiency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fuelLogs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {new Date(log.transaction_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{log.station_name || '—'}</TableCell>
                      <TableCell className="capitalize">{log.fuel_type}</TableCell>
                      <TableCell>{log.quantity.toFixed(2)}</TableCell>
                      <TableCell>${log.total_cost?.toFixed(2)}</TableCell>
                      <TableCell>{log.odometer_reading.toLocaleString()} km</TableCell>
                      <TableCell>
                        {log.fuel_efficiency ? `${log.fuel_efficiency.toFixed(2)} km/L` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                icon={Fuel}
                title="No fuel logs"
                description="No fuel purchases have been recorded for this vehicle."
                variant="dashed"
              />
            )}
          </Card>
        </TabsContent>

        {/* Incidents Tab */}
        <TabsContent value="incidents" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Incident History</h2>
              <p className="text-sm text-muted-foreground">Accidents, damage, and other incidents</p>
            </div>
            <Button size="sm" onClick={() => setIncidentDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Report Incident
            </Button>
          </div>

          <Card>
            {loadingIncidents ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : incidents.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Incident ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Est. Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidents.map((incident: any) => (
                    <TableRow key={incident.id}>
                      <TableCell className="font-medium">{incident.incident_id}</TableCell>
                      <TableCell className="capitalize">
                        {incident.incident_type?.replace('_', ' ')}
                      </TableCell>
                      <TableCell>{getSeverityBadge(incident.severity)}</TableCell>
                      <TableCell>{getIncidentStatusBadge(incident.status)}</TableCell>
                      <TableCell>
                        {new Date(incident.incident_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{incident.location}</TableCell>
                      <TableCell>
                        {incident.estimated_repair_cost
                          ? `$${incident.estimated_repair_cost.toLocaleString()}`
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                icon={AlertTriangle}
                title="No incidents recorded"
                description="No incidents have been reported for this vehicle."
                variant="dashed"
              />
            )}
          </Card>
        </TabsContent>

        {/* Inspections Tab */}
        <TabsContent value="inspections" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Inspection Records</h2>
              <p className="text-sm text-muted-foreground">Safety and compliance inspection history</p>
            </div>
            <Button size="sm" onClick={() => setInspectionDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Inspection
            </Button>
          </div>

          <Card>
            {loadingInspections ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : inspections.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inspection ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Inspector</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Roadworthy</TableHead>
                    <TableHead>Next Inspection</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inspections.map((inspection: any) => (
                    <TableRow key={inspection.id}>
                      <TableCell className="font-medium">{inspection.inspection_id}</TableCell>
                      <TableCell className="capitalize">
                        {inspection.inspection_type?.replace('_', ' ')}
                      </TableCell>
                      <TableCell>
                        {new Date(inspection.inspection_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {inspection.inspector?.full_name || inspection.inspector_name}
                      </TableCell>
                      <TableCell>{getInspectionStatusBadge(inspection.overall_status)}</TableCell>
                      <TableCell>
                        {inspection.roadworthy ? (
                          <Badge variant="default">Yes</Badge>
                        ) : (
                          <Badge variant="destructive">No</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {inspection.next_inspection_date
                          ? new Date(inspection.next_inspection_date).toLocaleDateString()
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                icon={ClipboardCheck}
                title="No inspections recorded"
                description="No inspections have been conducted for this vehicle."
                variant="dashed"
              />
            )}
          </Card>
        </TabsContent>

        {/* Capacity Tab */}
        <TabsContent value="capacity">
          <VehicleCapacityTab vehicle={vehicle} />
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <VehicleDocumentsTab
            vehicleId={vehicle.id}
            documents={Array.isArray(vehicle.documents) ? vehicle.documents : []}
          />
        </TabsContent>

        {/* Photos Tab */}
        <TabsContent value="photos">
          <VehiclePhotosTab
            vehicleId={vehicle.id}
            photos={Array.isArray(vehicle.photos) ? vehicle.photos : []}
          />
        </TabsContent>
      </Tabs>

      {/* Module Dialogs — pre-filled with this vehicle */}
      <ScheduleMaintenanceDialog
        open={maintenanceDialogOpen}
        onOpenChange={setMaintenanceDialogOpen}
        defaultVehicleId={vehicle.id}
      />
      <LogFuelPurchaseDialog
        open={fuelDialogOpen}
        onOpenChange={setFuelDialogOpen}
        defaultVehicleId={vehicle.id}
      />
      <ReportIncidentDialog
        open={incidentDialogOpen}
        onOpenChange={setIncidentDialogOpen}
        defaultVehicleId={vehicle.id}
      />
      <CreateInspectionDialog
        open={inspectionDialogOpen}
        onClose={() => setInspectionDialogOpen(false)}
        defaultVehicleId={vehicle.id}
      />
    </div>
  );
}

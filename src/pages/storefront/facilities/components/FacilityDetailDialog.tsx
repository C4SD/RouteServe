import { Facility } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Edit, Trash2, MapPin, ExternalLink } from 'lucide-react';
import { useFacilityServices, useFacilityDeliveries, useFacilityStock, useFacilityAuditLog } from '@/hooks/useFacilities';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useAllFacilityRealtime } from '@/hooks/useFacilitiesRealtime';
import { FacilityProgramsSection } from './FacilityProgramsSection';

interface FacilityDetailDialogProps {
  facility: Facility;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (facility: Facility) => void;
  onDelete: (id: string) => void;
}

export function FacilityDetailDialog({
  facility,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: FacilityDetailDialogProps) {
  // Enable realtime updates for this facility
  useAllFacilityRealtime(facility.id);

  const { data: services, isLoading: servicesLoading } = useFacilityServices(facility.id);
  const { data: deliveriesData, isLoading: deliveriesLoading } = useFacilityDeliveries(facility.id);
  const { data: stock, isLoading: stockLoading } = useFacilityStock(facility.id);
  const { data: auditData, isLoading: auditLoading } = useFacilityAuditLog(facility.id);

  const deliveries = deliveriesData?.deliveries || [];
  const auditLogs = auditData?.logs || [];

  const handleOpenMap = () => {
    window.open(`https://www.google.com/maps?q=${facility.lat},${facility.lng}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl">{facility.name}</DialogTitle>
              <DialogDescription className="mt-2 space-y-1">
                <div className="font-mono text-sm">{facility.warehouse_code}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  {facility.level_of_care && (
                    <Badge variant="outline">{facility.level_of_care}</Badge>
                  )}
                  {(facility.programmes?.length ? facility.programmes : facility.programme ? [facility.programme] : []).map((p) => (
                    <Badge key={p} variant="secondary">{p}</Badge>
                  ))}
                  {facility.service_zone && (
                    <Badge>{facility.service_zone}</Badge>
                  )}
                </div>
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onEdit(facility);
                  onOpenChange(false);
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (confirm('Delete this facility?')) {
                    await onDelete(facility.id);
                    onOpenChange(false);
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="programs">Programs</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
            <TabsTrigger value="stock">Stock</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="details" className="space-y-6 m-0">
              {/* Basic Information */}
              <div>
                <h3 className="font-semibold mb-3">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <InfoItem label="Name" value={facility.name} />
                  <InfoItem label="Warehouse Code" value={facility.warehouse_code} mono />
                  <InfoItem label="State" value={facility.state} />
                  <InfoItem label="LGA" value={facility.lga} />
                  <InfoItem label="Ward" value={facility.ward} />
                  <InfoItem label="Address" value={facility.address} className="col-span-2" />
                </div>
              </div>

              {/* Location */}
              <div>
                <h3 className="font-semibold mb-3">Location</h3>
                <div className="grid grid-cols-2 gap-4">
                  <InfoItem label="Latitude" value={facility.lat.toFixed(6)} mono />
                  <InfoItem label="Longitude" value={facility.lng.toFixed(6)} mono />
                  <div className="col-span-2">
                    <Button variant="outline" size="sm" onClick={handleOpenMap}>
                      <MapPin className="h-4 w-4 mr-2" />
                      View on Google Maps
                      <ExternalLink className="h-3 w-3 ml-2" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Program Information */}
              <div>
                <h3 className="font-semibold mb-3">Program Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <BadgeInfoItem
                    label="IP Name"
                    values={facility.ip_names?.length ? facility.ip_names : facility.ip_name ? [facility.ip_name] : []}
                    variant="outline"
                  />
                  <BadgeInfoItem
                    label="Funding Source"
                    values={facility.funding_sources?.length ? facility.funding_sources : facility.funding_source ? [facility.funding_source] : []}
                    variant="secondary"
                  />
                  <BadgeInfoItem
                    label="Programme"
                    values={facility.programmes?.length ? facility.programmes : facility.programme ? [facility.programme] : []}
                    variant="secondary"
                  />
                  <InfoItem label="Service Zone" value={facility.service_zone} />
                  <InfoItem label="Level of Care" value={facility.level_of_care} />
                  <InfoItem label="Type of Service" value={facility.type_of_service} />
                </div>
              </div>

              {/* Services Available */}
              <div>
                <h3 className="font-semibold mb-3">Services Available</h3>
                <div className="grid grid-cols-2 gap-4">
                  <InfoItem
                    label="PCR Service"
                    value={facility.pcr_service ? 'Yes' : 'No'}
                    valueClassName={facility.pcr_service ? 'text-success' : 'text-muted-foreground'}
                  />
                  <InfoItem
                    label="CD4 Service"
                    value={facility.cd4_service ? 'Yes' : 'No'}
                    valueClassName={facility.cd4_service ? 'text-success' : 'text-muted-foreground'}
                  />
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h3 className="font-semibold mb-3">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <InfoItem label="Contact Person (Pharmacy)" value={facility.contact_name_pharmacy} />
                  <InfoItem label="Designation" value={facility.designation} />
                  <InfoItem label="Phone (Pharmacy)" value={facility.phone_pharmacy} />
                  <InfoItem label="Email" value={facility.email} />
                </div>
              </div>

              {/* Capacity */}
              <div>
                <h3 className="font-semibold mb-3">Capacity</h3>
                <div className="grid grid-cols-2 gap-4">
                  <InfoItem label="Storage Capacity" value={facility.storage_capacity} />
                  <InfoItem label="General Capacity" value={facility.capacity} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="programs" className="m-0">
              <FacilityProgramsSection facility={facility} />
            </TabsContent>

            <TabsContent value="services" className="m-0">
              {servicesLoading ? (
                <div className="space-y-2">
                  {[...Array(11)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {services?.map((service) => (
                    <div
                      key={service.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <span className="font-medium">{service.service_name}</span>
                      <Badge variant={service.availability ? 'default' : 'secondary'}>
                        {service.availability ? 'Available' : 'Not Available'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="deliveries" className="m-0">
              {deliveriesLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : deliveries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No delivery history yet
                </div>
              ) : (
                <div className="space-y-2">
                  {deliveries.map((delivery) => (
                    <div key={delivery.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">
                          {format(new Date(delivery.delivery_date), 'PPP')}
                        </span>
                        <Badge>{delivery.status}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Items delivered: {delivery.items_delivered}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="stock" className="m-0">
              {stockLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : !stock || stock.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No stock information available
                </div>
              ) : (
                <div className="space-y-2">
                  {stock.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{item.product_name}</div>
                        <div className="text-sm text-muted-foreground">
                          Last updated: {format(new Date(item.last_updated), 'PPp')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{item.quantity}</div>
                        <div className="text-sm text-muted-foreground">{item.unit}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="audit" className="m-0">
              {auditLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No audit history
                </div>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant={
                          log.action === 'created' ? 'default' :
                          log.action === 'updated' ? 'secondary' :
                          log.action === 'deleted' ? 'destructive' : 'outline'
                        }>
                          {log.action}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(log.timestamp), 'PPp')}
                        </span>
                      </div>
                      {log.user_id && (
                        <div className="text-xs text-muted-foreground">
                          By: {log.user_id}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function InfoItem({
  label,
  value,
  mono = false,
  className = '',
  valueClassName = '',
}: {
  label: string;
  value?: string | number | null;
  mono?: boolean;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={className}>
      <div className="text-sm text-muted-foreground mb-1">{label}</div>
      <div className={`${mono ? 'font-mono' : ''} ${valueClassName}`}>
        {value || '-'}
      </div>
    </div>
  );
}

function BadgeInfoItem({
  label,
  values,
  variant = 'secondary',
}: {
  label: string;
  values: string[];
  variant?: React.ComponentProps<typeof Badge>['variant'];
}) {
  return (
    <div>
      <div className="text-sm text-muted-foreground mb-1">{label}</div>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {values.map((v) => (
            <Badge key={v} variant={variant} className="text-xs">
              {v}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground">-</span>
      )}
    </div>
  );
}

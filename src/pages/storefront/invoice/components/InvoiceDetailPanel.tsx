import { useState } from 'react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/formatCurrency';
import { X, Building2, Warehouse, Calendar, Truck, Edit, Package, ShoppingBag, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { Invoice } from '@/types/invoice';
import { INVOICE_STATUS_CONFIG } from '@/types/invoice';
import { useNavigate } from 'react-router-dom';
import { InvoiceStatusActions } from '@/components/storefront/invoice/InvoiceStatusActions';
import { PackagingMenuDialog } from './PackagingMenuDialog';

interface InvoiceDetailPanelProps {
  invoice: Invoice;
  onClose: () => void;
  onEdit?: () => void;
}

export function InvoiceDetailPanel({ invoice, onClose, onEdit }: InvoiceDetailPanelProps) {
  const navigate = useNavigate();
  const statusConfig = INVOICE_STATUS_CONFIG[invoice.status];
  const [packagingDialogOpen, setPackagingDialogOpen] = useState(false);

  const handleStatusChanged = (newStatus: string) => {
    if (newStatus === 'packaging_pending') {
      setPackagingDialogOpen(true);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd MMM yyyy');
    } catch {
      return '-';
    }
  };

  const canDispatch = () => {
    return (
      invoice.status === 'ready' ||
      invoice.status === 'packaged'
    ) && invoice.total_weight_kg && invoice.total_volume_m3;
  };

  const handleDispatchToFleetOps = () => {
    // Navigate to Storefront scheduler with invoice data
    navigate('/storefront/scheduler', {
      state: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        facilityId: invoice.facility_id,
        warehouseId: invoice.warehouse_id,
      },
    });
  };

  return (
    <div className="w-96 border-l bg-background flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold font-mono">{invoice.invoice_number}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={cn('font-normal', statusConfig.color)}>
                {statusConfig.label}
              </Badge>
              {invoice.ref_number && (
                <Badge variant="outline">Ref: {invoice.ref_number}</Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Facility Info */}
          {invoice.facility && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Destination</h3>
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{invoice.facility.name}</span>
                </div>
                {invoice.facility.address && (
                  <p className="text-sm text-muted-foreground ml-6">{invoice.facility.address}</p>
                )}
                {invoice.facility.lga && (
                  <p className="text-sm text-muted-foreground ml-6">{invoice.facility.lga}</p>
                )}
              </div>
            </div>
          )}

          {/* Warehouse Info */}
          {invoice.warehouse && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Source Warehouse</h3>
              <div className="flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-muted-foreground" />
                <span>{invoice.warehouse.name}</span>
                {invoice.warehouse.code && (
                  <Badge variant="outline" className="text-xs">{invoice.warehouse.code}</Badge>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Dates */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Dates</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Created</p>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">{formatDate(invoice.created_at)}</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Last Updated</p>
                <span className="text-sm">{formatDate(invoice.updated_at)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Metrics */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Metrics</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Total Weight</p>
                <p className="text-lg font-semibold">
                  {invoice.total_weight_kg?.toFixed(2) || '-'} kg
                </p>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Total Volume</p>
                <p className="text-lg font-semibold">
                  {invoice.total_volume_m3?.toFixed(4) || '-'} m³
                </p>
              </div>
            </div>

            <div className="p-3 bg-primary/10 rounded-lg">
              <p className="text-xs text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(invoice.total_price)}
              </p>
            </div>
          </div>

          <Separator />

          {/* Packaging */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Packaging</h3>

            {invoice.packaging_required ? (
              <div className="space-y-2">
                {/* Package breakdown if available */}
                {invoice.packaging && invoice.packaging.total_packages > 0 ? (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-purple-700">
                        <Package className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {invoice.packaging.total_packages} package
                          {invoice.packaging.total_packages !== 1 ? 's' : ''} configured
                        </span>
                      </div>
                      <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                        {invoice.status === 'packaged' ? 'Packaged' : 'Packaging Pending'}
                      </Badge>
                    </div>
                    {/* Per-type breakdown from package_items */}
                    <div className="flex flex-wrap gap-1">
                      {/* Show packaging mode summary */}
                      <Badge variant="outline" className="text-xs text-purple-700 border-purple-300">
                        {invoice.packaging.packaging_mode === 'bag' ? (
                          <><ShoppingBag className="h-3 w-3 mr-1" />Bags</>
                        ) : (
                          <><Package className="h-3 w-3 mr-1" />Boxes</>
                        )}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-700 font-medium">Packaging not yet configured</p>
                    <p className="text-xs text-yellow-600 mt-0.5">
                      Configure packaging to unlock dispatch
                    </p>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setPackagingDialogOpen(true)}
                >
                  <Package className="h-3.5 w-3.5 mr-1.5" />
                  {invoice.packaging ? 'Edit Packaging' : 'Configure Packaging'}
                  <ChevronRight className="h-3.5 w-3.5 ml-auto" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-muted/30 border rounded-lg">
                <p className="text-sm text-muted-foreground">No packaging required</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setPackagingDialogOpen(true)}
                >
                  Change
                </Button>
              </div>
            )}
          </div>

          {invoice.notes && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Notes</h3>
                <p className="text-sm">{invoice.notes}</p>
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="flex-shrink-0 p-4 border-t space-y-2">
        <InvoiceStatusActions
          invoiceId={invoice.id}
          currentStatus={invoice.status}
          invoiceNumber={invoice.invoice_number}
          onStatusChanged={handleStatusChanged}
        />

        {canDispatch() && (
          <Button onClick={handleDispatchToFleetOps} className="w-full">
            <Truck className="h-4 w-4 mr-2" />
            Dispatch to FleetOps
          </Button>
        )}
        <Button variant="outline" className="w-full" onClick={onEdit}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Invoice
        </Button>
      </div>

      {/* Packaging dialog */}
      <PackagingMenuDialog
        open={packagingDialogOpen}
        onOpenChange={setPackagingDialogOpen}
        invoice={invoice}
      />
    </div>
  );
}

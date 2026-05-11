import { useState, useMemo } from 'react';
import { formatCurrency } from '@/lib/formatCurrency';
import { Plus, Search, FileText, CheckCircle, Package, Truck, Check, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { useInvoices, useInvoicesStats } from '@/hooks/useInvoices';
import type { Invoice, InvoiceStatus, InvoiceFilters } from '@/types/invoice';
import { INVOICE_STATUS_CONFIG } from '@/types/invoice';
import { InvoiceRow } from './components/InvoiceRow';
import { InvoiceDetailPanel } from './components/InvoiceDetailPanel';
import { NewInvoiceWizard } from './components/NewInvoiceWizard';

const STATUS_ORDER: InvoiceStatus[] = [
  'draft',
  'ready',
  'packaging_pending',
  'packaged',
  'dispatched',
  'completed',
  'cancelled',
];

const STATUS_ICONS: Record<InvoiceStatus, React.ComponentType<{ className?: string }>> = {
  draft: FileText,
  ready: CheckCircle,
  packaging_pending: Package,
  packaged: Package,
  dispatched: Truck,
  completed: Check,
  cancelled: XCircle,
};

export default function InvoicePage() {
  // Filters state
  const [filters, setFilters] = useState<InvoiceFilters>({});
  const [searchTerm, setSearchTerm] = useState('');

  // Selection state
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Dialog state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  // Accordion state
  const [openAccordions, setOpenAccordions] = useState<string[]>(['draft', 'ready']);

  // Active filters
  const activeFilters = useMemo(() => ({
    ...filters,
    search: searchTerm || undefined,
  }), [filters, searchTerm]);

  // Data fetching
  const { data, isLoading } = useInvoices(activeFilters);
  const { data: stats } = useInvoicesStats();

  const invoices = data?.invoices || [];

  // Group invoices by status
  const groupedInvoices = useMemo(() => {
    const groups: Record<InvoiceStatus, Invoice[]> = {
      draft: [],
      ready: [],
      packaging_pending: [],
      packaged: [],
      dispatched: [],
      completed: [],
      cancelled: [],
    };

    invoices.forEach((invoice) => {
      if (groups[invoice.status]) {
        groups[invoice.status].push(invoice);
      }
    });

    return groups;
  }, [invoices]);

  // Handlers
  const handleInvoiceClick = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedInvoice(null);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Invoice</h1>
              <p className="text-sm text-muted-foreground">
                Manage delivery invoices and packaging
              </p>
            </div>
            <Button onClick={() => setIsWizardOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Invoice
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Invoices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-2xl font-bold">{stats?.total_invoices || 0}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Value
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold">
                  {formatCurrency(stats?.total_value || 0)}
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Ready to Dispatch
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-500" />
                  <span className="text-2xl font-bold">{stats?.ready_count || 0}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Dispatched
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-indigo-500" />
                  <span className="text-2xl font-bold">{stats?.dispatched_count || 0}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm('')}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* List */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <FileText className="h-12 w-12 mb-2 opacity-50" />
              <p>No invoices found</p>
              <p className="text-sm">Create a new invoice to get started</p>
            </div>
          ) : (
            <Accordion
              type="multiple"
              value={openAccordions}
              onValueChange={setOpenAccordions}
              className="p-4"
            >
              {STATUS_ORDER.map((status) => {
                const statusInvoices = groupedInvoices[status];
                const config = INVOICE_STATUS_CONFIG[status];
                const Icon = STATUS_ICONS[status];

                if (statusInvoices.length === 0) return null;

                return (
                  <AccordionItem key={status} value={status} className="border rounded-lg mb-2">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${config.color.split(' ')[0]}`} />
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{config.label}</span>
                        <Badge variant="secondary" className="ml-2">
                          {statusInvoices.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-2">
                        {statusInvoices.map((invoice) => (
                          <InvoiceRow
                            key={invoice.id}
                            invoice={invoice}
                            onClick={() => handleInvoiceClick(invoice)}
                            isSelected={selectedInvoice?.id === invoice.id}
                          />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>

        {/* Detail Panel */}
        {isDetailOpen && selectedInvoice && (
          <InvoiceDetailPanel
            invoice={selectedInvoice}
            onClose={handleCloseDetail}
            onEdit={() => {
              setEditingInvoice(selectedInvoice);
              setIsWizardOpen(true);
            }}
          />
        )}
      </div>

      {/* New / Edit Invoice Wizard */}
      <NewInvoiceWizard
        key={editingInvoice?.id ?? 'new'}
        open={isWizardOpen}
        onOpenChange={(open) => {
          setIsWizardOpen(open);
          if (!open) setEditingInvoice(null);
        }}
        editingInvoice={editingInvoice ?? undefined}
      />
    </div>
  );
}

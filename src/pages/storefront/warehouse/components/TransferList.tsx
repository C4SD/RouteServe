import { format } from 'date-fns';
import { ArrowRight, Search } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { InventoryTransfer, TransferStatus } from '@/types/warehouse';

interface TransferListProps {
  transfers: InventoryTransfer[];
  isLoading: boolean;
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  searchTerm: string;
  statusFilter: TransferStatus | '';
  onSearchChange: (term: string) => void;
  onStatusFilterChange: (status: TransferStatus | '') => void;
  onPageChange: (page: number) => void;
  onTransferClick: (transfer: InventoryTransfer) => void;
  selectedTransferId?: string;
}

const STATUS_CONFIG: Record<TransferStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  in_transit: { label: 'In Transit', color: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  partial: { label: 'Partial', color: 'bg-amber-100 text-amber-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
};

export function TransferList({
  transfers,
  isLoading,
  total,
  page,
  totalPages,
  pageSize,
  searchTerm,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
  onPageChange,
  onTransferClick,
  selectedTransferId,
}: TransferListProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd MMM yyyy HH:mm');
    } catch {
      return '-';
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="flex-shrink-0 p-4 border-b flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transfers..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter || '__all__'}
          onValueChange={(v) => onStatusFilterChange(v === '__all__' ? '' : v as TransferStatus)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {transfers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <p>No transfers found</p>
          <p className="text-sm">Create a transfer to move stock between nodes</p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 border-b">
                <TableRow>
                  <TableHead className="min-w-[130px]">Transfer #</TableHead>
                  <TableHead className="min-w-[280px]">Route</TableHead>
                  <TableHead className="min-w-[100px]">Status</TableHead>
                  <TableHead className="min-w-[140px]">Created</TableHead>
                  <TableHead className="min-w-[140px]">Dispatched</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((transfer) => {
                  const statusCfg = STATUS_CONFIG[transfer.status];
                  return (
                    <TableRow
                      key={transfer.id}
                      className={cn(
                        'cursor-pointer hover:bg-muted/50',
                        selectedTransferId === transfer.id && 'bg-blue-50'
                      )}
                      onClick={() => onTransferClick(transfer)}
                    >
                      <TableCell>
                        <span className="font-mono text-sm">{transfer.transfer_number}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium truncate max-w-[120px]">
                            {transfer.from_warehouse?.name || 'Unknown'}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate max-w-[120px]">
                            {transfer.to_warehouse?.name || 'Unknown'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('font-normal', statusCfg.color)}>
                          {statusCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(transfer.created_at)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(transfer.dispatched_at)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex-shrink-0 border-t p-4 flex items-center justify-between bg-background">
            <p className="text-sm text-muted-foreground">
              Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page === 0}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages || 1}</span>
              <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

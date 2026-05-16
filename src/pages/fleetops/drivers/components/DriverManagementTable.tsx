/**
 * Driver Management Table View
 * Clean table layout for driver list with search, filter, and actions
 * Uses RouteServe design system branding
 */

import React, { useState } from 'react';
import { useDrivers } from '@/hooks/useDrivers';
import { useDriverManagement } from '@/hooks/useDriverManagement';
import { DriverDocumentsPanel } from '@/components/drivers/DriverDocumentsPanel';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  ArrowUpDown,
  Filter,
  List,
  Grid,
  Check,
  X,
  MoreVertical,
  Phone,
  Mail,
  MessageSquare,
  Edit,
  Trash2,
  FileText,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStatusColors } from '@/lib/designTokens';
import type { Driver } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface DriverManagementTableProps {
  onDriverSelect?: (driver: Driver) => void;
  onViewChange?: (view: 'table' | 'grid') => void;
  onEditDriver?: (driver: Driver) => void;
}

const ITEMS_PER_PAGE = 10;

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getDriverStatusBadge(status: Driver['status']) {
  const statusMap = {
    available: { variant: 'success' as const, label: 'Available' },
    busy: { variant: 'default' as const, label: 'Busy' },
    offline: { variant: 'secondary' as const, label: 'Offline' },
  };

  const config = statusMap[status] || statusMap.offline;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function DriverManagementTable({
  onDriverSelect,
  onViewChange,
  onEditDriver,
}: DriverManagementTableProps) {
  const { data: drivers = [], isLoading } = useDrivers();
  const { updateDriver, deleteDriver } = useDriverManagement();

  const [searchQuery, setSearchQuery] = useState('');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [driverToReject, setDriverToReject] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [documentsDialogOpen, setDocumentsDialogOpen] = useState(false);
  const [selectedDriverForDocs, setSelectedDriverForDocs] = useState<{ id: string; name: string } | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'location'>('name');
  const [filterStatus, setFilterStatus] = useState<'all' | Driver['status']>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Filter and search drivers
  const filteredDrivers = drivers.filter((driver) => {
    const matchesSearch =
      searchQuery === '' ||
      driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.phone.includes(searchQuery) ||
      (driver.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    const matchesFilter = filterStatus === 'all' || driver.status === filterStatus;

    return matchesSearch && matchesFilter;
  });

  // Sort drivers
  const sortedDrivers = [...filteredDrivers].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'status':
        return a.status.localeCompare(b.status);
      default:
        return 0;
    }
  });

  // Pagination
  const totalPages = Math.ceil(sortedDrivers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedDrivers = sortedDrivers.slice(startIndex, endIndex);

  const handleApprove = async (driverId: string) => {
    try {
      updateDriver({
        id: driverId,
        data: { onboarding_completed: true }
      });
      toast.success('Driver approved successfully', {
        description: 'The driver can now be assigned to deliveries.'
      });
    } catch (error) {
      toast.error('Failed to approve driver', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const handleReject = async (driverId: string) => {
    setDriverToReject(driverId);
    setRejectDialogOpen(true);
  };

  const confirmReject = async () => {
    if (!driverToReject || !rejectionReason.trim()) return;

    try {
      updateDriver({
        id: driverToReject,
        data: {
          onboarding_completed: false,
          // Store rejection reason in a notes field if available, or we could extend the schema
        }
      });
      toast.success('Driver rejected', {
        description: 'The driver onboarding has been rejected.'
      });
      setRejectDialogOpen(false);
      setRejectionReason('');
      setDriverToReject(null);
    } catch (error) {
      toast.error('Failed to reject driver', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const handleDelete = async (driverId: string) => {
    if (confirm('Are you sure you want to delete this driver?')) {
      await deleteDriver.mutateAsync(driverId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading drivers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Actions Bar */}
      <div className="flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search drivers"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Sort Dropdown */}
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-[140px]">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="location">Location</SelectItem>
            </SelectContent>
          </Select>

          {/* Filter Dropdown */}
          <Select
            value={filterStatus}
            onValueChange={(value: any) => setFilterStatus(value)}
          >
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Drivers</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="busy">Busy</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
            </SelectContent>
          </Select>

          {/* View Toggle */}
          <ToggleGroup
            type="single"
            defaultValue="table"
            onValueChange={(value) => {
              if (value && onViewChange) {
                onViewChange(value as 'table' | 'grid');
              }
            }}
          >
            <ToggleGroupItem value="table" aria-label="Table view">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Grid view">
              <Grid className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="py-4 px-4 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                Name
              </TableHead>
              <TableHead className="py-4 px-4 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                Phone Number
              </TableHead>
              <TableHead className="py-4 px-4 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                Email
              </TableHead>
              <TableHead className="py-4 px-4 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                Location
              </TableHead>
              <TableHead className="py-4 px-4 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                Documents
              </TableHead>
              <TableHead className="py-4 px-4 text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedDrivers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No drivers found
                </TableCell>
              </TableRow>
            ) : (
              paginatedDrivers.map((driver) => (
                <TableRow
                  key={driver.id}
                  className="border-b border-border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => onDriverSelect?.(driver)}
                >
                  <TableCell className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={driver.profilePhotoUrl} />
                        <AvatarFallback className="bg-primary/10 text-primary font-medium">
                          {getInitials(driver.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-foreground">{driver.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {getDriverStatusBadge(driver.status)}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 px-4 text-sm text-foreground">{driver.phone}</TableCell>
                  <TableCell className="py-4 px-4 text-sm text-foreground">
                    {driver.email || (
                      <span className="text-muted-foreground italic">Not provided</span>
                    )}
                  </TableCell>
                  <TableCell className="py-4 px-4 text-sm text-foreground">
                    {driver.city || driver.location || (
                      <span className="text-muted-foreground italic">Unknown</span>
                    )}
                  </TableCell>
                  <TableCell className="py-4 px-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDriverForDocs({
                          id: driver.id,
                          name: driver.name
                        });
                        setDocumentsDialogOpen(true);
                      }}
                      className="text-sm text-primary hover:text-primary/80 underline underline-offset-4 transition-colors"
                    >
                      View Documents
                    </button>
                  </TableCell>
                  <TableCell className="py-4 px-4">
                    <div
                      className="flex items-center justify-end gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-success hover:bg-success/10"
                        onClick={() => handleApprove(driver.id)}
                        aria-label="Approve driver"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-destructive hover:bg-destructive/10"
                        onClick={() => handleReject(driver.id)}
                        aria-label="Reject driver"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="More actions">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => onDriverSelect?.(driver)}
                            className="gap-2"
                          >
                            <FileText className="h-4 w-4" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onEditDriver?.(driver)}
                            className="gap-2"
                          >
                            <Edit className="h-4 w-4" />
                            Edit Driver
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2">
                            <Phone className="h-4 w-4" />
                            Call Driver
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2">
                            <MessageSquare className="h-4 w-4" />
                            Send Message
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(driver.id)}
                            className="gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete Driver
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination className="mt-6">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className={cn(
                  'cursor-pointer',
                  currentPage === 1 && 'pointer-events-none opacity-50'
                )}
              />
            </PaginationItem>

            {[...Array(totalPages)].map((_, index) => {
              const page = index + 1;

              // Show first page, last page, current page, and pages around current
              const showPage =
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1);

              if (!showPage) {
                // Show ellipsis for gaps
                if (page === currentPage - 2 || page === currentPage + 2) {
                  return (
                    <PaginationItem key={page}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }
                return null;
              }

              return (
                <PaginationItem key={page}>
                  <PaginationLink
                    onClick={() => setCurrentPage(page)}
                    isActive={currentPage === page}
                    className={cn(
                      'cursor-pointer',
                      currentPage === page && 'bg-primary text-primary-foreground'
                    )}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              );
            })}

            <PaginationItem>
              <PaginationNext
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className={cn(
                  'cursor-pointer',
                  currentPage === totalPages && 'pointer-events-none opacity-50'
                )}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Summary */}
      <div className="text-sm text-muted-foreground text-center">
        Showing {startIndex + 1}-{Math.min(endIndex, sortedDrivers.length)} of{' '}
        {sortedDrivers.length} drivers
      </div>

      {/* Reject Driver Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Driver Onboarding</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this driver's onboarding. This action can be reversed later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Rejection Reason *</Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter the reason for rejection (e.g., incomplete documents, failed background check)..."
                rows={4}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setRejectionReason('');
              setDriverToReject(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReject}
              disabled={!rejectionReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reject Driver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Driver Documents Panel */}
      {selectedDriverForDocs && (
        <DriverDocumentsPanel
          driverId={selectedDriverForDocs.id}
          driverName={selectedDriverForDocs.name}
          isOpen={documentsDialogOpen}
          onClose={() => {
            setDocumentsDialogOpen(false);
            setSelectedDriverForDocs(null);
          }}
        />
      )}
    </div>
  );
}

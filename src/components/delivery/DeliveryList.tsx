import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Delivery } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { useFiltersStore } from '@/stores/filtersStore';
import { 
  Truck, 
  Calendar, 
  Clock, 
  MapPin, 
  Package, 
  User,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RotateCcw
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface DeliveryListProps {
  deliveries: Delivery[];
  onDeliveryUpdate: (deliveryId: string, updates: Partial<Delivery>) => void;
}

const DeliveryList = ({ deliveries, onDeliveryUpdate }: DeliveryListProps) => {
  // Use persisted filters from store
  const deliveryStatus = useFiltersStore((state) => state.deliveryStatus);
  const deliveryPriority = useFiltersStore((state) => state.deliveryPriority);
  const setDeliveryStatus = useFiltersStore((state) => state.setDeliveryStatus);
  const setDeliveryPriority = useFiltersStore((state) => state.setDeliveryPriority);
  const resetFilters = useFiltersStore((state) => state.resetFilters);

  const filteredDeliveries = deliveries.filter(delivery => {
    const statusMatch = deliveryStatus === 'all' || delivery.status === deliveryStatus;
    const priorityMatch = deliveryPriority === 'all' || delivery.priority === deliveryPriority;
    return statusMatch && priorityMatch;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'high': return 'bg-warning/10 text-warning border-warning/20';
      case 'medium': return 'bg-primary/10 text-primary border-primary/20';
      case 'low': return 'bg-muted/30 text-muted-foreground border-muted/50';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success/10 text-success border-success/20';
      case 'in-progress': return 'bg-primary/10 text-primary border-primary/20';
      case 'cancelled': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-warning/10 text-warning border-warning/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'in-progress': return RotateCcw;
      case 'cancelled': return XCircle;
      default: return Clock;
    }
  };

  const handleStatusChange = (deliveryId: string, newStatus: string) => {
    onDeliveryUpdate(deliveryId, { 
      status: newStatus as 'scheduled' | 'in-progress' | 'completed' | 'cancelled' 
    });
    
    const delivery = deliveries.find(d => d.id === deliveryId);
    if (delivery) {
      toast.success(`Delivery to ${delivery.facilityName} marked as ${newStatus}`);
    }
  };

  const sortedDeliveries = [...filteredDeliveries].sort((a, b) => {
    const dateA = new Date(`${a.scheduledDate} ${a.scheduledTime}`);
    const dateB = new Date(`${b.scheduledDate} ${b.scheduledTime}`);
    return dateA.getTime() - dateB.getTime();
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Truck className="w-5 h-5 text-primary" />
            <span>Delivery Management</span>
          </CardTitle>
          <CardDescription>
            View and manage all delivery schedules
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="space-y-2">
              <label htmlFor="status-filter" className="text-sm font-medium">Status Filter</label>
              <Select value={deliveryStatus} onValueChange={setDeliveryStatus}>
                <SelectTrigger id="status-filter" className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="priority-filter" className="text-sm font-medium">Priority Filter</label>
              <Select value={deliveryPriority} onValueChange={setDeliveryPriority}>
                <SelectTrigger id="priority-filter" className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                disabled={deliveryStatus === 'all' && deliveryPriority === 'all'}
              >
                Reset Filters
              </Button>
              <div className="text-sm text-muted-foreground self-center">
                Showing {sortedDeliveries.length} of {deliveries.length} deliveries
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deliveries Table */}
      <Card>
        <CardContent className="p-0">
          {sortedDeliveries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No deliveries found</p>
              <p className="text-sm">
                {deliveries.length === 0 
                  ? "Create your first delivery schedule to get started"
                  : "Try adjusting your filters to see more deliveries"
                }
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Facility</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Medication</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedDeliveries.map((delivery) => {
                    const StatusIcon = getStatusIcon(delivery.status);
                    
                    return (
                      <TableRow key={delivery.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{delivery.facilityName}</div>
                            <div className="text-sm text-muted-foreground">
                              Est. {delivery.estimatedDuration} min
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3 text-muted-foreground" />
                              <span className="text-sm">
                                {format(parseISO(delivery.scheduledDate), 'MMM d, yyyy')}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              <span className="text-sm">{delivery.scheduledTime}</span>
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{delivery.medicationType}</div>
                            <div className="text-sm text-muted-foreground">
                              Qty: {delivery.quantity}
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <Badge className={getPriorityColor(delivery.priority)}>
                            {delivery.priority === 'urgent' || delivery.priority === 'high' ? (
                              <AlertTriangle className="w-3 h-3 mr-1" />
                            ) : (
                              <Package className="w-3 h-3 mr-1" />
                            )}
                            {delivery.priority}
                          </Badge>
                        </TableCell>
                        
                        <TableCell>
                          <Badge className={getStatusColor(delivery.status)}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {delivery.status}
                          </Badge>
                        </TableCell>
                        
                        <TableCell>
                          {delivery.driver ? (
                            <div className="flex items-center space-x-1">
                              <User className="w-3 h-3 text-muted-foreground" />
                              <span className="text-sm">{delivery.driver}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          <Select
                            value={delivery.status}
                            onValueChange={(value) => handleStatusChange(delivery.id, value)}
                          >
                            <SelectTrigger className="w-[120px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="scheduled">Scheduled</SelectItem>
                              <SelectItem value="in-progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DeliveryList;
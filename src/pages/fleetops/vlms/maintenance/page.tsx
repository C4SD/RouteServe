'use client';

import { useState } from 'react';
import { useMaintenanceRecords } from '@/hooks/vlms/useMaintenance';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Calendar, Wrench } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ScheduleMaintenanceDialog } from './ScheduleMaintenanceDialog';

export default function MaintenancePage() {
  const { data: records, isLoading } = useMaintenanceRecords();
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

  const getStatusBadge = (status: string) => {
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-bold tracking-tight">Maintenance Management</h1>
          <p className="text-muted-foreground">Track vehicle maintenance and service records</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => alert('Calendar view coming soon!')}>
            <Calendar data-icon="inline-start" />
            Calendar View
          </Button>
          <Button onClick={() => setScheduleDialogOpen(true)}>
            <Plus data-icon="inline-start" />
            Schedule Maintenance
          </Button>
        </div>
      </div>

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : records && records.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Record ID</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Scheduled Date</TableHead>
                <TableHead>Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">{record.record_id}</TableCell>
                  <TableCell>
                    {record.vehicle?.make} {record.vehicle?.model}
                    <div className="text-sm text-muted-foreground">
                      {record.vehicle?.license_plate}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">
                    {record.maintenance_type?.replace('_', ' ')}
                  </TableCell>
                  <TableCell>{getStatusBadge(record.status)}</TableCell>
                  <TableCell>{getPriorityBadge(record.priority)}</TableCell>
                  <TableCell>
                    {record.scheduled_date
                      ? new Date(record.scheduled_date).toLocaleDateString()
                      : 'Not scheduled'}
                  </TableCell>
                  <TableCell>${record.total_cost?.toLocaleString() || '0'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={Wrench}
            title="No maintenance records found"
            description="Start tracking vehicle maintenance by scheduling your first service."
            variant="dashed"
          />
        )}
      </Card>

      <ScheduleMaintenanceDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
      />
    </div>
  );
}

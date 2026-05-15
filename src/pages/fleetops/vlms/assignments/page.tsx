'use client';

import { useEffect, useState } from 'react';
import { useAssignmentsStore } from '@/stores/vlms/assignmentsStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, UserCheck } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CreateAssignmentDialog } from './CreateAssignmentDialog';

export default function AssignmentsPage() {
  const { assignments, isLoading, fetchAssignments } = useAssignmentsStore();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      active: 'default',
      completed: 'outline',
      cancelled: 'destructive',
      overdue: 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-bold tracking-tight">Vehicle Assignments</h1>
          <p className="text-muted-foreground">Track vehicle assignments to drivers and locations</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus data-icon="inline-start" />
          Create Assignment
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : assignments && assignments.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assignment ID</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell className="font-medium">{assignment.assignment_id}</TableCell>
                  <TableCell>
                    {assignment.vehicle?.make} {assignment.vehicle?.model}
                    <div className="text-sm text-muted-foreground">
                      {assignment.vehicle?.license_plate}
                    </div>
                  </TableCell>
                  <TableCell>
                    {assignment.assigned_to?.full_name || 'N/A'}
                  </TableCell>
                  <TableCell>
                    {assignment.assigned_location?.name || 'N/A'}
                  </TableCell>
                  <TableCell className="capitalize">
                    {assignment.assignment_type?.replace('_', ' ')}
                  </TableCell>
                  <TableCell>{getStatusBadge(assignment.status)}</TableCell>
                  <TableCell>
                    {new Date(assignment.start_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {assignment.end_date
                      ? new Date(assignment.end_date).toLocaleDateString()
                      : 'Ongoing'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={UserCheck}
            title="No assignments found"
            description="Start assigning vehicles to drivers and locations to track utilization."
            variant="dashed"
          />
        )}
      </Card>

      <CreateAssignmentDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}

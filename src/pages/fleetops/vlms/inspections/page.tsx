'use client';

import { useEffect, useState } from 'react';
import { useInspectionsStore } from '@/stores/vlms/inspectionsStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClipboardCheck, Calendar, Plus } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { InspectionsCalendarView } from './InspectionsCalendarView';
import { CreateInspectionDialog } from './CreateInspectionDialog';

export default function InspectionsPage() {
  const { inspections, isLoading, fetchInspections } = useInspectionsStore();
  const [showCalendar, setShowCalendar] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    fetchInspections();
  }, [fetchInspections]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      passed: 'default',
      'passed with conditions': 'secondary',
      failed: 'destructive',
      pending: 'outline',
    };
    return <Badge variant={variants[status.toLowerCase()] || 'default'}>{status}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, any> = {
      routine: 'outline',
      pre_trip: 'default',
      post_trip: 'default',
      annual: 'secondary',
      safety: 'destructive',
    };
    return (
      <Badge variant={variants[type] || 'default'}>
        {type.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-bold tracking-tight">Vehicle Inspections</h1>
          <p className="text-muted-foreground">Track vehicle safety and compliance inspections</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setShowCalendar(true)}>
            <Calendar data-icon="inline-start" />
            Calendar View
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus data-icon="inline-start" />
            Create Inspection
          </Button>
        </div>
      </div>

      {/* Calendar View Modal */}
      {showCalendar && (
        <InspectionsCalendarView
          inspections={inspections}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {/* Create Inspection Dialog */}
      <CreateInspectionDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : inspections && inspections.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inspection ID</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Inspector</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Roadworthy</TableHead>
                <TableHead>Next Inspection</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inspections.map((inspection) => (
                <TableRow key={inspection.id}>
                  <TableCell className="font-medium">{inspection.inspection_id}</TableCell>
                  <TableCell>
                    {inspection.vehicle?.make} {inspection.vehicle?.model}
                    <div className="text-sm text-muted-foreground">
                      {inspection.vehicle?.license_plate}
                    </div>
                  </TableCell>
                  <TableCell>{getTypeBadge(inspection.inspection_type)}</TableCell>
                  <TableCell>
                    {new Date(inspection.inspection_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {inspection.inspector?.full_name || inspection.inspector_name}
                  </TableCell>
                  <TableCell>{getStatusBadge(inspection.overall_status)}</TableCell>
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
                      : 'N/A'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={ClipboardCheck}
            title="No inspections recorded"
            description="No vehicle inspections have been recorded yet."
            variant="dashed"
          />
        )}
      </Card>
    </div>
  );
}

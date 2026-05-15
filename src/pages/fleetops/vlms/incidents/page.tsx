'use client';

import { useEffect, useState } from 'react';
import { useIncidentsStore } from '@/stores/vlms/incidentsStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, AlertTriangle } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ReportIncidentDialog } from './ReportIncidentDialog';

export default function IncidentsPage() {
  const { incidents, isLoading, fetchIncidents } = useIncidentsStore();
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const getStatusBadge = (status: string) => {
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-bold tracking-tight">Incident Management</h1>
          <p className="text-muted-foreground">Track and manage vehicle incidents</p>
        </div>
        <Button onClick={() => setReportDialogOpen(true)}>
          <Plus data-icon="inline-start" />
          Report Incident
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : incidents && incidents.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Incident ID</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Est. Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.map((incident) => (
                <TableRow key={incident.id}>
                  <TableCell className="font-medium">{incident.incident_id}</TableCell>
                  <TableCell>
                    {incident.vehicle?.make} {incident.vehicle?.model}
                    <div className="text-sm text-muted-foreground">
                      {incident.vehicle?.license_plate}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">
                    {incident.incident_type?.replace('_', ' ')}
                  </TableCell>
                  <TableCell>{getSeverityBadge(incident.severity)}</TableCell>
                  <TableCell>{getStatusBadge(incident.status)}</TableCell>
                  <TableCell>
                    {new Date(incident.incident_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{incident.location}</TableCell>
                  <TableCell>
                    ${incident.estimated_repair_cost?.toLocaleString() || 'N/A'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={AlertTriangle}
            title="No incidents reported"
            description="No incidents on record. All vehicles are operating without reported issues."
            variant="dashed"
          />
        )}
      </Card>

      <ReportIncidentDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
      />
    </div>
  );
}

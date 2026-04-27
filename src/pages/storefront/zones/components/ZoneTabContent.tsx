import { useState } from 'react';
import { Plus, Layers, Building2, MapPin, LayoutGrid, Map } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useOperationalZones, useZoneMetrics } from '@/hooks/useOperationalZones';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateZoneDialog } from './CreateZoneDialog';
import { ZoneDetailDialog } from './ZoneDetailDialog';
import { EditZoneDialog } from './EditZoneDialog';
import { ZoneMapView } from './ZoneMapView';
import { OperationalZone } from '@/types/zones';

type ViewMode = 'grid' | 'map';

export function ZoneTabContent() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState<OperationalZone | null>(null);
  const [zoneToEdit, setZoneToEdit] = useState<OperationalZone | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const { zones, loading: zonesLoading } = useOperationalZones();
  const { data: metrics, isLoading: metricsLoading } = useZoneMetrics();

  const isLoading = zonesLoading || metricsLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Zones</h2>
          <p className="text-muted-foreground mt-1">
            Administrative boundaries and governance units
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as ViewMode)}>
            <ToggleGroupItem value="grid" aria-label="Grid view">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="map" aria-label="Map view">
              <Map className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Zone
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      {!isLoading && zones && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Zones</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{zones.length}</div>
              <p className="text-xs text-muted-foreground">
                {zones.filter(z => z.is_active).length} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Facilities</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics?.totalFacilities || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total LGAs</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics?.totalLGAs || 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Map View */}
      {viewMode === 'map' && (
        <ZoneMapView
          zones={zones || []}
          onZoneSelect={setSelectedZone}
        />
      )}

      {/* Zones Grid */}
      {viewMode === 'grid' && <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-24 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        ) : zones && zones.length > 0 ? (
          zones.map((zone) => (
            <Card
              key={zone.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedZone(zone)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {zone.name}
                      {!zone.is_active && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </CardTitle>
                    {zone.code && (
                      <CardDescription className="mt-1">
                        Code: {zone.code}
                      </CardDescription>
                    )}
                  </div>
                </div>
                {zone.description && (
                  <CardDescription className="mt-2 line-clamp-2">
                    {zone.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Click to view zone details
                </p>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Layers className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No zones found</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first zone to organize your operations
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Zone
              </Button>
            </CardContent>
          </Card>
        )}
      </div>}

      {/* Dialogs */}
      <CreateZoneDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      {selectedZone && (
        <ZoneDetailDialog
          zone={selectedZone}
          open={!!selectedZone}
          onOpenChange={(open) => !open && setSelectedZone(null)}
          onEditRequest={() => setZoneToEdit(selectedZone)}
        />
      )}

      {zoneToEdit && (
        <EditZoneDialog
          zone={zoneToEdit}
          open={!!zoneToEdit}
          onOpenChange={(open) => !open && setZoneToEdit(null)}
        />
      )}
    </div>
  );
}

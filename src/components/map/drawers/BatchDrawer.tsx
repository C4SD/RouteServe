import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, MapPin, Clock, User, X, CheckCircle } from 'lucide-react';
import { useDeliveryBatches } from '@/hooks/useDeliveryBatches';

interface BatchDrawerProps {
  isOpen: boolean;
  batchId: string | null;
  onClose: () => void;
}

export function BatchDrawer({ isOpen, batchId, onClose }: BatchDrawerProps) {
  const { data: batches = [] } = useDeliveryBatches();
  const batch: any = batchId ? batches.find((b: any) => b.id === batchId) : null;

  if (!batch) return null;

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'planned':
        return 'outline';
      case 'assigned':
        return 'secondary';
      case 'in-progress':
        return 'default';
      case 'completed':
        return 'default';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const completedStops = batch.facilities?.filter((f: any) => f.status === 'delivered').length || 0;
  const totalStops = batch.facilities?.length || 0;
  const progressPct = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[480px] overflow-y-auto">
        <SheetHeader className="border-b border-border pb-4 mb-6">
          <div className="flex items-center justify-between">
            <SheetTitle>Batch Details</SheetTitle>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close drawer">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
              <Package className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">{batch.name}</h3>
              <p className="text-sm text-muted-foreground">
                {batch.medicationType}
              </p>
              <Badge variant={getStatusVariant(batch.status)} className="mt-1">
                {batch.status}
              </Badge>
            </div>
          </div>

          {/* Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Delivery Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Completed:</span>
                  <span className="font-medium">
                    {completedStops} / {totalStops} stops
                  </span>
                </div>
                <Progress value={progressPct} />
              </div>
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Batch Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Distance:</span>
                <span className="font-medium">{batch.totalDistance} km</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Est. Duration:</span>
                <span className="font-medium">{batch.estimatedDuration} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Quantity:</span>
                <span className="font-medium">{batch.totalQuantity} items</span>
              </div>
              {batch.totalWeight && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Weight:</span>
                  <span className="font-medium">{batch.totalWeight} kg</span>
                </div>
              )}
              {batch.programs && batch.programs.length > 0 && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Programs:</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {batch.programs.slice(0, 2).map((p: string) => (
                      <Badge key={p} variant="outline" className="text-[10px] px-1.5 py-0">
                        {p}
                      </Badge>
                    ))}
                    {batch.programs.length > 2 && (
                      <span className="text-[10px] text-muted-foreground self-center">
                        +{batch.programs.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stops List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Delivery Stops</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {batch.facilities?.map((facility: any, index: number) => (
                    <div
                      key={facility.id}
                      className="flex items-center gap-3 p-2 border border-border rounded-md"
                    >
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-xs font-semibold">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {facility.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {facility.address}
                        </div>
                      </div>
                      {facility.status === 'delivered' && (
                        <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-2">
            {batch.status === 'planned' && (
              <Button className="w-full gap-2">
                <User className="h-4 w-4" />
                Assign Driver
              </Button>
            )}
            <Button variant="outline" className="w-full gap-2">
              <MapPin className="h-4 w-4" />
              View on Map
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

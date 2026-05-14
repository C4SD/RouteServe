import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useCreateZone } from '@/hooks/useOperationalZones';
import { CreateZoneInput } from '@/types/zones';
import { ZoneMapDrawer, GeometrySummary } from './ZoneMapDrawer';

interface CreateZoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateZoneDialog({ open, onOpenChange }: CreateZoneDialogProps) {
  const [formData, setFormData] = useState<CreateZoneInput>({
    name: '',
    code: '',
    description: '',
    is_active: true,
  });
  const [geometrySummary, setGeometrySummary] = useState<GeometrySummary | null>(null);

  const createZone = useCreateZone();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createZone.mutateAsync(formData);
      onOpenChange(false);
      resetForm();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      is_active: true,
    });
    setGeometrySummary(null);
  };

  const handleChange = (field: keyof CreateZoneInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGeometryChange = useCallback((geometry: GeoJSON.Polygon | null, summary: GeometrySummary | null) => {
    setGeometrySummary(summary);

    if (summary && geometry) {
      // Set region_center from polygon centroid + persist geometry and summary in metadata
      setFormData(prev => ({
        ...prev,
        region_center: { lat: summary.center.lat, lng: summary.center.lng },
        metadata: {
          ...prev.metadata,
          geometry,
          geometry_summary: {
            areaKm2: summary.areaKm2,
            vertices: summary.vertices,
            center: summary.center,
          },
        },
      }));
    } else {
      setFormData(prev => {
        const { region_center, metadata, ...rest } = prev;
        return rest;
      });
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[900px] max-h-[90vh] overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle>Create New Zone</DialogTitle>
            <DialogDescription>
              Add a new operational zone to organize warehouses, LGAs, and facilities.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-6 py-4 flex-1 min-h-0">
            {/* Left Panel - Form Fields */}
            <div className="flex flex-col gap-4 overflow-y-auto pr-2">
              <div className="grid gap-2">
                <Label htmlFor="name">Zone Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Central Zone"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="code">Zone Code</Label>
                <Input
                  id="code"
                  placeholder="e.g., CZ01"
                  value={formData.code}
                  onChange={(e) => handleChange('code', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Optional short code for easy reference
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the zone's coverage area..."
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="is_active">Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable this zone for operations
                  </p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => handleChange('is_active', checked)}
                />
              </div>

              {/* Geometry Summary */}
              {geometrySummary && (
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium">Geometry Summary</Label>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>
                      Area: {geometrySummary.areaKm2} km<sup>2</sup>
                    </li>
                    <li>Vertices: {geometrySummary.vertices}</li>
                    <li>
                      Center: {geometrySummary.center.lat}, {geometrySummary.center.lng}
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Right Panel - Map */}
            <div className="flex flex-col min-h-[400px]">
              <Label className="text-sm font-medium uppercase tracking-wide mb-2">Zone Map</Label>
              <div className="flex-1 border rounded-lg overflow-hidden">
                <ZoneMapDrawer onGeometryChange={handleGeometryChange} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createZone.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createZone.isPending}>
              {createZone.isPending ? 'Creating...' : 'Create Zone'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

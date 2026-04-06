/**
 * VLMS Vehicle Onboarding — Step 2: Sub-type Selection
 * BIKO design system: shadcn Card/Badge/Button, semantic color tokens, rounded-lg.
 */

import { useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { getSubtypesByCategory } from '@/lib/vlms/vehicleTaxonomy';
import { useVehicleOnboardState } from '@/hooks/useVehicleOnboardState';
import type { VehicleType } from '@/types/vlms-onboarding';

// ─── Sub-type Card ────────────────────────────────────────────────────────────

interface SubtypeCardProps {
  subtype: VehicleType;
  isSelected: boolean;
  onSelect: () => void;
}

function SubtypeCard({ subtype, isSelected, onSelect }: SubtypeCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
    >
      <Card
        className={cn(
          'relative overflow-hidden transition-all duration-150 h-full',
          'cursor-pointer',
          isSelected
            ? 'border-foreground shadow-sm'
            : 'hover:shadow-md hover:border-border/80',
        )}
      >
        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute top-2.5 right-2.5 h-4.5 w-4.5 rounded-full bg-foreground flex items-center justify-center z-10">
            <Check className="h-2.5 w-2.5 text-background" strokeWidth={3} />
          </div>
        )}

        <CardContent className="flex flex-col items-center gap-2.5 p-4 pt-5">
          {/* Silhouette */}
          <div className="h-16 w-full flex items-end justify-center">
            {subtype.icon_name ? (
              <img
                src={subtype.icon_name}
                alt={subtype.name}
                className="max-h-16 max-w-full object-contain opacity-80 group-hover:opacity-100 transition-opacity"
                draggable={false}
              />
            ) : (
              <div className="h-12 w-20 rounded bg-muted flex items-center justify-center">
                <span className="text-muted-foreground text-lg">—</span>
              </div>
            )}
          </div>

          {/* Name + capacity */}
          <div className="text-center space-y-0.5 w-full">
            <p className={cn(
              'text-sm font-medium leading-snug',
              isSelected ? 'text-foreground' : 'text-foreground',
            )}>
              {subtype.name}
            </p>
            {subtype.default_capacity_kg && (
              <p className="text-xs text-muted-foreground">
                {subtype.default_capacity_kg >= 1000
                  ? `${(subtype.default_capacity_kg / 1000).toFixed(1)}t`
                  : `${subtype.default_capacity_kg}kg`}
                {subtype.default_capacity_m3 && ` · ${subtype.default_capacity_m3}m³`}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

// ─── Step ─────────────────────────────────────────────────────────────────────

export function VehicleSubcategoryStep() {
  const [isCustomDialogOpen, setIsCustomDialogOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');

  const selectedCategory = useVehicleOnboardState((s) => s.selectedCategory);
  const selectedType = useVehicleOnboardState((s) => s.selectedType);
  const customTypeName = useVehicleOnboardState((s) => s.customTypeName);
  const setSelectedType = useVehicleOnboardState((s) => s.setSelectedType);
  const setCustomTypeName = useVehicleOnboardState((s) => s.setCustomTypeName);
  const goToNextStep = useVehicleOnboardState((s) => s.goToNextStep);
  const goToPreviousStep = useVehicleOnboardState((s) => s.goToPreviousStep);
  const canGoNext = useVehicleOnboardState((s) => s.canGoNext());

  const subtypes = selectedCategory ? getSubtypesByCategory(selectedCategory.id) : [];

  const handleCreateCustom = () => {
    if (customInput.trim()) {
      setCustomTypeName(customInput.trim());
      setIsCustomDialogOpen(false);
      setCustomInput('');
    }
  };

  if (!selectedCategory) {
    return (
      <Alert variant="destructive">
        <AlertDescription>No category selected. Please go back and choose a category.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {selectedCategory.name}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{selectedCategory.description}</p>
        </div>

        <Dialog open={isCustomDialogOpen} onOpenChange={setIsCustomDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Custom type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Custom Vehicle Type</DialogTitle>
              <DialogDescription>
                Enter a name for this vehicle type. Configure capacity in the next step.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="custom-type-name">Vehicle Type Name</Label>
                <Input
                  id="custom-type-name"
                  placeholder="e.g., Toyota Hiace Custom"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateCustom()}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCustomDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateCustom} disabled={!customInput.trim()}>
                Use this type
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Custom type selected */}
      {customTypeName && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
          <Check className="h-4 w-4 text-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{customTypeName}</p>
            <p className="text-xs text-muted-foreground">Custom type</p>
          </div>
          <button
            type="button"
            onClick={() => setCustomTypeName('')}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            Clear
          </button>
        </div>
      )}

      {/* Sub-type grid */}
      {subtypes.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {subtypes.map((subtype) => (
            <SubtypeCard
              key={subtype.id}
              subtype={subtype}
              isSelected={selectedType?.id === subtype.id}
              onSelect={() => setSelectedType(subtype)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-10 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No predefined types for this category.</p>
          <Button variant="outline" size="sm" onClick={() => setIsCustomDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Create a custom type
          </Button>
        </div>
      )}

      {/* Footer nav */}
      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={goToPreviousStep}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back
        </Button>

        <Button onClick={goToNextStep} disabled={!canGoNext}>
          Configure Capacity
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

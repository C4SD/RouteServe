/**
 * VLMS Vehicle Onboarding — Step 1: Category Selection
 * RouteServe design system: shadcn Card components, semantic color tokens, rounded-lg.
 * Clicking a card immediately advances to the sub-type step.
 */

import { ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { VEHICLE_CATEGORIES } from '@/lib/vlms/vehicleTaxonomy';
import { useVehicleOnboardState } from '@/hooks/useVehicleOnboardState';
import type { VehicleCategory } from '@/types/vlms-onboarding';

const SPECIALIZED_ID = 'cat-specialized';
const mainCategories = VEHICLE_CATEGORIES.filter((c) => c.id !== SPECIALIZED_ID);
const specializedCategories = VEHICLE_CATEGORIES.filter((c) => c.id === SPECIALIZED_ID);

// ─── Category Card ────────────────────────────────────────────────────────────

interface CategoryCardProps {
  category: VehicleCategory;
  onClick: () => void;
}

function CategoryCard({ category, onClick }: CategoryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
    >
      <Card
        className={cn(
          'relative overflow-hidden transition-all duration-150',
          'hover:shadow-md hover:border-border/80',
          'cursor-pointer',
        )}
      >
        <CardContent className="flex items-center justify-between gap-4 p-5 min-h-[100px]">
          {/* Text */}
          <div className="flex flex-col gap-1 z-10">
            <span className="text-base font-semibold text-foreground leading-snug">
              {category.name}
            </span>
            <span className="flex items-center gap-0.5 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              Choose type
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>

          {/* Silhouette */}
          {category.icon_name && (
            <div className="shrink-0 h-[72px] w-[120px] relative">
              <img
                src={category.icon_name}
                alt={category.name}
                className="absolute bottom-0 right-0 h-full w-full object-contain object-right-bottom opacity-80 group-hover:opacity-100 transition-opacity drop-shadow-sm"
                draggable={false}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </button>
  );
}

// ─── Step ────────────────────────────────────────────────────────────────────

export function VehicleCategoryStep() {
  const setSelectedCategory = useVehicleOnboardState((s) => s.setSelectedCategory);
  const goToNextStep = useVehicleOnboardState((s) => s.goToNextStep);

  const handleSelect = (category: VehicleCategory) => {
    setSelectedCategory(category);
    goToNextStep();
  };

  return (
    <div className="space-y-5">
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">Select a vehicle category</p>
        <p className="text-sm text-muted-foreground">
          You'll choose the specific type on the next step.
        </p>
      </div>

      {/* Main categories — 2-column grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {mainCategories.map((cat) => (
          <CategoryCard key={cat.id} category={cat} onClick={() => handleSelect(cat)} />
        ))}
      </div>

      {/* Specialized section */}
      {specializedCategories.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-0.5">
            Specialized Vehicles
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {specializedCategories.map((cat) => (
              <CategoryCard key={cat.id} category={cat} onClick={() => handleSelect(cat)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

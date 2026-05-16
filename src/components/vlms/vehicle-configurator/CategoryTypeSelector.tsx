/**
 * Category & Type Selector Component
 * Compact horizontal bar for category, type, and model selection
 * Tesla/Arrival-inspired configurator style
 */

import React, { useEffect } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useVehicleCategories } from '@/hooks/useVehicleCategories';
import { useVehicleTypesByCategory } from '@/hooks/useVehicleTypes';
import type { VehicleCategory, VehicleType } from '@/types/vlms-onboarding';

interface CategoryTypeSelectorProps {
  selectedCategory: VehicleCategory | null;
  selectedType: VehicleType | null;
  modelName: string;
  onCategoryChange: (category: VehicleCategory | null) => void;
  onTypeChange: (type: VehicleType | null) => void;
  onModelNameChange: (name: string) => void;
}

export function CategoryTypeSelector({
  selectedCategory,
  selectedType,
  modelName,
  onCategoryChange,
  onTypeChange,
  onModelNameChange,
}: CategoryTypeSelectorProps) {
  const { data: categories, isLoading: categoriesLoading } = useVehicleCategories();
  const { data: vehicleTypes, isLoading: typesLoading } = useVehicleTypesByCategory(
    selectedCategory?.id
  );

  // Reset type when category changes
  useEffect(() => {
    if (selectedCategory && selectedType) {
      // Check if selected type belongs to new category
      const typeExists = vehicleTypes?.some(t => t.id === selectedType.id);
      if (!typeExists) {
        onTypeChange(null);
      }
    }
  }, [selectedCategory, selectedType, vehicleTypes, onTypeChange]);

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Category Selection */}
      <div className="space-y-1">
        <Label htmlFor="category" className="text-xs text-muted-foreground">Category</Label>
        <Select
          value={selectedCategory?.id || ''}
          onValueChange={(value) => {
            const category = categories?.find(c => c.id === value);
            onCategoryChange(category || null);
          }}
        >
          <SelectTrigger id="category" className="h-9">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {categoriesLoading ? (
              <SelectItem value="loading" disabled>
                Loading...
              </SelectItem>
            ) : categories && categories.length > 0 ? (
              <>
                {/* Group by source */}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  EU Standard
                </div>
                {categories
                  .filter(c => c.source === 'eu')
                  .map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          {category.code}
                        </span>
                        <span className="text-sm">{category.display_name || category.name}</span>
                      </div>
                    </SelectItem>
                  ))}

                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                  RouteServe Quick Select
                </div>
                {categories
                  .filter(c => c.source === 'biko')
                  .map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-warning/10 text-warning px-1.5 py-0.5 rounded">
                          RS
                        </span>
                        <span className="text-sm">{category.display_name || category.name}</span>
                      </div>
                    </SelectItem>
                  ))}
              </>
            ) : (
              <SelectItem value="none" disabled>
                No categories
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Vehicle Type Selection */}
      <div className="space-y-1">
        <Label htmlFor="vehicle-type" className="text-xs text-muted-foreground">Type</Label>
        <Select
          value={selectedType?.id || ''}
          onValueChange={(value) => {
            const type = vehicleTypes?.find(t => t.id === value);
            onTypeChange(type || null);
          }}
          disabled={!selectedCategory}
        >
          <SelectTrigger id="vehicle-type" className="h-9">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {typesLoading ? (
              <SelectItem value="loading" disabled>
                Loading...
              </SelectItem>
            ) : vehicleTypes && vehicleTypes.length > 0 ? (
              vehicleTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  <div className="flex flex-col">
                    <span className="text-sm">{type.name}</span>
                    {(type.default_capacity_m3 || type.default_capacity_kg) && (
                      <span className="text-xs text-muted-foreground">
                        {type.default_capacity_m3 && `${type.default_capacity_m3} m³`}
                        {type.default_capacity_m3 && type.default_capacity_kg && ' • '}
                        {type.default_capacity_kg && `${type.default_capacity_kg} kg`}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))
            ) : (
              <SelectItem value="none" disabled>
                No types
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Model Name Input */}
      <div className="space-y-1">
        <Label htmlFor="model-name" className="text-xs text-muted-foreground">
          Model <span className="text-muted-foreground">(Optional)</span>
        </Label>
        <Input
          id="model-name"
          type="text"
          placeholder="e.g., Toyota Hiace..."
          value={modelName}
          onChange={(e) => onModelNameChange(e.target.value)}
          disabled={!selectedCategory}
          className="h-9"
        />
      </div>
    </div>
  );
}

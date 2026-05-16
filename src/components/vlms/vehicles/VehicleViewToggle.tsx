/**
 * VehicleViewToggle Component
 * Toggle between list, card (grid), and kanban views
 * Uses RouteServe design system branding
 */

import React from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { List, Grid3x3, Kanban } from 'lucide-react';

export type ViewMode = 'list' | 'card' | 'kanban';

interface VehicleViewToggleProps {
  value: ViewMode;
  onValueChange: (value: ViewMode) => void;
}

export function VehicleViewToggle({ value, onValueChange }: VehicleViewToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(newValue) => {
        if (newValue) onValueChange(newValue as ViewMode);
      }}
      className="border border-border rounded-lg p-0.5"
    >
      <ToggleGroupItem
        value="list"
        aria-label="List view"
        className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      >
        <List className="h-4 w-4" />
        <span className="ml-2 text-sm font-medium hidden sm:inline">List</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="card"
        aria-label="Card view"
        className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      >
        <Grid3x3 className="h-4 w-4" />
        <span className="ml-2 text-sm font-medium hidden sm:inline">Card</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="kanban"
        aria-label="Kanban view"
        className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      >
        <Kanban className="h-4 w-4" />
        <span className="ml-2 text-sm font-medium hidden sm:inline">Kanban</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

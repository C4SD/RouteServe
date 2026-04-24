/**
 * =====================================================
 * Schedule Header
 * =====================================================
 * Header component for Step 2 (Schedule) containing
 * title, start location, and planned date inputs.
 */

import * as React from 'react';
import { format } from 'date-fns';
import { CalendarIcon, MapPin, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { StartLocationType } from '@/types/unified-workflow';
import type { TimeWindow } from '@/types/scheduler';

interface ScheduleHeaderProps {
  title: string | null;
  onTitleChange: (title: string) => void;
  startLocationId: string | null;
  startLocationType: StartLocationType;
  onStartLocationChange: (id: string, type: StartLocationType) => void;
  plannedDate: string | null;
  onPlannedDateChange: (date: string) => void;
  timeWindow: TimeWindow | null;
  onTimeWindowChange: (window: TimeWindow | null) => void;
  warehouses: Array<{ id: string; name: string }>;
  facilities?: Array<{ id: string; name: string }>;
  className?: string;
  /** When true, the start location is auto-set from the service policy and shown as read-only */
  startLocationAutoSet?: boolean;
}

export function ScheduleHeader({
  title,
  onTitleChange,
  startLocationId,
  startLocationType,
  onStartLocationChange,
  plannedDate,
  onPlannedDateChange,
  timeWindow,
  onTimeWindowChange,
  warehouses,
  facilities = [],
  className,
  startLocationAutoSet = false,
}: ScheduleHeaderProps) {
  const [locationTab, setLocationTab] = React.useState<StartLocationType>(startLocationType);

  const selectedDate = plannedDate ? new Date(plannedDate) : undefined;

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      onPlannedDateChange(format(date, 'yyyy-MM-dd'));
    }
  };

  const handleLocationChange = (id: string) => {
    onStartLocationChange(id, locationTab);
  };

  const locationOptions = locationTab === 'warehouse' ? warehouses : facilities;
  const selectedLocation = locationOptions.find((loc) => loc.id === startLocationId);

  return (
    <div className={cn('space-y-4 p-4 border-b bg-muted/30', className)}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Schedule Title */}
        <div className="md:col-span-1">
          <Label htmlFor="schedule-title" className="text-xs font-medium">
            Schedule Title
          </Label>
          <Input
            id="schedule-title"
            value={title || ''}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Enter schedule title..."
            className="mt-1"
          />
        </div>

        {/* Start Location */}
        <div className="md:col-span-1">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            Start Location
            {startLocationAutoSet && (
              <span className="text-xs font-normal text-muted-foreground">(from policy)</span>
            )}
          </Label>
          {startLocationAutoSet ? (
            <div className="flex items-center gap-2 mt-1 h-9 px-3 rounded-md border bg-muted/50 text-sm">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">
                {warehouses.find((w) => w.id === startLocationId)?.name ?? 'Warehouse from policy'}
              </span>
            </div>
          ) : (
            <div className="flex gap-2 mt-1">
              <div className="flex rounded-md border overflow-hidden">
                <Button
                  type="button"
                  variant={locationTab === 'warehouse' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-none h-9 px-2"
                  onClick={() => setLocationTab('warehouse')}
                >
                  <Building2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant={locationTab === 'facility' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-none h-9 px-2"
                  onClick={() => setLocationTab('facility')}
                  disabled={facilities.length === 0}
                >
                  <MapPin className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Select value={startLocationId || ''} onValueChange={handleLocationChange}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={`Select ${locationTab}...`} />
                </SelectTrigger>
                <SelectContent>
                  {locationOptions.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Planned Date */}
        <div className="md:col-span-1">
          <Label className="text-xs font-medium">Planned Date</Label>
          <Popover modal={false}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal mt-1',
                  !selectedDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-[10000]" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Time Window */}
        <div className="md:col-span-1">
          <Label className="text-xs font-medium">Time Window</Label>
          <Select
            value={timeWindow || ''}
            onValueChange={(value) => onTimeWindowChange(value as TimeWindow)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select time window..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="morning">Morning (6am - 12pm)</SelectItem>
              <SelectItem value="afternoon">Afternoon (12pm - 6pm)</SelectItem>
              <SelectItem value="evening">Evening (6pm - 10pm)</SelectItem>
              <SelectItem value="all_day">All Day</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Selected Location Display */}
      {selectedLocation && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {locationTab === 'warehouse' ? (
            <Building2 className="h-4 w-4" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
          <span>
            Starting from: <span className="font-medium text-foreground">{selectedLocation.name}</span>
          </span>
        </div>
      )}
    </div>
  );
}

export default ScheduleHeader;

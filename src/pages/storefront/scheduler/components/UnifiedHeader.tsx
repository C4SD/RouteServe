/**
 * =====================================================
 * Unified Scheduler Header Component (Two-Row Layout)
 * =====================================================
 * Renders a fixed-height header with two stacked rows:
 * 1. Identity & View toggle (Scheduler title, view segmented control, CTA)
 * 2. Filter controls (warehouse selector, date picker, advanced filters)
 */
 
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarIcon,
  Download,
  Filter,
  LayoutList,
  MapPin,
  Plus,
  Warehouse,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { SchedulerFilters } from '@/types/scheduler';
import type { DateRange } from 'react-day-picker';

export type ViewMode = 'status' | 'calendar';
export type StatusAssignmentFilter = 'any' | 'assigned' | 'unassigned';

export interface StatusFilterExtras {
  assignment: StatusAssignmentFilter;
  payloadMin?: number;
  payloadMax?: number;
  program: string | 'all';
  zone?: string | 'all';
}

interface UnifiedHeaderProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;

  statusFilters?: SchedulerFilters;
  onStatusFiltersChange?: (filters: SchedulerFilters) => void;
  statusExtras: StatusFilterExtras;
  onStatusExtrasChange: (filters: StatusFilterExtras) => void;

  selectedWarehouse?: string;
  onWarehouseChange?: (warehouseId: string) => void;
  selectedDate?: Date;
  onDateChange?: (date: Date | undefined) => void;
  calendarViewMode?: 'day' | 'week' | 'month';
  onCalendarViewModeChange?: (mode: 'day' | 'week' | 'month') => void;
  warehouses?: Array<{ id: string; name: string }>;
  availablePrograms?: string[];
  availableZones?: string[];

  onNewSchedule: () => void;
  onExport?: () => void;
  scheduleCount?: number;
}

export function UnifiedHeader({
  activeView,
  onViewChange,
  statusFilters = {},
  onStatusFiltersChange,
  statusExtras,
  onStatusExtrasChange,
  selectedWarehouse,
  onWarehouseChange,
  selectedDate,
  onDateChange,
  calendarViewMode = 'week',
  onCalendarViewModeChange,
  warehouses = [],
  availablePrograms = [],
  availableZones = [],
  onNewSchedule,
  onExport,
  scheduleCount = 0,
}: UnifiedHeaderProps) {
  const [statusDateRange, setStatusDateRange] = useState<DateRange | undefined>(
    statusFilters.date_range
      ? {
          from: statusFilters.date_range.from
            ? new Date(statusFilters.date_range.from)
            : undefined,
          to: statusFilters.date_range.to ? new Date(statusFilters.date_range.to) : undefined,
        }
      : undefined
  );

  useEffect(() => {
    setStatusDateRange(
      statusFilters.date_range
        ? {
            from: statusFilters.date_range.from
              ? new Date(statusFilters.date_range.from)
              : undefined,
            to: statusFilters.date_range.to ? new Date(statusFilters.date_range.to) : undefined,
          }
        : undefined
    );
  }, [statusFilters.date_range?.from, statusFilters.date_range?.to]);

  const statusDateRangeLabel = useMemo(() => {
    if (statusDateRange?.from && statusDateRange?.to) {
      const sameDay = format(statusDateRange.from, 'PP') === format(statusDateRange.to, 'PP');
      return sameDay
        ? format(statusDateRange.from, 'PPP')
        : `${format(statusDateRange.from, 'PP')} - ${format(statusDateRange.to, 'PP')}`;
    }

    if (statusDateRange?.from) {
      return `From ${format(statusDateRange.from, 'PP')}`;
    }

    return 'Select date range';
  }, [statusDateRange]);

  const handleStatusDateRangeChange = (range?: DateRange) => {
    setStatusDateRange(range);
    if (!onStatusFiltersChange) return;

    if (range?.from && range?.to) {
      onStatusFiltersChange({
        ...statusFilters,
        date_range: {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        },
      });
    } else {
      onStatusFiltersChange({
        ...statusFilters,
        date_range: undefined,
      });
    }
  };

  const updateStatusExtras = (updates: Partial<StatusFilterExtras>) => {
    onStatusExtrasChange({ ...statusExtras, ...updates });
  };

  const handleZoneChange = (zoneValue: string) => {
    updateStatusExtras({ zone: zoneValue as StatusFilterExtras['zone'] });
    onStatusFiltersChange?.({
      ...statusFilters,
      zone: zoneValue === 'all' ? undefined : [zoneValue as any],
    });
  };

  const renderStatusFilterRow = () => (
    <div className="flex h-14 items-center gap-3 overflow-x-auto border-b bg-muted/20 px-6">
      <Select
        value={statusFilters.warehouse_id || 'all'}
        onValueChange={(value) =>
          onStatusFiltersChange?.({
            ...statusFilters,
            warehouse_id: value === 'all' ? undefined : value,
          })
        }
      >
        <SelectTrigger className="w-48 bg-white">
          <Warehouse className="mr-2 h-4 w-4" />
          <SelectValue placeholder="All Warehouses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Warehouses</SelectItem>
          {warehouses.map((warehouse) => (
            <SelectItem key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-[240px] justify-start text-left font-normal bg-white',
              !statusDateRange?.from && !statusDateRange?.to && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span className="truncate">{statusDateRangeLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarPicker
            mode="range"
            numberOfMonths={2}
            selected={statusDateRange}
            onSelect={handleStatusDateRangeChange}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" className="gap-2 bg-white">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </SheetTrigger>
        <SheetContent className="flex w-full flex-col gap-6 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Refine schedules</SheetTitle>
          </SheetHeader>

          <section className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Zone
              </Label>
              <Select value={statusExtras.zone || 'all'} onValueChange={handleZoneChange}>
                <SelectTrigger>
                  <SelectValue placeholder="All zones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All zones</SelectItem>
                  {availableZones.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Assignment
              </Label>
              <ToggleGroup
                type="single"
                value={statusExtras.assignment}
                onValueChange={(value) =>
                  value && updateStatusExtras({ assignment: value as StatusAssignmentFilter })
                }
                className="grid grid-cols-3 gap-2"
              >
                <ToggleGroupItem value="any">Any</ToggleGroupItem>
                <ToggleGroupItem value="assigned">Assigned</ToggleGroupItem>
                <ToggleGroupItem value="unassigned">Unassigned</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-medium text-muted-foreground">
                Payload (kg)
              </Label>
              <Slider
                min={0}
                max={5000}
                step={100}
                value={[statusExtras.payloadMin ?? 0, statusExtras.payloadMax ?? 5000]}
                onValueChange={([min, max]) => updateStatusExtras({ payloadMin: min, payloadMax: max })}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{statusExtras.payloadMin ?? 0} kg</span>
                <span>{statusExtras.payloadMax ?? 5000} kg</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Programs
              </Label>
              <Select
                value={statusExtras.program}
                onValueChange={(value) => updateStatusExtras({ program: value as StatusFilterExtras['program'] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All programs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All programs</SelectItem>
                  {availablePrograms.map((program) => (
                    <SelectItem key={program} value={program}>
                      {program}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between space-x-3 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Show only flagged</p>
                <p className="text-xs text-muted-foreground">
                  Reserved for future operational alerts.
                </p>
              </div>
              <Switch disabled />
            </div>
          </section>

          <SheetFooter className="mt-auto">
            <SheetClose asChild>
              <Button variant="outline">Close</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );

  const renderCalendarFilterRow = () => (
    <div className="flex h-14 items-center gap-3 overflow-x-auto border-b bg-muted/20 px-6">
      <Select value={selectedWarehouse || 'all'} onValueChange={onWarehouseChange}>
        <SelectTrigger className="w-48 bg-white">
          <Warehouse className="mr-2 h-4 w-4" />
          <SelectValue placeholder="Select warehouse" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Warehouses</SelectItem>
          {warehouses.map((warehouse) => (
            <SelectItem key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-[240px] justify-start text-left font-normal bg-white',
              !selectedDate && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedDate ? format(selectedDate, 'PPP') : 'Pick date'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarPicker mode="single" selected={selectedDate} onSelect={onDateChange} initialFocus />
        </PopoverContent>
      </Popover>

      <ToggleGroup
        type="single"
        value={calendarViewMode}
        onValueChange={(value) => value && onCalendarViewModeChange?.(value as 'day' | 'week' | 'month')}
        className="border rounded-lg bg-white p-1"
      >
        <ToggleGroupItem value="day" className="px-3 py-1 text-sm">
          Day
        </ToggleGroupItem>
        <ToggleGroupItem value="week" className="px-3 py-1 text-sm">
          Week
        </ToggleGroupItem>
        <ToggleGroupItem value="month" className="px-3 py-1 text-sm">
          Month
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );

  return (
    <div className="flex flex-col bg-white">
      {/* Row 1: Identity & View Control */}
      <div className="flex h-14 items-center justify-between border-b px-6">
        <h1 className="text-lg font-semibold text-foreground">Scheduler</h1>
        <div className="flex items-center gap-3">
          <ToggleGroup
            type="single"
            value={activeView}
            onValueChange={(value) => value && onViewChange(value as ViewMode)}
            className="border rounded-lg bg-muted/50 p-1"
          >
            <ToggleGroupItem
              value="status"
              className="px-4 py-1.5 text-sm font-medium data-[state=on]:bg-white data-[state=on]:shadow-sm"
            >
              Status View
            </ToggleGroupItem>
            <ToggleGroupItem
              value="calendar"
              className="px-4 py-1.5 text-sm font-medium data-[state=on]:bg-white data-[state=on]:shadow-sm"
            >
              Calendar View
            </ToggleGroupItem>
          </ToggleGroup>
          {onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              disabled={scheduleCount === 0}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
          )}
          <Button onClick={onNewSchedule} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            New Schedule
          </Button>
        </div>
      </div>

      {/* Row 2: Context & Filters */}
      {activeView === 'status' ? renderStatusFilterRow() : renderCalendarFilterRow()}
    </div>
  );
}

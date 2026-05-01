/**
 * =====================================================
 * Calendar View Component for Unified Scheduler
 * =====================================================
 */

import { useState, useMemo } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
} from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { CalendarHeader } from './calendar/CalendarHeader';
import { TimeSlotGrid } from './calendar/TimeSlotGrid';
import { ScheduleEventBlock } from './calendar/ScheduleEventBlock';
import type { CalendarEvent, CalendarViewMode } from '../types';

interface CalendarViewProps {
  selectedDate?: Date;
  onDateChange?: (date: Date) => void;
  viewMode?: 'day' | 'week' | 'month';
  onViewModeChange?: (mode: 'day' | 'week' | 'month') => void;
  schedules: any[];
  onScheduleClick?: (schedule: any) => void;
}

// Helper to map different status formats to calendar status
function mapToStatus(status: string): 'draft' | 'ready' | 'scheduled' | 'published' | 'cancelled' {
  switch (status?.toLowerCase()) {
    case 'draft':
      return 'draft';
    case 'ready':
    case 'confirmed':
      return 'ready';
    case 'scheduled':
    case 'exported':
      return 'scheduled';
    case 'published':
    case 'dispatched':
      return 'published';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'draft';
  }
}

export function CalendarView({
  selectedDate = new Date(),
  onDateChange,
  viewMode = 'week',
  onViewModeChange,
  schedules = [],
  onScheduleClick,
}: CalendarViewProps) {
  const [internalSelectedDate, setInternalSelectedDate] = useState<Date | undefined>();

  const currentDate = selectedDate;
  const calendarViewMode = viewMode as CalendarViewMode;

  // Convert schedules to calendar events
  const events: CalendarEvent[] = useMemo(() => {
    return schedules.map((schedule) => {
      // Handle both scheduler batches and planner schedules
      const isSchedulerBatch = 'batch_code' in schedule;
      const plannedDate = isSchedulerBatch
        ? schedule.planned_date || schedule.created_at
        : schedule.planned_date;

      return {
        id: schedule.id,
        batchId: schedule.id,
        batchCode: isSchedulerBatch ? schedule.batch_code : schedule.name || `Schedule ${schedule.id.slice(0, 8)}`,
        title: isSchedulerBatch ? schedule.batch_code : schedule.name || 'Delivery Schedule',
        start: new Date(plannedDate),
        end: new Date(plannedDate),
        timeWindow: schedule.time_window || 'morning',
        status: mapToStatus(schedule.status),
        facilityCount: schedule.facility_ids?.length || 0,
        warehouseName: schedule.warehouse?.name || 'Unknown Warehouse',
        driverName: schedule.driver?.name,
        vehiclePlate: schedule.vehicle?.plate_number,
        priority: 'medium',
        capacityUtilization: isSchedulerBatch 
          ? schedule.total_weight ? Math.min((schedule.total_weight / 5000) * 100, 100) : undefined
          : schedule.total_payload_kg ? Math.min((schedule.total_payload_kg / 5000) * 100, 100) : undefined,
      };
    });
  }, [schedules]);

  // Get dates based on view mode
  const dates = useMemo(() => {
    if (calendarViewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    }
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate, calendarViewMode]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    return dates.reduce((acc, date) => {
      const dateKey = format(date, 'yyyy-MM-dd');
      acc[dateKey] = events.filter((event) =>
        isSameDay(event.start, date)
      );
      return acc;
    }, {} as Record<string, CalendarEvent[]>);
  }, [dates, events]);

  const handleEventClick = (event: CalendarEvent) => {
    const schedule = schedules.find((s) => s.id === event.batchId);
    if (schedule && onScheduleClick) {
      onScheduleClick(schedule);
    }
  };

  const handleDateChange = (date: Date) => {
    if (onDateChange) {
      onDateChange(date);
    }
  };

  const handleViewModeChange = (mode: CalendarViewMode) => {
    if (onViewModeChange) {
      const mappedMode = mode === 'week' ? 'week' : mode === 'month' ? 'month' : 'day';
      onViewModeChange(mappedMode);
    }
  };

  // Render week view with time slots
  if (calendarViewMode === 'week') {
    return (
      <div className="flex h-full flex-col min-h-0">
        <CalendarHeader
          currentDate={currentDate}
          viewMode={calendarViewMode}
          onDateChange={handleDateChange}
          onViewModeChange={handleViewModeChange}
        />
        <div className="flex-1 min-h-0">
          <TimeSlotGrid
            dates={dates}
            events={events}
            onEventClick={handleEventClick}
            selectedDate={internalSelectedDate}
          />
        </div>
      </div>
    );
  }

  // Render month view as a grid
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];

  // Pad the start with days from previous month if needed
  const firstDayOfMonth = dates[0];
  const startPadding = (firstDayOfMonth.getDay() + 6) % 7; // Monday = 0
  for (let i = startPadding - 1; i >= 0; i--) {
    const prevDate = new Date(firstDayOfMonth);
    prevDate.setDate(prevDate.getDate() - (i + 1));
    currentWeek.push(prevDate);
  }

  dates.forEach((date) => {
    currentWeek.push(date);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  // Pad the end with days from next month if needed
  if (currentWeek.length > 0) {
    const lastDayOfMonth = dates[dates.length - 1];
    let nextDay = new Date(lastDayOfMonth);
    while (currentWeek.length < 7) {
      nextDay = new Date(nextDay);
      nextDay.setDate(nextDay.getDate() + 1);
      currentWeek.push(nextDay);
    }
    weeks.push(currentWeek);
  }

  return (
    <div className="flex h-full flex-col min-h-0">
      <CalendarHeader
        currentDate={currentDate}
        viewMode={calendarViewMode}
        onDateChange={handleDateChange}
        onViewModeChange={handleViewModeChange}
      />

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
          {/* Day Labels */}
          <div className="mb-2 grid grid-cols-7 gap-1">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div
                key={day}
                className="py-2 text-center text-xs font-medium uppercase text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {weeks.flat().map((date) => {
              const dateKey = format(date, 'yyyy-MM-dd');
              const dayEvents = eventsByDate[dateKey] || [];
              const isCurrentMonth = isSameMonth(date, currentDate);
              const isToday = isSameDay(date, new Date());
              const isSelected = internalSelectedDate && isSameDay(date, internalSelectedDate);

              return (
                <button
                  key={dateKey}
                  onClick={() => setInternalSelectedDate(date)}
                  className={cn(
                    'min-h-[100px] rounded-lg border p-2 text-left transition-colors',
                    'hover:border-primary/50 hover:bg-muted/50',
                    !isCurrentMonth && 'bg-muted/30 text-muted-foreground',
                    isToday && 'border-primary/50 bg-primary/5',
                    isSelected && 'ring-2 ring-primary'
                  )}
                >
                  {/* Date Number */}
                  <div className="mb-1">
                    <span
                      className={cn(
                        'inline-flex h-6 w-6 items-center justify-center rounded-full text-sm',
                        isToday && 'bg-primary text-primary-foreground font-semibold'
                      )}
                    >
                      {format(date, 'd')}
                    </span>
                  </div>

                  {/* Events */}
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <ScheduleEventBlock
                        key={event.id}
                        event={event}
                        onClick={handleEventClick}
                        compact
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-muted-foreground">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
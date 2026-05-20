/**
 * =====================================================
 * Working Set Column (Middle Column)
 * =====================================================
 * Displays selected facilities in the batch-in-formation.
 * Supports reordering via drag-and-drop or buttons.
 */

import * as React from 'react';
import {
  GripVertical,
  X,
  ChevronUp,
  ChevronDown,
  Building2,
  Package,
  MapPin,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WorkingSetItem } from '@/types/unified-workflow';

interface WorkingSetColumnProps {
  items: WorkingSetItem[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (facilityId: string) => void;
  onClear: () => void;
  className?: string;
}

export function WorkingSetColumn({
  items,
  onReorder,
  onRemove,
  onClear,
  className,
}: WorkingSetColumnProps) {
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (fromIndex !== toIndex) {
      onReorder(fromIndex, toIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Button reorder handlers
  const handleMoveUp = (index: number) => {
    if (index > 0) {
      onReorder(index, index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < items.length - 1) {
      onReorder(index, index + 1);
    }
  };

  // Calculate totals
  const totals = React.useMemo(() => {
    return items.reduce(
      (acc, item) => ({
        slots: acc.slots + (item.slot_demand || 0),
        weight: acc.weight + (item.weight_kg || 0),
        volume: acc.volume + (item.volume_m3 || 0),
      }),
      { slots: 0, weight: 0, volume: 0 }
    );
  }, [items]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header with Clear Button */}
      {items.length > 0 && (
        <div className="px-3 py-2 border-b flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? 'facility' : 'facilities'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={onClear}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear All
          </Button>
        </div>
      )}

      {/* Items List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No facilities selected</p>
              <p className="text-xs mt-1">
                Add facilities from the left column to build your schedule
              </p>
            </div>
          ) : (
            items.map((item, index) => (
              <WorkingSetCard
                key={item.facility_id}
                item={item}
                index={index}
                isFirst={index === 0}
                isLast={index === items.length - 1}
                isDragging={draggedIndex === index}
                isDragOver={dragOverIndex === index}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                onMoveUp={() => handleMoveUp(index)}
                onMoveDown={() => handleMoveDown(index)}
                onRemove={() => onRemove(item.facility_id)}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer Totals */}
      {items.length > 0 && (
        <div className="p-3 border-t bg-muted/50">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Stops</p>
              <p className="text-sm font-semibold">{items.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Slots</p>
              <p className="text-sm font-semibold">{totals.slots}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Weight</p>
              <p className="text-sm font-semibold">
                {totals.weight > 0 ? `${totals.weight.toLocaleString()} kg` : '-'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// Working Set Card Sub-component
// =====================================================

interface WorkingSetCardProps {
  item: WorkingSetItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

function WorkingSetCard({
  item,
  index,
  isFirst,
  isLast,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
  onRemove,
}: WorkingSetCardProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        'flex items-stretch rounded-lg border bg-card transition-all duration-150',
        isDragging && 'opacity-50 scale-95',
        isDragOver && 'border-primary border-dashed bg-primary/5'
      )}
    >
      {/* Drag handle — full-height left strip */}
      <div className="flex items-center px-1.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground border-r border-border/50 rounded-l-lg">
        <GripVertical className="h-4 w-4 shrink-0" />
      </div>

      {/* Card body */}
      <div className="flex-1 min-w-0 px-2.5 py-2">
        {/* Row 1: number + name (wraps) + remove button */}
        <div className="flex items-start gap-2">
          <span className="shrink-0 w-5 h-5 mt-0.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center leading-none">
            {index + 1}
          </span>
          <p className="flex-1 min-w-0 text-sm font-medium leading-snug break-words">
            {item.facility_name}
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-6 w-6 -mt-0.5 -mr-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={onRemove}
            title="Remove"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Row 2: LGA + slots (left) · reorder buttons (right) */}
        <div className="flex items-center justify-between gap-2 mt-1.5 pl-7">
          <div className="flex items-center gap-1.5 min-w-0">
            {item.lga && (
              <span className="text-xs text-muted-foreground flex items-center gap-0.5 truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                {item.lga}
              </span>
            )}
            {item.slot_demand > 0 && (
              <Badge variant="outline" className="shrink-0 text-xs px-1.5 py-0 h-4">
                {item.slot_demand} slots
              </Badge>
            )}
          </div>
          <div className="flex items-center shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30"
              disabled={isFirst}
              onClick={onMoveUp}
              title="Move up"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30"
              disabled={isLast}
              onClick={onMoveDown}
              title="Move down"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkingSetColumn;

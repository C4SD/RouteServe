import { useState } from 'react';
import {
  Plus, Trash2, PlusCircle, MinusCircle, Check, X, Loader2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { zoneColor } from '@/services/zoningService';
import type { UseGeospatialZoningReturn } from '../hooks/useGeospatialZoning';
import { ZoneConflictModal } from './ZoneConflictModal';

const ZONE_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#d97706',
  '#7c3aed', '#0891b2', '#be185d', '#65a30d',
];

interface ZoningPanelProps {
  zoning: UseGeospatialZoningReturn;
}

export function ZoningPanel({ zoning }: ZoningPanelProps) {
  const {
    zones, assignedMap, selectedLgaIds, editMode, editingZoneId,
    isMutating, isLoading, error, pendingConflict,
    clearSelection, assignSelectionToZone, createZone,
    enterAddMode, enterRemoveMode, exitEditMode, commitEditModeSelection,
    deleteZone, getZoneLgaCount, getZoneBoundaryIds,
    nextColor,
  } = zoning;

  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneColor, setNewZoneColor] = useState(nextColor());
  const [showCreate, setShowCreate] = useState(false);
  const [deletingZoneId, setDeletingZoneId] = useState<string | null>(null);

  const selectionCount = selectedLgaIds.length;
  const isEditing = editMode !== 'select';

  async function handleAssign() {
    if (!selectedZoneId || selectionCount === 0) return;
    await assignSelectionToZone(selectedZoneId);
  }

  async function handleCreateAndAssign() {
    if (!newZoneName.trim()) return;
    const zone = await createZone(newZoneName.trim(), newZoneColor);
    if (zone && selectionCount > 0) {
      await assignSelectionToZone(zone.id);
    }
    setNewZoneName('');
    setNewZoneColor(nextColor());
    setShowCreate(false);
  }

  async function handleDeleteConfirm() {
    if (!deletingZoneId) return;
    await deleteZone(deletingZoneId);
    setDeletingZoneId(null);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm">Loading boundaries…</span>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-5">

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Edit mode banner */}
        {isEditing && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
            <p className="text-xs font-medium text-primary">
              {editMode === 'add-to-zone'
                ? `Adding LGAs to: ${zones.find((z) => z.id === editingZoneId)?.name}`
                : `Removing LGAs from: ${zones.find((z) => z.id === editingZoneId)?.name}`}
            </p>
            <p className="text-xs text-muted-foreground">
              Click LGAs on the map to select, then confirm below.
            </p>
            <div className="flex gap-2 mt-1">
              <Button
                size="sm"
                className="h-7 text-xs flex-1"
                disabled={selectionCount === 0 || isMutating}
                onClick={commitEditModeSelection}
              >
                {isMutating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                Confirm ({selectionCount})
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={exitEditMode}>
                <X className="h-3 w-3 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Selection summary */}
        {!isEditing && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Selection
              </p>
              {selectionCount > 0 && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                  onClick={clearSelection}
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-sm">
              {selectionCount === 0 ? (
                <span className="text-muted-foreground">Click LGAs on the map to select</span>
              ) : (
                <span>
                  <span className="font-semibold">{selectionCount}</span>{' '}
                  {selectionCount === 1 ? 'LGA' : 'LGAs'} selected
                </span>
              )}
            </p>
          </div>
        )}

        {/* Assign to existing zone */}
        {!isEditing && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Assign to Zone
            </p>
            <div className="flex gap-2">
              <Select value={selectedZoneId} onValueChange={setSelectedZoneId}>
                <SelectTrigger className="flex-1 h-8 text-xs">
                  <SelectValue placeholder="Select a zone…" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ background: zoneColor(z) }}
                        />
                        {z.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-8 text-xs shrink-0"
                disabled={!selectedZoneId || selectionCount === 0 || isMutating}
                onClick={handleAssign}
              >
                {isMutating ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Assign'}
              </Button>
            </div>
          </div>
        )}

        {/* Create new zone */}
        {!isEditing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Create New Zone
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => setShowCreate((p) => !p)}
              >
                {showCreate ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              </Button>
            </div>

            {showCreate && (
              <div className="space-y-2 border rounded-md p-3">
                <Input
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  placeholder="Zone name…"
                  className="h-8 text-xs"
                />
                {/* Color swatches */}
                <div className="flex gap-1.5 flex-wrap">
                  {ZONE_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewZoneColor(c)}
                      className={cn(
                        'h-5 w-5 rounded-full border-2 transition-transform hover:scale-110',
                        newZoneColor === c ? 'border-foreground scale-110' : 'border-transparent',
                      )}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <Button
                  size="sm"
                  className="h-7 text-xs w-full"
                  disabled={!newZoneName.trim() || isMutating}
                  onClick={handleCreateAndAssign}
                >
                  {isMutating
                    ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    : <Plus className="h-3 w-3 mr-1" />}
                  {selectionCount > 0 ? 'Create & Assign' : 'Create Zone'}
                </Button>
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Existing zones list */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Zones ({zones.length})
          </p>

          {zones.length === 0 && (
            <p className="text-xs text-muted-foreground py-3 text-center">
              No zones yet. Create one above.
            </p>
          )}

          <div className="space-y-1.5">
            {zones.map((zone) => {
              const count = getZoneLgaCount(zone.id, assignedMap);
              const color = zoneColor(zone);
              const isThisEditing = editingZoneId === zone.id;

              return (
                <div
                  key={zone.id}
                  className={cn(
                    'rounded-md border p-2.5 transition-colors',
                    isThisEditing ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/30',
                  )}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ background: color }}
                    />
                    <span className="text-sm font-medium flex-1 truncate">{zone.name}</span>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] shrink-0">
                      {count} LGA{count !== 1 ? 's' : ''}
                    </Badge>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      variant={isThisEditing && editMode === 'add-to-zone' ? 'default' : 'outline'}
                      size="sm"
                      className="h-6 text-[10px] flex-1 px-2"
                      onClick={() =>
                        isThisEditing && editMode === 'add-to-zone'
                          ? exitEditMode()
                          : enterAddMode(zone.id)
                      }
                    >
                      <PlusCircle className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                    <Button
                      variant={isThisEditing && editMode === 'remove-from-zone' ? 'default' : 'outline'}
                      size="sm"
                      className="h-6 text-[10px] flex-1 px-2"
                      disabled={count === 0}
                      onClick={() =>
                        isThisEditing && editMode === 'remove-from-zone'
                          ? exitEditMode()
                          : enterRemoveMode(zone.id)
                      }
                    >
                      <MinusCircle className="h-3 w-3 mr-1" />
                      Remove
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 px-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeletingZoneId(zone.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Conflict resolution modal */}
      {pendingConflict && pendingConflict.conflicts.length > 0 && (
        <ZoneConflictModal
          conflicts={pendingConflict.conflicts}
          onResolve={pendingConflict.resolve}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingZoneId} onOpenChange={(o) => !o && setDeletingZoneId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Zone</AlertDialogTitle>
            <AlertDialogDescription>
              This will unassign all LGAs and permanently delete the zone. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollArea>
  );
}

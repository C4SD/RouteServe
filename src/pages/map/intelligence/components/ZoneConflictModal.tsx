import { AlertTriangle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ConflictInfo, ConflictMode } from '@/services/zoningService';

interface ZoneConflictModalProps {
  conflicts: ConflictInfo[];
  onResolve: (mode: ConflictMode) => void;
}

export function ZoneConflictModal({ conflicts, onResolve }: ZoneConflictModalProps) {
  return (
    <Dialog open onOpenChange={() => onResolve('cancel')}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Boundary Conflict
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {conflicts.length} {conflicts.length === 1 ? 'LGA is' : 'LGAs are'} already assigned to
            another zone. Choose how to proceed:
          </p>

          <ScrollArea className="max-h-48 rounded-md border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium">LGA</th>
                  <th className="text-left px-3 py-2 font-medium">Current Zone</th>
                </tr>
              </thead>
              <tbody>
                {conflicts.map((c) => (
                  <tr key={c.boundaryId} className="border-b last:border-0">
                    <td className="px-3 py-2">{c.lgaName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.currentZoneName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
          <Button variant="outline" size="sm" onClick={() => onResolve('cancel')} className="order-3 sm:order-1">
            Cancel
          </Button>
          <Button variant="outline" size="sm" onClick={() => onResolve('skip')} className="order-2">
            Skip conflicts
          </Button>
          <Button size="sm" onClick={() => onResolve('reassign')} className="order-1 sm:order-3">
            Reassign all
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

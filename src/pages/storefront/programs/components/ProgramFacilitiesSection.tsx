import { useState } from 'react';
import { Plus, X, Search, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useFacilities, useUpdateFacility } from '@/hooks/useFacilities';
import { toast } from 'sonner';
import type { Program } from '@/types/program';
import type { Facility } from '@/types';

interface ProgramFacilitiesSectionProps {
  program: Program;
}

export function ProgramFacilitiesSection({ program }: ProgramFacilitiesSectionProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Fetch facilities linked to this program (array containment on programmes[])
  const { data, isLoading } = useFacilities({ programme: program.name });
  const facilities = data?.facilities || [];

  const updateFacility = useUpdateFacility();

  const handleRemove = (facility: Facility) => {
    const updated = (facility.programmes ?? []).filter((p) => p !== program.name);
    updateFacility.mutate(
      { id: facility.id, updates: { programmes: updated } },
      {
        onSuccess: () => toast.success(`Removed ${facility.name} from ${program.name}`),
      }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">Facilities</h4>
          <Badge variant="secondary" className="text-xs">{facilities.length}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => setIsAddOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Facilities
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : facilities.length === 0 ? (
        <div className="text-center py-6 border border-dashed rounded-lg">
          <p className="text-sm text-muted-foreground">No facilities linked to this program</p>
        </div>
      ) : (
        <div className="border rounded-lg max-h-[300px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>LGA</TableHead>
                <TableHead>Level of Care</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {facilities.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium text-sm">{f.name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">{f.warehouse_code}</code>
                  </TableCell>
                  <TableCell className="text-sm">{f.lga || '—'}</TableCell>
                  <TableCell className="text-sm">{f.level_of_care || '—'}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleRemove(f)}
                      disabled={updateFacility.isPending}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AddFacilitiesToProgramDialog
        program={program}
        existingFacilityIds={facilities.map((f) => f.id)}
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
      />
    </div>
  );
}

// ─── Add Facilities Dialog ──────────────────────────────────────────

interface AddFacilitiesToProgramDialogProps {
  program: Program;
  existingFacilityIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AddFacilitiesToProgramDialog({
  program,
  existingFacilityIds,
  open,
  onOpenChange,
}: AddFacilitiesToProgramDialogProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Fetch all facilities (unfiltered by programme) to let user pick
  const { data, isLoading } = useFacilities(
    search ? { search } : undefined,
    0,
    50
  );

  const updateFacility = useUpdateFacility();

  // Filter out already-linked facilities
  const availableFacilities = (data?.facilities || []).filter(
    (f) => !existingFacilityIds.includes(f.id)
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    try {
      const allFacilities = data?.facilities || [];
      await Promise.all(
        ids.map((id) => {
          const facility = allFacilities.find((f) => f.id === id);
          const current = facility?.programmes ?? [];
          const updated = current.includes(program.name) ? current : [...current, program.name];
          return updateFacility.mutateAsync({ id, updates: { programmes: updated } });
        })
      );
      toast.success(`Added ${ids.length} facility(ies) to ${program.name}`);
      setSelected(new Set());
      onOpenChange(false);
    } catch {
      toast.error('Failed to add some facilities');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Facilities to {program.name}</DialogTitle>
          <DialogDescription>
            Search and select facilities to link to this program.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search facilities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-auto border rounded-lg min-h-[200px] max-h-[400px]">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : availableFacilities.length === 0 ? (
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-sm text-muted-foreground">
                {search ? 'No matching facilities found' : 'All facilities are already linked'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]" />
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>LGA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableFacilities.map((f) => (
                  <TableRow
                    key={f.id}
                    className="cursor-pointer"
                    onClick={() => toggleSelect(f.id)}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(f.id)}
                        onCheckedChange={() => toggleSelect(f.id)}
                      />
                    </TableCell>
                    <TableCell className="text-sm font-medium">{f.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {f.warehouse_code}
                      </code>
                    </TableCell>
                    <TableCell className="text-sm">{f.lga || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">
            {selected.size} selected
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={selected.size === 0 || updateFacility.isPending}>
              Add to Program
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { Plus, X, Search, Tag, Snowflake, DollarSign } from 'lucide-react';
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
import { useUpdateFacility } from '@/hooks/useFacilities';
import { usePrograms } from '@/hooks/usePrograms';
import { toast } from 'sonner';
import type { Facility } from '@/types';
import type { Program } from '@/types/program';

interface FacilityProgramsSectionProps {
  facility: Facility;
}

export function FacilityProgramsSection({ facility }: FacilityProgramsSectionProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const updateFacility = useUpdateFacility();

  // All programs in this workspace
  const { data: programsData, isLoading } = usePrograms();
  const allPrograms = programsData?.programs || [];

  // Programs linked to this facility: programme name is in facility.programmes[]
  const linkedPrograms = allPrograms.filter((p) =>
    (facility.programmes ?? []).includes(p.name)
  );

  const handleRemove = (program: Program) => {
    const updated = (facility.programmes ?? []).filter((name) => name !== program.name);
    updateFacility.mutate(
      { id: facility.id, updates: { programmes: updated } },
      {
        onSuccess: () => toast.success(`Removed ${facility.name} from ${program.name}`),
      }
    );
  };

  const getPriorityVariant = (tier: string): React.ComponentProps<typeof Badge>['variant'] => {
    if (tier === 'CRITICAL') return 'destructive';
    if (tier === 'HIGH') return 'default';
    return 'secondary';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">Programs</h4>
          <Badge variant="secondary" className="text-xs">{linkedPrograms.length}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => setIsAddOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Link Program
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : linkedPrograms.length === 0 ? (
        <div className="text-center py-6 border border-dashed rounded-lg">
          <p className="text-sm text-muted-foreground">No programs linked to this facility</p>
        </div>
      ) : (
        <div className="border rounded-lg max-h-[320px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Funding</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {linkedPrograms.map((program) => (
                <TableRow key={program.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{program.name}</span>
                      {program.requires_cold_chain && (
                        <Snowflake className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      )}
                    </div>
                    <code className="text-[10px] text-muted-foreground">{program.code}</code>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={program.status === 'active' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {program.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getPriorityVariant(program.priority_tier)} className="text-xs">
                      {program.priority_tier}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {program.funding_source ? (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {program.funding_source}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleRemove(program)}
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

      <LinkProgramToFacilityDialog
        facility={facility}
        linkedProgramIds={linkedPrograms.map((p) => p.id)}
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
      />
    </div>
  );
}

// ─── Link Program Dialog ──────────────────────────────────────────────────────

interface LinkProgramToFacilityDialogProps {
  facility: Facility;
  linkedProgramIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function LinkProgramToFacilityDialog({
  facility,
  linkedProgramIds,
  open,
  onOpenChange,
}: LinkProgramToFacilityDialogProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: programsData, isLoading } = usePrograms(
    search ? { search } : undefined
  );
  const updateFacility = useUpdateFacility();

  const availablePrograms = (programsData?.programs || []).filter(
    (p) => !linkedProgramIds.includes(p.id)
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLink = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    const selectedPrograms = (programsData?.programs || []).filter((p) => ids.includes(p.id));
    const namesToAdd = selectedPrograms.map((p) => p.name);
    const current = facility.programmes ?? [];
    const updated = [...new Set([...current, ...namesToAdd])];

    try {
      await updateFacility.mutateAsync({ id: facility.id, updates: { programmes: updated } });
      toast.success(`Linked ${ids.length} program(s) to ${facility.name}`);
      setSelected(new Set());
      onOpenChange(false);
    } catch {
      toast.error('Failed to link programs');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Link Programs to {facility.name}</DialogTitle>
          <DialogDescription>
            Select programs to link this facility to.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search programs..."
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
          ) : availablePrograms.length === 0 ? (
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-sm text-muted-foreground">
                {search ? 'No matching programs found' : 'All programs are already linked'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]" />
                  <TableHead>Program</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availablePrograms.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => toggle(p.id)}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={() => toggle(p.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{p.name}</p>
                      <code className="text-[10px] text-muted-foreground">{p.code}</code>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={p.status === 'active' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.priority_tier}
                    </TableCell>
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
            <Button
              onClick={handleLink}
              disabled={selected.size === 0 || updateFacility.isPending}
            >
              Link to Facility
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

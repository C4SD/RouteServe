import { useState, useMemo } from 'react';
import { Check, Layers, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useFacilities } from '@/hooks/useFacilities';
import { useWarehouses } from '@/hooks/useWarehouses';
import { usePrograms } from '@/hooks/usePrograms';
import { useItems } from '@/hooks/useItems';
import { useCreateRequisition } from '@/hooks/useRequisitions';
import type { Item } from '@/types/items';

interface ProgramBasedFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface SelectedItem {
  id: string;
  name: string;
  program: string;
  unit: string;
  quantity: number;
  weight_kg?: number;
  volume_m3?: number;
}

export function ProgramBasedForm({ onClose, onSuccess }: ProgramBasedFormProps) {
  const [step, setStep] = useState<'programs' | 'items'>('programs');
  const [selectedProgramIds, setSelectedProgramIds] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [facilityId, setFacilityId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [requisitionDate] = useState(new Date().toISOString().split('T')[0]);
  const [requiredByDate, setRequiredByDate] = useState('');

  // Fetch real data
  const { data: programsData, isLoading: programsLoading, isError: programsError } = usePrograms({ status: 'active', skipMetrics: true });
  const { data: facilitiesData, isLoading: facilitiesLoading, error: facilitiesError } = useFacilities();
  const { data: warehousesData, isLoading: warehousesLoading, error: warehousesError } = useWarehouses();
  const { data: itemsData, isLoading: itemsLoading } = useItems();
  const createRequisition = useCreateRequisition();

  const programs = programsData?.programs || [];
  const facilities = facilitiesData?.facilities || [];
  const warehouses = warehousesData?.warehouses || [];
  const allItems = itemsData?.items || [];

  // Build a map of program name → item count for display on program cards
  const programItemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of allItems) {
      if (item.program) {
        counts[item.program] = (counts[item.program] || 0) + 1;
      }
    }
    return counts;
  }, [allItems]);

  // Get the selected program codes for filtering items
  const selectedProgramCodes = useMemo(
    () => programs.filter(p => selectedProgramIds.includes(p.id)).map(p => p.code),
    [programs, selectedProgramIds]
  );

  // Get the selected program names for display
  const selectedProgramNames = useMemo(
    () => programs.filter(p => selectedProgramIds.includes(p.id)).map(p => p.name),
    [programs, selectedProgramIds]
  );

  // Filter items to those belonging to selected programs and matching search
  const availableItems = useMemo(() => {
    return allItems.filter(item => {
      if (!item.program || !selectedProgramCodes.includes(item.program)) return false;
      if (itemSearch) {
        const search = itemSearch.toLowerCase();
        return item.item_name.toLowerCase().includes(search) ||
               item.product_code?.toLowerCase().includes(search);
      }
      return true;
    });
  }, [allItems, selectedProgramCodes, itemSearch]);

  const toggleProgram = (programId: string) => {
    setSelectedProgramIds(prev =>
      prev.includes(programId)
        ? prev.filter(id => id !== programId)
        : [...prev, programId]
    );
  };

  const toggleItem = (item: Item) => {
    const exists = selectedItems.find(i => i.id === item.id);
    if (exists) {
      setSelectedItems(prev => prev.filter(i => i.id !== item.id));
    } else {
      setSelectedItems(prev => [...prev, {
        id: item.id,
        name: item.item_name,
        program: item.program || '',
        unit: item.unit_pack || 'unit',
        quantity: item.stock_on_hand > 0 ? 1 : 1,
        weight_kg: item.weight_kg,
        volume_m3: item.volume_m3,
      }]);
    }
  };

  const updateItemQuantity = (itemId: string, quantity: number) => {
    setSelectedItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  };

  const handleConfirm = () => {
    const deliveryDate = requiredByDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    createRequisition.mutate({
      facility_id: facilityId,
      warehouse_id: warehouseId,
      priority: 'medium',
      requested_delivery_date: deliveryDate,
      notes: `Program-based requisition for: ${selectedProgramNames.join(', ')}`,
      items: selectedItems.map(item => ({
        item_name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        weight_kg: item.weight_kg,
        volume_m3: item.volume_m3,
        temperature_required: false,
      })),
    }, {
      onSuccess: () => onSuccess(),
    });
  };

  const canProceedToItems = selectedProgramIds.length > 0;
  const canSubmit = selectedItems.length > 0 && facilityId && warehouseId && !createRequisition.isPending;

  return (
    <>
      {step === 'programs' && (
        <>
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Select one or more programs to load their associated items.
              </p>

              {programsLoading || itemsLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading programs...
                </div>
              ) : programsError ? (
                <div className="text-center py-12 text-destructive">
                  <p className="font-medium">Failed to load programs</p>
                  <p className="text-xs mt-1 text-muted-foreground">Check your connection and try again.</p>
                </div>
              ) : programs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="font-medium">No active programs found</p>
                  <p className="text-xs mt-1">Create programs in Resources &gt; Programs first.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {programs.map((program) => {
                    const itemCount = programItemCounts[program.code] || 0;
                    return (
                      <div
                        key={program.id}
                        className={`
                          p-4 border rounded-lg cursor-pointer transition-colors
                          ${selectedProgramIds.includes(program.id)
                            ? 'border-primary bg-primary/5'
                            : 'hover:border-muted-foreground/50'
                          }
                          ${itemCount === 0 ? 'opacity-50' : ''}
                        `}
                        onClick={() => toggleProgram(program.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={selectedProgramIds.includes(program.id)}
                              onCheckedChange={() => toggleProgram(program.id)}
                            />
                            <div>
                              <p className="font-medium">{program.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {itemCount} {itemCount === 1 ? 'item' : 'items'} available
                              </p>
                            </div>
                          </div>
                          {selectedProgramIds.includes(program.id) && (
                            <Check className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="px-8 py-6 border-t bg-background flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => setStep('items')}
              disabled={!canProceedToItems}
            >
              Continue ({selectedProgramIds.length} program{selectedProgramIds.length !== 1 ? 's' : ''})
            </Button>
          </div>
        </>
      )}

      {step === 'items' && (
        <>
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {selectedProgramIds.length} program{selectedProgramIds.length !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search items..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {(facilitiesError || warehousesError) && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {facilitiesError && <div>Failed to load facilities: {facilitiesError.message}</div>}
                  {warehousesError && <div>Failed to load warehouses: {warehousesError.message}</div>}
                </div>
              )}

              <div className="border rounded-md max-h-[320px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Program</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          {itemsLoading ? 'Loading items...' : 'No items found for the selected programs.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      availableItems.map((item) => {
                        const isSelected = selectedItems.some(i => i.id === item.id);
                        const selectedItem = selectedItems.find(i => i.id === item.id);

                        return (
                          <TableRow
                            key={item.id}
                            className={isSelected ? 'bg-primary/5' : 'cursor-pointer hover:bg-muted/50'}
                            onClick={() => !isSelected && toggleItem(item)}
                          >
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleItem(item)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{item.item_name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.program}</Badge>
                            </TableCell>
                            <TableCell>{item.unit_pack || '—'}</TableCell>
                            <TableCell>
                              {isSelected ? (
                                <Input
                                  type="number"
                                  min={1}
                                  value={selectedItem?.quantity || 1}
                                  onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value) || 1)}
                                  className="h-8 w-20 text-right"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Facility *</Label>
                    <Select value={facilityId} onValueChange={setFacilityId} disabled={facilitiesLoading}>
                      <SelectTrigger>
                        <SelectValue placeholder={facilitiesLoading ? "Loading facilities..." : "Select facility"} />
                      </SelectTrigger>
                      <SelectContent className="z-[9999]">
                        {facilities.length === 0 ? (
                          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                            No facilities available
                          </div>
                        ) : (
                          facilities.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Warehouse *</Label>
                    <Select value={warehouseId} onValueChange={setWarehouseId} disabled={warehousesLoading}>
                      <SelectTrigger>
                        <SelectValue placeholder={warehousesLoading ? "Loading warehouses..." : "Select warehouse"} />
                      </SelectTrigger>
                      <SelectContent className="z-[9999]">
                        {warehouses.length === 0 ? (
                          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                            No warehouses available
                          </div>
                        ) : (
                          warehouses.map((w) => (
                            <SelectItem key={w.id} value={w.id}>
                              {w.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Requisition Date (auto)</Label>
                    <Input
                      type="date"
                      value={requisitionDate}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Required By Date (optional)</Label>
                    <Input
                      type="date"
                      value={requiredByDate}
                      onChange={(e) => setRequiredByDate(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Delivery scheduling happens in /scheduler
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-8 py-6 border-t bg-background flex justify-between">
            <Button variant="outline" onClick={() => setStep('programs')}>
              Back to Programs
            </Button>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!canSubmit}
              >
                {createRequisition.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  `Create Requisition (${selectedItems.length} items)`
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TruckVisualizer } from './TruckVisualizer';
import { RequisitionsList } from './RequisitionsList';
import { useVehicleTiers } from '@/hooks/useVehicleTiers';
import { useBatchTierAssignments, useCreateBatchTierAssignment } from '@/hooks/useBatchTierAssignments';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { toast } from 'sonner';

interface LoadingPlannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  vehicleId: string;
  requisitions: any[];
}

export function LoadingPlannerDialog({
  open,
  onOpenChange,
  batchId,
  vehicleId,
  requisitions
}: LoadingPlannerDialogProps) {
  const { data: tiers = [] } = useVehicleTiers(vehicleId);
  const { data: assignments = [] } = useBatchTierAssignments(batchId);
  const { mutateAsync: createAssignment } = useCreateBatchTierAssignment();
  const [selectedRequisitions, setSelectedRequisitions] = useState<Set<string>>(new Set());

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;

    const requisitionId = active.id as string;
    const tierId = over.id as string;
    
    const requisition = requisitions.find(r => r.id === requisitionId);
    const tier = tiers.find(t => t.id === tierId);
    
    if (!requisition || !tier) return;

    // Calculate requisition weight
    const totalWeight = requisition.requisition_items?.reduce(
      (sum: number, item: any) => sum + (item.weight_kg * item.quantity),
      0
    ) || 0;

    try {
      await createAssignment({
        batch_id: batchId,
        requisition_id: requisitionId,
        vehicle_tier_id: tierId,
        tier_position: tier.tier_name,
        assigned_weight_kg: totalWeight,
        assigned_volume_m3: 0,
        loading_status: 'planned'
      });
      
      toast.success(`Assigned to ${tier.tier_name} tier`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign cargo');
    }
  };

  const handleAutoAssign = async () => {
    // Greedy bin-packing algorithm
    const sortedReqs = [...requisitions].sort((a, b) => {
      const aWeight = a.requisition_items?.reduce(
        (sum: number, item: any) => sum + (item.weight_kg * item.quantity),
        0
      ) || 0;
      const bWeight = b.requisition_items?.reduce(
        (sum: number, item: any) => sum + (item.weight_kg * item.quantity),
        0
      ) || 0;
      return bWeight - aWeight;
    });

    const tierCapacity = new Map(
      tiers.map(t => [t.id, { remaining: t.max_weight_kg, tier: t }])
    );

    for (const req of sortedReqs) {
      const weight = req.requisition_items?.reduce(
        (sum: number, item: any) => sum + (item.weight_kg * item.quantity),
        0
      ) || 0;

      // Find first tier with enough capacity
      for (const [tierId, data] of tierCapacity) {
        if (data.remaining >= weight) {
          await createAssignment({
            batch_id: batchId,
            requisition_id: req.id,
            vehicle_tier_id: tierId,
            tier_position: data.tier.tier_name,
            assigned_weight_kg: weight,
            assigned_volume_m3: 0,
            loading_status: 'planned'
          });
          
          data.remaining -= weight;
          break;
        }
      }
    }

    toast.success('Auto-assignment complete');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[90vw] max-h-[90vh] p-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>Cargo Loading Planner</DialogTitle>
        </DialogHeader>

        <DndContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-2 gap-6 p-6 h-[calc(90vh-8rem)] overflow-hidden">
            {/* Left: Truck Visualizer */}
            <div className="flex flex-col gap-4">
              <TruckVisualizer 
                tiers={tiers}
                assignments={assignments}
                vehicleId={vehicleId}
                batchId={batchId}
              />
            </div>

            {/* Right: Requisitions List */}
            <div className="flex flex-col gap-4 overflow-hidden">
              <RequisitionsList
                requisitions={requisitions}
                assignments={assignments}
                selectedRequisitions={selectedRequisitions}
                onToggleSelection={(id) => {
                  const newSet = new Set(selectedRequisitions);
                  if (newSet.has(id)) {
                    newSet.delete(id);
                  } else {
                    newSet.add(id);
                  }
                  setSelectedRequisitions(newSet);
                }}
              />
            </div>
          </div>
        </DndContext>

        {/* Bottom Actions */}
        <div className="border-t p-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedRequisitions.size} requisition(s) selected
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSelectedRequisitions(new Set())}>
              Clear All
            </Button>
            <Button variant="secondary" onClick={handleAutoAssign}>
              Auto-Assign
            </Button>
            <Button onClick={() => onOpenChange(false)}>
              Finish Loading
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Vehicle Onboarding Dialog
 * Modal wrapper for the 3-step vehicle onboarding wizard:
 *   1. Category selection  2. Sub-type selection  3. Configure + Register
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VehicleOnboardWizard } from '@/components/vlms/vehicle-onboarding/VehicleOnboardWizard';

interface VehicleConfiguratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VehicleConfiguratorDialog({
  open,
  onOpenChange,
}: VehicleConfiguratorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
          <DialogTitle className="text-lg font-semibold">Add Vehicle</DialogTitle>
          <DialogDescription className="sr-only">
            Select a vehicle category, then choose the specific type to begin configuration.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pt-4 pb-6 flex-1 min-h-0 overflow-y-auto">
          <VehicleOnboardWizard onClose={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

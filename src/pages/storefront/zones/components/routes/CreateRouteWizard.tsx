import { useState } from 'react';
import { List, Upload, FlaskConical, X, Network, ArrowLeft } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FacilityListRouteForm } from './FacilityListRouteForm';
import { UploadRouteForm } from './UploadRouteForm';
import { SandboxRouteForm } from './SandboxRouteForm';
import { ServicePolicyRouteForm } from './ServicePolicyRouteForm';
import type { RouteCreationMode } from '@/types/routes';
import { cn } from '@/lib/utils';

const MODES: {
  id: RouteCreationMode;
  title: string;
  description: string;
  icon: React.ElementType;
  badge?: string;
}[] = [
  {
    id: 'service_policy',
    title: 'From Service Policy',
    description: 'Auto-load a cluster from a Service Policy and optimize the visit sequence.',
    icon: Network,
    badge: 'Recommended',
  },
  {
    id: 'facility_list',
    title: 'From Facility List',
    description: 'Manually select facilities from a service area and build the route.',
    icon: List,
  },
  {
    id: 'upload',
    title: 'Upload Facilities',
    description: 'Upload a CSV with facility coordinates for rapid route expansion.',
    icon: Upload,
  },
  {
    id: 'sandbox',
    title: 'Sandbox',
    description: 'Simulate and analyze routes without writing to production.',
    icon: FlaskConical,
  },
];

interface CreateRouteWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSandboxSelect?: () => void;
}

export function CreateRouteWizard({ open, onOpenChange, onSandboxSelect }: CreateRouteWizardProps) {
  const [selectedMode, setSelectedMode] = useState<RouteCreationMode | null>(null);

  const modeTitle: Record<RouteCreationMode, string> = {
    service_policy: 'From Service Policy',
    facility_list: 'From Facility List',
    upload: 'Upload Facilities',
    sandbox: 'Sandbox',
  };
  const modeDescription: Record<RouteCreationMode, string> = {
    service_policy: 'Auto-load cluster facilities and optimize the visit sequence.',
    facility_list: 'Select facilities from existing service areas for production route planning.',
    upload: 'Upload a CSV with facility coordinates for rapid route expansion.',
    sandbox: 'Simulate and analyze routes without writing to production.',
  };

  const handleClose = (open: boolean) => {
    if (!open) setSelectedMode(null);
    onOpenChange(open);
  };

  const handleBack = () => setSelectedMode(null);

  const handleSuccess = () => {
    setSelectedMode(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-xl"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header Section */}
        <div className="px-8 pt-8 pb-6 border-b">
          <DialogHeader className="flex flex-col gap-2 pb-0">
            <div className="flex items-center gap-3">
              {selectedMode && (
                <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div className="flex-1">
                <DialogTitle className="text-xl font-semibold">
                  {selectedMode ? modeTitle[selectedMode] : 'New Route'}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  {selectedMode
                    ? modeDescription[selectedMode]
                    : 'Choose how you want to create a route.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Close button */}
          <DialogClose className="absolute top-6 right-6">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </div>

        {/* Content Section */}
        {!selectedMode ? (
          <div className="px-8 pb-8 mt-6">
            <div className="grid grid-cols-2 gap-4">
              {MODES.map((mode) => {
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.id}
                    className={cn(
                      "p-6 rounded-lg border hover:border-primary transition min-h-[160px]",
                      "flex flex-col items-start gap-3 text-left relative",
                      "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      mode.id === 'service_policy' && "border-primary/40 bg-primary/5"
                    )}
                    onClick={() => {
                      if (mode.id === 'sandbox' && onSandboxSelect) {
                        onSandboxSelect();
                        onOpenChange(false);
                        return;
                      }
                      setSelectedMode(mode.id);
                    }}
                  >
                    {mode.badge && (
                      <Badge className="absolute top-3 right-3 text-xs" variant="secondary">
                        {mode.badge}
                      </Badge>
                    )}
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold">{mode.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {mode.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {selectedMode === 'service_policy' && (
              <ServicePolicyRouteForm onSuccess={handleSuccess} />
            )}
            {selectedMode === 'facility_list' && (
              <FacilityListRouteForm onSuccess={handleSuccess} />
            )}
            {selectedMode === 'upload' && (
              <UploadRouteForm onSuccess={handleSuccess} />
            )}
            {selectedMode === 'sandbox' && (
              <SandboxRouteForm onSuccess={handleSuccess} />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

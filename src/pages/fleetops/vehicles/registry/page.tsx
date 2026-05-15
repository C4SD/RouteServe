import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVehicles } from '@/hooks/useVehicles';
import { useVehicleWizard } from '@/hooks/useVehicleWizard';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Plus, Car } from 'lucide-react';
import { Step1CategorySelect } from '@/components/vehicle/wizard/Step1CategorySelect';
import { Step2CapacityConfig } from '@/components/vehicle/wizard/Step2CapacityConfig';
import { Step3OperationalConfig } from '@/components/vehicle/wizard/Step3OperationalConfig';
import { Step4Review } from '@/components/vehicle/wizard/Step4Review';

const stepTitles: Record<number, string> = {
  1: 'Select Vehicle Category',
  2: 'Configure Capacity & Tiers',
  3: 'Operational Specifications',
  4: 'Review & Confirm',
};

interface StatCardProps {
  label: string;
  value: number;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

export default function VehicleRegistry() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const { currentStep, reset } = useVehicleWizard();
  const { data: vehicles = [], isLoading } = useVehicles();
  const navigate = useNavigate();

  const handleOpenWizard = () => {
    reset();
    setWizardOpen(true);
  };

  const handleCloseWizard = () => {
    setWizardOpen(false);
    reset();
  };

  const totalSteps = 4;
  const progressValue = (currentStep / totalSteps) * 100;

  return (
    <div className="h-full bg-background p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-3xl font-bold tracking-tight">Vehicle Registry</h1>
            <p className="text-muted-foreground">
              Manage your fleet vehicles and their configurations
            </p>
          </div>
          <Button onClick={handleOpenWizard}>
            <Plus data-icon="inline-start" />
            Add Vehicle
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Vehicles" value={vehicles.length} />
          <StatCard
            label="Active"
            value={vehicles.filter((v) => v.status === 'available').length}
          />
          <StatCard
            label="In Use"
            value={vehicles.filter((v) => v.status === 'in-use').length}
          />
          <StatCard
            label="Maintenance"
            value={vehicles.filter((v) => v.status === 'maintenance').length}
          />
        </div>

        {/* Vehicle List */}
        <Card>
          <CardHeader>
            <CardTitle>All Vehicles</CardTitle>
            <CardDescription>
              {vehicles.length === 0
                ? 'No vehicles registered yet.'
                : `${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'} in your fleet.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" text="Loading vehicles..." />
              </div>
            ) : vehicles.length === 0 ? (
              <EmptyState
                icon={Car}
                title="No vehicles in registry"
                description="Get started by adding your first vehicle to the fleet."
                action={
                  <Button onClick={handleOpenWizard}>
                    <Plus data-icon="inline-start" />
                    Add Your First Vehicle
                  </Button>
                }
                variant="dashed"
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {vehicles.map((vehicle) => (
                  <li key={vehicle.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/fleetops/vehicles/${vehicle.id}`)}
                      className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                          <Car className="size-5 text-primary" />
                        </div>
                        <div className="flex flex-col">
                          <p className="font-medium">{vehicle.model}</p>
                          <p className="text-sm text-muted-foreground">
                            {vehicle.plateNumber} · {vehicle.type}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                          <p className="text-sm font-medium tabular-nums">{vehicle.capacity} kg</p>
                          <p className="text-xs text-muted-foreground">Capacity</p>
                        </div>
                        <Badge
                          variant={
                            vehicle.status === 'available'
                              ? 'default'
                              : vehicle.status === 'in-use'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {vehicle.status}
                        </Badge>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Wizard Dialog */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{stepTitles[currentStep]}</DialogTitle>
          </DialogHeader>

          {/* Progress Indicator */}
          <div className="flex flex-col gap-2">
            <Progress value={progressValue} aria-label={`Step ${currentStep} of ${totalSteps}`} />
            <p className="text-xs text-muted-foreground">
              Step {currentStep} of {totalSteps}
            </p>
          </div>

          {/* Step Content */}
          {currentStep === 1 && <Step1CategorySelect />}
          {currentStep === 2 && <Step2CapacityConfig />}
          {currentStep === 3 && <Step3OperationalConfig />}
          {currentStep === 4 && <Step4Review onComplete={handleCloseWizard} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Car, Wrench, Fuel, Users, AlertTriangle, ClipboardCheck, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStatusColors } from '@/lib/designTokens';
import { useVehicles } from '@/hooks/useVehicles';

type ModuleSemanticColor = 'active' | 'warning' | 'success' | 'info' | 'error' | 'in_progress';

interface ModuleDef {
  title: string;
  description: string;
  icon: typeof Car;
  href: string;
  semanticColor: ModuleSemanticColor;
}

const modules: ModuleDef[] = [
  {
    title: 'Vehicle Management',
    description: 'Manage your fleet vehicles, specifications, and documentation',
    icon: Car,
    href: '/fleetops/vlms/vehicles',
    semanticColor: 'active',
  },
  {
    title: 'Maintenance Tracking',
    description: 'Schedule and track vehicle maintenance, repairs, and services',
    icon: Wrench,
    href: '/fleetops/vlms/maintenance',
    semanticColor: 'warning',
  },
  {
    title: 'Fuel Management',
    description: 'Log fuel purchases and track consumption efficiency',
    icon: Fuel,
    href: '/fleetops/vlms/fuel',
    semanticColor: 'success',
  },
  {
    title: 'Vehicle Assignments',
    description: 'Assign vehicles to drivers and track assignments',
    icon: Users,
    href: '/fleetops/vlms/assignments',
    semanticColor: 'info',
  },
  {
    title: 'Incident Reports',
    description: 'Report and manage vehicle accidents, damage, and incidents',
    icon: AlertTriangle,
    href: '/fleetops/vlms/incidents',
    semanticColor: 'error',
  },
  {
    title: 'Inspections',
    description: 'Conduct and track vehicle safety inspections',
    icon: ClipboardCheck,
    href: '/fleetops/vlms/inspections',
    semanticColor: 'in_progress',
  },
];

const gettingStartedSteps = [
  {
    title: 'Add Your First Vehicle',
    description:
      'Navigate to Vehicle Management and click "Add Vehicle" to register your first fleet vehicle.',
  },
  {
    title: 'Schedule Maintenance',
    description: 'Set up maintenance schedules to keep your vehicles in optimal condition.',
  },
  {
    title: 'Assign to Drivers',
    description: 'Create vehicle assignments to track who is using which vehicle.',
  },
];

interface StatCardProps {
  label: string;
  value: number;
  hint: string;
}

function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export default function VLMSPage() {
  const navigate = useNavigate();
  const { data: vehicles = [] } = useVehicles();

  const { totalVehicles, availableCount, maintenanceCount, assignedCount } = useMemo(
    () => ({
      totalVehicles: vehicles.length,
      availableCount: vehicles.filter((v) => v.status === 'available').length,
      maintenanceCount: vehicles.filter((v) => v.status === 'maintenance').length,
      assignedCount: vehicles.filter((v) => v.status === 'in-use').length,
    }),
    [vehicles]
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-bold tracking-tight">Vehicle Lifecycle Management</h1>
        <p className="text-muted-foreground">
          Comprehensive fleet management solution for tracking vehicles from acquisition to disposal.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Vehicles"
          value={totalVehicles}
          hint={totalVehicles === 0 ? 'Ready to add vehicles' : 'In your fleet'}
        />
        <StatCard label="Available" value={availableCount} hint="Ready for assignment" />
        <StatCard label="In Maintenance" value={maintenanceCount} hint="Under service" />
        <StatCard label="Active Assignments" value={assignedCount} hint="Currently assigned" />
      </div>

      {/* Module Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => {
          const Icon = module.icon;
          const colors = getStatusColors(module.semanticColor);
          return (
            <Card
              key={module.href}
              role="button"
              tabIndex={0}
              onClick={() => navigate(module.href)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(module.href);
                }
              }}
              className="cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className={cn('flex items-center justify-center rounded-lg p-3', colors.bg)}>
                    <Icon className={cn('size-6', colors.text)} />
                  </div>
                  <ArrowRight className="size-5 text-muted-foreground" />
                </div>
                <CardTitle className="mt-4">{module.title}</CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button variant="link" className="h-auto px-0">
                  Open module
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Getting Started */}
      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>
            Follow these steps to get the most out of your fleet management workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-4">
            {gettingStartedSteps.map((step, idx) => (
              <li key={step.title} className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                  {idx + 1}
                </div>
                <div className="flex flex-col gap-1">
                  <p className="font-medium leading-none">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

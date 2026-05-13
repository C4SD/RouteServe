import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Info, Ruler, Building2, Layers } from 'lucide-react';
import type { CopilotConstraints } from '@/types/operations-copilot';

interface Step3ConstraintsProps {
  constraints: CopilotConstraints;
  onConstraintsChange: (c: CopilotConstraints) => void;
  onNext: () => void;
  onBack: () => void;
  warehouseCount: number;
  facilityCount: number;
}

function ConstraintCard({
  icon: Icon,
  label,
  description,
  value,
  unit,
  min,
  max,
  step,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-muted rounded-md">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-baseline justify-between">
              <Label className="text-sm font-medium">{label}</Label>
              <span className="text-xl font-bold tabular-nums">
                {value}
                <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <Slider
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          className="mt-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{min} {unit}</span>
          <span>{max} {unit}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function Step3Constraints({
  constraints,
  onConstraintsChange,
  onNext,
  onBack,
  warehouseCount,
  facilityCount,
}: Step3ConstraintsProps) {
  const estimatedZones = Math.ceil(facilityCount / constraints.max_facilities_per_zone);
  const avgPerWarehouse = warehouseCount > 0
    ? Math.round(facilityCount / warehouseCount)
    : facilityCount;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Configure Constraints</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          These parameters control how Copilot groups facilities into zones. Defaults work well for most regions.
        </p>
      </div>

      {/* Summary */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: 'Warehouses', value: warehouseCount },
          { label: 'Facilities', value: facilityCount },
          { label: 'Avg per warehouse', value: avgPerWarehouse },
          { label: 'Estimated zones', value: estimatedZones },
        ].map(({ label, value }) => (
          <div key={label} className="flex-1 min-w-24 rounded-lg border bg-muted/30 px-3 py-2.5 text-center">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Constraint sliders */}
      <div className="grid gap-4 md:grid-cols-3">
        <ConstraintCard
          icon={Ruler}
          label="Max Radius"
          description="Maximum distance from warehouse a facility may be to qualify for assignment."
          value={constraints.max_radius_km}
          unit="km"
          min={5}
          max={100}
          step={5}
          onChange={v => onConstraintsChange({ ...constraints, max_radius_km: v })}
        />
        <ConstraintCard
          icon={Building2}
          label="Max Facilities per Zone"
          description="Maximum number of facilities allowed in a single zone cluster."
          value={constraints.max_facilities_per_zone}
          unit="facilities"
          min={2}
          max={30}
          step={1}
          onChange={v => onConstraintsChange({ ...constraints, max_facilities_per_zone: v })}
        />
        <ConstraintCard
          icon={Layers}
          label="Max Service Areas"
          description="Maximum number of service areas generated per warehouse."
          value={constraints.max_service_areas_per_warehouse}
          unit="areas"
          min={1}
          max={20}
          step={1}
          onChange={v => onConstraintsChange({ ...constraints, max_service_areas_per_warehouse: v })}
        />
      </div>

      {/* Info note */}
      <div className="flex gap-2.5 rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Facilities outside the max radius of all warehouses will be flagged as{' '}
          <span className="font-medium text-foreground">out of coverage</span> and excluded from zone generation.
          You can still save zones for covered facilities and handle exceptions manually.
        </p>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>Generate Operational Structure</Button>
      </div>
    </div>
  );
}

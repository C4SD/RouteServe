import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Info, Ruler, Building2, Layers, Sparkles, X, CheckCircle2 } from 'lucide-react';
import { haversineKm } from '@/lib/operations-copilot-engine';
import type { CopilotConstraints, CopilotWarehouse, CopilotFacility } from '@/types/operations-copilot';

interface Step3ConstraintsProps {
  constraints: CopilotConstraints;
  onConstraintsChange: (c: CopilotConstraints) => void;
  onNext: () => void;
  onBack: () => void;
  warehouseCount: number;
  facilityCount: number;
  warehouses: CopilotWarehouse[];
  facilities: CopilotFacility[];
}

function computeAIOptimal(
  warehouses: CopilotWarehouse[],
  facilities: CopilotFacility[],
): { constraints: CopilotConstraints; rationale: string[] } {
  if (warehouses.length === 0 || facilities.length === 0) {
    return {
      constraints: { max_radius_km: 30, max_facilities_per_zone: 12, max_service_areas_per_warehouse: 5 },
      rationale: ['Using defaults — no facility/warehouse data available.'],
    };
  }

  const dists = facilities
    .map(f => warehouses.reduce((best, w) => Math.min(best, haversineKm(f.lat, f.lng, w.lat, w.lng)), Infinity))
    .sort((a, b) => a - b);

  const p90 = dists[Math.floor(dists.length * 0.9)] ?? 30;
  const max_radius_km = Math.min(100, Math.max(10, Math.ceil((p90 * 1.15) / 5) * 5));

  const facilsPerWh = facilities.length / warehouses.length;
  const targetZones = Math.max(2, Math.round(Math.sqrt(facilsPerWh)));
  const max_facilities_per_zone = Math.min(30, Math.max(3, Math.round(facilsPerWh / targetZones)));
  const max_service_areas_per_warehouse = Math.min(20, Math.max(2, targetZones));

  const rationale = [
    `Max radius set to ${max_radius_km} km — covers 90% of facilities from their nearest warehouse.`,
    `Max ${max_facilities_per_zone} facilities/zone — optimal cluster density for ${Math.round(facilsPerWh)} avg facilities per warehouse.`,
    `${max_service_areas_per_warehouse} service areas/warehouse — aligns with estimated ${targetZones} natural zone groups.`,
  ];

  return { constraints: { max_radius_km, max_facilities_per_zone, max_service_areas_per_warehouse }, rationale };
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
  warehouses,
  facilities,
}: Step3ConstraintsProps) {
  const estimatedZones = Math.ceil(facilityCount / constraints.max_facilities_per_zone);
  const avgPerWarehouse = warehouseCount > 0
    ? Math.round(facilityCount / warehouseCount)
    : facilityCount;

  const [aiPanel, setAiPanel] = useState<{ constraints: CopilotConstraints; rationale: string[] } | null>(null);
  const [aiApplied, setAiApplied] = useState(false);

  function handleAIOptimize() {
    const result = computeAIOptimal(warehouses, facilities);
    setAiPanel(result);
    setAiApplied(false);
  }

  function applyAISettings() {
    if (aiPanel) {
      onConstraintsChange(aiPanel.constraints);
      setAiApplied(true);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Configure Constraints</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manually tune parameters below, or let AI determine the optimal configuration.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 border-violet-300 text-violet-700 hover:bg-violet-50 hover:text-violet-800 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-950"
          onClick={handleAIOptimize}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          AI Optimization
        </Button>
      </div>

      {/* AI optimization panel */}
      {aiPanel && (
        <div className="rounded-lg border border-violet-200 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/30 p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
              <span className="text-sm font-medium text-violet-800 dark:text-violet-300">
                AI-Recommended Configuration
              </span>
            </div>
            <button onClick={() => setAiPanel(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="space-y-1">
            {aiPanel.rationale.map((r, i) => (
              <li key={i} className="text-xs text-violet-700 dark:text-violet-300 flex gap-1.5">
                <span className="text-violet-400 shrink-0">·</span>
                {r}
              </li>
            ))}
          </ul>
          <div className="flex gap-2 pt-1">
            {aiApplied ? (
              <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Settings applied — sliders updated below
              </div>
            ) : (
              <Button
                size="sm"
                className="h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white"
                onClick={applyAISettings}
              >
                Apply These Settings
              </Button>
            )}
          </div>
        </div>
      )}


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

import { useEffect, useState } from 'react';
import { Zap, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { runCopilotEngine } from '@/lib/operations-copilot-engine';
import type {
  CopilotConstraints,
  CopilotFacility,
  CopilotWarehouse,
  CopilotGenerationResult,
} from '@/types/operations-copilot';

interface Step4GenerateProps {
  warehouses: CopilotWarehouse[];
  facilities: CopilotFacility[];
  constraints: CopilotConstraints;
  onComplete: (result: CopilotGenerationResult) => void;
  onBack: () => void;
  existingResult: CopilotGenerationResult | null;
}

type GenerationPhase =
  | 'idle'
  | 'assigning'
  | 'zoning'
  | 'service_areas'
  | 'policies'
  | 'done'
  | 'error';

const PHASES: { phase: GenerationPhase; label: string; pct: number }[] = [
  { phase: 'assigning', label: 'Assigning facilities to warehouses…', pct: 20 },
  { phase: 'zoning', label: 'Generating zone clusters…', pct: 50 },
  { phase: 'service_areas', label: 'Building service areas…', pct: 70 },
  { phase: 'policies', label: 'Mapping service policies…', pct: 90 },
  { phase: 'done', label: 'Operational structure ready', pct: 100 },
];

export function Step4Generate({
  warehouses,
  facilities,
  constraints,
  onComplete,
  onBack,
  existingResult,
}: Step4GenerateProps) {
  const [phase, setPhase] = useState<GenerationPhase>(existingResult ? 'done' : 'idle');
  const [progress, setProgress] = useState(existingResult ? 100 : 0);
  const [result, setResult] = useState<CopilotGenerationResult | null>(existingResult);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setPhase('idle');
    setError(null);
    setResult(null);

    try {
      for (const { phase: p, label: _l, pct } of PHASES) {
        setPhase(p);
        setProgress(pct);
        // Small delay so the UI updates are visible
        await new Promise(r => setTimeout(r, 280));
      }

      const generated = runCopilotEngine(warehouses, facilities, constraints);
      setResult(generated);
      setPhase('done');
      setProgress(100);
    } catch (e: any) {
      setError(e?.message ?? 'Generation failed. Please try again.');
      setPhase('error');
    }
  }

  // Auto-generate on mount if no existing result
  useEffect(() => {
    if (!existingResult) {
      generate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentPhaseLabel =
    PHASES.find(p => p.phase === phase)?.label ??
    (phase === 'idle' ? 'Preparing…' : phase === 'error' ? 'Generation failed' : '');

  const totalZones = result?.structures.reduce((s, st) => s + st.zones.length, 0) ?? 0;
  const totalSAs = result?.structures.reduce((s, st) => s + st.service_areas.length, 0) ?? 0;
  const outOfCoverage = result?.global_out_of_coverage.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Generating Operational Structure</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Copilot is running the inference engine across {warehouses.length} warehouse{warehouses.length !== 1 ? 's' : ''} and {facilities.length} facilit{facilities.length !== 1 ? 'ies' : 'y'}.
        </p>
      </div>

      {/* Progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{currentPhaseLabel}</span>
          <span className="font-medium tabular-nums">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2.5" />
      </div>

      {/* Phases checklist */}
      <div className="space-y-2">
        {PHASES.filter(p => p.phase !== 'done').map(({ phase: p, label }) => {
          const currentIdx = PHASES.findIndex(x => x.phase === phase);
          const thisIdx = PHASES.findIndex(x => x.phase === p);
          const isDone = phase === 'done' || (currentIdx > thisIdx && phase !== 'idle');
          const isActive = phase === p;

          return (
            <div
              key={p}
              className={`flex items-center gap-3 text-sm ${
                isDone ? 'text-foreground' : isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              ) : isActive ? (
                <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-primary" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
              )}
              {label}
            </div>
          );
        })}
      </div>

      {/* Error */}
      {phase === 'error' && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm text-destructive">Generation Error</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Result summary */}
      {phase === 'done' && result && (
        <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 p-5 space-y-4">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <Zap className="h-5 w-5 shrink-0" />
            <span className="font-semibold">Structure Generated</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Warehouses', value: result.structures.length },
              { label: 'Zones', value: totalZones },
              { label: 'Service Areas', value: totalSAs },
              { label: 'Out of coverage', value: outOfCoverage },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border bg-background/60 px-3 py-3 text-center">
                <p className={`text-2xl font-bold ${label === 'Out of coverage' && value > 0 ? 'text-amber-600' : 'text-green-700 dark:text-green-400'}`}>
                  {value}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
            ))}
          </div>
          {outOfCoverage > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {outOfCoverage} facilit{outOfCoverage > 1 ? 'ies' : 'y'} could not be assigned to any warehouse within the configured radius.
            </p>
          )}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} disabled={phase !== 'done' && phase !== 'error' && phase !== 'idle'}>
          Back
        </Button>
        <div className="flex gap-2">
          {(phase === 'done' || phase === 'error') && (
            <Button variant="outline" onClick={generate}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate
            </Button>
          )}
          {phase === 'done' && result && (
            <Button onClick={() => onComplete(result)}>
              Review & Accept
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

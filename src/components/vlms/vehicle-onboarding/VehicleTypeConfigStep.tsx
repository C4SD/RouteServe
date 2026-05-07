/**
 * VLMS Vehicle Onboarding — Combined Step: Type + Capacity + Registration (v4)
 *
 * Tabs:
 *   Left panel  — vehicle type carousel (< > swipe through subtypes)
 *   Right panel — Capacity | Specs | Interior | Slots & Tiers
 *
 * Changes from v3:
 *  - Dimensions input in metres (m), stored internally as cm
 *  - License plate and VIN are checked for uniqueness against the DB
 *  - New "Slots & Tiers" tab for full tier / slot configuration
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Check,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Ruler,
  Weight,
  FileText,
  Image as ImageIcon,
  X,
  Satellite,
  Layers,
  Loader2,
  AlertCircle,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { getSubtypesByCategory } from '@/lib/vlms/vehicleTaxonomy';
import { useVehicleOnboardState } from '@/hooks/useVehicleOnboardState';
import { useOnboardingFilesStore } from '@/stores/vlms/onboardingFilesStore';
import {
  calculateVolumeFromDimensions,
  createDimensionalConfig,
  calculateAutoTiersFromDimensions,
  computeSlotLayout,
  deriveSlotGrid,
  BOX_PRESETS,
  type SlotLayoutResult,
} from '@/lib/vlms/capacityCalculations';
import { getSlotConstraints } from '@/lib/vlms/vehicleTaxonomy';
import { AiDimensionButton } from '@/components/vlms/vehicle-configurator/AiDimensionButton';
import { useLicensePlateUniqueness, useVinUniqueness } from '@/hooks/useVehicleUniquenessCheck';
import type { VehicleType, TierConfig } from '@/types/vlms-onboarding';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert metres (user input) → cm (internal storage). */
const mToCm = (m: string | number): number => Math.round(parseFloat(String(m)) * 100) || 0;
/** Convert cm (internal storage) → metres string for display. */
const cmToM = (cm?: number): string => (cm ? (cm / 100).toFixed(2) : '');

// ─── Carousel dot indicator ───────────────────────────────────────────────────

function Dot({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-1.5 rounded-full transition-all duration-200',
        active ? 'w-4 bg-foreground' : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60',
      )}
    />
  );
}

// ─── Left panel: Type Carousel ────────────────────────────────────────────────

interface TypeCarouselProps {
  subtypes: VehicleType[];
  currentIndex: number;
  selectedType: VehicleType | null;
  customTypeName: string;
  onNavigate: (index: number) => void;
  onCustomOpen: () => void;
}

function TypeCarousel({
  subtypes,
  currentIndex,
  selectedType,
  customTypeName,
  onNavigate,
  onCustomOpen,
}: TypeCarouselProps) {
  const current = subtypes[currentIndex];

  const handlePrev = () => onNavigate((currentIndex - 1 + subtypes.length) % subtypes.length);
  const handleNext = () => onNavigate((currentIndex + 1) % subtypes.length);

  if (subtypes.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted/20 p-8">
        <p className="text-sm text-muted-foreground text-center">
          No predefined types for this category.
        </p>
        <Button variant="outline" size="sm" onClick={onCustomOpen}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Create custom type
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col items-center justify-between bg-muted/20 border-r border-border/50 py-8 px-4">
      <button
        type="button"
        onClick={handlePrev}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-muted transition-colors"
        aria-label="Previous type"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex flex-col items-center gap-3 px-12 w-full flex-1 justify-center">
        <div className="h-44 w-full flex items-end justify-center">
          {current?.icon_name ? (
            <img
              key={current.id}
              src={current.icon_name}
              alt={current.name}
              className="max-h-full max-w-[280px] w-full object-contain object-bottom drop-shadow-sm"
              draggable={false}
            />
          ) : (
            <div className="h-32 w-56 rounded-lg bg-muted/60 flex items-center justify-center">
              <span className="text-muted-foreground text-3xl">—</span>
            </div>
          )}
        </div>

        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-foreground">{current?.name}</p>
          {current?.default_capacity_kg && (
            <p className="text-xs text-muted-foreground">
              {current.default_capacity_kg >= 1000
                ? `${(current.default_capacity_kg / 1000).toFixed(1)}t`
                : `${current.default_capacity_kg}kg`}
              {current.default_capacity_m3 && ` · ${current.default_capacity_m3}m³`}
            </p>
          )}
        </div>

        {selectedType?.id === current?.id && (
          <Badge variant="secondary" className="text-xs gap-1">
            <Check className="h-3 w-3" />
            Selected
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1.5 mt-3">
        {subtypes.map((_, i) => (
          <Dot key={i} active={i === currentIndex} onClick={() => onNavigate(i)} />
        ))}
      </div>

      <button
        type="button"
        onClick={onCustomOpen}
        className="mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
      >
        {customTypeName ? `Custom: ${customTypeName}` : 'Or create a custom type'}
      </button>

      <button
        type="button"
        onClick={handleNext}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-muted transition-colors"
        aria-label="Next type"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Right panel: Configurator tab ───────────────────────────────────────────

interface ConfiguratorPanelProps {
  isAiProcessing: boolean;
  onAiProcessingChange: (v: boolean) => void;
}

function ConfiguratorPanel({ isAiProcessing, onAiProcessingChange }: ConfiguratorPanelProps) {
  const capacityConfig = useVehicleOnboardState((s) => s.capacityConfig);
  const updateCapacityConfig = useVehicleOnboardState((s) => s.updateCapacityConfig);

  // Vehicle body dimensions — in metres, stored as cm
  const [vehLengthM, setVehLengthM] = useState(cmToM(capacityConfig.vehicle_dimensions?.length_cm));
  const [vehWidthM,  setVehWidthM]  = useState(cmToM(capacityConfig.vehicle_dimensions?.width_cm));
  const [vehHeightM, setVehHeightM] = useState(cmToM(capacityConfig.vehicle_dimensions?.height_cm));

  // Cargo hold dimensions — in metres, stored as cm
  const [lengthM, setLengthM] = useState(cmToM(capacityConfig.dimensions?.length_cm));
  const [widthM, setWidthM]   = useState(cmToM(capacityConfig.dimensions?.width_cm));
  const [heightM, setHeightM] = useState(cmToM(capacityConfig.dimensions?.height_cm));
  const [maxPayloadKg, setMaxPayloadKg] = useState(capacityConfig.capacity_kg?.toString() || '');

  const parsedLcm = mToCm(lengthM);
  const parsedWcm = mToCm(widthM);
  const parsedHcm = mToCm(heightM);

  const calculatedVolume =
    parsedLcm > 0 && parsedWcm > 0 && parsedHcm > 0
      ? calculateVolumeFromDimensions(parsedLcm, parsedWcm, parsedHcm)
      : 0;

  const handleVehicleDimBlur = () => {
    const lCm = mToCm(vehLengthM), wCm = mToCm(vehWidthM), hCm = mToCm(vehHeightM);
    if (lCm > 0 && wCm > 0 && hCm > 0) {
      updateCapacityConfig({
        vehicle_dimensions: createDimensionalConfig(lCm, wCm, hCm),
      });
    }
  };

  const handleDimensionBlur = () => {
    if (parsedLcm > 0 && parsedWcm > 0 && parsedHcm > 0) {
      const dimensions = createDimensionalConfig(parsedLcm, parsedWcm, parsedHcm);
      updateCapacityConfig({ use_dimensions: true, dimensions, capacity_m3: dimensions.calculated_volume_m3 });
    }
  };

  const handlePayloadBlur = () => {
    updateCapacityConfig({ capacity_kg: parseFloat(maxPayloadKg) || undefined });
  };

  const handleAiAnalysis = (analysis: {
    dimensions_cm?: { length: number; width: number; height: number };
    max_payload_kg?: number;
    volume_m3?: number;
  }) => {
    if (analysis.dimensions_cm) {
      const { length, width, height } = analysis.dimensions_cm;
      if (length > 0 && width > 0 && height > 0) {
        setLengthM((length / 100).toFixed(2));
        setWidthM((width / 100).toFixed(2));
        setHeightM((height / 100).toFixed(2));
        const dimensions = createDimensionalConfig(length, width, height);
        updateCapacityConfig({ use_dimensions: true, dimensions, capacity_m3: dimensions.calculated_volume_m3 });
      }
    }
    if (analysis.max_payload_kg) {
      setMaxPayloadKg(String(analysis.max_payload_kg));
      updateCapacityConfig({ capacity_kg: analysis.max_payload_kg });
    }
  };

  return (
    <div className="space-y-5">
      {/* Vehicle Dimensions — overall body size */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5">
          <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Vehicle Dimensions (m)
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Length', val: vehLengthM, set: setVehLengthM, placeholder: '5.00' },
            { label: 'Width',  val: vehWidthM,  set: setVehWidthM,  placeholder: '2.10' },
            { label: 'Height', val: vehHeightM, set: setVehHeightM, placeholder: '2.30' },
          ].map(({ label, val, set, placeholder }) => (
            <div key={label} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder={placeholder}
                value={val}
                onChange={(e) => set(e.target.value)}
                onBlur={handleVehicleDimBlur}
                className="h-8 text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Cargo Dimensions — usable cargo hold */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5">
          <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Cargo Dimensions (m)
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Length', val: lengthM, set: setLengthM, placeholder: '4.00' },
            { label: 'Width',  val: widthM,  set: setWidthM,  placeholder: '2.00' },
            { label: 'Height', val: heightM, set: setHeightM, placeholder: '1.80' },
          ].map(({ label, val, set, placeholder }) => (
            <div key={label} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder={placeholder}
                value={val}
                onChange={(e) => set(e.target.value)}
                onBlur={handleDimensionBlur}
                className="h-8 text-sm"
              />
            </div>
          ))}
        </div>

        {/* Auto-calculated volume */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Cargo Volume</Label>
          <Input
            readOnly
            value={calculatedVolume > 0 ? `${calculatedVolume.toFixed(2)} m³` : ''}
            placeholder="Auto-calculated from dimensions"
            className="h-8 text-sm bg-muted/40 cursor-default"
          />
        </div>
      </div>

      <Separator />

      {/* Payload */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5">
          <Weight className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payload</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Max Payload (kg)</Label>
          <Input
            type="number"
            placeholder="1000"
            value={maxPayloadKg}
            onChange={(e) => setMaxPayloadKg(e.target.value)}
            onBlur={handlePayloadBlur}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <Separator />

      {/* AI-Assisted Dimensions */}
      <div className="rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <p className="text-xs font-semibold text-primary">AI-Assisted Dimensions</p>
          <Badge variant="secondary" className="text-[10px] ml-auto">Optional</Badge>
        </div>
        <AiDimensionButton
          onAnalysisComplete={handleAiAnalysis}
          isProcessing={isAiProcessing}
          onProcessingChange={onAiProcessingChange}
        />
      </div>
    </div>
  );
}

// ─── Right panel: Specs tab ───────────────────────────────────────────────────

function SpecsPanel() {
  const registrationData = useVehicleOnboardState((s) => s.registrationData);
  const updateRegistrationData = useVehicleOnboardState((s) => s.updateRegistrationData);

  const handleChange = (field: string, value: unknown) =>
    updateRegistrationData({ [field]: value });

  // Uniqueness checks
  const { isDuplicate: plateDuplicate, isChecking: plateChecking } =
    useLicensePlateUniqueness(registrationData.license_plate);
  const { isDuplicate: vinDuplicate, isChecking: vinChecking } =
    useVinUniqueness(registrationData.vin ?? '');

  return (
    <div className="space-y-5">
      {/* Required information */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Required Information
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">
              Make <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Toyota"
              value={registrationData.make}
              onChange={(e) => handleChange('make', e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">
              Model <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="e.g. Hiace"
              value={registrationData.model ?? ''}
              onChange={(e) => handleChange('model', e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Year */}
          <div className="space-y-1">
            <Label className="text-xs">
              Year <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              placeholder={new Date().getFullYear().toString()}
              value={registrationData.year}
              onChange={(e) => handleChange('year', parseInt(e.target.value))}
              min={1900}
              max={new Date().getFullYear() + 1}
              className="h-8 text-sm"
            />
          </div>

          {/* License Plate — with uniqueness check */}
          <div className="space-y-1">
            <Label className="text-xs">
              License Plate <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                placeholder="ABC-123-XY"
                value={registrationData.license_plate}
                onChange={(e) => handleChange('license_plate', e.target.value.toUpperCase())}
                className={cn(
                  'h-8 text-sm font-mono pr-7',
                  plateDuplicate && 'border-destructive focus-visible:ring-destructive',
                )}
              />
              {plateChecking && (
                <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {!plateChecking && plateDuplicate && (
                <AlertCircle className="absolute right-2 top-2 h-4 w-4 text-destructive" />
              )}
              {!plateChecking && !plateDuplicate && registrationData.license_plate.length >= 3 && (
                <Check className="absolute right-2 top-2 h-4 w-4 text-emerald-500" />
              )}
            </div>
            {plateDuplicate && (
              <p className="text-[10px] text-destructive">Already registered in this workspace</p>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* VIN */}
      <div className="space-y-2">
        <Label className="text-xs">VIN</Label>
        <div className="relative">
          <Input
            placeholder="17-character VIN"
            value={registrationData.vin || ''}
            onChange={(e) => handleChange('vin', e.target.value.toUpperCase())}
            maxLength={17}
            className={cn(
              'h-8 text-sm font-mono pr-7',
              vinDuplicate && 'border-destructive focus-visible:ring-destructive',
            )}
          />
          {vinChecking && (
            <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {!vinChecking && vinDuplicate && (
            <AlertCircle className="absolute right-2 top-2 h-4 w-4 text-destructive" />
          )}
          {!vinChecking && !vinDuplicate && (registrationData.vin?.length ?? 0) === 17 && (
            <Check className="absolute right-2 top-2 h-4 w-4 text-emerald-500" />
          )}
        </div>
        {vinDuplicate && <p className="text-[10px] text-destructive">VIN already registered in this workspace</p>}
      </div>

      <Separator />

      {/* Specifications */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Specifications
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Fuel Type</Label>
            <Select
              value={registrationData.fuel_type || ''}
              onValueChange={(v) => handleChange('fuel_type', v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gasoline">Gasoline</SelectItem>
                <SelectItem value="diesel">Diesel</SelectItem>
                <SelectItem value="electric">Electric</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
                <SelectItem value="cng">CNG</SelectItem>
                <SelectItem value="lpg">LPG</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Transmission</Label>
            <Select
              value={registrationData.transmission || ''}
              onValueChange={(v) => handleChange('transmission', v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="automatic">Automatic</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="cvt">CVT</SelectItem>
                <SelectItem value="dct">DCT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Engine (cc)</Label>
            <Input
              type="number"
              placeholder="2000"
              value={registrationData.engine_capacity || ''}
              onChange={(e) =>
                handleChange('engine_capacity', parseFloat(e.target.value) || undefined)
              }
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Color</Label>
            <Input
              placeholder="White"
              value={registrationData.color || ''}
              onChange={(e) => handleChange('color', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mileage (km)</Label>
            <Input
              type="number"
              placeholder="0"
              value={registrationData.current_mileage || 0}
              onChange={(e) => handleChange('current_mileage', parseInt(e.target.value) || 0)}
              min={0}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select
              value={registrationData.status}
              onValueChange={(v) => handleChange('status', v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="in_use">In Use</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="out_of_service">Out of Service</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* Acquisition */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Acquisition
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input
              type="date"
              value={registrationData.acquisition_date}
              onChange={(e) => handleChange('acquisition_date', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select
              value={registrationData.acquisition_type}
              onValueChange={(v) => handleChange('acquisition_type', v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="purchase">Purchase</SelectItem>
                <SelectItem value="lease">Lease</SelectItem>
                <SelectItem value="donation">Donation</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Purchase Price</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={registrationData.purchase_price || ''}
              onChange={(e) =>
                handleChange('purchase_price', parseFloat(e.target.value) || undefined)
              }
              min={0}
              step={0.01}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Vendor</Label>
            <Input
              placeholder="ABC Motors"
              value={registrationData.vendor_name || ''}
              onChange={(e) => handleChange('vendor_name', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Insurance & Registration */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Insurance &amp; Registration
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Insurance Provider</Label>
            <Input
              placeholder="XYZ Insurance"
              value={registrationData.insurance_provider || ''}
              onChange={(e) => handleChange('insurance_provider', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Policy No.</Label>
            <Input
              placeholder="Policy number"
              value={registrationData.insurance_policy_number || ''}
              onChange={(e) => handleChange('insurance_policy_number', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Insurance Expiry</Label>
            <Input
              type="date"
              value={registrationData.insurance_expiry || ''}
              onChange={(e) => handleChange('insurance_expiry', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Reg. Expiry</Label>
            <Input
              type="date"
              value={registrationData.registration_expiry || ''}
              onChange={(e) => handleChange('registration_expiry', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Right panel: Interior tab ────────────────────────────────────────────────

interface InteriorPanelProps {
  interiorLengthM: string;
  interiorWidthM: string;
  interiorHeightM: string;
  onInteriorChange: (field: 'length' | 'width' | 'height', value: string) => void;
}

function InteriorPanel({
  interiorLengthM,
  interiorWidthM,
  interiorHeightM,
  onInteriorChange,
}: InteriorPanelProps) {
  const registrationData = useVehicleOnboardState((s) => s.registrationData);
  const updateRegistrationData = useVehicleOnboardState((s) => s.updateRegistrationData);
  const { stagedDocuments, stagedPhotos, addDocuments, addPhotos, removeDocument, removePhoto } =
    useOnboardingFilesStore();
  const docInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (field: string, value: unknown) =>
    updateRegistrationData({ [field]: value });

  const handleDocumentSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      addDocuments(Array.from(e.target.files || []));
      if (docInputRef.current) docInputRef.current.value = '';
    },
    [addDocuments],
  );

  const handlePhotoSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      addPhotos(Array.from(e.target.files || []));
      if (photoInputRef.current) photoInputRef.current.value = '';
    },
    [addPhotos],
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-5">
      {/* Interior Dimensions — in metres */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Interior Dimensions (m)
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Length', val: interiorLengthM, field: 'length' as const, ph: '3.00' },
            { label: 'Width',  val: interiorWidthM,  field: 'width'  as const, ph: '1.80' },
            { label: 'Height', val: interiorHeightM, field: 'height' as const, ph: '1.90' },
          ].map(({ label, val, field, ph }) => (
            <div key={label} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder={ph}
                value={val}
                onChange={(e) => onInteriorChange(field, e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Seating */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seating</p>
        <div className="space-y-1">
          <Label className="text-xs">Number of Seats</Label>
          <Input
            type="number"
            placeholder="2"
            value={registrationData.seating_capacity || ''}
            onChange={(e) =>
              handleChange('seating_capacity', parseInt(e.target.value) || undefined)
            }
            min={1}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <Separator />

      {/* Telemetry */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Satellite className="h-3 w-3" />
          Telemetry
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Provider</Label>
            <Select
              value={registrationData.telematics_provider || ''}
              onValueChange={(v) => handleChange('telematics_provider', v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="biko_native">Biko Native</SelectItem>
                <SelectItem value="teltonika">Teltonika</SelectItem>
                <SelectItem value="queclink">Queclink</SelectItem>
                <SelectItem value="ruptela">Ruptela</SelectItem>
                <SelectItem value="coban">Coban</SelectItem>
                <SelectItem value="concox">Concox</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Device ID / IMEI</Label>
            <Input
              placeholder="350544508537246"
              value={registrationData.telematics_id || ''}
              onChange={(e) => handleChange('telematics_id', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">SIM Number</Label>
            <Input
              placeholder="+234 801 234 5678"
              value={registrationData.tracker_sim_number || ''}
              onChange={(e) => handleChange('tracker_sim_number', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Protocol</Label>
            <Select
              value={registrationData.tracker_protocol || ''}
              onValueChange={(v) => handleChange('tracker_protocol', v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gprs">GPRS (2G)</SelectItem>
                <SelectItem value="3g">3G</SelectItem>
                <SelectItem value="4g">4G / LTE</SelectItem>
                <SelectItem value="satellite">Satellite</SelectItem>
                <SelectItem value="bluetooth">Bluetooth</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'gps',           label: 'GPS Location' },
            { id: 'speed',         label: 'Speed Monitoring' },
            { id: 'fuel_level',    label: 'Fuel Level' },
            { id: 'temperature',   label: 'Temperature' },
            { id: 'door_sensor',   label: 'Door Sensor' },
            { id: 'engine_status', label: 'Engine Status' },
          ].map((cap) => {
            const capabilities = registrationData.tracker_capabilities || [];
            const isChecked = capabilities.includes(cap.id as never);
            return (
              <div key={cap.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`tc-${cap.id}`}
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    const updated = checked
                      ? [...capabilities, cap.id]
                      : capabilities.filter((c) => c !== cap.id);
                    handleChange('tracker_capabilities', updated);
                  }}
                />
                <Label htmlFor={`tc-${cap.id}`} className="text-xs font-normal cursor-pointer">
                  {cap.label}
                </Label>
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Notes */}
      <div className="space-y-1">
        <Label className="text-xs">Notes</Label>
        <Textarea
          placeholder="Additional notes..."
          value={registrationData.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={2}
          className="text-sm resize-none"
        />
      </div>

      <Separator />

      {/* Documents & Photos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Documents &amp; Photos
          </p>
          <span className="text-xs text-muted-foreground">
            {stagedDocuments.length} doc{stagedDocuments.length !== 1 ? 's' : ''} ·{' '}
            {stagedPhotos.length} photo{stagedPhotos.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={() => docInputRef.current?.click()}
          >
            <FileText className="h-3 w-3 mr-1" /> Add Docs
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={() => photoInputRef.current?.click()}
          >
            <ImageIcon className="h-3 w-3 mr-1" /> Add Photos
          </Button>
        </div>
        <input
          ref={docInputRef}
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          onChange={handleDocumentSelect}
        />
        <input
          ref={photoInputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*"
          onChange={handlePhotoSelect}
        />

        {stagedDocuments.length > 0 && (
          <div className="space-y-1">
            {stagedDocuments.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="flex items-center justify-between rounded-md bg-muted px-2 py-1 text-xs"
              >
                <span className="truncate flex-1">{file.name}</span>
                <span className="text-muted-foreground mx-2">{formatFileSize(file.size)}</span>
                <button
                  type="button"
                  onClick={() => removeDocument(i)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {stagedPhotos.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5">
            {stagedPhotos.map((file, i) => (
              <div key={`${file.name}-${i}`} className="relative group">
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="w-full h-14 object-cover rounded border"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tier label constants ─────────────────────────────────────────────────────

const TIER_LABELS = ['A', 'B', 'C', 'D', 'E'];


// ─── Inline slot grid for a single tier ──────────────────────────────────────

function TierSlotGrid({
  slotCount,
  tierIndex,
  onChange,
  maxSlots,
}: {
  slotCount: number;
  tierIndex: number;
  onChange: (n: number) => void;
  maxSlots: number;
}) {
  const { rows, cols } = deriveSlotGrid(Math.max(1, slotCount));
  const cells = rows * cols;

  return (
    <div className="space-y-2">
      {/* Grid */}
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cells }).map((_, j) => {
          const isActive = j < slotCount;
          const slotNum  = j + 1;
          return (
            <div
              key={j}
              title={isActive ? `Slot ${slotNum}` : undefined}
              className={cn(
                'h-9 rounded-md border text-[11px] font-bold flex items-center justify-center select-none transition-colors',
                isActive
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'bg-muted/20 border-dashed border-muted-foreground/20 text-transparent',
              )}
            >
              {slotNum}
            </div>
          );
        })}
      </div>

      {/* +/− stepper */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {slotCount} slot{slotCount !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={slotCount <= 1}
            onClick={() => onChange(Math.max(1, slotCount - 1))}
            className="h-6 w-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Remove slot"
          >
            <span className="text-sm leading-none">−</span>
          </button>
          <span className="w-6 text-center text-xs font-medium tabular-nums">{slotCount}</span>
          <button
            type="button"
            disabled={slotCount >= maxSlots}
            onClick={() => onChange(Math.min(maxSlots, slotCount + 1))}
            className="h-6 w-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Add slot"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Right panel: Slots & Tiers tab ──────────────────────────────────────────

function SlotTierPanel() {
  const capacityConfig    = useVehicleOnboardState((s) => s.capacityConfig);
  const updateCapacityConfig = useVehicleOnboardState((s) => s.updateCapacityConfig);
  const selectedType      = useVehicleOnboardState((s) => s.selectedType);

  const [selectedBoxId, setSelectedBoxId] = useState<string>(BOX_PRESETS[2].id); // default Medium

  const tiers = capacityConfig.tiered_config;
  const dims  = capacityConfig.dimensions;

  // Derive slot constraints from selected vehicle type
  const constraints = selectedType
    ? getSlotConstraints(selectedType.id)
    : { maxTiers: 2, maxSlotsPerTier: 6 };

  // Compute layout whenever cargo dimensions or box preset change
  const slotLayout: SlotLayoutResult | null =
    dims && dims.length_cm > 0 && dims.width_cm > 0 && dims.height_cm > 0
      ? computeSlotLayout(
          { length_cm: dims.length_cm, width_cm: dims.width_cm, height_cm: dims.height_cm },
          BOX_PRESETS.find((b) => b.id === selectedBoxId) ?? BOX_PRESETS[2],
          constraints,
        )
      : null;

  // Apply computed layout to tiered_config
  const applyLayout = () => {
    if (!slotLayout) return;
    const kg  = capacityConfig.capacity_kg ?? 0;
    const m3  = capacityConfig.capacity_m3 ?? 0;
    const tierNames = ['Lower', 'Middle', 'Upper', 'Top', 'Roof'];
    const weightDists: Record<number, number[]> = {
      1: [1.0],
      2: [0.6, 0.4],
      3: [0.4, 0.35, 0.25],
      4: [0.35, 0.3, 0.2, 0.15],
      5: [0.3, 0.25, 0.2, 0.15, 0.1],
    };
    const dists = weightDists[slotLayout.tiers] ?? Array(slotLayout.tiers).fill(1 / slotLayout.tiers);

    const newTiers: TierConfig[] = Array.from({ length: slotLayout.tiers }, (_, i) => ({
      tier_name:     tierNames[i] ?? `Tier ${i + 1}`,
      tier_order:    i + 1,
      slot_count:    slotLayout.slotsPerTier,
      max_weight_kg: kg > 0 ? Math.round(kg * dists[i]) : undefined,
      max_volume_m3: m3 > 0 ? Math.round((m3 / slotLayout.tiers) * 100) / 100 : undefined,
      weight_pct:    Math.round(dists[i] * 100),
      volume_pct:    Math.round(100 / slotLayout.tiers),
    }));

    updateCapacityConfig({ tiered_config: newTiers });
  };

  const updateTier = (index: number, updates: Partial<TierConfig>) => {
    const updated = tiers.map((t, i) => (i === index ? { ...t, ...updates } : t));
    updateCapacityConfig({ tiered_config: updated });
  };

  const addTier = () => {
    const nextOrder = (tiers[tiers.length - 1]?.tier_order ?? 0) + 1;
    const defaultNames = ['Lower', 'Middle', 'Upper', 'Top', 'Roof'];
    const tierName = defaultNames[tiers.length] ?? `Tier ${nextOrder}`;
    updateCapacityConfig({
      tiered_config: [
        ...tiers,
        { tier_name: tierName, tier_order: nextOrder, slot_count: 3 },
      ],
    });
  };

  const removeTier = (index: number) => {
    const updated = tiers
      .filter((_, i) => i !== index)
      .map((t, i) => ({ ...t, tier_order: i + 1 }));
    updateCapacityConfig({ tiered_config: updated });
  };

  const totalSlots = tiers.reduce((s, t) => s + (t.slot_count ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Tier &amp; Slot Configuration
          </p>
        </div>
        {tiers.length > 0 && (
          <Badge variant="outline" className="text-[10px]">
            {tiers.length} tier{tiers.length !== 1 ? 's' : ''} · {totalSlots} slots
          </Badge>
        )}
      </div>

      {/* ── Auto-builder from cargo dimensions ─────────────── */}
      <div className="rounded-lg border border-border p-3 space-y-3">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-muted-foreground" />
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Auto-Builder
          </p>
          <Badge variant="secondary" className="text-[9px] ml-auto">From cargo dims</Badge>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-[10px] text-muted-foreground shrink-0">Box size</Label>
          <Select value={selectedBoxId} onValueChange={setSelectedBoxId}>
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BOX_PRESETS.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  <span className="font-medium">{b.name}</span>
                  <span className="text-muted-foreground ml-1.5">
                    {b.length_cm}×{b.width_cm}×{b.height_cm} cm
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {slotLayout ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <div className="rounded-md bg-muted/40 p-2 text-center">
                <p className="font-semibold">{slotLayout.tiers}</p>
                <p className="text-muted-foreground">Tiers</p>
              </div>
              <div className="rounded-md bg-muted/40 p-2 text-center">
                <p className="font-semibold">{slotLayout.slotsPerTier}</p>
                <p className="text-muted-foreground">Slots/tier</p>
              </div>
              <div className="rounded-md bg-primary/10 p-2 text-center">
                <p className="font-semibold text-primary">{slotLayout.totalSlots}</p>
                <p className="text-muted-foreground">Total</p>
              </div>
            </div>
            {slotLayout.isConstrained && (
              <p className="text-[9px] text-amber-500">
                Capped by vehicle class (max {constraints.maxTiers} tiers · {constraints.maxSlotsPerTier} slots/tier)
              </p>
            )}
            <Button type="button" size="sm" className="w-full h-7 text-xs" onClick={applyLayout}>
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Apply to tiers
            </Button>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            Set cargo dimensions in the Capacity tab to auto-compute slots.
          </p>
        )}
      </div>

      {/* ── Tier list with inline slot grids ─────────────── */}
      {tiers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-2">
          <p className="text-xs text-muted-foreground">No tiers yet.</p>
          <p className="text-[10px] text-muted-foreground">Auto-build from cargo dimensions above, or add manually.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tiers.map((tier, i) => {
            const slotCount = tier.slot_count ?? 1;
            return (
              <div key={i} className="rounded-lg border border-border p-3 space-y-3">
                {/* Tier header */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded text-[10px] font-bold bg-foreground text-background shrink-0">
                    {TIER_LABELS[i] ?? String(tier.tier_order)}
                  </span>
                  <Input
                    value={tier.tier_name}
                    onChange={(e) => updateTier(i, { tier_name: e.target.value })}
                    className="h-7 text-xs flex-1 font-medium"
                    placeholder="Tier name"
                  />
                  <button
                    type="button"
                    onClick={() => removeTier(i)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    aria-label="Remove tier"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Weight / Volume */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Max Weight (kg)</Label>
                    <Input
                      type="number"
                      placeholder="—"
                      value={tier.max_weight_kg ?? ''}
                      onChange={(e) =>
                        updateTier(i, { max_weight_kg: parseFloat(e.target.value) || undefined })
                      }
                      min={0}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Max Vol. (m³)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="—"
                      value={tier.max_volume_m3 ?? ''}
                      onChange={(e) =>
                        updateTier(i, { max_volume_m3: parseFloat(e.target.value) || undefined })
                      }
                      min={0}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>

                {/* Slot compartment visualizer */}
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Cargo Compartments</Label>
                  <TierSlotGrid
                    slotCount={slotCount}
                    tierIndex={i}
                    maxSlots={constraints.maxSlotsPerTier}
                    onChange={(n) => updateTier(i, { slot_count: n })}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add tier */}
      {tiers.length < 5 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs"
          onClick={addTier}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Tier
        </Button>
      )}

      {/* Summary */}
      {tiers.length > 0 && (
        <div className="rounded-md bg-muted/40 p-3 text-xs space-y-1.5">
          <p className="font-semibold text-muted-foreground mb-2">Summary</p>
          {tiers.map((t, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-foreground font-medium">{t.tier_name}</span>
              <span className="text-muted-foreground">
                {t.max_weight_kg ? `${t.max_weight_kg} kg` : '—'} ·{' '}
                {t.max_volume_m3 ? `${t.max_volume_m3} m³` : '—'} ·{' '}
                {t.slot_count ?? 0} slot{t.slot_count !== 1 ? 's' : ''}
              </span>
            </div>
          ))}
          <Separator className="my-1" />
          <div className="flex items-center justify-between font-medium">
            <span>Total</span>
            <span>
              {tiers.reduce((s, t) => s + (t.max_weight_kg ?? 0), 0)} kg ·{' '}
              {tiers.reduce((s, t) => s + (t.max_volume_m3 ?? 0), 0).toFixed(1)} m³ ·{' '}
              {totalSlots} slots
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main: VehicleTypeConfigStep ──────────────────────────────────────────────

export function VehicleTypeConfigStep() {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isCustomDialogOpen, setIsCustomDialogOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // Interior dimensions stored in metres locally
  const [interiorLengthM, setInteriorLengthM] = useState('');
  const [interiorWidthM, setInteriorWidthM]   = useState('');
  const [interiorHeightM, setInteriorHeightM] = useState('');

  const selectedCategory  = useVehicleOnboardState((s) => s.selectedCategory);
  const selectedType      = useVehicleOnboardState((s) => s.selectedType);
  const customTypeName    = useVehicleOnboardState((s) => s.customTypeName);
  const setSelectedType   = useVehicleOnboardState((s) => s.setSelectedType);
  const setCustomTypeName = useVehicleOnboardState((s) => s.setCustomTypeName);
  const registrationData  = useVehicleOnboardState((s) => s.registrationData);
  const setCurrentStep    = useVehicleOnboardState((s) => s.setCurrentStep);
  const goToPreviousStep  = useVehicleOnboardState((s) => s.goToPreviousStep);

  const subtypes = selectedCategory ? getSubtypesByCategory(selectedCategory.id) : [];

  useEffect(() => {
    if (subtypes.length > 0 && !selectedType && !customTypeName) {
      setSelectedType(subtypes[0]);
      setCarouselIndex(0);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNavigate = (index: number) => {
    setCarouselIndex(index);
    if (subtypes[index]) setSelectedType(subtypes[index]);
  };

  const handleCreateCustom = () => {
    if (customInput.trim()) {
      setCustomTypeName(customInput.trim());
      setIsCustomDialogOpen(false);
      setCustomInput('');
    }
  };

  const handleInteriorChange = (field: 'length' | 'width' | 'height', value: string) => {
    if (field === 'length')      setInteriorLengthM(value);
    else if (field === 'width')  setInteriorWidthM(value);
    else                         setInteriorHeightM(value);
  };

  // Mirror uniqueness checks in the footer gate
  const { isDuplicate: plateDup } = useLicensePlateUniqueness(registrationData.license_plate);
  const { isDuplicate: vinDup }   = useVinUniqueness(registrationData.vin ?? '');

  const canSave =
    (selectedType !== null || customTypeName.trim().length > 0) &&
    registrationData.make.trim().length > 0 &&
    registrationData.model.trim().length > 0 &&
    registrationData.license_plate.trim().length > 0 &&
    registrationData.year > 1900 &&
    registrationData.year <= new Date().getFullYear() + 1 &&
    !plateDup &&
    !vinDup;

  return (
    <>
      <div className="flex h-[580px] -mx-6 -mb-6 overflow-hidden">
        {/* Left: Type carousel */}
        <TypeCarousel
          subtypes={subtypes}
          currentIndex={carouselIndex}
          selectedType={selectedType}
          customTypeName={customTypeName}
          onNavigate={handleNavigate}
          onCustomOpen={() => setIsCustomDialogOpen(true)}
        />

        {/* Right: 4-tab panel */}
        <div className="flex w-[420px] shrink-0 flex-col">
          <Tabs defaultValue="specs" className="flex flex-col flex-1 min-h-0">
            <TabsList className="mx-4 mt-4 grid grid-cols-4 shrink-0">
              <TabsTrigger value="configurator" className="text-[11px] px-1">Capacity</TabsTrigger>
              <TabsTrigger value="specs"        className="text-[11px] px-1">Specs</TabsTrigger>
              <TabsTrigger value="interior"     className="text-[11px] px-1">Interior</TabsTrigger>
              <TabsTrigger value="tiers"        className="text-[11px] px-1">Slots &amp; Tiers</TabsTrigger>
            </TabsList>

            <TabsContent value="configurator" className="flex-1 overflow-y-auto px-4 pb-2 mt-3">
              <ConfiguratorPanel
                isAiProcessing={isAiProcessing}
                onAiProcessingChange={setIsAiProcessing}
              />
            </TabsContent>

            <TabsContent value="specs" className="flex-1 overflow-y-auto px-4 pb-2 mt-3">
              <SpecsPanel />
            </TabsContent>

            <TabsContent value="interior" className="flex-1 overflow-y-auto px-4 pb-2 mt-3">
              <InteriorPanel
                interiorLengthM={interiorLengthM}
                interiorWidthM={interiorWidthM}
                interiorHeightM={interiorHeightM}
                onInteriorChange={handleInteriorChange}
              />
            </TabsContent>

            <TabsContent value="tiers" className="flex-1 overflow-y-auto px-4 pb-2 mt-3">
              <SlotTierPanel />
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="shrink-0 border-t border-border px-4 py-3 flex items-center justify-between gap-3 bg-background">
            <Button variant="ghost" size="sm" onClick={goToPreviousStep}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back
            </Button>

            {!canSave && (
              <p className="text-xs text-muted-foreground flex-1 text-center truncate">
                {plateDup
                  ? 'License plate already registered'
                  : vinDup
                  ? 'VIN already registered'
                  : !(selectedType || customTypeName)
                  ? 'Select a vehicle type'
                  : 'Fill required fields in Specs'}
              </p>
            )}

            <Button
              onClick={() => setCurrentStep('review')}
              disabled={!canSave || isAiProcessing}
              size="sm"
            >
              Review &amp; Submit
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Custom type dialog */}
      <Dialog open={isCustomDialogOpen} onOpenChange={setIsCustomDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Custom Vehicle Type</DialogTitle>
            <DialogDescription>
              Enter a name for this vehicle type. Configure capacity in the Capacity tab.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="custom-type-name">Vehicle Type Name</Label>
              <Input
                id="custom-type-name"
                placeholder="e.g., Toyota Hiace Custom"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCustom()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCustomDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCustom} disabled={!customInput.trim()}>
              Use this type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

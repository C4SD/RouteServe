// MOD4 Delivery Sheet - Multi-step PoD Workflow
// Complete proof of delivery with quantity verification, attestation, and location

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slot, Facility, DeliveryItem, DiscrepancyReason } from '@/lib/db/schema';
import { getDeliveryItemsBySlotId } from '@/lib/db/pod';
import { QuantityConfirmation } from './QuantityConfirmation';
import { DiscrepancyForm } from './DiscrepancyForm';
import { RecipientAttestation } from './RecipientAttestation';
import { LocationVerification } from './LocationVerification';
import { PoDReviewStep } from './PoDReviewStep';
import { 
  Package, MapPin, User, Phone, X, AlertTriangle, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeliverySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: Slot | null;
  facility: Facility | null;
  onConfirmDelivery: (data: DeliveryData) => Promise<void>;
  onSkipDelivery: (reason: string) => Promise<void>;
}

export interface DeliveryData {
  photo: string | null;
  signature: string | null;
  notes: string;
  items: DeliveryItem[];
  hasDiscrepancy: boolean;
  discrepancyReason?: DiscrepancyReason;
  discrepancyNotes?: string;
  recipientName: string;
  recipientRole?: string;
  location?: { latitude: number; longitude: number; accuracy: number };
  isProxyDelivery: boolean;
  proxyReason?: string;
  proxyNotes?: string;
}

type SheetMode = 'deliver' | 'skip';
type DeliveryStep = 'quantity' | 'discrepancy' | 'attestation' | 'location' | 'review';

const STEP_TITLES: Record<DeliveryStep, string> = {
  quantity: 'Verify Items',
  discrepancy: 'Resolve Discrepancy',
  attestation: 'Capture Evidence',
  location: 'Verify Location',
  review: 'Confirm Delivery',
};

export function DeliverySheet({
  open,
  onOpenChange,
  slot,
  facility,
  onConfirmDelivery,
  onSkipDelivery,
}: DeliverySheetProps) {
  const [mode, setMode] = useState<SheetMode>('deliver');
  const [step, setStep] = useState<DeliveryStep>('quantity');
  const [skipReason, setSkipReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // PoD data
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [discrepancyReason, setDiscrepancyReason] = useState<DiscrepancyReason | null>(null);
  const [discrepancyNotes, setDiscrepancyNotes] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientRole, setRecipientRole] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [proxyReason, setProxyReason] = useState('');
  const [proxyNotes, setProxyNotes] = useState('');

  const hasDiscrepancy = items.some(item => item.delivered_quantity !== item.expected_quantity);
  const isProxyDelivery = location !== null && facility !== null && calculateDistance(location.latitude, location.longitude, facility.lat, facility.lng) > 100;

  // Load delivery items when slot changes
  useEffect(() => {
    if (slot) {
      getDeliveryItemsBySlotId(slot.id).then(setItems);
    }
  }, [slot?.id]);

  const resetState = () => {
    setMode('deliver');
    setStep('quantity');
    setItems([]);
    setDiscrepancyReason(null);
    setDiscrepancyNotes('');
    setRecipientName('');
    setRecipientRole('');
    setPhoto(null);
    setSignature(null);
    setNotes('');
    setLocation(null);
    setProxyReason('');
    setProxyNotes('');
    setSkipReason('');
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handleConfirmDelivery = async () => {
    if (!photo || !signature || !recipientName) return;
    
    setIsSubmitting(true);
    try {
      await onConfirmDelivery({
        photo,
        signature,
        notes,
        items,
        hasDiscrepancy,
        discrepancyReason: discrepancyReason ?? undefined,
        discrepancyNotes: hasDiscrepancy ? discrepancyNotes : undefined,
        recipientName,
        recipientRole: recipientRole || undefined,
        location: location ?? undefined,
        isProxyDelivery,
        proxyReason: isProxyDelivery ? proxyReason : undefined,
        proxyNotes: isProxyDelivery ? proxyNotes : undefined,
      });
      handleClose();
    } catch (error) {
      console.error('Failed to confirm delivery:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipDelivery = async () => {
    if (!skipReason.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onSkipDelivery(skipReason);
      handleClose();
    } catch (error) {
      console.error('Failed to skip delivery:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToNextStep = () => {
    if (step === 'quantity') {
      setStep(hasDiscrepancy ? 'discrepancy' : 'attestation');
    } else if (step === 'discrepancy') {
      setStep('attestation');
    } else if (step === 'attestation') {
      setStep('location');
    } else if (step === 'location') {
      setStep('review');
    }
  };

  const goToPreviousStep = () => {
    if (step === 'review') {
      setStep('location');
    } else if (step === 'location') {
      setStep('attestation');
    } else if (step === 'attestation') {
      setStep(hasDiscrepancy ? 'discrepancy' : 'quantity');
    } else if (step === 'discrepancy') {
      setStep('quantity');
    }
  };

  if (!slot || !facility) return null;

  const stepNumber = step === 'quantity' ? 1 : step === 'discrepancy' ? 2 : step === 'attestation' ? (hasDiscrepancy ? 3 : 2) : step === 'location' ? (hasDiscrepancy ? 4 : 3) : (hasDiscrepancy ? 5 : 4);
  const totalSteps = hasDiscrepancy ? 5 : 4;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="h-[92vh] rounded-t-3xl px-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="px-6 pb-4 border-b border-border/50">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/20 border border-primary/30">
                <Package className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-left text-lg">
                  {mode === 'deliver' ? STEP_TITLES[step] : 'Skip Delivery'}
                </SheetTitle>
                <SheetDescription className="text-left flex items-center gap-1.5 mt-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {facility.name}
                </SheetDescription>
              </div>
              {mode === 'deliver' && (
                <span className="text-sm font-mono text-muted-foreground">
                  {stepNumber}/{totalSteps}
                </span>
              )}
            </div>

            {/* Mode tabs */}
            <div className="flex gap-2 mt-4">
              <Button
                variant={mode === 'deliver' ? 'default' : 'ghost'}
                size="sm"
                className={cn("flex-1", mode === 'deliver' && "bg-primary text-primary-foreground")}
                onClick={() => { setMode('deliver'); setStep('quantity'); }}
              >
                Deliver
              </Button>
              <Button
                variant={mode === 'skip' ? 'destructive' : 'ghost'}
                size="sm"
                className="flex-1"
                onClick={() => setMode('skip')}
              >
                <X className="w-4 h-4 mr-2" />
                Skip
              </Button>
            </div>
          </SheetHeader>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <AnimatePresence mode="wait">
              {mode === 'deliver' ? (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  {step === 'quantity' && (
                    <QuantityConfirmation items={items} onItemsChange={setItems} onContinue={goToNextStep} />
                  )}
                  {step === 'discrepancy' && (
                    <DiscrepancyForm items={items} selectedReason={discrepancyReason} notes={discrepancyNotes} onReasonChange={setDiscrepancyReason} onNotesChange={setDiscrepancyNotes} onContinue={goToNextStep} onBack={goToPreviousStep} />
                  )}
                  {step === 'attestation' && (
                    <RecipientAttestation recipientName={recipientName} recipientRole={recipientRole} notes={notes} photo={photo} signature={signature} onNameChange={setRecipientName} onRoleChange={setRecipientRole} onNotesChange={setNotes} onPhotoChange={setPhoto} onSignatureChange={setSignature} onContinue={goToNextStep} onBack={goToPreviousStep} />
                  )}
                  {step === 'location' && (
                    <LocationVerification facility={facility} location={location} isProxyDelivery={isProxyDelivery} proxyReason={proxyReason} proxyNotes={proxyNotes} onLocationCapture={setLocation} onProxyReasonChange={setProxyReason} onProxyNotesChange={setProxyNotes} onContinue={goToNextStep} onBack={goToPreviousStep} />
                  )}
                  {step === 'review' && (
                    <PoDReviewStep facility={facility} items={items} hasDiscrepancy={hasDiscrepancy} discrepancyReason={discrepancyReason ?? undefined} discrepancyNotes={discrepancyNotes} recipientName={recipientName} recipientRole={recipientRole} photo={photo} signature={signature} notes={notes} location={location} isProxyDelivery={isProxyDelivery} proxyReason={proxyReason} proxyNotes={proxyNotes} isSubmitting={isSubmitting} onConfirm={handleConfirmDelivery} onBack={goToPreviousStep} />
                  )}
                </motion.div>
              ) : (
                <motion.div key="skip" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-warning/10 border border-warning/30">
                    <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Skip this delivery?</p>
                      <p className="text-sm text-muted-foreground mt-1">This will mark the slot as skipped and require a reason for records.</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="skip-reason" className="text-sm font-medium text-foreground">Reason for skipping <span className="text-destructive">*</span></label>
                    <Textarea id="skip-reason" name="skip-reason" placeholder="Enter reason..." value={skipReason} onChange={(e) => setSkipReason(e.target.value)} className="min-h-[120px] resize-none" required />
                  </div>
                  <Button variant="destructive" className="w-full h-14 text-base font-semibold" disabled={!skipReason.trim() || isSubmitting} onClick={handleSkipDelivery}>
                    {isSubmitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <X className="w-5 h-5 mr-2" />}
                    {isSubmitting ? 'Skipping...' : 'Skip Delivery'}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
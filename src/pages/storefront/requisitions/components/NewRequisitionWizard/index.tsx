import { useState } from 'react';
import { FileText, Upload, PenLine, Layers, ChevronRight, ArrowLeft } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ManualEntryForm } from './ManualEntryForm';
import { UploadForm } from './UploadForm';
import { ProgramBasedForm } from './ProgramBasedForm';

export type RequisitionCreationMode = 'manual' | 'upload' | 'program';

interface NewRequisitionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewRequisitionWizard({ open, onOpenChange }: NewRequisitionWizardProps) {
  const [step, setStep] = useState<'mode' | 'form'>('mode');
  const [selectedMode, setSelectedMode] = useState<RequisitionCreationMode | null>(null);

  const handleModeSelect = (mode: RequisitionCreationMode) => {
    setSelectedMode(mode);
    setStep('form');
  };

  const handleBack = () => {
    setStep('mode');
    setSelectedMode(null);
  };

  const handleClose = () => {
    setStep('mode');
    setSelectedMode(null);
    onOpenChange(false);
  };

  const handleSuccess = () => {
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] flex flex-col rounded-xl"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-8 pt-8 pb-6 border-b">
          <div className="flex justify-between items-center">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              {step === 'form' && (
                <Button variant="ghost" size="icon" onClick={handleBack} className="h-6 w-6">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              {step === 'mode' ? 'Create New Requisition' : getModeTitle(selectedMode)}
            </DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            {step === 'mode' ? 'Choose how to create your requisition' : `Create requisition via ${getModeTitle(selectedMode).toLowerCase()}`}
          </DialogDescription>
        </DialogHeader>

        {step === 'mode' && (
          <ModeSelector onSelect={handleModeSelect} />
        )}

        {step === 'form' && selectedMode === 'manual' && (
          <ManualEntryForm onClose={handleClose} onSuccess={handleSuccess} />
        )}

        {step === 'form' && selectedMode === 'upload' && (
          <UploadForm onClose={handleClose} onSuccess={handleSuccess} />
        )}

        {step === 'form' && selectedMode === 'program' && (
          <ProgramBasedForm onClose={handleClose} onSuccess={handleSuccess} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function getModeTitle(mode: RequisitionCreationMode | null): string {
  switch (mode) {
    case 'manual':
      return 'Manual Entry';
    case 'upload':
      return 'Upload File';
    case 'program':
      return 'Program-Based Request';
    default:
      return 'Create New Requisition';
  }
}

interface ModeSelectorProps {
  onSelect: (mode: RequisitionCreationMode) => void;
}

function ModeSelector({ onSelect }: ModeSelectorProps) {
  const modes: { mode: RequisitionCreationMode; icon: React.ComponentType<{ className?: string }>; title: string; description: string }[] = [
    {
      mode: 'manual',
      icon: PenLine,
      title: 'Manual Entry',
      description: 'Manually enter requisition details, facility info, and line items',
    },
    {
      mode: 'upload',
      icon: Upload,
      title: 'Upload File',
      description: 'Upload a CSV or document file and map data to requisition fields',
    },
    {
      mode: 'program',
      icon: Layers,
      title: 'Program-Based Request',
      description: 'Select programs to filter and request items associated with those programs',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <div className="grid gap-4">
        {modes.map(({ mode, icon: Icon, title, description }) => (
          <Card
            key={mode}
            className={cn(
              'cursor-pointer hover:border-primary transition-colors'
            )}
            onClick={() => onSelect(mode)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{title}</CardTitle>
                    <CardDescription className="text-sm">{description}</CardDescription>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

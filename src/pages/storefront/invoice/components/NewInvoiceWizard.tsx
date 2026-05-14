import { useState } from 'react';
import { FileText, Upload, PenLine, ChevronRight, ArrowLeft, X } from 'lucide-react';
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
import type { Invoice, InvoiceCreationMode, InvoiceFormData } from '@/types/invoice';
import { useCreateInvoice, useFullUpdateInvoice, useSaveInvoicePackaging } from '@/hooks/useInvoices';
import { ManualEntryForm } from './ManualEntryForm';
import { ReadyRequestForm } from './ReadyRequestForm';
import { UploadFileForm } from './UploadFileForm';
import {
  PackagingStep,
  type InvoiceDisplayContext,
  type PackagingRow,
  type PackagingTotals,
} from './PackagingStep';

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = 'mode' | 'form' | 'packaging';

interface PendingInvoiceData {
  formData: InvoiceFormData;
  packagingRequired: boolean;
  displayContext: InvoiceDisplayContext;
}

// Map packaging rows to the counts format expected by useSaveInvoicePackaging
function rowsToCounts(rows: PackagingRow[]): Record<string, number> {
  const counts: Record<string, number> = { bag_s: 0, box_m: 0, box_l: 0, crate_xl: 0 };
  const sizeMap: Record<string, string> = { S: 'bag_s', M: 'box_m', L: 'box_l', XL: 'crate_xl' };
  for (const row of rows) {
    const key = sizeMap[row.size];
    if (key) counts[key] += row.quantity;
  }
  return counts;
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

interface NewInvoiceWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedRequisitionId?: string;
  editingInvoice?: Invoice;
}

function getEditMode(invoice: Invoice): InvoiceCreationMode {
  return invoice.requisition_id ? 'ready_request' : 'manual_entry';
}

export function NewInvoiceWizard({ open, onOpenChange, preSelectedRequisitionId, editingInvoice }: NewInvoiceWizardProps) {
  const initialMode: InvoiceCreationMode | null = editingInvoice
    ? getEditMode(editingInvoice)
    : preSelectedRequisitionId ? 'ready_request' : null;

  const [step, setStep] = useState<WizardStep>(
    editingInvoice || preSelectedRequisitionId ? 'form' : 'mode'
  );
  const [selectedMode, setSelectedMode] = useState<InvoiceCreationMode | null>(initialMode);
  const [pendingData, setPendingData] = useState<PendingInvoiceData | null>(null);
  const [formPackagingRequired, setFormPackagingRequired] = useState(false);

  const createInvoice = useCreateInvoice();
  const updateInvoice = useFullUpdateInvoice();
  const savePackaging = useSaveInvoicePackaging();

  const isCreating = createInvoice.isPending || updateInvoice.isPending || savePackaging.isPending;

  const handleModeSelect = (mode: InvoiceCreationMode) => {
    setSelectedMode(mode);
    setStep('form');
  };

  const handleBack = () => {
    if (step === 'packaging') {
      setStep('form');
      return;
    }
    if (preSelectedRequisitionId) {
      handleClose();
      return;
    }
    setStep('mode');
    setSelectedMode(null);
  };

  const handleClose = () => {
    setStep(editingInvoice || preSelectedRequisitionId ? 'form' : 'mode');
    setSelectedMode(initialMode);
    setPendingData(null);
    setFormPackagingRequired(false);
    onOpenChange(false);
  };

  const handleSuccess = () => handleClose();

  // Called by forms when they have data ready
  const handleSubmitData = (
    formData: InvoiceFormData,
    packagingRequired: boolean,
    context: InvoiceDisplayContext
  ) => {
    if (packagingRequired) {
      setPendingData({ formData, packagingRequired, displayContext: context });
      setStep('packaging');
    } else if (editingInvoice) {
      updateInvoice.mutateAsync({ id: editingInvoice.id, formData }).then(() => handleClose()).catch(() => {});
    } else {
      createInvoice.mutateAsync(formData).then(() => handleClose()).catch(() => {});
    }
  };

  const handleConfirmPackaging = async (rows: PackagingRow[], totals: PackagingTotals) => {
    if (!pendingData) return;
    try {
      let invoiceId: string;
      if (editingInvoice) {
        await updateInvoice.mutateAsync({ id: editingInvoice.id, formData: pendingData.formData });
        invoiceId = editingInvoice.id;
      } else {
        const invoice = await createInvoice.mutateAsync(pendingData.formData);
        invoiceId = invoice.id;
      }
      await savePackaging.mutateAsync({
        invoiceId,
        packagingRequired: true,
        counts: rowsToCounts(rows),
        totalWeight: totals.totalWeight,
        totalVolume: totals.totalVolume,
      });
      handleClose();
    } catch {
      // errors shown by mutation toasts
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          'flex flex-col overflow-hidden rounded-xl p-0',
          step === 'packaging'
            ? 'max-w-[92vw] w-full h-[90vh]'
            : 'max-h-[90vh] max-w-4xl'
        )}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {step === 'packaging' && pendingData ? (
          <PackagingStep
            displayContext={pendingData.displayContext}
            onBack={handleBack}
            onConfirm={handleConfirmPackaging}
            isLoading={isCreating}
            onCancel={handleClose}
          />
        ) : (
          <>
            {/* Fixed Header */}
            <DialogHeader className="px-8 pt-8 pb-6 border-b">
              <div className="flex justify-between items-center">
                <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                  {step === 'form' && (
                    <Button variant="ghost" size="icon" onClick={handleBack} className="h-6 w-6">
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  )}
                  {editingInvoice ? 'Edit Invoice' : step === 'mode' ? 'Create New Invoice' : getModeTitle(selectedMode)}
                </DialogTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="absolute top-6 right-6 h-6 w-6"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <DialogDescription className="sr-only">
                {step === 'mode'
                  ? 'Choose how to create your invoice'
                  : `Create invoice via ${getModeTitle(selectedMode).toLowerCase()}`}
              </DialogDescription>
            </DialogHeader>

            {/* Scrollable Content Region */}
            <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
              {step === 'mode' && <ModeSelector onSelect={handleModeSelect} />}

              {step === 'form' && selectedMode === 'ready_request' && (
                <ReadyRequestForm
                  onClose={handleSuccess}
                  preSelectedRequisitionId={preSelectedRequisitionId ?? editingInvoice?.requisition_id}
                  editingInvoice={editingInvoice}
                  onSubmitData={handleSubmitData}
                  onPackagingRequiredChange={setFormPackagingRequired}
                />
              )}

              {step === 'form' && selectedMode === 'upload_file' && (
                <UploadFileForm
                  onClose={handleSuccess}
                  onSubmitData={handleSubmitData}
                  onPackagingRequiredChange={setFormPackagingRequired}
                />
              )}

              {step === 'form' && selectedMode === 'manual_entry' && (
                <ManualEntryForm
                  onClose={handleSuccess}
                  editingInvoice={editingInvoice}
                  onSubmitData={handleSubmitData}
                  onPackagingRequiredChange={setFormPackagingRequired}
                />
              )}
            </div>

            {/* Fixed Footer */}
            <div className="px-8 py-6 border-t bg-background flex justify-end gap-3">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              {step === 'form' && selectedMode === 'manual_entry' && (
                <Button type="submit" form="manual-invoice-form">
                  {formPackagingRequired ? 'Next: Define Packaging →' : editingInvoice ? 'Save Changes' : 'Create Invoice'}
                </Button>
              )}
              {step === 'form' && selectedMode === 'ready_request' && (
                <Button form="ready-request-form">
                  {formPackagingRequired ? 'Next: Define Packaging →' : editingInvoice ? 'Save Changes' : 'Create Invoice'}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function getModeTitle(mode: InvoiceCreationMode | null): string {
  switch (mode) {
    case 'ready_request': return 'Create from Ready Request';
    case 'upload_file':   return 'Upload Invoice File';
    case 'manual_entry':  return 'Manual Invoice Entry';
    default:              return 'Create New Invoice';
  }
}

interface ModeSelectorProps {
  onSelect: (mode: InvoiceCreationMode) => void;
}

function ModeSelector({ onSelect }: ModeSelectorProps) {
  const modes: {
    mode: InvoiceCreationMode;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
  }[] = [
    {
      mode: 'ready_request',
      icon: FileText,
      title: 'Ready Request',
      description: 'Load finalized requisitions that are ready for invoicing',
    },
    {
      mode: 'upload_file',
      icon: Upload,
      title: 'Upload File',
      description: 'Upload a CSV or Excel file with invoice data',
    },
    {
      mode: 'manual_entry',
      icon: PenLine,
      title: 'Manual Entry',
      description: 'Manually enter invoice details and line items',
    },
  ];

  return (
    <div className="grid gap-4 py-4">
      {modes.map(({ mode, icon: Icon, title, description }) => (
        <Card
          key={mode}
          className={cn('cursor-pointer hover:border-primary transition-colors')}
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
  );
}

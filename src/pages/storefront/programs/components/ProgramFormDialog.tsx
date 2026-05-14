import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useCreateProgram, useUpdateProgram } from '@/hooks/usePrograms';
import { toast } from 'sonner';
import { useFundingSources } from '@/hooks/useFundingSources';
import { ProgramFacilitiesSection } from './ProgramFacilitiesSection';
import { ProgramItemsSection } from './ProgramItemsSection';
import type { Program, ProgramFormData } from '@/types/program';

interface ProgramFormDialogProps {
  program?: Program;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProgramFormDialog({
  program: programProp,
  open,
  onOpenChange,
}: ProgramFormDialogProps) {
  // After creating a new program, we transition to edit mode using this state
  const [createdProgram, setCreatedProgram] = useState<Program | null>(null);
  const program = programProp || createdProgram;
  const isEditing = !!program;

  const [activeTab, setActiveTab] = useState('settings');

  const createProgram = useCreateProgram();
  const updateProgram = useUpdateProgram();
  const { data: fundingSources = [] } = useFundingSources();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProgramFormData>({
    defaultValues: {
      name: '',
      code: '',
      description: '',
      funding_source: '',
      priority_tier: 'NORMAL',
      requires_cold_chain: false,
      sla_days: undefined,
      status: 'active',
    },
  });

  // Reset created program state and tab when dialog opens/closes or prop changes
  useEffect(() => {
    if (!open) {
      setCreatedProgram(null);
      setActiveTab('settings');
    }
  }, [open]);

  // Load program data when editing
  useEffect(() => {
    if (program) {
      reset({
        name: program.name,
        code: program.code,
        description: program.description || '',
        funding_source: program.funding_source || '',
        priority_tier: program.priority_tier,
        requires_cold_chain: program.requires_cold_chain,
        sla_days: program.sla_days || undefined,
        status: program.status,
      });
    } else {
      reset({
        name: '',
        code: '',
        description: '',
        funding_source: '',
        priority_tier: 'NORMAL',
        requires_cold_chain: false,
        sla_days: undefined,
        status: 'active',
      });
    }
  }, [program, reset]);

  const onSubmit = async (data: ProgramFormData) => {
    try {
      if (programProp) {
        // Editing an existing program passed via prop
        await updateProgram.mutateAsync({
          id: programProp.id,
          ...data,
        });
        toast.success('Program updated successfully');
        onOpenChange(false);
      } else if (createdProgram) {
        // Updating a program that was just created in this session
        await updateProgram.mutateAsync({
          id: createdProgram.id,
          ...data,
        });
        toast.success('Program updated successfully');
        onOpenChange(false);
      } else {
        // Creating a new program — stay open and transition to edit mode
        const newProgram = await createProgram.mutateAsync(data);
        setCreatedProgram(newProgram as Program);
        toast.success('Program created! You can now add facilities and items.');
        setActiveTab('items');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save program');
    }
  };

  const handleClose = (openState: boolean) => {
    onOpenChange(openState);
  };

  const priorityTier = watch('priority_tier');
  const requiresColdChain = watch('requires_cold_chain');
  const status = watch('status');

  const dialogTitle = programProp
    ? 'Edit Program'
    : createdProgram
    ? `${createdProgram.name} — Setup`
    : 'Create New Program';

  const dialogDescription = programProp
    ? 'Update program configuration and operational parameters'
    : createdProgram
    ? 'Program created. Add facilities and items to complete setup.'
    : 'Configure a new operational program with funding and policy settings';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="facilities" disabled={!program}>
              Facilities
            </TabsTrigger>
            <TabsTrigger value="items" disabled={!program}>
              Items
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Basic Information</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Program Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      {...register('name', { required: 'Program name is required' })}
                      placeholder="e.g., ART Program"
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="code">
                      Program Code <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="code"
                      {...register('code', { required: 'Program code is required' })}
                      placeholder="e.g., ART-01"
                      className="font-mono"
                    />
                    {errors.code && (
                      <p className="text-sm text-destructive">{errors.code.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...register('description')}
                    placeholder="Brief description of the program..."
                    rows={3}
                  />
                </div>
              </div>

              {/* Funding & Priority */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Funding & Priority</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="funding_source">Funding Source</Label>
                    <Select
                      value={watch('funding_source')}
                      onValueChange={(value) => setValue('funding_source', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select funding source" />
                      </SelectTrigger>
                      <SelectContent>
                        {fundingSources.map((fs) => (
                          <SelectItem key={fs.id} value={fs.code}>{fs.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority_tier">
                      Priority Tier <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={priorityTier}
                      onValueChange={(value) =>
                        setValue('priority_tier', value as any)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="NORMAL">Normal</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="CRITICAL">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Operational Configuration */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Operational Configuration</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sla_days">SLA (Days)</Label>
                    <Input
                      id="sla_days"
                      type="number"
                      {...register('sla_days', { setValueAs: (v: string) => v === '' ? undefined : Number(v) })}
                      placeholder="e.g., 7"
                      min="1"
                    />
                    <p className="text-xs text-muted-foreground">
                      Expected fulfillment window
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">
                      Status <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={status}
                      onValueChange={(value) => setValue('status', value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    id="requires_cold_chain"
                    checked={requiresColdChain}
                    onCheckedChange={(checked) =>
                      setValue('requires_cold_chain', checked)
                    }
                  />
                  <Label htmlFor="requires_cold_chain" className="cursor-pointer">
                    Requires Cold Chain
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enable if this program requires temperature-controlled storage and
                  transport
                </p>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleClose(false)}
                  disabled={isSubmitting}
                >
                  {program ? 'Close' : 'Cancel'}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? 'Saving...'
                    : programProp
                    ? 'Update Program'
                    : createdProgram
                    ? 'Update Program'
                    : 'Create & Continue'}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* Facilities Tab */}
          <TabsContent value="facilities" className="mt-4">
            {program ? (
              <div className="space-y-4">
                <ProgramFacilitiesSection program={program} />
                <Separator />
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => handleClose(false)}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Save the program first to add facilities.
              </div>
            )}
          </TabsContent>

          {/* Items Tab */}
          <TabsContent value="items" className="mt-4">
            {program ? (
              <div className="space-y-4">
                <ProgramItemsSection program={program} />
                <Separator />
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => handleClose(false)}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Save the program first to add items.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

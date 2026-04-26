import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Warehouse, Building, Loader2, SkipForward, ArrowRight, Check, LayoutGrid, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { useOnboardingWizard } from '@/hooks/onboarding/useOnboardingWizard';

interface DataImportStepProps {
  wizard: ReturnType<typeof useOnboardingWizard>;
}

interface CreatedWorkspace {
  id: string;
  name: string;
}

type ActiveForm = 'warehouse' | 'facility' | 'workspace' | null;

export default function DataImportStep({ wizard }: DataImportStepProps) {
  const { state, skipStep, saveStepProgress, goNext } = wizard;
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);
  const [warehouseCreated, setWarehouseCreated] = useState(false);
  const [facilityCreated, setFacilityCreated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Warehouse form
  const [warehouseName, setWarehouseName] = useState('');
  const [warehouseAddress, setWarehouseAddress] = useState('');

  // Facility form
  const [facilityName, setFacilityName] = useState('');
  const [facilityType, setFacilityType] = useState('');

  // Workspace form
  const [workspaceName, setWorkspaceName] = useState('');
  const [createdWorkspaces, setCreatedWorkspaces] = useState<CreatedWorkspace[]>([]);

  const handleCreateWarehouse = async () => {
    if (!warehouseName.trim() || !state.workspaceId) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('warehouses').insert({
        name: warehouseName.trim(),
        address: warehouseAddress.trim() || null,
        workspace_id: state.workspaceId,
      });
      if (error) throw error;

      setWarehouseCreated(true);
      setActiveForm(null);
      setWarehouseName('');
      setWarehouseAddress('');
      toast.success('Warehouse Created', {
        description: `${warehouseName} has been added to your workspace.`,
      });
    } catch (error) {
      const msg = (error as { message?: string })?.message ?? 'An error occurred';
      toast.error('Failed to create warehouse', { description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateFacility = async () => {
    if (!facilityName.trim() || !state.workspaceId) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('facilities').insert({
        name: facilityName.trim(),
        type: (facilityType.trim() || 'clinic') as any,
        address: 'TBD',
        lat: 0,
        lng: 0,
        workspace_id: state.workspaceId,
      });
      if (error) throw error;

      setFacilityCreated(true);
      setActiveForm(null);
      setFacilityName('');
      setFacilityType('');
      toast.success('Facility Created', {
        description: `${facilityName} has been added to your workspace.`,
      });
    } catch (error) {
      const msg = (error as { message?: string })?.message ?? 'An error occurred';
      toast.error('Failed to create facility', { description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) return;
    setIsSubmitting(true);
    const slug = workspaceName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    try {
      const { data, error } = await supabase.rpc('create_workspace', {
        p_name: workspaceName.trim(),
        p_slug: slug,
      });
      if (error) throw error;

      const newWorkspace: CreatedWorkspace = { id: data as string, name: workspaceName.trim() };
      setCreatedWorkspaces(prev => [...prev, newWorkspace]);
      setActiveForm(null);
      setWorkspaceName('');
      toast.success('Workspace Created', {
        description: `${workspaceName} workspace is ready.`,
      });
    } catch (error) {
      const msg = (error as { message?: string })?.message ?? 'An error occurred';
      toast.error('Failed to create workspace', { description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWorkspace = async (ws: CreatedWorkspace) => {
    try {
      const { error } = await supabase.from('workspaces').delete().eq('id', ws.id);
      if (error) throw error;
      setCreatedWorkspaces(prev => prev.filter(w => w.id !== ws.id));
      toast.success('Workspace removed');
    } catch (error) {
      const msg = (error as { message?: string })?.message ?? 'An error occurred';
      toast.error('Failed to remove workspace', { description: msg });
    }
  };

  const handleContinue = async () => {
    await saveStepProgress('fleet');
    goNext();
  };

  const handleSkip = async () => {
    await saveStepProgress('fleet');
    skipStep();
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center mb-4">
          <Warehouse className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-3xl font-semibold text-white">Add Your Locations</h1>
        <p className="text-zinc-400">
          Set up warehouses, facilities, and additional workspaces. You can add more later.
        </p>
      </div>

      {/* Tile cards */}
      {!activeForm && (
        <div className="grid grid-cols-3 gap-4">
          <Card
            className={`bg-zinc-900 border-zinc-800 cursor-pointer transition-colors ${
              warehouseCreated
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'hover:border-zinc-700'
            }`}
            onClick={() => !warehouseCreated && setActiveForm('warehouse')}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Warehouse className="w-8 h-8 text-orange-400" />
                {warehouseCreated && (
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              <CardTitle className="text-white text-base">Create Warehouse</CardTitle>
              <CardDescription className="text-zinc-500 text-xs">
                {warehouseCreated ? 'Warehouse created' : 'Add your first warehouse'}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card
            className={`bg-zinc-900 border-zinc-800 cursor-pointer transition-colors ${
              facilityCreated
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'hover:border-zinc-700'
            }`}
            onClick={() => !facilityCreated && setActiveForm('facility')}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Building className="w-8 h-8 text-blue-400" />
                {facilityCreated && (
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              <CardTitle className="text-white text-base">Create Facility</CardTitle>
              <CardDescription className="text-zinc-500 text-xs">
                {facilityCreated ? 'Facility created' : 'Add a delivery facility'}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card
            className="bg-zinc-900 border-zinc-800 cursor-pointer transition-colors hover:border-zinc-700"
            onClick={() => setActiveForm('workspace')}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <LayoutGrid className="w-8 h-8 text-violet-400" />
                {createdWorkspaces.length > 0 && (
                  <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{createdWorkspaces.length}</span>
                  </div>
                )}
              </div>
              <CardTitle className="text-white text-base">Add Workspace</CardTitle>
              <CardDescription className="text-zinc-500 text-xs">
                Create additional branch workspaces
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Warehouse form */}
      {activeForm === 'warehouse' && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">Create Warehouse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">
                Warehouse Name <span className="text-red-400">*</span>
              </Label>
              <Input
                placeholder="e.g., Kano Central Warehouse"
                value={warehouseName}
                onChange={(e) => setWarehouseName(e.target.value)}
                className="h-10 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-emerald-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">
                Address <span className="text-zinc-600">(optional)</span>
              </Label>
              <Input
                placeholder="Street address"
                value={warehouseAddress}
                onChange={(e) => setWarehouseAddress(e.target.value)}
                className="h-10 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-emerald-500"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setActiveForm(null)} className="text-zinc-400">
                Cancel
              </Button>
              <Button
                onClick={handleCreateWarehouse}
                disabled={!warehouseName.trim() || isSubmitting}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Warehouse
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Facility form */}
      {activeForm === 'facility' && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">Create Facility</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">
                Facility Name <span className="text-red-400">*</span>
              </Label>
              <Input
                placeholder="e.g., Nassarawa General Hospital"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                className="h-10 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-emerald-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">
                Facility Type <span className="text-zinc-600">(optional)</span>
              </Label>
              <Input
                placeholder="e.g., Hospital, Clinic, PHC"
                value={facilityType}
                onChange={(e) => setFacilityType(e.target.value)}
                className="h-10 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-emerald-500"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setActiveForm(null)} className="text-zinc-400">
                Cancel
              </Button>
              <Button
                onClick={handleCreateFacility}
                disabled={!facilityName.trim() || isSubmitting}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Facility
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workspace form */}
      {activeForm === 'workspace' && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">Create Workspace</CardTitle>
            <CardDescription className="text-zinc-500 text-sm">
              Add a branch or regional workspace. Each workspace is an independent operational unit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">
                Workspace Name <span className="text-red-400">*</span>
              </Label>
              <Input
                placeholder="e.g., Lagos Branch, Abuja Depot"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="h-10 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-violet-500"
              />
              {workspaceName.trim().length >= 2 && (
                <p className="text-xs text-zinc-500">
                  Slug:{' '}
                  <span className="text-zinc-400">
                    {workspaceName
                      .toLowerCase()
                      .replace(/[^a-z0-9\s-]/g, '')
                      .replace(/\s+/g, '-')
                      .replace(/-+/g, '-')
                      .trim()}
                  </span>
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setActiveForm(null)} className="text-zinc-400">
                Cancel
              </Button>
              <Button
                onClick={handleCreateWorkspace}
                disabled={!workspaceName.trim() || isSubmitting}
                className="bg-violet-500 hover:bg-violet-600 text-white"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Workspace
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Created workspaces list */}
      {!activeForm && createdWorkspaces.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-400">
            Additional Workspaces ({createdWorkspaces.length})
          </p>
          <div className="space-y-2">
            {createdWorkspaces.map((ws) => (
              <div
                key={ws.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-zinc-900 border border-violet-500/20"
              >
                <div className="flex items-center gap-3">
                  <LayoutGrid className="w-4 h-4 text-violet-400" />
                  <span className="text-sm text-white">{ws.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveForm('workspace')}
                    className="h-8 px-2 text-zinc-400 hover:text-white"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteWorkspace(ws)}
                    className="h-8 px-2 text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            <button
              onClick={() => setActiveForm('workspace')}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-zinc-700 text-zinc-500 hover:border-violet-500/50 hover:text-violet-400 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Add another workspace
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
        <Button
          variant="ghost"
          onClick={handleSkip}
          className="text-zinc-400 hover:text-white"
        >
          <SkipForward className="w-4 h-4 mr-2" />
          Skip
        </Button>
        <Button
          onClick={handleContinue}
          className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-medium"
        >
          Continue
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}

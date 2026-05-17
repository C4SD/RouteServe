import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Plus, Trash2, Loader2, ArrowRight, SkipForward } from 'lucide-react';
import type { TeamInvitation } from '@/types/onboarding';
import type { useOnboardingWizard } from '@/hooks/onboarding/useOnboardingWizard';

interface TeamSetupStepProps {
  wizard: ReturnType<typeof useOnboardingWizard>;
}

// RBAC v2 role codes — must match public.roles.code values
const APP_ROLES = [
  { value: 'ops_manager', label: 'Ops Manager' },
  { value: 'fleet_manager', label: 'Fleet Manager' },
  { value: 'driver', label: 'Driver' },
  { value: 'viewer', label: 'Viewer' },
];

export default function TeamSetupStep({ wizard }: TeamSetupStepProps) {
  const { state, sendInvitations, skipStep, saveStepProgress } = wizard;
  const [showForm, setShowForm] = useState(false);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([
    { name: '', email: '', appRole: 'ops_manager' },
  ]);

  const addRow = () => {
    setInvitations(prev => [...prev, { name: '', email: '', appRole: 'ops_manager' }]);
  };

  const removeRow = (index: number) => {
    setInvitations(prev => prev.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof TeamInvitation, value: string) => {
    setInvitations(prev =>
      prev.map((inv, i) => (i === index ? { ...inv, [field]: value } : inv))
    );
  };

  const validInvitations = invitations.filter(
    inv => inv.email.trim() && inv.email.includes('@')
  );

  const handleSendInvitations = () => {
    if (validInvitations.length === 0) return;
    sendInvitations.mutate(validInvitations);
  };

  const handleSkip = async () => {
    await saveStepProgress('data_import');
    skipStep();
  };

  if (!showForm) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-semibold text-white">Invite Your Team</h1>
          <p className="text-zinc-400">
            Add team members to your workspace. They&apos;ll receive an email invitation to join.
          </p>
        </div>

        <div className="space-y-4">
          <Button
            onClick={() => setShowForm(true)}
            className="w-full h-14 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white justify-start px-6"
            variant="outline"
          >
            <Users className="w-5 h-5 mr-3 text-emerald-400" />
            <div className="text-left">
              <div className="font-medium">Invite Team Members</div>
              <div className="text-xs text-zinc-500">Add users by email and assign roles</div>
            </div>
          </Button>

          <Button
            onClick={handleSkip}
            variant="ghost"
            className="w-full h-12 text-zinc-400 hover:text-white hover:bg-zinc-900"
          >
            <SkipForward className="w-4 h-4 mr-2" />
            Skip for Now
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center mb-4">
          <Users className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-3xl font-semibold text-white">Invite Your Team</h1>
        <p className="text-zinc-400">
          Add team members by email. They&apos;ll get an invitation to join{' '}
          <strong className="text-white">{state.orgName}</strong>.
        </p>
      </div>

      <div className="space-y-4">
        {invitations.map((inv, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="flex-1 grid grid-cols-3 gap-3">
              <div className="space-y-1">
                {index === 0 && <Label className="text-xs text-zinc-500">Name</Label>}
                <Input
                  placeholder="Full name"
                  value={inv.name}
                  onChange={(e) => updateRow(index, 'name', e.target.value)}
                  className="h-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-emerald-500"
                />
              </div>
              <div className="space-y-1">
                {index === 0 && (
                  <Label className="text-xs text-zinc-500">
                    Email <span className="text-red-400">*</span>
                  </Label>
                )}
                <Input
                  type="email"
                  placeholder="user@email.com"
                  value={inv.email}
                  onChange={(e) => updateRow(index, 'email', e.target.value)}
                  className="h-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-emerald-500"
                />
              </div>
              <div className="space-y-1">
                {index === 0 && <Label className="text-xs text-zinc-500">Role</Label>}
                <Select
                  value={inv.appRole}
                  onValueChange={(v) => updateRow(index, 'appRole', v)}
                >
                  <SelectTrigger className="h-10 bg-zinc-900 border-zinc-800 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APP_ROLES.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeRow(index)}
              disabled={invitations.length === 1}
              className={`text-zinc-500 hover:text-red-400 hover:bg-zinc-900 ${index === 0 ? 'mt-5' : ''}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}

        <Button
          variant="ghost"
          onClick={addRow}
          className="text-emerald-400 hover:text-emerald-300 hover:bg-zinc-900"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Another
        </Button>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
        <Button
          variant="ghost"
          onClick={handleSkip}
          className="text-zinc-400 hover:text-white"
        >
          Skip
        </Button>
        <Button
          onClick={handleSendInvitations}
          disabled={validInvitations.length === 0 || sendInvitations.isPending}
          className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-medium"
        >
          {sendInvitations.isPending ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Sending Invitations...
            </>
          ) : (
            <>
              Send {validInvitations.length} Invitation{validInvitations.length !== 1 ? 's' : ''} & Continue
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

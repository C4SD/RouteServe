import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  User,
  Phone,
  Camera,
  Loader2,
  CheckCircle,
  Building2,
  Shield,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface InvitationContext {
  fromInvitation?: boolean;
  workspaceName?: string;
  appRole?: string;
  workspaceRole?: string;
}

export default function ProfileCompletionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const invitationContext = (location.state as InvitationContext) || {};
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(
    user?.user_metadata?.full_name || ''
  );
  const [phone, setPhone] = useState(user?.user_metadata?.phone || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !fullName.trim()) return;

    setIsSubmitting(true);
    try {
      let avatarUrl: string | undefined;

      // Upload avatar if provided
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop();
        const filePath = `${user.id}/avatar-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile);

        if (!uploadError) {
          const {
            data: { publicUrl },
          } = supabase.storage.from('avatars').getPublicUrl(filePath);
          avatarUrl = publicUrl;
        }
      }

      // Update profile fields
      const profileUpdate: Record<string, unknown> = {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        onboarding_completed: true,
      };
      if (avatarUrl) {
        profileUpdate.avatar_url = avatarUrl;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Advance status through the state machine: registered → role_assigned → active.
      // Users who accepted an invitation before the migration fix may still be at
      // 'registered'; the conditional UPDATE is a no-op for anyone already past it.
      await supabase
        .from('profiles')
        .update({ user_status: 'role_assigned' })
        .eq('id', user.id)
        .eq('user_status', 'registered');

      const { error: activateError } = await supabase
        .from('profiles')
        .update({ user_status: 'active', activated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (activateError) throw activateError;

      // Update auth user metadata
      await supabase.auth.updateUser({
        data: { full_name: fullName.trim(), phone: phone.trim() || undefined },
      });

      toast.success('Profile completed!', {
        description: `Welcome to ${invitationContext.workspaceName || 'BIKO'}`,
      });

      // Redirect based on role
      const homePath = getRoleHomePath(invitationContext.appRole);
      navigate(homePath, { replace: true });
    } catch (error) {
      toast.error('Failed to save profile', {
        description: (error as Error).message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Left panel: Form */}
      <div className="w-full lg:w-[520px] flex flex-col justify-center px-8 py-12">
        <div className="max-w-sm mx-auto w-full space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-white">
              Complete Your Profile
            </h1>
            <p className="text-zinc-400">
              {invitationContext.fromInvitation
                ? `You've joined ${invitationContext.workspaceName || 'the workspace'}. Set up your profile to get started.`
                : 'Set up your profile to get started.'}
            </p>
          </div>

          {/* Invitation context badges */}
          {invitationContext.fromInvitation && (
            <div className="flex flex-wrap gap-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
              {invitationContext.workspaceName && (
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <Building2 className="h-4 w-4 text-emerald-400" />
                  {invitationContext.workspaceName}
                </div>
              )}
              {invitationContext.appRole && (
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/10 text-emerald-400"
                >
                  <Shield className="h-3 w-3 mr-1" />
                  {invitationContext.appRole.replace('_', ' ')}
                </Badge>
              )}
            </div>
          )}

          {/* Avatar upload */}
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative w-24 h-24 rounded-full bg-zinc-800 border-2 border-dashed border-zinc-600 hover:border-emerald-500 transition-colors flex items-center justify-center overflow-hidden group"
            >
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Camera className="h-8 w-8 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <p className="text-xs text-zinc-500">
              Click to upload photo (optional)
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-zinc-300">
                Full Name *
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                  className="pl-10 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-zinc-300">
                Phone Number
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234 123 456 7890"
                  className="pl-10 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Email</Label>
              <Input
                value={user?.email || ''}
                disabled
                className="bg-zinc-900/50 border-zinc-700 text-zinc-400"
              />
              <p className="text-xs text-zinc-500">
                Email is set from your invitation and cannot be changed here.
              </p>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !fullName.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete Profile
                </>
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Right panel: Visual */}
      <div className="hidden lg:flex flex-1 bg-zinc-900/30 items-center justify-center border-l border-zinc-800">
        <div className="max-w-md text-center space-y-6 px-8">
          <div className="mx-auto w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-emerald-400" />
          </div>
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-white">
              Almost There!
            </h2>
            <p className="text-zinc-400 leading-relaxed">
              Complete your profile to access all the features of your
              workspace. Your team is waiting for you.
            </p>
          </div>
          <div className="space-y-3 text-left bg-zinc-800/50 rounded-lg p-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <span className="text-zinc-300">Account created</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <span className="text-zinc-300">Workspace joined</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              </div>
              <span className="text-white font-medium">
                Complete your profile
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getRoleHomePath(appRole?: string): string {
  switch (appRole) {
    case 'driver':
      return '/mod4/driver';
    case 'warehouse_officer':
      return '/storefront';
    case 'zonal_manager':
      return '/fleetops';
    case 'system_admin':
      return '/admin';
    default:
      return '/fleetops';
  }
}

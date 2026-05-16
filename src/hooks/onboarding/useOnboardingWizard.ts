import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type {
  OnboardingWizardStep,
  OnboardingWizardState,
  OperatingModel,
  OrgType,
  Sector,
  TeamInvitation,
  ONBOARDING_STEPS,
} from '@/types/onboarding';

const STEP_ORDER: OnboardingWizardStep[] = ['organization', 'team', 'data_import', 'fleet', 'launch'];

function createInitialState(): OnboardingWizardState {
  return {
    currentStep: 'organization',
    workspaceId: null,
    orgName: '',
    orgSlug: '',
    orgType: null,
    sector: null,
    contactEmail: '',
    contactPhone: '',
    fax: '',
    selectedCountryIds: [],
    primaryCountryId: null,
    selectedStateIds: [],
    selectedLgaIds: [],
    operatingModel: null,
    invitations: [],
    isSubmitting: false,
    error: null,
    completedSteps: [],
  };
}

export function useOnboardingWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingWizardState>(createInitialState);

  // Query user's onboarding status to determine where to resume
  const { data: onboardingStatus, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_onboarding_status');
      if (error) throw error;
      return data as {
        user_id: string;
        user_status: string;
        onboarding_completed: boolean;
        has_workspace: boolean;
        has_role: boolean;
        workspaces: Array<{
          workspace_id: string;
          workspace_name: string;
          workspace_role: string;
          org_status: string;
          is_ready: boolean;
        }> | null;
      };
    },
    enabled: !!user,
  });

  // If user already has a workspace, check if onboarding is in progress
  useEffect(() => {
    if (!onboardingStatus) return;

    if (onboardingStatus.onboarding_completed) {
      navigate('/fleetops');
      return;
    }

    if (onboardingStatus.has_workspace && onboardingStatus.workspaces?.[0]) {
      const ws = onboardingStatus.workspaces[0];
      setState(prev => ({
        ...prev,
        workspaceId: ws.workspace_id,
        orgName: ws.workspace_name,
      }));

      // Fetch the saved onboarding step from the workspace
      supabase
        .from('workspaces')
        .select('onboarding_current_step')
        .eq('id', ws.workspace_id)
        .single()
        .then(({ data }) => {
          if (data?.onboarding_current_step) {
            const savedStep = data.onboarding_current_step as OnboardingWizardStep;
            if (STEP_ORDER.includes(savedStep)) {
              // Mark all prior steps as completed
              const stepIndex = STEP_ORDER.indexOf(savedStep);
              const completed = STEP_ORDER.slice(0, stepIndex);
              setState(prev => ({
                ...prev,
                currentStep: savedStep,
                completedSteps: completed,
              }));
            }
          }
        });
    }

    // Pre-fill contact email from user
    if (user?.email) {
      setState(prev => ({
        ...prev,
        contactEmail: prev.contactEmail || user.email || '',
      }));
    }
  }, [onboardingStatus, user, navigate]);

  // Auto-generate slug from org name
  const setOrgName = useCallback((name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    setState(prev => ({ ...prev, orgName: name, orgSlug: slug }));
  }, []);

  const updateField = useCallback(<K extends keyof OnboardingWizardState>(
    field: K,
    value: OnboardingWizardState[K]
  ) => {
    setState(prev => ({ ...prev, [field]: value }));
  }, []);

  // Navigation
  const goToStep = useCallback((step: OnboardingWizardStep) => {
    setState(prev => ({ ...prev, currentStep: step }));
  }, []);

  const goNext = useCallback(() => {
    setState(prev => {
      const currentIndex = STEP_ORDER.indexOf(prev.currentStep);
      if (currentIndex < STEP_ORDER.length - 1) {
        const nextStep = STEP_ORDER[currentIndex + 1];
        const completed = prev.completedSteps.includes(prev.currentStep)
          ? prev.completedSteps
          : [...prev.completedSteps, prev.currentStep];
        return { ...prev, currentStep: nextStep, completedSteps: completed };
      }
      return prev;
    });
  }, []);

  const goBack = useCallback(() => {
    setState(prev => {
      const currentIndex = STEP_ORDER.indexOf(prev.currentStep);
      if (currentIndex > 0) {
        return { ...prev, currentStep: STEP_ORDER[currentIndex - 1] };
      }
      return prev;
    });
  }, []);

  const skipStep = useCallback(() => {
    goNext();
  }, [goNext]);

  // Save step progress to DB
  const saveStepProgress = useCallback(async (step: OnboardingWizardStep) => {
    if (!state.workspaceId) return;
    try {
      await supabase.rpc('save_onboarding_step', {
        p_workspace_id: state.workspaceId,
        p_step: step,
      });
    } catch (err) {
      console.error('Failed to save onboarding progress:', err);
    }
  }, [state.workspaceId]);

  // Create organization mutation
  const createOrganization = useMutation({
    mutationFn: async () => {
      const primaryCountryId = state.primaryCountryId || state.selectedCountryIds[0];
      if (!primaryCountryId) {
        throw new Error('At least one country must be selected');
      }

      const { data, error } = await supabase.rpc('create_organization_with_admin', {
        p_name: state.orgName.trim(),
        p_slug: state.orgSlug.trim(),
        p_country_id: primaryCountryId,
        p_operating_model: state.operatingModel,
        p_primary_contact_email: state.contactEmail.trim() || null,
        p_primary_contact_phone: state.contactPhone.trim() || null,
        p_org_type: state.orgType,
        p_sector: state.sector,
        p_fax: state.fax.trim() || null,
        p_country_ids: state.selectedCountryIds,
      });

      if (error) throw error;
      return data as string;
    },
    onSuccess: async (workspaceId) => {
      setState(prev => ({ ...prev, workspaceId }));

      // Save selected states if any
      if (state.selectedStateIds.length > 0) {
        await supabase.rpc('save_workspace_states', {
          p_workspace_id: workspaceId,
          p_admin_unit_ids: state.selectedStateIds,
        });
      }

      // Save selected LGAs if any
      if (state.selectedLgaIds.length > 0) {
        await supabase.rpc('save_workspace_lgas', {
          p_workspace_id: workspaceId,
          p_admin_unit_ids: state.selectedLgaIds,
        });
      }

      // Save step progress
      await saveStepProgress('team');

      toast.success('Organization Created', {
        description: `${state.orgName} has been created. You are now the admin.`,
      });

      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      goNext();
    },
    onError: (error: unknown) => {
      const raw =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message: string }).message)
            : 'Failed to create organization';

      let message = raw;
      if (raw.includes('workspaces_slug_key') || raw.includes('slug')) {
        message = 'An organization with this name already exists. Please choose a different name.';
      } else if (raw.includes('workspace_name_unique_per_country') || raw.includes('duplicate key')) {
        message = 'An organization with this name already exists in the selected region. Please choose a different name.';
      }

      console.error('Organization creation failed:', error);
      toast.error('Creation Failed', { description: message });
    },
  });

  // Send team invitations mutation
  const sendInvitations = useMutation({
    mutationFn: async (invitations: TeamInvitation[]) => {
      if (!state.workspaceId) throw new Error('Workspace not created yet');

      const results = [];
      for (const invite of invitations) {
        const { data, error } = await supabase.rpc('invite_user', {
          p_email: invite.email,
          p_workspace_id: state.workspaceId,
          p_app_role: invite.appRole as any,
          p_workspace_role: invite.workspaceRole || 'member',
        });
        if (error) {
          console.error(`Failed to invite ${invite.email}:`, error);
          results.push({ email: invite.email, success: false, error: error.message });
        } else {
          results.push({ email: invite.email, success: true, id: data });
        }
      }
      return results;
    },
    onSuccess: async (results) => {
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      if (successful.length > 0) {
        toast.success('Invitations Sent', {
          description: `${successful.length} invitation(s) sent successfully.`,
        });
      }
      if (failed.length > 0) {
        toast.error('Some Invitations Failed', {
          description: failed.map(f => `${f.email}: ${f.error}`).join(', '),
        });
      }

      await saveStepProgress('data_import');
      goNext();
    },
  });

  // Complete onboarding mutation
  const completeOnboarding = useMutation({
    mutationFn: async () => {
      if (!state.workspaceId) throw new Error('Workspace not created yet');
      const { error } = await supabase.rpc('complete_onboarding', {
        p_workspace_id: state.workspaceId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      queryClient.invalidateQueries({ queryKey: ['user-role'] });
      toast.success('Welcome to RouteServe!', {
        description: 'Your workspace is ready.',
      });
      navigate('/fleetops');
      window.location.reload();
    },
    onError: (error) => {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to complete onboarding',
      });
    },
  });

  return {
    state,
    isLoadingStatus,
    onboardingStatus,
    setOrgName,
    updateField,
    goToStep,
    goNext,
    goBack,
    skipStep,
    saveStepProgress,
    createOrganization,
    sendInvitations,
    completeOnboarding,
  };
}

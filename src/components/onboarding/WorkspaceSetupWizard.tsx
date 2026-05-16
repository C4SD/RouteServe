/**
 * Workspace Setup Wizard
 *
 * This wizard guides new users through setting up their workspace:
 * 1. Select Country
 * 2. Create Workspace (name + slug)
 * 3. Operating Model (owned_fleet / contracted / hybrid)
 * 4. Primary Contact
 * 5. Import Admin Boundaries (Optional)
 * 6. Complete
 *
 * Creates organization with first user as system_admin + workspace owner.
 * Only shown on first login if user has no workspace assigned.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_COUNTRY_NIGERIA_ID } from '@/lib/constants';
import {
  Globe,
  Building2,
  MapPin,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Truck,
  User,
} from 'lucide-react';
import type { OperatingModel } from '@/types/onboarding';
import { OPERATING_MODELS } from '@/types/onboarding';

interface Country {
  id: string;
  name: string;
  iso_code: string;
  iso3_code: string;
}

interface PrimaryContact {
  name: string;
  email: string;
  phone: string;
}

type WizardStep = 'country' | 'workspace' | 'operating_model' | 'primary_contact' | 'boundaries' | 'complete';

const WIZARD_STEPS: WizardStep[] = ['country', 'workspace', 'operating_model', 'primary_contact', 'boundaries', 'complete'];

export default function WorkspaceSetupWizard() {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<WizardStep>('country');
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [operatingModel, setOperatingModel] = useState<OperatingModel | null>(null);
  const [primaryContact, setPrimaryContact] = useState<PrimaryContact>({
    name: '',
    email: '',
    phone: '',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createdWorkspaceId, setCreatedWorkspaceId] = useState<string | null>(null);

  // Auto-generate slug from workspace name
  const handleWorkspaceNameChange = (name: string) => {
    setWorkspaceName(name);
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    setWorkspaceSlug(slug);
  };

  // Get step icon
  const getStepIcon = () => {
    switch (currentStep) {
      case 'country':
        return <Globe className="h-6 w-6 text-primary" />;
      case 'workspace':
        return <Building2 className="h-6 w-6 text-primary" />;
      case 'operating_model':
        return <Truck className="h-6 w-6 text-primary" />;
      case 'primary_contact':
        return <User className="h-6 w-6 text-primary" />;
      case 'boundaries':
        return <MapPin className="h-6 w-6 text-primary" />;
      case 'complete':
        return <CheckCircle className="h-6 w-6 text-success" />;
    }
  };

  // Get step title
  const getStepTitle = () => {
    switch (currentStep) {
      case 'country':
        return 'Select Your Country';
      case 'workspace':
        return 'Create Your Workspace';
      case 'operating_model':
        return 'Operating Model';
      case 'primary_contact':
        return 'Primary Contact';
      case 'boundaries':
        return 'Import Admin Boundaries';
      case 'complete':
        return 'Setup Complete!';
    }
  };

  // Get step description
  const getStepDescription = () => {
    switch (currentStep) {
      case 'country':
        return 'Choose the country where you operate';
      case 'workspace':
        return 'Set up your organization workspace';
      case 'operating_model':
        return 'How does your organization handle deliveries?';
      case 'primary_contact':
        return 'Who should we contact about this workspace?';
      case 'boundaries':
        return 'Download geographic boundaries (optional)';
      case 'complete':
        return 'Your workspace is ready to use';
    }
  };

  // Navigation
  const goToNextStep = () => {
    const currentIndex = WIZARD_STEPS.indexOf(currentStep);
    if (currentIndex < WIZARD_STEPS.length - 1) {
      setCurrentStep(WIZARD_STEPS[currentIndex + 1]);
    }
  };

  const goToPreviousStep = () => {
    const currentIndex = WIZARD_STEPS.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(WIZARD_STEPS[currentIndex - 1]);
    }
  };

  // Step 1: Country Selection
  const handleCountrySelect = async () => {
    if (!selectedCountry) {
      toast.error('Country Required', {
        description: 'Please select a country to continue',
      });
      return;
    }
    goToNextStep();
  };

  // Step 2: Workspace Name validation
  const handleWorkspaceNext = () => {
    if (!workspaceName.trim() || !workspaceSlug.trim()) {
      toast.error('Validation Error', {
        description: 'Please enter a workspace name',
      });
      return;
    }
    goToNextStep();
  };

  // Step 3: Operating Model validation
  const handleOperatingModelNext = () => {
    if (!operatingModel) {
      toast.error('Selection Required', {
        description: 'Please select an operating model',
      });
      return;
    }
    goToNextStep();
  };

  // Step 4: Primary Contact - Create Organization
  const handleCreateOrganization = async () => {
    if (!primaryContact.email.trim()) {
      toast.error('Email Required', {
        description: 'Please enter a contact email',
      });
      return;
    }

    if (!selectedCountry) {
      toast.error('Error', {
        description: 'Country not selected',
      });
      return;
    }

    try {
      setIsCreating(true);

      // Use the RPC function to create organization with auto-admin assignment
      const { data, error } = await supabase.rpc('create_organization_with_admin', {
        p_name: workspaceName.trim(),
        p_slug: workspaceSlug.trim(),
        p_country_id: selectedCountry.id,
        p_operating_model: operatingModel,
        p_primary_contact_name: primaryContact.name.trim() || null,
        p_primary_contact_email: primaryContact.email.trim(),
        p_primary_contact_phone: primaryContact.phone.trim() || null,
      });

      if (error) throw error;

      setCreatedWorkspaceId(data as string);

      toast.success('Organization Created', {
        description: `${workspaceName} has been created. You are now the admin.`,
      });

      goToNextStep();
    } catch (error) {
      console.error('Error creating organization:', error);
      toast.error('Creation Failed', {
        description: error instanceof Error ? error.message : 'Failed to create organization',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Step 5: Import Boundaries (Optional)
  const handleSkipBoundaries = () => {
    goToNextStep();
  };

  const handleImportBoundaries = async () => {
    if (!createdWorkspaceId || !selectedCountry) return;

    try {
      const { error } = await supabase.functions.invoke('import-boundaries', {
        body: {
          region: selectedCountry.iso_code.toLowerCase(),
          adminLevels: [4, 6], // States and LGAs
          countryId: selectedCountry.id,
          workspaceId: createdWorkspaceId,
        },
      });

      if (error) throw error;

      toast.success('Import Started', {
        description: 'Admin boundaries are being imported in the background',
      });

      goToNextStep();
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Import Failed', {
        description: 'You can import boundaries later from Location Management',
      });
      // Still allow to continue
      goToNextStep();
    }
  };

  // Step 6: Complete
  const handleFinish = () => {
    navigate('/');
    window.location.reload(); // Reload to apply workspace context
  };

  const getStepProgress = () => {
    const currentIndex = WIZARD_STEPS.indexOf(currentStep);
    return ((currentIndex + 1) / WIZARD_STEPS.length) * 100;
  };

  const canGoBack = currentStep !== 'country' && currentStep !== 'complete' && currentStep !== 'boundaries';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                {getStepIcon()}
              </div>
              <div>
                <CardTitle className="text-2xl">{getStepTitle()}</CardTitle>
                <CardDescription>{getStepDescription()}</CardDescription>
              </div>
            </div>
          </div>
          <Progress value={getStepProgress()} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            Step {WIZARD_STEPS.indexOf(currentStep) + 1} of {WIZARD_STEPS.length}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step 1: Country Selection */}
          {currentStep === 'country' && (
            <div className="space-y-4">
              <Alert>
                <Globe className="h-4 w-4" />
                <AlertDescription>
                  Your workspace will operate within one country. You can create additional workspaces for other countries later.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select
                  value={selectedCountry?.id}
                  onValueChange={() => {
                    // For now, hardcoded to Nigeria
                    setSelectedCountry({
                      id: DEFAULT_COUNTRY_NIGERIA_ID,
                      name: 'Nigeria',
                      iso_code: 'NG',
                      iso3_code: 'NGA',
                    });
                  }}
                >
                  <SelectTrigger id="country">
                    <SelectValue placeholder="Select a country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT_COUNTRY_NIGERIA_ID}>
                      Nigeria
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedCountry && (
                <Alert className="bg-primary/10 border-primary/20">
                  <AlertDescription>
                    <strong>{selectedCountry.name}</strong> selected. You&apos;ll be able to import states, LGAs, and wards from OpenStreetMap.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Step 2: Workspace Creation */}
          {currentStep === 'workspace' && (
            <div className="space-y-4">
              <Alert>
                <Building2 className="h-4 w-4" />
                <AlertDescription>
                  Create a workspace for your organization. All your facilities, zones, and data will belong to this workspace.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="workspace-name">Organization Name</Label>
                <Input
                  id="workspace-name"
                  placeholder="e.g., Kano Pharma, Lagos Health Services"
                  value={workspaceName}
                  onChange={(e) => handleWorkspaceNameChange(e.target.value)}
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="workspace-slug">Workspace URL Slug</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">app.routeserve.com/</span>
                  <Input
                    id="workspace-slug"
                    placeholder="kano-pharma"
                    value={workspaceSlug}
                    onChange={(e) => setWorkspaceSlug(e.target.value)}
                    disabled={isCreating}
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Auto-generated from workspace name. Only lowercase letters, numbers, and hyphens.
                </p>
              </div>

              {selectedCountry && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">
                    <strong>Country:</strong> {selectedCountry.name} ({selectedCountry.iso_code})
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Operating Model */}
          {currentStep === 'operating_model' && (
            <div className="space-y-4">
              <Alert>
                <Truck className="h-4 w-4" />
                <AlertDescription>
                  Select how your organization handles delivery operations. This helps configure the right features for your workflow.
                </AlertDescription>
              </Alert>

              <RadioGroup
                value={operatingModel ?? undefined}
                onValueChange={(value) => setOperatingModel(value as OperatingModel)}
                className="space-y-3"
              >
                {OPERATING_MODELS.map((model) => (
                  <div
                    key={model.value}
                    className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                      operatingModel === model.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setOperatingModel(model.value)}
                  >
                    <RadioGroupItem value={model.value} id={model.value} className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor={model.value} className="text-base font-medium cursor-pointer">
                        {model.label}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">{model.description}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Step 4: Primary Contact */}
          {currentStep === 'primary_contact' && (
            <div className="space-y-4">
              <Alert>
                <User className="h-4 w-4" />
                <AlertDescription>
                  Provide contact information for the primary administrator of this workspace.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="contact-name">Full Name</Label>
                  <Input
                    id="contact-name"
                    placeholder="John Doe"
                    value={primaryContact.name}
                    onChange={(e) => setPrimaryContact({ ...primaryContact, name: e.target.value })}
                    disabled={isCreating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-email">Email Address *</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    placeholder="john@example.com"
                    value={primaryContact.email}
                    onChange={(e) => setPrimaryContact({ ...primaryContact, email: e.target.value })}
                    disabled={isCreating}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-phone">Phone Number</Label>
                  <Input
                    id="contact-phone"
                    type="tel"
                    placeholder="+234 800 000 0000"
                    value={primaryContact.phone}
                    onChange={(e) => setPrimaryContact({ ...primaryContact, phone: e.target.value })}
                    disabled={isCreating}
                  />
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg space-y-1">
                <p className="text-sm font-medium">Summary</p>
                <p className="text-sm text-muted-foreground">
                  <strong>Organization:</strong> {workspaceName}
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Operating Model:</strong> {OPERATING_MODELS.find(m => m.value === operatingModel)?.label}
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Import Boundaries */}
          {currentStep === 'boundaries' && (
            <div className="space-y-4">
              <Alert>
                <MapPin className="h-4 w-4" />
                <AlertDescription>
                  Import administrative boundaries (States, LGAs) from OpenStreetMap. This is optional and can be done later.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 border rounded-lg">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                  <div>
                    <h4 className="font-medium">What will be imported</h4>
                    <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                      <li>All states in {selectedCountry?.name}</li>
                      <li>All LGAs (Local Government Areas)</li>
                      <li>Geographic boundaries for mapping</li>
                      <li>Population and area data</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 border rounded-lg bg-warning/10 border-warning/20">
                  <AlertDescription className="text-sm">
                    <strong>Note:</strong> The import process downloads ~300MB of data and may take 5-10 minutes. You can skip this and import boundaries later from the Location Management page.
                  </AlertDescription>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Complete */}
          {currentStep === 'complete' && (
            <div className="space-y-4 text-center py-8">
              <div className="mx-auto h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">You&apos;re all set!</h3>
                <p className="text-muted-foreground mt-2">
                  Your organization <strong>{workspaceName}</strong> has been created and you are now the administrator.
                </p>
              </div>
              <Alert className="text-left">
                <AlertDescription>
                  <strong>Next steps to get started:</strong>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>1. Add your first warehouse location</li>
                    <li>2. Onboard at least one vehicle</li>
                    <li>3. Add facilities to your workspace</li>
                    <li>4. Invite team members</li>
                  </ul>
                  <p className="mt-3 text-muted-foreground">
                    Planning features will be unlocked once you complete the operational setup.
                  </p>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between">
          {canGoBack && (
            <Button
              variant="outline"
              onClick={goToPreviousStep}
              disabled={isCreating}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}

          {currentStep === 'country' && (
            <Button onClick={handleCountrySelect} disabled={!selectedCountry} className="ml-auto">
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}

          {currentStep === 'workspace' && (
            <Button onClick={handleWorkspaceNext} disabled={!workspaceName.trim()} className="ml-auto">
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}

          {currentStep === 'operating_model' && (
            <Button onClick={handleOperatingModelNext} disabled={!operatingModel} className="ml-auto">
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}

          {currentStep === 'primary_contact' && (
            <Button
              onClick={handleCreateOrganization}
              disabled={isCreating || !primaryContact.email.trim()}
              className="ml-auto"
            >
              {isCreating ? 'Creating...' : 'Create Organization'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}

          {currentStep === 'boundaries' && (
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={handleSkipBoundaries}>
                Skip for Now
              </Button>
              <Button onClick={handleImportBoundaries}>
                Import Boundaries
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}

          {currentStep === 'complete' && (
            <Button onClick={handleFinish} className="ml-auto">
              Go to Dashboard
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

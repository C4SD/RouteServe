import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Clock,
  UserPlus,
  Activity,
  CheckCircle2,
  Mail,
  Send,
  RotateCcw,
} from 'lucide-react';
import {
  IntegrationCard,
  ActiveIntegrationItem,
  BackupStatusCard,
  LinkByEmailDialog,
  GenerateOTPDialog,
  LinkedUsersTable,
  OnboardingRequestsTable,
  IntegrationConfigDialog,
} from '@/components/admin/integration';
import { useLinkedUsers, usePendingOTPs } from '@/hooks/admin/useIntegration';
import { useOnboardingRequests } from '@/hooks/admin/useOnboardingRequests';
import { useWorkspaceInvitations, useResendInvitation, buildMod4InvitationUrl } from '@/hooks/useInvitations';
import type { UserInvitation } from '@/types/onboarding';
import { AVAILABLE_INTEGRATIONS, INTEGRATION_CATEGORIES } from '@/data/integrations';
import { Integration, IntegrationType, IntegrationConfig } from '@/types/integration';
import { toast } from 'sonner';

export default function AdminIntegrationPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationType | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);

  // Get workspace ID for dialogs
  const { data: workspaceId } = useQuery({
    queryKey: ['admin-current-workspace-id'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      return membership?.workspace_id as string | null;
    },
    retry: 1,
  });

  const { data: links = [] } = useLinkedUsers(workspaceId);
  const { data: pendingOTPs = [] } = usePendingOTPs(workspaceId);
  const { data: requests = [] } = useOnboardingRequests();
  const { data: invitations = [], refetch: refetchInvitations } = useWorkspaceInvitations(workspaceId);
  const resendInvitation = useResendInvitation();

  // Mock active integrations (in real app, fetch from database)
  const activeIntegrations: Integration[] = [
    {
      id: 'mod4-1',
      type: 'mod4',
      name: 'Mod4 Driver System',
      description: 'Driver execution platform for delivery batches',
      category: 'execution',
      status: 'active',
      icon: 'Truck',
      capabilities: ['Driver onboarding', 'Batch assignment', 'Proof of delivery'],
      lastSync: new Date().toISOString(),
    },
  ];

  const activeLinks = links.filter((l) => l.status === 'active').length;
  const pendingRequests = requests.filter((r) => r.status === 'pending').length;
  const pendingInvitations = invitations.filter((i) => i.status === 'pending').length;

  // Filter integrations
  const filteredIntegrations = AVAILABLE_INTEGRATIONS.filter((integration) => {
    const matchesSearch =
      integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all' || integration.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleConfigure = useCallback((type: string) => {
    setSelectedIntegration(type as IntegrationType);
    setConfigDialogOpen(true);
  }, []);

  const handleDisable = useCallback((id: string) => {
    console.log('Disable integration:', id);
  }, []);

  const handleSync = useCallback((id: string) => {
    console.log('Sync integration:', id);
  }, []);

  const handleSaveConfig = useCallback(
    async (config: IntegrationConfig) => {
      // In production, save to database
      console.log('Saving config for', selectedIntegration, config);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success(
        `Successfully configured ${
          AVAILABLE_INTEGRATIONS.find((i) => i.type === selectedIntegration)?.name
        }`
      );

      // TODO: Refresh active integrations list
    },
    [selectedIntegration]
  );

  const selectedIntegrationData = selectedIntegration
    ? AVAILABLE_INTEGRATIONS.find((i) => i.type === selectedIntegration)
    : null;

  const existingConfig = selectedIntegration
    ? activeIntegrations.find((i) => i.type === selectedIntegration)?.config
    : undefined;

  return (
    <div className="max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-muted-foreground">
          Connect external systems to streamline your logistics operations.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Integrations</p>
                <p className="text-2xl font-bold">{activeIntegrations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Connected</p>
                <p className="text-2xl font-bold">{activeLinks}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending OTPs</p>
                <p className="text-2xl font-bold">{pendingOTPs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Send className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Invites</p>
                <p className="text-2xl font-bold">{pendingInvitations}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="available" className="space-y-6">
        <TabsList>
          <TabsTrigger value="available">Available Integrations</TabsTrigger>
          <TabsTrigger value="active">
            Current Integrations
            {activeIntegrations.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeIntegrations.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="mod4">
            Mod4 Setup
            {(pendingRequests > 0 || pendingOTPs.length > 0 || pendingInvitations > 0) && (
              <Badge variant="secondary" className="ml-2 bg-amber-500/10 text-amber-600">
                {pendingRequests + pendingOTPs.length + pendingInvitations}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Available Integrations Tab */}
        <TabsContent value="available" className="space-y-6">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search integrations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {INTEGRATION_CATEGORIES.map((category) => (
                <Button
                  key={category.value}
                  variant={selectedCategory === category.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category.value)}
                  className="whitespace-nowrap"
                >
                  {category.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Integration Grid */}
          {filteredIntegrations.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <p className="text-muted-foreground">No integrations found matching your search.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredIntegrations.map((integration) => {
                const isActive = activeIntegrations.some((a) => a.type === integration.type);
                const activeIntegration = activeIntegrations.find((a) => a.type === integration.type);
                return (
                  <IntegrationCard
                    key={integration.type}
                    integration={integration}
                    isActive={isActive}
                    activeIntegration={activeIntegration}
                    onConfigure={handleConfigure}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Current Integrations Tab */}
        <TabsContent value="active" className="space-y-4">
          <BackupStatusCard workspaceId={workspaceId} />

          {activeIntegrations.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No Active Integrations</h3>
                <p className="text-muted-foreground mb-4">
                  Get started by adding your first integration.
                </p>
                <Button onClick={() => setSelectedCategory('all')}>Browse Integrations</Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {activeIntegrations.map((integration) => (
                    <ActiveIntegrationItem
                      key={integration.id}
                      integration={integration}
                      onConfigure={handleConfigure}
                      onDisable={handleDisable}
                      onSync={handleSync}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Mod4 Setup Tab */}
        <TabsContent value="mod4" className="space-y-6">
          {/* Actions */}
          <div className="flex gap-2">
            {workspaceId && (
              <>
                <LinkByEmailDialog workspaceId={workspaceId} />
                <GenerateOTPDialog workspaceId={workspaceId} />
              </>
            )}
          </div>

          {/* Pending Invitations */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Sent Invitations</h3>
                {pendingInvitations > 0 && (
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">
                    {pendingInvitations} pending
                  </Badge>
                )}
              </div>
              {invitations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No invitations sent yet. Use "Link by Email" above to invite drivers.</p>
                </div>
              ) : (
                <div className="border rounded-lg bg-card divide-y">
                  {invitations.map((inv: UserInvitation) => {
                    const isExpired = inv.status === 'pending' && new Date(inv.expires_at) < new Date();
                    const effectiveStatus = isExpired ? 'expired' : inv.status;

                    return (
                      <div key={inv.id} className="flex items-center justify-between p-4 gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{inv.email}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Invited {new Date(inv.invited_at).toLocaleDateString()}
                            {inv.accepted_at && ` · Accepted ${new Date(inv.accepted_at).toLocaleDateString()}`}
                            {effectiveStatus === 'expired' && ` · Expired ${new Date(inv.expires_at).toLocaleDateString()}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {effectiveStatus === 'pending' && (
                            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">
                              Pending
                            </Badge>
                          )}
                          {effectiveStatus === 'accepted' && (
                            <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                              Accepted
                            </Badge>
                          )}
                          {effectiveStatus === 'expired' && (
                            <Badge variant="secondary" className="bg-red-500/10 text-red-600">
                              Expired
                            </Badge>
                          )}
                          {effectiveStatus === 'revoked' && (
                            <Badge variant="secondary" className="bg-gray-500/10 text-gray-500">
                              Revoked
                            </Badge>
                          )}
                          {(effectiveStatus === 'expired' || effectiveStatus === 'revoked') && workspaceId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              disabled={resendInvitation.isPending}
                              onClick={() =>
                                resendInvitation.mutate(
                                  {
                                    invitationId: inv.id,
                                    workspaceId,
                                    email: inv.email,
                                    appRole: inv.role_code,
                                    workspaceRole: inv.workspace_role as any,
                                  },
                                  { onSuccess: () => refetchInvitations() }
                                )
                              }
                            >
                              <RotateCcw className="h-3 w-3" />
                              Resend
                            </Button>
                          )}
                          {effectiveStatus === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                navigator.clipboard.writeText(buildMod4InvitationUrl(inv.invitation_token));
                                toast.success('Link copied');
                              }}
                            >
                              Copy Link
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Linked Users Table */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-medium mb-4">Linked Users</h3>
              <div className="border rounded-lg">
                <LinkedUsersTable workspaceId={workspaceId} />
              </div>
            </CardContent>
          </Card>

          {/* Pending OTPs */}
          {pendingOTPs.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-medium mb-4">Pending OTP Codes</h3>
                <div className="border rounded-lg bg-card divide-y">
                  {pendingOTPs.map((otp) => {
                    const expiresAt = new Date(otp.expires_at);
                    const isExpired = expiresAt < new Date();
                    const minutesLeft = Math.max(
                      0,
                      Math.round((expiresAt.getTime() - Date.now()) / 60000)
                    );

                    return (
                      <div key={otp.id} className="flex items-center justify-between p-4">
                        <div>
                          <p className="font-medium">{otp.target_email}</p>
                          <p className="text-sm text-muted-foreground">
                            Code: <span className="font-mono font-bold">{otp.otp_code}</span>
                            {' · '}
                            Attempts: {otp.attempts}/{otp.max_attempts}
                          </p>
                        </div>
                        <div className="text-right">
                          {isExpired ? (
                            <Badge variant="secondary" className="bg-red-500/10 text-red-600">
                              Expired
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">
                              {minutesLeft}m remaining
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Onboarding Requests */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Onboarding Requests</h3>
                {pendingRequests > 0 && (
                  <Badge variant="secondary" className="bg-purple-500/10 text-purple-600">
                    {pendingRequests} pending
                  </Badge>
                )}
              </div>
              <div className="border rounded-lg">
                <OnboardingRequestsTable />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Configuration Dialog */}
      <IntegrationConfigDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        integrationType={selectedIntegration}
        integrationName={selectedIntegrationData?.name}
        existingConfig={existingConfig}
        onSave={handleSaveConfig}
      />
    </div>
  );
}

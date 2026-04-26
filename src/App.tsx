import React, { useEffect, lazy, Suspense, ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Toaster as RadixToaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { MapStateProvider } from "./contexts/MapStateContext";
import { WorkspaceProvider, useWorkspace } from "./contexts/WorkspaceContext";
import { AbilityProvider } from "./rbac/AbilityProvider";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import ErrorBoundary from "./components/ErrorBoundary";

// Lazy-load all layouts (named exports → wrapped with .then())
const FleetOpsLayout = lazy(() => import("./pages/fleetops/layout").then(m => ({ default: m.FleetOpsLayout })));
const StorefrontLayout = lazy(() => import("./pages/storefront/layout").then(m => ({ default: m.StorefrontLayout })));
const Mod4Layout = lazy(() => import("./pages/mod4/layout").then(m => ({ default: m.Mod4Layout })));
const AdminLayout = lazy(() => import("./pages/admin/layout").then(m => ({ default: m.AdminLayout })));
const MapLayout = lazy(() => import("./pages/map/layout").then(m => ({ default: m.MapLayout })));

// Lazy-load all pages
const FleetOpsHome = lazy(() => import("./pages/fleetops/page"));
const FleetManagement = lazy(() => import("./pages/fleetops/fleet-management/page"));
const VehicleRegistry = lazy(() => import("./pages/fleetops/vehicles/registry/page"));
const VehicleDetailPage = lazy(() => import("./pages/fleetops/vehicles/[id]/page"));
const DriverManagement = lazy(() => import("./pages/DriverManagement"));
const BatchManagement = lazy(() => import("./pages/BatchManagement"));
const ReportsPageWrapper = lazy(() => import("./pages/ReportsPageWrapper"));

// VLMS
const VLMSDashboard = lazy(() => import("./pages/fleetops/vlms/page"));
const VLMSVehicles = lazy(() => import("./pages/fleetops/vlms/vehicles/page"));
const VLMSVehicleOnboard = lazy(() => import("./pages/fleetops/vlms/vehicles/onboard/page"));
const VLMSVehicleDetail = lazy(() => import("./pages/fleetops/vlms/vehicles/[id]/page"));
const VLMSVehicleEdit = lazy(() => import("./pages/fleetops/vlms/vehicles/[id]/edit/page"));
const VLMSMaintenance = lazy(() => import("./pages/fleetops/vlms/maintenance/page"));
const VLMSFuel = lazy(() => import("./pages/fleetops/vlms/fuel/page"));
const VLMSAssignments = lazy(() => import("./pages/fleetops/vlms/assignments/page"));
const VLMSIncidents = lazy(() => import("./pages/fleetops/vlms/incidents/page"));
const VLMSInspections = lazy(() => import("./pages/fleetops/vlms/inspections/page"));

// Storefront
const StorefrontHome = lazy(() => import("./pages/storefront/page"));
const StorefrontFacilities = lazy(() => import("./pages/storefront/facilities/page"));
const StorefrontRequisitions = lazy(() => import("./pages/storefront/requisitions/page"));
const StorefrontZones = lazy(() => import("./pages/storefront/zones/page"));
const StorefrontScheduler = lazy(() => import("./pages/storefront/scheduler/page"));
const StorefrontStockReports = lazy(() => import("./pages/storefront/stock-reports/page"));
const StorefrontPrograms = lazy(() => import("./pages/storefront/programs/page"));
const StorefrontItems = lazy(() => import("./pages/storefront/items/page"));
const StorefrontInvoice = lazy(() => import("./pages/storefront/invoice/page"));
const StorefrontWarehouse = lazy(() => import("./pages/storefront/warehouse/page"));

// Mod4
const Mod4Dashboard = lazy(() => import("./pages/mod4/page"));
const Mod4DriverPage = lazy(() => import("./pages/mod4/driver/page"));
const Mod4ActiveDeliveryPage = lazy(() => import("./pages/mod4/driver/delivery/page"));
const Mod4DeliveryDetailPage = lazy(() => import("./pages/mod4/driver/delivery/[id]/page"));
const Mod4DispatcherPage = lazy(() => import("./pages/mod4/dispatcher/page"));
const Mod4SessionsPage = lazy(() => import("./pages/mod4/sessions/page"));

// Admin
const AdminDashboard = lazy(() => import("./pages/admin/page"));
const AdminSessionsPage = lazy(() => import("./pages/admin/sessions/page"));
const AdminSessionDetailPage = lazy(() => import("./pages/admin/sessions/[id]/page"));

// Map
const LiveMapPage = lazy(() => import("./pages/map/live/page"));
const PlaybackMapPage = lazy(() => import("./pages/map/playback/page"));
const IntelligenceLayout = lazy(() => import("./pages/intelligence/layout").then(m => ({ default: m.IntelligenceLayout })));
const MapIntelligencePage = lazy(() => import("./pages/intelligence/page"));

// Settings
const PermissionsPage = lazy(() => import("./pages/settings/permissions/page"));
const SettingsLayout = lazy(() => import("./pages/settings/layout"));
const SettingsGeneralPage = lazy(() => import("./pages/settings/general/page"));
const SettingsMembersPage = lazy(() => import("./pages/settings/members/page"));
const SettingsAccessControlPage = lazy(() => import("./pages/settings/access-control/page"));
const SettingsLocationsPage = lazy(() => import("./pages/admin/LocationManagement"));
const SettingsIntegrationPage = lazy(() => import("./pages/admin/integration/page"));
const SettingsProfilePage = lazy(() => import("./pages/settings/profile/page"));
const SettingsMapPage = lazy(() => import("./pages/settings/map/page"));

// Onboarding
const OnboardingWizardV2 = lazy(() => import("./components/onboarding/OnboardingWizardV2"));
const AcceptInvitationPage = lazy(() => import("./pages/invite/AcceptInvitationPage"));
const ProfileCompletionPage = lazy(() => import("./pages/onboarding/ProfileCompletionPage"));

// Other
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,        // 2 minutes before data is considered stale
      gcTime: 10 * 60 * 1000,           // 10 minutes garbage collection
      refetchOnWindowFocus: false,       // Don't refetch on tab switch
      refetchOnReconnect: 'always',      // Do refetch when network reconnects
      retry: 1,                          // Single retry on failure
    },
  },
});

function WorkspaceThemeApplier() {
  const { workspace } = useWorkspace();

  useEffect(() => {
    document.body.className = `workspace-${workspace}`;
  }, [workspace]);

  return null;
}

function AbilityWrapper({ children }: { children: ReactNode }) {
  const { workspaceId } = useWorkspace();
  return <AbilityProvider workspaceId={workspaceId}>{children}</AbilityProvider>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AuthProvider>
          <WorkspaceProvider>
            <AbilityWrapper>
            <TooltipProvider>
              <WorkspaceThemeApplier />
              <Toaster />
              <RadixToaster />
              <MapStateProvider>
                <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/login" element={<Auth />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />

                  {/* Onboarding Routes */}
                  <Route path="/onboarding" element={<ProtectedRoute><OnboardingWizardV2 /></ProtectedRoute>} />
                  <Route path="/onboarding/profile" element={<ProtectedRoute><ProfileCompletionPage /></ProtectedRoute>} />
                  <Route path="/invite/:token" element={<AcceptInvitationPage />} />

                  {/* FleetOps Workspace */}
                  <Route path="/fleetops" element={
                    <ProtectedRoute>
                      <FleetOpsLayout />
                    </ProtectedRoute>
                  }>
                    <Route index element={<FleetOpsHome />} />
                    <Route path="drivers" element={<DriverManagement />} />

                    <Route path="batches" element={<BatchManagement />} />
                    <Route path="tactical" element={<Navigate to="/map/live" replace />} />
                    <Route path="vehicles" element={<VehicleRegistry />} />
                    <Route path="vehicles/:id" element={<VehicleDetailPage />} />
                    <Route path="fleet-management" element={<FleetManagement />} />
                    <Route path="reports" element={<ReportsPageWrapper />} />
                    <Route path="vlms">
                      <Route index element={<VLMSDashboard />} />
                      <Route path="vehicles" element={<VLMSVehicles />} />
                      <Route path="vehicles/onboard" element={<VLMSVehicleOnboard />} />
                      <Route path="vehicles/:id" element={<VLMSVehicleDetail />} />
                      <Route path="vehicles/:id/edit" element={<VLMSVehicleEdit />} />
                      <Route path="maintenance" element={<VLMSMaintenance />} />
                      <Route path="fuel" element={<VLMSFuel />} />
                      <Route path="assignments" element={<VLMSAssignments />} />
                      <Route path="incidents" element={<VLMSIncidents />} />
                      <Route path="inspections" element={<VLMSInspections />} />
                    </Route>
                  </Route>

                  {/* Storefront Workspace */}
                  <Route path="/storefront" element={
                    <ProtectedRoute>
                      <StorefrontLayout />
                    </ProtectedRoute>
                  }>
                    <Route index element={<StorefrontHome />} />
                    {/* Order Management */}
                    <Route path="items" element={<StorefrontItems />} />
                    <Route path="requisitions" element={<StorefrontRequisitions />} />
                    <Route path="invoice" element={<StorefrontInvoice />} />
                    {/* Planning */}
                    <Route path="scheduler" element={<StorefrontScheduler />} />
                    {/* Resources */}
                    <Route path="zones" element={<StorefrontZones />} />
                    <Route path="facilities" element={<StorefrontFacilities />} />
                    <Route path="warehouse" element={<StorefrontWarehouse />} />
                    <Route path="programs" element={<StorefrontPrograms />} />
                    {/* Analytics */}
                    <Route path="stock-reports" element={<StorefrontStockReports />} />
                    {/* Legacy redirects */}
                    <Route path="schedule-planner" element={<Navigate to="/storefront/scheduler" replace />} />
                    <Route path="lgas" element={<Navigate to="/storefront/zones" replace />} />
                  </Route>

                  {/* Mod4 Workspace - Mobile Driver Execution */}
                  <Route path="/mod4" element={
                    <ProtectedRoute>
                      <Mod4Layout />
                    </ProtectedRoute>
                  }>
                    <Route index element={<Mod4Dashboard />} />
                    <Route path="driver" element={<Mod4DriverPage />} />
                    <Route path="driver/delivery" element={<Mod4ActiveDeliveryPage />} />
                    <Route path="driver/delivery/:batchId" element={<Mod4DeliveryDetailPage />} />
                    <Route path="dispatcher" element={<Mod4DispatcherPage />} />
                    <Route path="sessions" element={<Mod4SessionsPage />} />
                  </Route>

                  {/* Admin — System Operations (system_admin only) */}
                  <Route path="/admin" element={
                    <ProtectedRoute permission="admin.users">
                      <AdminLayout />
                    </ProtectedRoute>
                  }>
                    <Route index element={<Navigate to="/admin/analytics" replace />} />
                    <Route path="analytics" element={<AdminDashboard />} />
                    <Route path="sessions" element={<AdminSessionsPage />} />
                    <Route path="sessions/:id" element={<AdminSessionDetailPage />} />
                    {/* Legacy redirects → /settings */}
                    <Route path="integration" element={<Navigate to="/settings/integration" replace />} />
                    <Route path="general" element={<Navigate to="/settings/general" replace />} />
                    <Route path="locations" element={<Navigate to="/settings/locations" replace />} />
                    <Route path="members" element={<Navigate to="/settings/members" replace />} />
                    <Route path="members/:id" element={<Navigate to="/settings/members" replace />} />
                    <Route path="invitations" element={<Navigate to="/settings/members" replace />} />
                    <Route path="permissions" element={<Navigate to="/settings/access-control" replace />} />
                    <Route path="workspaces" element={<Navigate to="/settings/access-control" replace />} />
                    <Route path="users" element={<Navigate to="/settings/members" replace />} />
                  </Route>

                  {/* Map Workspace - Live Tracking & Playback */}
                  <Route path="/map" element={
                    <ProtectedRoute>
                      <MapLayout />
                    </ProtectedRoute>
                  }>
                    <Route index element={<Navigate to="/map/live" replace />} />
                    <Route path="live" element={<LiveMapPage />} />
                    <Route path="playback" element={<PlaybackMapPage />} />
                  </Route>

                  {/* Intelligence — unified map platform */}
                  <Route path="/intelligence" element={
                    <ProtectedRoute>
                      <IntelligenceLayout />
                    </ProtectedRoute>
                  }>
                    <Route index element={<MapIntelligencePage />} />
                  </Route>

                  {/* Legacy routes - redirect to workspace structure */}
                  <Route path="/" element={<Navigate to="/fleetops" replace />} />
                  <Route path="/command-center" element={<Navigate to="/fleetops" replace />} />
                  <Route path="/facilities" element={<Navigate to="/storefront/facilities" replace />} />
                  <Route path="/tactical" element={<Navigate to="/fleetops/tactical" replace />} />
                  <Route path="/tactical-map" element={<Navigate to="/fleetops/tactical" replace />} />

                  <Route path="/drivers" element={<Navigate to="/fleetops/drivers" replace />} />
                  <Route path="/vehicles" element={<Navigate to="/fleetops/vehicles" replace />} />
                  <Route path="/reports" element={<Navigate to="/fleetops/reports" replace />} />
                  
                  {/* Settings Routes — user-scoped (no workspace.manage required) */}
                  <Route path="/settings/permissions" element={
                    <ProtectedRoute>
                      <PermissionsPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/settings/profile" element={
                    <ProtectedRoute>
                      <SettingsLayout />
                    </ProtectedRoute>
                  }>
                    <Route index element={<SettingsProfilePage />} />
                  </Route>
                  {/* Settings Routes — workspace-scoped (workspace.manage required) */}
                  <Route path="/settings" element={
                    <ProtectedRoute permission="workspace.manage">
                      <SettingsLayout />
                    </ProtectedRoute>
                  }>
                    <Route index element={<Navigate to="/settings/general" replace />} />
                    <Route path="general" element={<SettingsGeneralPage />} />
                    <Route path="members" element={<SettingsMembersPage />} />
                    <Route path="access-control" element={<SettingsAccessControlPage />} />
                    <Route path="locations" element={<SettingsLocationsPage />} />
                    <Route path="map" element={<SettingsMapPage />} />
                    <Route path="integration" element={<SettingsIntegrationPage />} />
                  </Route>
                  
                  {/* Catch-all */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </Suspense>
              </MapStateProvider>
            </TooltipProvider>
            </AbilityWrapper>
          </WorkspaceProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </QueryClientProvider>
);

export default App;

import { useEffect, useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { initDB } from "@/lib/db/schema";
import { initSyncListeners } from "@/lib/sync/machine";
import { useAuthStore, initAuthListener } from "@/stores/authStore";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import ActivateAccount from "./pages/ActivateAccount";
import AcceptInvite from "./pages/AcceptInvite";
import RequestAccess from "./pages/RequestAccess";
import Dashboard from "./pages/Dashboard";
import RoutePage from "./pages/Route";
import Support from "./pages/Support";
import Profile from "./pages/Profile";
import ShiftSummary from "./pages/ShiftSummary";
import NotFound from "./pages/NotFound";
import { OfflineIndicator } from "./components/sync";

const queryClient = new QueryClient();

// Sign out and redirect to login
function Logout() {
  const { logout } = useAuthStore();
  useEffect(() => {
    logout().then(() => {
      localStorage.removeItem('mod4-auth');
      window.location.href = '/login';
    });
  }, [logout]);
  return <div className="min-h-screen bg-background" />;
}

// Auth guard component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function AppContent() {
  const { isAuthenticated, refreshSession } = useAuthStore();
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if onboarding has been completed
    const completed = localStorage.getItem('mod4_onboarding_completed') === 'true';
    setOnboardingCompleted(completed);

    // Initialize systems, then validate auth before rendering routes
    const init = async () => {
      // Initialize IndexedDB
      await initDB().catch(() => {});
      console.log('[MOD4] IndexedDB initialized');

      // Validate Supabase session (clears stale persisted auth)
      // Use timeout to prevent hanging if fetchDriverProfile stalls
      try {
        const timeout = new Promise<void>((resolve) => setTimeout(resolve, 5000));
        await Promise.race([refreshSession(), timeout]);
      } catch (e) {
        console.warn('[MOD4] Session refresh failed:', e);
      }
      console.log('[MOD4] Session validated');

      // Now safe to render routes
      setIsLoading(false);
    };

    init();

    // Initialize Supabase auth listener (for future changes)
    const authCleanup = initAuthListener();
    console.log('[MOD4] Auth listener initialized');

    // Initialize sync listeners
    const syncCleanup = initSyncListeners();
    console.log('[MOD4] Sync listeners initialized');

    return () => {
      authCleanup();
      syncCleanup();
    };
  }, []);

  if (isLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <BrowserRouter>
      <OfflineIndicator />
      <Routes>
        <Route path="/onboarding" element={
          onboardingCompleted ? <Navigate to="/login" replace /> : <Onboarding />
        } />
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/" replace /> : <Login />
        } />
        <Route path="/activate" element={<ActivateAccount />} />
        <Route path="/invite/:token" element={<AcceptInvite />} />
        <Route path="/request-access" element={<RequestAccess />} />
        <Route path="/logout" element={<Logout />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/route" element={
          <ProtectedRoute>
            <RoutePage />
          </ProtectedRoute>
        } />
        <Route path="/support" element={
          <ProtectedRoute>
            <Support />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } />
        <Route path="/summary" element={
          <ProtectedRoute>
            <ShiftSummary />
          </ProtectedRoute>
        } />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppContent />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

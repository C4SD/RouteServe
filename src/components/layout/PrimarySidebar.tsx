import { Warehouse, Truck, Users as UsersIcon, LayoutDashboard, Smartphone, Map, Building2, ChevronDown, Settings, Brain } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UserMenu } from './UserMenu';
import { useEffect, useCallback } from 'react';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

type WorkspaceConfig = {
  id: 'fleetops' | 'storefront' | 'admin' | 'dashboard' | 'mod4' | 'map' | 'intelligence';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  available: boolean;
};

const workspaces: WorkspaceConfig[] = [
  {
    id: 'storefront',
    label: 'Storefront',
    icon: Warehouse,
    path: '/storefront',
    available: true,
  },
  {
    id: 'fleetops',
    label: 'FleetOps',
    icon: Truck,
    path: '/fleetops',
    available: true,
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: UsersIcon,
    path: '/admin',
    available: true,
  },
  {
    id: 'map',
    label: 'Map',
    icon: Map,
    path: '/map',
    available: true,
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    icon: Brain,
    path: '/intelligence',
    available: true,
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
    available: false,
  },
  {
    id: 'mod4',
    label: 'Mod4',
    icon: Smartphone,
    path: '/mod4',
    available: FEATURE_FLAGS.ENABLE_MOD4,
  },
];

export function PrimarySidebar() {
  const { workspace, setWorkspace, workspaceId, workspaceName, workspaces: tenantWorkspaces, switchWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();

  const handleWorkspaceClick = useCallback((ws: WorkspaceConfig) => {
    if (!ws.available) return;
    if (ws.id === 'fleetops' || ws.id === 'storefront' || ws.id === 'admin' || ws.id === 'mod4' || ws.id === 'map' || ws.id === 'intelligence') {
      setWorkspace(ws.id as any);
    }
    navigate(ws.path);
  }, [setWorkspace, navigate]);

  // Keyboard shortcuts for workspace switching (Cmd+1-5)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) {
        const keyNum = parseInt(event.key);
        if (keyNum >= 1 && keyNum <= 5) {
          const targetWorkspace = workspaces[keyNum - 1];
          if (targetWorkspace.available) {
            event.preventDefault();
            handleWorkspaceClick(targetWorkspace);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleWorkspaceClick]);

  const isWorkspaceActive = (ws: WorkspaceConfig) => {
    return location.pathname.startsWith(ws.path);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="fixed left-0 top-0 h-screen w-16 bg-sidebar border-r border-sidebar-border/60 flex flex-col items-center py-6 z-50">
        {/* Logo/Brand */}
        <div className="mb-4 flex items-center justify-center">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-xs tracking-tight">RS</span>
          </div>
        </div>

        {/* Tenant Workspace Selector */}
        {tenantWorkspaces.length > 1 && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button className="w-11 h-11 rounded-lg flex items-center justify-center mb-4 bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors text-sidebar-foreground/80">
                    <Building2 className="w-5 h-5" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">{workspaceName || 'Switch workspace'}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="right" align="start" className="w-48">
              {tenantWorkspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.workspace_id}
                  onClick={() => switchWorkspace(ws.workspace_id)}
                  className={cn(
                    ws.workspace_id === workspaceId && 'bg-accent font-medium'
                  )}
                >
                  {ws.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Workspace Icons */}
        <div className="flex-1 flex flex-col gap-4">
          {workspaces.map((ws, index) => {
            const Icon = ws.icon;
            const isActive = isWorkspaceActive(ws);
            const shortcut = `⌘${index + 1}`;

            return (
              <Tooltip key={ws.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleWorkspaceClick(ws)}
                    disabled={!ws.available}
                    className={cn(
                      'relative w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-200',
                      'hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                      isActive && 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm',
                      !isActive && 'text-sidebar-foreground/70 hover:text-sidebar-foreground',
                      !ws.available && 'opacity-40 cursor-not-allowed'
                    )}
                    aria-label={ws.label}
                  >
                    {/* Active indicator - left border */}
                    {isActive && (
                      <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-7 bg-primary rounded-r-full" />
                    )}
                    <Icon className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex items-center gap-2">
                  <span>{ws.label}</span>
                  {ws.available && <kbd className="text-xs opacity-60">{shortcut}</kbd>}
                  {!ws.available && <span className="text-xs opacity-60">(Coming Soon)</span>}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Divider before settings + user */}
        <div className="w-8 h-px bg-sidebar-border/40 mb-4" />

        {/* Settings */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => navigate('/settings')}
              className={cn(
                'relative w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-200',
                'hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                location.pathname.startsWith('/settings')
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground'
              )}
              aria-label="Settings"
            >
              {location.pathname.startsWith('/settings') && (
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-7 bg-primary rounded-r-full" />
              )}
              <Settings className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Workspace Settings</TooltipContent>
        </Tooltip>

        {/* User Avatar at Bottom */}
        <div className="mt-auto">
          <UserMenu compact />
        </div>
      </div>
    </TooltipProvider>
  );
}

import { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { RbacRole } from '@/rbac/types';
import { getUserPermissions } from '@/services/authorization';
import { toast } from 'sonner';

// Module-level workspace type (which section of the app)
type WorkspaceType = 'fleetops' | 'storefront' | 'admin' | 'dashboard' | 'mod4' | 'map';

// Multi-tenant workspace info from get_my_workspaces() RPC
export interface TenantWorkspace {
  workspace_id: string;
  name: string;
  slug: string;
  role_code: RbacRole;
  role_name: string;
}

interface WorkspaceContextType {
  // Module workspace (existing — backward compatible)
  workspace: WorkspaceType;
  setWorkspace: (workspace: WorkspaceType) => void;

  // Multi-tenant workspace (new)
  workspaceId: string | null;
  workspaceName: string | null;
  workspaceSlug: string | null;
  role: RbacRole | null;
  workspaces: TenantWorkspace[];
  switchWorkspace: (workspaceId: string) => void;
  archiveWorkspace: (workspaceId: string) => Promise<void>;
  isLoadingWorkspaces: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const STORAGE_KEY_MODULE = 'biko_workspace';
const STORAGE_KEY_TENANT = 'biko_active_workspace_id';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Module workspace state (existing)
  const [moduleWorkspace, setModuleWorkspaceState] = useState<WorkspaceType>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_MODULE) as WorkspaceType;
    if (saved && ['fleetops', 'storefront', 'map'].includes(saved)) {
      return saved;
    }
    return 'fleetops';
  });

  const setModuleWorkspace = useCallback((ws: WorkspaceType) => {
    setModuleWorkspaceState(ws);
    localStorage.setItem(STORAGE_KEY_MODULE, ws);
  }, []);

  // Tenant workspace state (new)
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY_TENANT);
  });

  // Fetch workspaces from RPC
  const { data: workspaces = [], isLoading: isLoadingWorkspaces } = useQuery({
    queryKey: ['my-workspaces'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_workspaces');
      if (error) throw error;
      return (data || []) as TenantWorkspace[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Auto-select workspace if none is active or active one is no longer in list
  useEffect(() => {
    if (workspaces.length === 0) return;

    const currentIsValid = activeWorkspaceId &&
      workspaces.some((w) => w.workspace_id === activeWorkspaceId);

    if (!currentIsValid) {
      const firstId = workspaces[0].workspace_id;
      setActiveWorkspaceId(firstId);
      localStorage.setItem(STORAGE_KEY_TENANT, firstId);
    }
  }, [workspaces, activeWorkspaceId]);

  const switchWorkspace = useCallback(async (wsId: string) => {
    const previousWorkspaceId = activeWorkspaceId;

    try {
      // Optimistic update
      setActiveWorkspaceId(wsId);
      localStorage.setItem(STORAGE_KEY_TENANT, wsId);

      // Clear workflow store persisted state so previous workspace's batch planning
      // does not bleed into the new workspace context
      localStorage.removeItem('unified-workflow-storage');

      // Invalidate permission queries first so they refetch for the new workspace
      await queryClient.invalidateQueries({ queryKey: ['workspace-role'] });
      await queryClient.invalidateQueries({ queryKey: ['workspace-permissions'] });

      // Invalidate all other data queries to prevent cross-workspace leakage
      queryClient.invalidateQueries();

    } catch (error) {
      // Rollback on error
      setActiveWorkspaceId(previousWorkspaceId);
      if (previousWorkspaceId) {
        localStorage.setItem(STORAGE_KEY_TENANT, previousWorkspaceId);
      } else {
        localStorage.removeItem(STORAGE_KEY_TENANT);
      }

      console.error('Failed to switch workspace:', error);
      toast.error('Failed to switch workspace. Reverted to previous workspace.');

      throw error;
    }
  }, [activeWorkspaceId, queryClient]);

  const archiveWorkspace = useCallback(async (wsId: string) => {
    try {
      const { error } = await supabase.rpc('archive_workspace', {
        p_workspace_id: wsId,
      });
      if (error) throw error;

      // Refresh workspace list (archived workspace will be filtered out by RPC)
      await queryClient.invalidateQueries({ queryKey: ['my-workspaces'] });

      // If we just archived the active workspace, the auto-select effect
      // will pick the next available workspace
      if (wsId === activeWorkspaceId) {
        // Clear the active workspace so auto-select kicks in
        setActiveWorkspaceId(null);
        localStorage.removeItem(STORAGE_KEY_TENANT);

        // Invalidate all queries for clean state
        await queryClient.invalidateQueries({ queryKey: ['workspace-role'] });
        await queryClient.invalidateQueries({ queryKey: ['workspace-permissions'] });
        queryClient.invalidateQueries();
      }

      toast.success('Workspace archived successfully');
    } catch (err: any) {
      console.error('Failed to archive workspace:', err);
      toast.error(err.message || 'Failed to archive workspace');
      throw err;
    }
  }, [activeWorkspaceId, queryClient]);

  // Derive active workspace info
  const activeWorkspace = workspaces.find((w) => w.workspace_id === activeWorkspaceId) || null;

  const contextValue = useMemo<WorkspaceContextType>(() => ({
    workspace: moduleWorkspace,
    setWorkspace: setModuleWorkspace,
    workspaceId: activeWorkspace?.workspace_id ?? null,
    workspaceName: activeWorkspace?.name ?? null,
    workspaceSlug: activeWorkspace?.slug ?? null,
    role: activeWorkspace?.role_code ?? null,
    workspaces,
    switchWorkspace,
    archiveWorkspace,
    isLoadingWorkspaces,
  }), [moduleWorkspace, setModuleWorkspace, activeWorkspace, workspaces, switchWorkspace, archiveWorkspace, isLoadingWorkspaces]);

  return (
    <WorkspaceContext.Provider value={contextValue}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }
  return context;
}

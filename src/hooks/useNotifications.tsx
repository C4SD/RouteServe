import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useEffect } from 'react';

export interface Notification {
  id: string;
  user_id: string;
  workspace_id?: string;
  type: 'info' | 'warning' | 'urgent' | 'success';
  title: string;
  message: string;
  related_entity_type?: 'batch' | 'driver' | 'vehicle' | 'facility';
  related_entity_id?: string;
  read: boolean;
  created_at: string;
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      // Filter by workspace when the column exists (migration 20260510000006 adds it).
      // Also include rows where workspace_id is NULL (legacy notifications without workspace).
      if (workspaceId) {
        query = query.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Notification[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Realtime subscription scoped to the current workspace
  useEffect(() => {
    if (!workspaceId) return;

    const channel = supabase
      .channel(`notifications-changes-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', workspaceId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, workspaceId]);

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', workspaceId] });
    }
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false)
        .eq('user_id', user.id);

      if (workspaceId) {
        query = query.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
      }

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', workspaceId] });
    }
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    isLoading,
    unreadCount,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate
  };
}

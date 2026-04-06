import { Outlet, useLocation, NavLink } from 'react-router-dom';
import { Settings, Users, Shield, MapPin, Link2, User, Map } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SecondarySidebar, NavigationGroup } from '@/components/layout/SecondarySidebar';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

const settingsTabs = [
  { id: 'general', label: 'General', icon: Settings, path: '/settings/general' },
  { id: 'profile', label: 'Profile', icon: User, path: '/settings/profile' },
  { id: 'members', label: 'Members', icon: Users, path: '/settings/members' },
  { id: 'access-control', label: 'Access Control', icon: Shield, path: '/settings/access-control' },
  { id: 'locations', label: 'Locations', icon: MapPin, path: '/settings/locations' },
  { id: 'map', label: 'Map', icon: Map, path: '/settings/map' },
  { id: 'integration', label: 'Integration', icon: Link2, path: '/settings/integration' },
];

const sidebarGroups: NavigationGroup[] = [
  {
    label: 'WORKSPACE',
    items: [
      { label: 'General', href: '/settings/general', icon: Settings },
      { label: 'Profile', href: '/settings/profile', icon: User },
      { label: 'Members', href: '/settings/members', icon: Users },
      { label: 'Access Control', href: '/settings/access-control', icon: Shield },
      { label: 'Locations', href: '/settings/locations', icon: MapPin },
      { label: 'Map', href: '/settings/map', icon: Map },
      { label: 'Integration', href: '/settings/integration', icon: Link2 },
    ],
  },
];

function SettingsTabs() {
  const location = useLocation();

  const activeTab = useMemo(() => {
    const path = location.pathname;
    if (path.includes('/access-control')) return 'access-control';
    if (path.includes('/profile')) return 'profile';
    if (path.includes('/members')) return 'members';
    if (path.includes('/locations')) return 'locations';
    if (path.includes('/map')) return 'map';
    if (path.includes('/integration')) return 'integration';
    return 'general';
  }, [location.pathname]);

  return (
    <div className="border-b bg-background">
      <div className="flex items-center gap-1 px-4">
        {settingsTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <NavLink
              key={tab.id}
              to={tab.path}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative',
                'hover:text-foreground',
                isActive ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}

export default function SettingsLayout() {
  const { workspaceName } = useWorkspace();
  const location = useLocation();

  const breadcrumbs = useMemo(() => {
    const crumbs: Array<{ label: string; href?: string }> = [
      { label: 'Settings', href: '/settings/general' },
    ];

    const path = location.pathname;
    if (path.includes('/profile')) crumbs.push({ label: 'Profile' });
    else if (path.includes('/members')) crumbs.push({ label: 'Members' });
    else if (path.includes('/access-control')) crumbs.push({ label: 'Access Control' });
    else if (path.includes('/locations')) crumbs.push({ label: 'Locations' });
    else if (path.includes('/map')) crumbs.push({ label: 'Map' });
    else if (path.includes('/integration')) crumbs.push({ label: 'Integration' });
    else if (path.includes('/general')) crumbs.push({ label: 'General' });

    return crumbs;
  }, [location.pathname]);

  const sidebar = (
    <SecondarySidebar
      title={workspaceName || 'Settings'}
      subtitle="Workspace Settings"
      groups={sidebarGroups}
      searchPlaceholder="Search..."
    />
  );

  return (
    <AppLayout sidebar={sidebar} breadcrumbs={breadcrumbs}>
      <div className="flex flex-col h-full">
        <SettingsTabs />
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </div>
    </AppLayout>
  );
}

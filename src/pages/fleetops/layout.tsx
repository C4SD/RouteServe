import { Outlet, useLocation } from 'react-router-dom';
import { Package, LayoutDashboard, Users, GitBranch, FileBarChart, Wrench, Radio, History, AlertTriangle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SecondarySidebar, NavigationGroup } from '@/components/layout/SecondarySidebar';
import { useMemo } from 'react';
import { useAbilityContext } from '@/rbac';
import type { Permission } from '@/rbac/types';

interface GatedNavItem {
  label: string;
  href: string;
  icon: any;
  end?: boolean;
  permission?: Permission;
}

interface GatedNavGroup {
  label: string;
  items: GatedNavItem[];
}

const navigationGroups: GatedNavGroup[] = [
  {
    label: 'OVERVIEW',
    items: [
      {
        label: 'Dashboard',
        href: '/fleetops',
        icon: LayoutDashboard,
        end: true
      },
    ],
  },
  {
    label: 'PLANNING',
    items: [
      {
        label: 'Batches',
        href: '/fleetops/batches',
        icon: Package,
        permission: 'batches.read',
      },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      {
        label: 'Drivers',
        href: '/fleetops/drivers',
        icon: Users,
        permission: 'drivers.assign',
      },
      {
        label: 'Fleet Management',
        href: '/fleetops/fleet-management',
        icon: GitBranch
      },
      {
        label: 'VLMS',
        href: '/fleetops/vlms',
        icon: Wrench
      },
    ],
  },
  {
    label: 'TRACKING',
    items: [
      {
        label: 'Live Map',
        href: '/map/live',
        icon: Radio
      },
      {
        label: 'Playback',
        href: '/map/playback',
        icon: History
      },
    ],
  },
  {
    label: 'ANALYTICS',
    items: [
      {
        label: 'Reports',
        href: '/fleetops/reports',
        icon: FileBarChart,
        permission: 'reports.read',
      },
    ],
  },
];

export function FleetOpsLayout() {
  const location = useLocation();
  const { can, hasError, isLoading } = useAbilityContext();

  // Filter navigation by permission
  const filteredGroups: NavigationGroup[] = useMemo(() => {
    return navigationGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          !item.permission || can(item.permission)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [can]);

  // Generate breadcrumbs based on current path
  const breadcrumbs = useMemo(() => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const crumbs: Array<{ label: string; href?: string }> = [];

    if (pathSegments.length === 1 && pathSegments[0] === 'fleetops') {
      return [{ label: 'Dashboard' }];
    }

    // Add workspace
    crumbs.push({ label: 'FleetOps', href: '/fleetops' });

    // Add current page
    if (pathSegments.length > 1) {
      const pageName = pathSegments[1]
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      crumbs.push({ label: pageName });
    }

    return crumbs;
  }, [location.pathname]);

  const sidebar = (
    <SecondarySidebar
      title="FleetOps"
      subtitle="Operations & Delivery"
      groups={filteredGroups}
      searchPlaceholder="Search FleetOps..."
    />
  );

  return (
    <AppLayout sidebar={sidebar} breadcrumbs={breadcrumbs}>
      {hasError && !isLoading && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Permissions failed to load</p>
            <p className="text-destructive/80">
              Some navigation items may be hidden. Check your network/console, or contact an admin
              if the workspace RBAC functions aren't deployed.
            </p>
          </div>
        </div>
      )}
      <Outlet />
    </AppLayout>
  );
}

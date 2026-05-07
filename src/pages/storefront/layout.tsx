import { Outlet, useLocation } from 'react-router-dom';
import {
  Home,
  Building2,
  ShoppingCart,
  CalendarClock,
  Layers,
  BarChart3,
  Package,
  FileText,
  Warehouse,
  FolderKanban,
  History,
} from 'lucide-react';
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
        label: 'Overview',
        href: '/storefront',
        icon: Home,
        end: true
      },
    ],
  },
  {
    label: 'ORDER MANAGEMENT',
    items: [
      {
        label: 'Items',
        href: '/storefront/items',
        icon: Package,
        permission: 'item.manage',
      },
      {
        label: 'Requisitions',
        href: '/storefront/requisitions',
        icon: ShoppingCart,
        permission: 'requisitions.read',
      },
      {
        label: 'Invoice',
        href: '/storefront/invoice',
        icon: FileText,
        permission: 'invoice.process',
      },
    ],
  },
  {
    label: 'PLANNING',
    items: [
      {
        label: 'Scheduler',
        href: '/storefront/scheduler',
        icon: CalendarClock,
        permission: 'schedule.create',
      },
    ],
  },
  {
    label: 'RESOURCES',
    items: [
      {
        label: 'Zones',
        href: '/storefront/zones',
        icon: Layers,
        permission: 'zone.manage',
      },
      {
        label: 'Facilities',
        href: '/storefront/facilities',
        icon: Building2,
        permission: 'facility.manage',
      },
      {
        label: 'Warehouse',
        href: '/storefront/warehouse',
        icon: Warehouse,
        permission: 'inventory.view',
      },
      {
        label: 'Programs',
        href: '/storefront/programs',
        icon: FolderKanban,
        permission: 'program.manage',
      },
    ],
  },
  {
    label: 'ANALYTICS',
    items: [
      {
        label: 'Stock Reports',
        href: '/storefront/stock-reports',
        icon: BarChart3,
        permission: 'reports.read',
      },
    ],
  },
  {
    label: 'DATA',
    items: [
      {
        label: 'Import History',
        href: '/storefront/imports',
        icon: History,
        permission: 'item.manage',
      },
    ],
  },
];

export function StorefrontLayout() {
  const location = useLocation();
  const { can } = useAbilityContext();

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

    if (pathSegments.length === 1 && pathSegments[0] === 'storefront') {
      return [{ label: 'Overview' }];
    }

    // Add workspace
    crumbs.push({ label: 'Storefront', href: '/storefront' });

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
      title="Storefront"
      subtitle="Warehouse & Inventory"
      groups={filteredGroups}
      searchPlaceholder="Search Storefront..."
    />
  );

  return (
    <AppLayout sidebar={sidebar} breadcrumbs={breadcrumbs}>
      <Outlet />
    </AppLayout>
  );
}

/**
 * IntelligenceLayout
 *
 * Top-level layout for the /intelligence section.
 * Wraps in AppLayout with a minimal secondary sidebar — the main
 * track/playback/analytics tabs live inside the page itself.
 */

import { Outlet, useLocation } from 'react-router-dom';
import { Brain, Radio, History, BarChart3 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SecondarySidebar, NavigationGroup } from '@/components/layout/SecondarySidebar';
import { useMemo } from 'react';

const navigationGroups: NavigationGroup[] = [
  {
    label: 'VIEWS',
    items: [
      {
        label: 'Track',
        href: '/intelligence?tab=track',
        icon: Radio,
      },
      {
        label: 'Playback',
        href: '/intelligence?tab=playback',
        icon: History,
      },
      {
        label: 'Analytics',
        href: '/intelligence?tab=analytics',
        icon: BarChart3,
      },
    ],
  },
];

export function IntelligenceLayout() {
  const location = useLocation();

  const breadcrumbs = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab') ?? 'track';
    return [
      { label: 'Intelligence', href: '/intelligence' },
      { label: tab.charAt(0).toUpperCase() + tab.slice(1) },
    ];
  }, [location.search]);

  const sidebar = (
    <SecondarySidebar
      title="Intelligence"
      subtitle="Unified Map Platform"
      groups={navigationGroups}
      searchPlaceholder="Search..."
    />
  );

  return (
    <AppLayout sidebar={sidebar} breadcrumbs={breadcrumbs}>
      <Outlet />
    </AppLayout>
  );
}

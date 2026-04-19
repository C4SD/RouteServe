import * as React from 'react';
import { PrimarySidebar } from './PrimarySidebar';
import { MobileNav } from './MobileNav';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { NotificationCenter } from './NotificationCenter';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  breadcrumbs?: Array<{
    label: string;
    href?: string;
  }>;
  headerActions?: React.ReactNode;
}

export function AppLayout({ children, sidebar, breadcrumbs, headerActions }: AppLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Primary Sidebar - Fixed Icon-Only (Desktop Only) */}
      {!isMobile && <PrimarySidebar />}

      {/* Secondary Sidebar + Main Content */}
      <div className={cn('flex-1 flex h-full min-w-0 overflow-hidden', !isMobile && 'ml-16')}>
        <SidebarProvider defaultOpen={true}>
          {/* Secondary Sidebar - Collapsible with offset wrapper for desktop */}
          <div className={cn(!isMobile && 'sidebar-offset-wrapper')}>
            {sidebar}
          </div>

          {/* Main Content Area */}
          <SidebarInset className="flex flex-col flex-1 min-w-0 overflow-hidden">
            {/* Header with Breadcrumbs */}
            <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
              <div className="flex items-center gap-2 flex-1">
                <SidebarTrigger />
                <Separator orientation="vertical" className="h-6" />

                {breadcrumbs && breadcrumbs.length > 0 && (
                  <Breadcrumb>
                    <BreadcrumbList>
                      {breadcrumbs.map((crumb, index) => (
                        <React.Fragment key={index}>
                          {index > 0 && <BreadcrumbSeparator />}
                          <BreadcrumbItem>
                            {crumb.href && index < breadcrumbs.length - 1 ? (
                              <BreadcrumbLink href={crumb.href}>
                                {crumb.label}
                              </BreadcrumbLink>
                            ) : (
                              <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                            )}
                          </BreadcrumbItem>
                        </React.Fragment>
                      ))}
                    </BreadcrumbList>
                  </Breadcrumb>
                )}
              </div>

              {/* Header Actions (e.g., Quick Actions, Filters) */}
              {headerActions && (
                <>
                  <Separator orientation="vertical" className="h-6" />
                  <div className="flex items-center gap-2">
                    {headerActions}
                  </div>
                </>
              )}

              {/* Notification Center */}
              <NotificationCenter />
            </header>

            {/* Page Content */}
            <main className={cn('flex-1 min-w-0 min-h-0 overflow-auto relative', isMobile && 'pb-16')}>
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && <MobileNav />}
    </div>
  );
}

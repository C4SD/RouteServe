/**
 * PageLayout Component - Standardized Page Layout Template
 *
 * This component provides a consistent layout structure for all pages in the RouteServe application.
 * It standardizes:
 * - Header font sizes and spacing
 * - Breadcrumb placement
 * - Action button positioning
 * - Content area structure
 *
 * Usage:
 * ```tsx
 * <PageLayout
 *   title="Facilities Management"
 *   subtitle="Manage healthcare facilities and their details"
 *   breadcrumbs={[
 *     { label: 'Storefront', href: '/storefront' },
 *     { label: 'Facilities' }
 *   ]}
 *   actions={
 *     <>
 *       <Button variant="outline">Export</Button>
 *       <Button>Add Facility</Button>
 *     </>
 *   }
 * >
 *   {children}
 * </PageLayout>
 * ```
 */

import React from 'react';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';

// ============================================================================
// Type Definitions
// ============================================================================

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageLayoutProps {
  /**
   * Main page title (displayed as h1)
   */
  title: string;

  /**
   * Optional subtitle or description (displayed as muted text)
   */
  subtitle?: string;

  /**
   * Optional breadcrumb navigation items
   * Last item is automatically non-clickable
   */
  breadcrumbs?: BreadcrumbItem[];

  /**
   * Optional action buttons displayed on the right side
   * Wrap multiple buttons in a fragment
   */
  actions?: React.ReactNode;

  /**
   * Page content
   */
  children: React.ReactNode;

  /**
   * Optional custom className for the container
   */
  className?: string;
}

// ============================================================================
// PageLayout Component
// ============================================================================

export function PageLayout({
  title,
  subtitle,
  breadcrumbs,
  actions,
  children,
  className = '',
}: PageLayoutProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Breadcrumb Navigation (if provided) */}
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

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-muted-foreground">{subtitle}</p>
          )}
        </div>

        {/* Action Buttons */}
        {actions && (
          <div className="flex flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default PageLayout;

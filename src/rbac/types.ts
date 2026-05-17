/**
 * RBAC v2 Type Definitions
 */

export type RbacRole = 'owner' | 'admin' | 'ops_manager' | 'fleet_manager' | 'driver' | 'viewer';

export type Permission =
  // Requisitions
  | 'requisitions.read'
  | 'requisitions.write'
  | 'requisitions.approve'
  // Batches
  | 'batches.read'
  | 'batches.write'
  | 'batches.dispatch'
  // Drivers
  | 'drivers.assign'
  | 'drivers.view_assigned'
  | 'drivers.confirm_delivery'
  | 'drivers.record_discrepancy'
  | 'drivers.record_return'
  // Inventory
  | 'inventory.view'
  | 'inventory.adjust'
  | 'inventory.transfer'
  // Schedule
  | 'schedule.create'
  | 'schedule.review'
  | 'schedule.delete'
  // Invoice
  | 'invoice.process'
  | 'invoice.cancel'
  // Management
  | 'item.manage'
  | 'program.manage'
  | 'facility.manage'
  | 'zone.manage'
  // Reports
  | 'reports.read'
  | 'reports.export'
  // Admin
  | 'admin.users'
  | 'admin.settings'
  | 'workspace.manage';

export interface WorkspaceInfo {
  workspace_id: string;
  name: string;
  slug: string;
  role_code: RbacRole;
  role_name: string;
}

export interface AbilityState {
  role: RbacRole | null;
  permissions: Permission[];
  isLoading: boolean;
  hasError: boolean;
  can: (permission: Permission) => boolean;
  canAny: (...permissions: Permission[]) => boolean;
  canAll: (...permissions: Permission[]) => boolean;
}

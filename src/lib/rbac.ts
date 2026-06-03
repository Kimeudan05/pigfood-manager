// ============================================
// Role-Based Access Control (RBAC)
// ============================================
// Defines what each role can do in the app.
// `can(role, 'permission')` checks legacy coarse permissions.
// `canDo(appUser, 'granularPerm')` checks per-user Firestore overrides
// with role defaults as fallback.

import { UserRole, AppUser, GranularPermissions } from "@/types";

// ---------- Legacy coarse permissions (kept for backward compat) ----------

export interface Permissions {
  /** Can manage (add / remove / change roles of) other users */
  manageUsers: boolean;
  /** Can permanently delete customers or sales records */
  deleteRecords: boolean;
  /** Can view the Reports page */
  viewReports: boolean;
  /** Can create new sales and customer records */
  createRecords: boolean;
  /** Can edit existing sales and customer records */
  editRecords: boolean;
}

const PERMISSION_MATRIX: Record<UserRole, Permissions> = {
  owner: {
    manageUsers: true,
    deleteRecords: true,
    viewReports: true,
    createRecords: true,
    editRecords: true,
  },
  admin: {
    manageUsers: false,
    deleteRecords: true,
    viewReports: true,
    createRecords: true,
    editRecords: true,
  },
  staff: {
    manageUsers: false,
    deleteRecords: false,
    viewReports: false,
    createRecords: true,
    editRecords: false,
  },
};

/**
 * Check if a given role has a specific legacy permission.
 * Safely returns false for null/undefined roles.
 */
export function can(
  role: UserRole | null | undefined,
  permission: keyof Permissions
): boolean {
  if (!role) return false;
  return PERMISSION_MATRIX[role]?.[permission] ?? false;
}

// ---------- Granular permissions per role (defaults) ----------

export const GRANULAR_DEFAULTS: Record<UserRole, GranularPermissions> = {
  owner: {
    canAddCustomers: true,
    canAddSale: true,
    canViewDashboard: true,
    canDeleteSale: true,
    canEditSale: true,
    canEditCustomer: true,
    canApproveUser: true,
  },
  admin: {
    canAddCustomers: true,
    canAddSale: true,
    canViewDashboard: true,
    canDeleteSale: true,
    canEditSale: true,
    canEditCustomer: true,
    canApproveUser: true,
  },
  staff: {
    canAddCustomers: false,
    canAddSale: true,
    canViewDashboard: true,
    canDeleteSale: false,
    canEditSale: false,
    canEditCustomer: false,
    canApproveUser: false,
  },
};

/**
 * Human-readable labels for granular permissions (for the admin UI).
 */
export const GRANULAR_LABELS: Record<keyof GranularPermissions, string> = {
  canAddCustomers: "Can add customers",
  canAddSale: "Can add sale",
  canViewDashboard: "Can view dashboard",
  canDeleteSale: "Can delete sale",
  canEditSale: "Can edit sale",
  canEditCustomer: "Can edit a customer",
  canApproveUser: "Can approve user",
};

/**
 * Check if a user has a specific granular permission.
 * Per-user Firestore overrides take precedence over role defaults.
 */
export function canDo(
  appUser: AppUser | null | undefined,
  perm: keyof GranularPermissions
): boolean {
  if (!appUser) return false;
  // Check per-user override first
  if (appUser.permissions && perm in appUser.permissions) {
    return appUser.permissions[perm] ?? false;
  }
  // Fall back to role default
  return GRANULAR_DEFAULTS[appUser.role]?.[perm] ?? false;
}

/** Human-readable role labels */
export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
};

/** Tailwind colour classes for role badges */
export const ROLE_BADGE_CLASSES: Record<UserRole, string> = {
  owner:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  admin:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  staff:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

/** Tailwind colour classes for status badges */
export const STATUS_BADGE_CLASSES = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

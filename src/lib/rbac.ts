// ============================================
// Role-Based Access Control (RBAC)
// ============================================
// Defines what each role can do in the app.
// Future screens should call `can(role, 'permission')` before
// showing destructive actions or restricted pages.

import { UserRole } from "@/types";

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
 * Check if a given role has a specific permission.
 * Safely returns false for null/undefined roles.
 */
export function can(
  role: UserRole | null | undefined,
  permission: keyof Permissions
): boolean {
  if (!role) return false;
  return PERMISSION_MATRIX[role]?.[permission] ?? false;
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

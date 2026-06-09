// ============================================
// Takataka Pigfood Manager - TypeScript Types
// ============================================

import { Timestamp } from "firebase/firestore";

// ---------- Auth ----------
export type UserRole = 'owner' | 'admin' | 'staff' | 'viewer';
export type UserStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface GranularPermissions {
  // Dashboard
  canViewDashboard: boolean;
  // Customers
  canViewCustomers: boolean;
  canAddCustomers: boolean;
  canEditCustomer: boolean;
  // Sales
  canViewSales: boolean;
  canAddSale: boolean;
  canEditSale: boolean;
  canDeleteSale: boolean;
  // Reports
  canViewReports: boolean;
  // Admin
  canApproveUser: boolean;
}

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: Timestamp;
  permissions?: Partial<GranularPermissions>;
  adminMessage?: string;
  adminMessageRead?: boolean;
  adminNote?: string;
}

// ---------- Customer ----------
export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  location: string;
  notes: string;
  createdAt: Timestamp | Date;
  createdBy: string;
}

export interface CustomerFormData {
  fullName: string;
  phone: string;
  location: string;
  notes: string;
}

// ---------- Sale Items ----------
export interface SaleItems {
  cookedFood: number;
  bread: number;
  meat25: number;
  meat30: number;
  bones: number;    // Bones @ 15 bob
  bones10: number;  // Bones @ 10 bob
  gradeA: number;
  veggies: number;
}

export interface SaleTotals {
  cookedFoodTotal: number;
  breadTotal: number;
  meat25Total: number;
  meat30Total: number;
  bonesTotal: number;   // Bones @ 15
  bones10Total: number; // Bones @ 10
  gradeATotal: number;
  veggiesTotal: number;
  grandTotal: number;
}

// ---------- Sale ----------
export interface Sale extends SaleItems, SaleTotals {
  id: string;
  saleNumber: string;
  customerId: string;
  customerName: string;
  createdBy: string;
  createdAt: Timestamp | Date;
}

export interface SaleFormData extends SaleItems {
  customerId: string;
  customerName: string;
  saleDate?: string;
}

// ---------- Dashboard ----------
export interface DashboardStats {
  totalCustomers: number;
  totalSales: number;
  totalRevenue: number;
  todaySales: number;
  todayRevenue: number;
}

export interface WeeklySummary {
  day: string;
  sales: number;
  revenue: number;
}

export interface MonthlySummary {
  month: string;
  sales: number;
  revenue: number;
}

export interface TopCustomer {
  id: string;
  name: string;
  totalPurchases: number;
  totalSpent: number;
}

// ---------- UI ----------
export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
}

export type ThemeMode = "light" | "dark";

// ---------- Product Config ----------
export interface ProductConfig {
  key: keyof SaleItems;
  label: string;
  price: number;
  totalKey: keyof SaleTotals;
}

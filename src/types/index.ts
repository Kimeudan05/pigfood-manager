// ============================================
// Takataka Pigfood Manager - TypeScript Types
// ============================================

import { Timestamp } from "firebase/firestore";

// ---------- Auth ----------
export type UserRole = 'owner' | 'admin' | 'staff' | 'viewer';
export type UserStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

// ---------- Billing ----------
export type PlanTier = 'basic' | 'standard' | 'pro';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';

export interface Subscription {
  planTier: PlanTier;
  status: SubscriptionStatus;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  currentPeriodEnd: Timestamp;
  cancelAtPeriodEnd: boolean;
}

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
  subscription?: Subscription;
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
  bread25: number;
  meat25: number;
  meat30: number;
  meat40: number;   // Meat @ 40 bob
  bones: number;    // Bones @ 15 bob
  bones10: number;  // Bones @ 10 bob
  gradeA: number;
  veggies: number;
  unga:number;
}

export interface SaleTotals {
  cookedFoodTotal: number;
  breadTotal: number;
  bread25Total: number;
  meat25Total: number;
  meat30Total: number;
  meat40Total: number;  // Meat @ 40
  bonesTotal: number;   // Bones @ 15
  bones10Total: number; // Bones @ 10
  gradeATotal: number;
  veggiesTotal: number;
  ungaTotal: number;
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

// ---------- Receivals ----------
export type ReceivalSource = 'Pigfood Truck' | 'Normal Truck' | 'Conveyor (Local)';

export interface ReceivalFractions {
  cookedFood: number;
  bread: number;
  meat: number;
  bones: number;
  veggies: number;
}

export interface Receival extends ReceivalFractions {
  id: string;
  date: Timestamp | Date;
  source: ReceivalSource;
  truckNumber?: string;
  weightIn?: number;
  weightOut?: number;
  netWeight: number;
  notes?: string;
  createdBy: string;
  createdAt: Timestamp | Date;
}

export interface ReceivalFormData extends ReceivalFractions {
  date: string;
  source: ReceivalSource;
  truckNumber?: string;
  weightIn?: number;
  weightOut?: number;
  netWeight: number;
  notes?: string;
}

// ---------- Reports & Notes ----------
export interface WeeklyNote {
  id: string; // The weekKey, e.g. "2026-07-06"
  note: string;
  createdBy: string;
  updatedAt: Timestamp | Date;
}

export interface WeeklyAgg {
  weekKey: string;     // e.g. "2026-07-06"
  weekLabel: string;   // e.g. "Jul 06"
  timestamp: number;
  salesRevenue: number;
  salesKgs: number;
  receivalsKgs: number;
  pigfoodTruckKgs: number;
  normalTruckKgs: number;
  conveyorKgs: number;
  salesFractions: {
    cookedFood: number;
    bread: number;
    meat: number;
    bones: number;
    veggies: number;
  };
  salesRevenueFractions: {
    cookedFood: number;
    bread: number;
    meat: number;
    bones: number;
    veggies: number;
  };
  receivalFractions: {
    cookedFood: number;
    bread: number;
    meat: number;
    bones: number;
    veggies: number;
  };
}

// ---------- Period Comparison ----------
export interface PeriodAgg {
  label: string;           // e.g. "May 18 – Jun 29"
  startDate: Date;
  endDate: Date;
  salesRevenue: number;
  salesKgs: number;
  receivalsKgs: number;
  pigfoodTruckKgs: number;
  normalTruckKgs: number;
  conveyorKgs: number;
  salesFractions: {
    cookedFood: number;
    bread: number;
    meat: number;
    bones: number;
    veggies: number;
  };
  salesRevenueFractions: {
    cookedFood: number;
    bread: number;
    meat: number;
    bones: number;
    veggies: number;
  };
  receivalFractions: {
    cookedFood: number;
    bread: number;
    meat: number;
    bones: number;
    veggies: number;
  };
}

// ---------- User Sessions ----------
export interface UserSession {
  id: string;
  userId: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  startTime: number;     // epoch ms
  lastActive: number;    // epoch ms
  duration: number;      // in seconds
}


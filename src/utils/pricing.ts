// ============================================
// Pricing Calculator Utility
// ============================================
// Centralized pricing logic for pig food items.
// All prices and calculations defined here for easy maintenance.

import { SaleItems, SaleTotals, ProductConfig } from "@/types";

// Product pricing configuration - single source of truth
export const PRODUCTS: ProductConfig[] = [
  { key: "cookedFood", label: "Cooked Food", price: 20, totalKey: "cookedFoodTotal" },
  { key: "bread", label: "Bread", price: 20, totalKey: "breadTotal" },
  { key: "bread25", label: "Bread @ 25", price: 25, totalKey: "bread25Total" },
  { key: "meat25", label: "Meat @ 25", price: 25, totalKey: "meat25Total" },
  { key: "meat30", label: "Meat @ 30", price: 30, totalKey: "meat30Total" },
  { key: "meat40", label: "Meat @ 40", price: 40, totalKey: "meat40Total" },
  { key: "bones", label: "Bones @ 15", price: 15, totalKey: "bonesTotal" },
  { key: "bones10", label: "Bones @ 10", price: 10, totalKey: "bones10Total" },
  { key: "bones13", label: "Bones @ 13", price: 13, totalKey: "bones13Total" },
  { key: "gradeA", label: "Grade A", price: 5, totalKey: "gradeATotal" },
  { key: "veggies", label: "Veggies", price: 6, totalKey: "veggiesTotal" },
  { key: "unga", label: "Dryfood / Unga @ 20", price: 20, totalKey: "ungaTotal" },
  { key: "BSF", label: "BSF", price: 3.5, totalKey: "BSFTotal" },
];

/**
 * Group definitions used in reports to combine related products.
 * Each group has a label, a colour, and the keys of PRODUCTS it aggregates.
 */
export const PRODUCT_GROUPS = [
  {
    key: "meat",
    label: "Meat",
    color: "#8b5cf6",
    members: ["meat25", "meat30", "meat40"] as const,
  },
  {
    key: "bones",
    label: "Bones",
    color: "#f59e0b",
    members: ["bones", "bones10"] as const,
  },
  {
    key: "bread",
    label: "Bread",
    color: "#ec4899",
    members: ["bread", "bread25"] as const,
  },
] as const;

/** Calculate totals for each item and the grand total */
export function calculateTotals(items: SaleItems): SaleTotals {
  const cookedFoodTotal = (items.cookedFood ?? 0) * 20;
  const breadTotal = (items.bread ?? 0) * 20;
  const bread25Total = (items.bread25 ?? 0) * 25;
  const meat25Total = (items.meat25 ?? 0) * 25;
  const meat30Total = (items.meat30 ?? 0) * 30;
  const meat40Total = (items.meat40 ?? 0) * 40;
  const bonesTotal = (items.bones ?? 0) * 15;
  const bones10Total = (items.bones10 ?? 0) * 10;
  const bones13Total = (items.bones13 ?? 0) * 13;
  const gradeATotal = (items.gradeA ?? 0) * 5;
  const veggiesTotal = (items.veggies ?? 0) * 6;
  const BSFTotal = (items.BSF ?? 0) * 3.5;
  const ungaTotal = (items.unga ?? 0) * 20;

  const grandTotal =
    cookedFoodTotal +
    breadTotal +
    bread25Total +
    meat25Total +
    meat30Total +
    meat40Total +
    bonesTotal +
    bones10Total +
    bones13Total +
    gradeATotal +
    veggiesTotal +
    BSFTotal +
    ungaTotal;

  return {
    cookedFoodTotal,
    breadTotal,
    bread25Total,
    meat25Total,
    meat30Total,
    meat40Total,
    bonesTotal,
    bones10Total,
    bones13Total,
    gradeATotal,
    veggiesTotal,
    ungaTotal,
    BSFTotal,
    grandTotal,
  };
}

/** Get the default empty sale items (all quantities at 0) */
export function getEmptySaleItems(): SaleItems {
  return {
    cookedFood: 0,
    bread: 0,
    bread25: 0,
    meat25: 0,
    meat30: 0,
    meat40: 0,
    bones: 0,
    bones10: 0,
    bones13: 0,
    gradeA: 0,
    veggies: 0,
    BSF: 0,
    unga: 0,
  };
}

/**
 * @deprecated — use generateSaleNumber(tenantSlug) instead.
 * Generate a unique sale number based on timestamp using the legacy "TK" prefix.
 */
export function generateSaleNumberLegacy(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `TK-${year}${month}${day}-${random}`;
}

/**
 * Generate a unique sale number scoped to the given tenant.
 *
 * Pattern: `{TENANT_PREFIX}-{YYMMDD}-{4-digit-random}`
 *
 * - `TENANT_PREFIX` = first 4 characters of `tenantSlug` uppercased.
 *   If the slug is shorter than 4 characters it is padded with 'X' on the
 *   right to reach exactly 4 characters (e.g. "abc" → "ABCX").
 * - `YYMMDD`        = 2-digit year + 2-digit month + 2-digit day (e.g. "250714").
 * - `4-digit-random` = random integer in [1000, 9999].
 *
 * _Requirements: 5.10_
 */
export function generateSaleNumber(tenantSlug: string): string {
  const raw = tenantSlug.slice(0, 4).toUpperCase();
  const prefix = raw.padEnd(4, "X");

  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");

  const random = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}-${year}${month}${day}-${random}`;
}

/**
 * Calculate the grand total for a sale from an array of line items.
 * Result is rounded to 2 decimal places using banker-safe arithmetic.
 *
 * Formula: Math.round(sum(quantity_i × unitPrice_i) × 100) / 100
 *
 * _Requirements: 5.9, Property 10_
 */
export function calculateGrandTotal(
  lines: Array<{ quantity: number; unitPrice: number }>
): number {
  const raw = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  return Math.round(raw * 100) / 100;
}

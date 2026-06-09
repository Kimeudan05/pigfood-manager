// ============================================
// Pricing Calculator Utility
// ============================================
// Centralized pricing logic for pig food items.
// All prices and calculations defined here for easy maintenance.

import { SaleItems, SaleTotals, ProductConfig } from "@/types";

// Product pricing configuration - single source of truth
export const PRODUCTS: ProductConfig[] = [
  { key: "cookedFood", label: "Cooked Food",  price: 20, totalKey: "cookedFoodTotal" },
  { key: "bread",      label: "Bread",         price: 20, totalKey: "breadTotal"      },
  { key: "meat25",     label: "Meat @ 25",     price: 25, totalKey: "meat25Total"     },
  { key: "meat30",     label: "Meat @ 30",     price: 30, totalKey: "meat30Total"     },
  { key: "bones",      label: "Bones @ 15",    price: 15, totalKey: "bonesTotal"      },
  { key: "bones10",    label: "Bones @ 10",    price: 10, totalKey: "bones10Total"    },
  { key: "gradeA",     label: "Grade A",       price: 5,  totalKey: "gradeATotal"     },
  { key: "veggies",    label: "Veggies",       price: 6,  totalKey: "veggiesTotal"    },
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
    members: ["meat25", "meat30"] as const,
  },
  {
    key: "bones",
    label: "Bones",
    color: "#f59e0b",
    members: ["bones", "bones10"] as const,
  },
] as const;

/** Calculate totals for each item and the grand total */
export function calculateTotals(items: SaleItems): SaleTotals {
  const cookedFoodTotal = (items.cookedFood ?? 0) * 20;
  const breadTotal      = (items.bread      ?? 0) * 20;
  const meat25Total     = (items.meat25     ?? 0) * 25;
  const meat30Total     = (items.meat30     ?? 0) * 30;
  const bonesTotal      = (items.bones      ?? 0) * 15;
  const bones10Total    = (items.bones10    ?? 0) * 10;
  const gradeATotal     = (items.gradeA     ?? 0) * 5;
  const veggiesTotal    = (items.veggies    ?? 0) * 6;

  const grandTotal =
    cookedFoodTotal +
    breadTotal      +
    meat25Total     +
    meat30Total     +
    bonesTotal      +
    bones10Total    +
    gradeATotal     +
    veggiesTotal;

  return {
    cookedFoodTotal,
    breadTotal,
    meat25Total,
    meat30Total,
    bonesTotal,
    bones10Total,
    gradeATotal,
    veggiesTotal,
    grandTotal,
  };
}

/** Get the default empty sale items (all quantities at 0) */
export function getEmptySaleItems(): SaleItems {
  return {
    cookedFood: 0,
    bread:      0,
    meat25:     0,
    meat30:     0,
    bones:      0,
    bones10:    0,
    gradeA:     0,
    veggies:    0,
  };
}

/** Generate a unique sale number based on timestamp */
export function generateSaleNumber(): string {
  const now = new Date();
  const year   = now.getFullYear().toString().slice(-2);
  const month  = (now.getMonth() + 1).toString().padStart(2, "0");
  const day    = now.getDate().toString().padStart(2, "0");
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `TK-${year}${month}${day}-${random}`;
}

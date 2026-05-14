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
  { key: "meat25", label: "Meat @ 25", price: 25, totalKey: "meat25Total" },
  { key: "meat30", label: "Meat @ 30", price: 30, totalKey: "meat30Total" },
  { key: "bones", label: "Bones", price: 15, totalKey: "bonesTotal" },
  { key: "gradeA", label: "Grade A", price: 5, totalKey: "gradeATotal" },
  { key: "veggies", label: "Veggies", price: 6, totalKey: "veggiesTotal" },
];

/** Calculate totals for each item and the grand total */
export function calculateTotals(items: SaleItems): SaleTotals {
  const cookedFoodTotal = items.cookedFood * 20;
  const breadTotal = items.bread * 20;
  const meat25Total = items.meat25 * 25;
  const meat30Total = items.meat30 * 30;
  const bonesTotal = items.bones * 15;
  const gradeATotal = items.gradeA * 5;
  const veggiesTotal = items.veggies * 6;

  const grandTotal =
    cookedFoodTotal +
    breadTotal +
    meat25Total +
    meat30Total +
    bonesTotal +
    gradeATotal +
    veggiesTotal;

  return {
    cookedFoodTotal,
    breadTotal,
    meat25Total,
    meat30Total,
    bonesTotal,
    gradeATotal,
    veggiesTotal,
    grandTotal,
  };
}

/** Get the default empty sale items (all quantities at 0) */
export function getEmptySaleItems(): SaleItems {
  return {
    cookedFood: 0,
    bread: 0,
    meat25: 0,
    meat30: 0,
    bones: 0,
    gradeA: 0,
    veggies: 0,
  };
}

/** Generate a unique sale number based on timestamp */
export function generateSaleNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `TK-${year}${month}${day}-${random}`;
}

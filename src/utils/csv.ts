// ============================================
// CSV Export Utility
// ============================================

import { Sale } from "@/types";
import { formatDate, formatCurrency } from "./formatters";

/** Convert sales data to CSV string */
export function salesToCSV(sales: Sale[]): string {
  const headers = [
    "Sale Number",
    "Customer",
    "Date",
    "Cooked Food (Qty)",
    "Cooked Food (Total)",
    "Bread (Qty)",
    "Bread (Total)",
    "Meat@25 (Qty)",
    "Meat@25 (Total)",
    "Meat@30 (Qty)",
    "Meat@30 (Total)",
    "Bones (Qty)",
    "Bones (Total)",
    "Grade A (Qty)",
    "Grade A (Total)",
    "Veggies (Qty)",
    "Veggies (Total)",
    "Grand Total",
  ];

  const rows = sales.map((sale) => [
    sale.saleNumber,
    sale.customerName,
    formatDate(sale.createdAt),
    sale.cookedFood,
    sale.cookedFoodTotal,
    sale.bread,
    sale.breadTotal,
    sale.meat25,
    sale.meat25Total,
    sale.meat30,
    sale.meat30Total,
    sale.bones,
    sale.bonesTotal,
    sale.gradeA,
    sale.gradeATotal,
    sale.veggies,
    sale.veggiesTotal,
    sale.grandTotal,
  ]);

  const csv = [
    headers.join(","),
    ...rows.map((row) => row.map((val) => `"${val}"`).join(",")),
  ].join("\n");

  return csv;
}

/** Download CSV file to the user's device */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

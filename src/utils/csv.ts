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
    "Bones@15 (Qty)",
    "Bones@15 (Total)",
    "Bones@10 (Qty)",
    "Bones@10 (Total)",
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
    sale.cookedFood   || 0,
    sale.cookedFoodTotal || 0,
    sale.bread        || 0,
    sale.breadTotal   || 0,
    sale.meat25       || 0,
    sale.meat25Total  || 0,
    sale.meat30       || 0,
    sale.meat30Total  || 0,
    sale.bones        || 0,
    sale.bonesTotal   || 0,
    sale.bones10      || 0,
    sale.bones10Total || 0,
    sale.gradeA       || 0,
    sale.gradeATotal  || 0,
    sale.veggies      || 0,
    sale.veggiesTotal || 0,
    sale.grandTotal   || 0,
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

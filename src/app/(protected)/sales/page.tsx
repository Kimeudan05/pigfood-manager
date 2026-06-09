"use client";
import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { getAllSales, deleteSale } from "@/lib/firestore";
import { Sale } from "@/types";
import { formatDate, formatCurrency, toDate } from "@/utils/formatters";
import { PageSpinner } from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import { ConfirmModal } from "@/components/ui/Modal";
import { canDo } from "@/lib/rbac";
import { Plus, Search, Trash2, ShoppingCart, Filter, Printer, ChevronLeft, ChevronRight, Pencil, Lock } from "lucide-react";

const PER_PAGE = 12;

export default function SalesPage() {
  const { appUser } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();

  const canViewSales = canDo(appUser, "canViewSales");
  const canAdd       = canDo(appUser, "canAddSale");
  const canEdit      = canDo(appUser, "canEditSale");
  const canDelete    = canDo(appUser, "canDeleteSale");

  function denyToast(action: string) {
    addToast("warning", `🔒 You don't have permission to ${action}. Contact your admin.`);
  }
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);
  const [delTarget, setDelTarget] = useState<Sale | null>(null);
  const [delLoading, setDelLoading] = useState(false);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);

  // Guard + load: wait for appUser to resolve before making any Firestore reads.
  // This prevents a permission-denied error for viewers before the redirect fires.
  async function load() {
    try { setSales(await getAllSales()); } catch { addToast("error", "Failed to load sales"); } finally { setLoading(false); }
  }

  useEffect(() => {
    if (!appUser) return; // still loading auth — wait
    if (!canViewSales) {
      router.replace("/dashboard");
      return;
    }
    load();
  }, [appUser]);

  const filtered = useMemo(() => {
    let result = sales;
    if (search) {
      const t = search.toLowerCase();
      result = result.filter(s => s.customerName.toLowerCase().includes(t) || s.saleNumber.toLowerCase().includes(t));
    }
    if (dateFilter) {
      result = result.filter(s => {
        if (!s.createdAt) return false;
        const d = toDate(s.createdAt);
        return d.toISOString().slice(0, 10) === dateFilter;
      });
    }
    return result;
  }, [sales, search, dateFilter]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  useEffect(() => { setPage(1); }, [search, dateFilter]);

  async function handleDelete() {
    if (!delTarget) return;
    if (!canDelete) { denyToast("delete sales"); setDelTarget(null); return; }
    setDelLoading(true);
    try { await deleteSale(delTarget.id); addToast("success", "Sale deleted"); setDelTarget(null); await load(); }
    catch { addToast("error", "Delete failed"); } finally { setDelLoading(false); }
  }

  function printReceipt(sale: Sale) {
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    const items = [
      { label: "Cooked Food", qty: sale.cookedFood, total: sale.cookedFoodTotal, price: 20 },
      { label: "Bread", qty: sale.bread, total: sale.breadTotal, price: 20 },
      { label: "Meat @25", qty: sale.meat25, total: sale.meat25Total, price: 25 },
      { label: "Meat @30", qty: sale.meat30, total: sale.meat30Total, price: 30 },
      { label: "Bones", qty: sale.bones, total: sale.bonesTotal, price: 15 },
      { label: "Grade A", qty: sale.gradeA, total: sale.gradeATotal, price: 5 },
      { label: "Veggies", qty: sale.veggies, total: sale.veggiesTotal, price: 6 },
    ].filter(i => i.qty > 0);

    w.document.write(`<!DOCTYPE html><html><head><title>Receipt</title><style>
      body{font-family:monospace;padding:20px;max-width:350px;margin:0 auto}
      h2{text-align:center;margin:0}p.sub{text-align:center;font-size:12px;color:#666}
      hr{border:none;border-top:1px dashed #ccc;margin:12px 0}
      .row{display:flex;justify-content:space-between;font-size:13px;margin:4px 0}
      .total{font-weight:bold;font-size:15px;border-top:2px solid #000;padding-top:8px;margin-top:8px}
      .footer{text-align:center;font-size:11px;color:#999;margin-top:20px}
      @media print{button{display:none}}
    </style></head><body>
      <h2>🐷 Takataka Pigfood</h2><p class="sub">Sales Receipt</p><hr>
      <div class="row"><span>Sale #:</span><span>${sale.saleNumber}</span></div>
      <div class="row"><span>Customer:</span><span>${sale.customerName}</span></div>
      <div class="row"><span>Date:</span><span>${formatDate(sale.createdAt)}</span></div><hr>
      ${items.map(i => `<div class="row"><span>${i.label} x${i.qty} @${i.price}</span><span>KES ${i.total}</span></div>`).join("")}
      <div class="row total"><span>GRAND TOTAL</span><span>KES ${sale.grandTotal}</span></div><hr>
      <p class="footer">Thank you for your business!</p>
      <button onclick="window.print()" style="width:100%;padding:8px;margin-top:12px;cursor:pointer">Print</button>
    </body></html>`);
    w.document.close();
  }

  if (loading) return <PageSpinner />;
  if (!canViewSales) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{sales.length} total sales</p>
        </div>
        {canAdd ? (
          <Link href="/sales/new" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 transition-all">
            <Plus className="h-4 w-4" /> New Sale
          </Link>
        ) : (
          <button
            onClick={() => denyToast("add sales")}
            className="inline-flex items-center gap-2 rounded-xl bg-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500"
            title="Permission required"
          >
            <Lock className="h-4 w-4" /> New Sale
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Search customer or sale #..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white transition-all" />
        </div>
        <div className="relative">
          <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white transition-all" />
        </div>
        {dateFilter && <button onClick={() => setDateFilter("")} className="text-xs text-red-500 hover:text-red-400 self-center">Clear date</button>}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ShoppingCart className="h-10 w-10 text-emerald-400" />} title={search || dateFilter ? "No matching sales" : "No sales yet"} description="Create a sale to see it here" />
      ) : (
        <>
          <div className="hidden md:block rounded-2xl border border-gray-200 bg-white overflow-hidden dark:border-gray-700/50 dark:bg-gray-800/50">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50">
                <th className="px-5 py-3.5 text-left text-xs font-medium text-gray-500">Sale #</th>
                <th className="px-5 py-3.5 text-left text-xs font-medium text-gray-500">Customer</th>
                <th className="px-5 py-3.5 text-left text-xs font-medium text-gray-500">Date</th>
                <th className="px-5 py-3.5 text-right text-xs font-medium text-gray-500">Total</th>
                <th className="px-5 py-3.5 text-right text-xs font-medium text-gray-500">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/30">
                {paginated.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-600 dark:text-gray-300">{s.saleNumber}</td>
                    <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">{s.customerName}</td>
                    <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">{formatDate(s.createdAt)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(s.grandTotal)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => printReceipt(s)} className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors" title="Print receipt"><Printer className="h-4 w-4" /></button>
                        {canEdit ? (
                          <a href={`/sales/${s.id}/edit`} className="rounded-lg p-2 text-gray-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/20 dark:hover:text-amber-400 transition-colors" title="Edit sale"><Pencil className="h-4 w-4" /></a>
                        ) : (
                          <button onClick={() => denyToast("edit sales")} className="rounded-lg p-2 text-gray-200 dark:text-gray-700 cursor-not-allowed" title="Permission required"><Lock className="h-4 w-4" /></button>
                        )}
                        {canDelete ? (
                          <button onClick={() => setDelTarget(s)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors" title="Delete"><Trash2 className="h-4 w-4" /></button>
                        ) : (
                          <button onClick={() => denyToast("delete sales")} className="rounded-lg p-2 text-gray-200 dark:text-gray-700 cursor-not-allowed" title="Permission required"><Trash2 className="h-4 w-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {paginated.map(s => (
              <div key={s.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700/50 dark:bg-gray-800/50">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{s.customerName}</p>
                    <p className="text-xs text-gray-500 font-mono">{s.saleNumber}</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(s.grandTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{formatDate(s.createdAt)}</span>
                  <div className="flex gap-1">
                    <button onClick={() => printReceipt(s)} className="p-1.5 text-gray-400 hover:text-blue-600"><Printer className="h-4 w-4" /></button>
                    {canEdit ? (
                      <a href={`/sales/${s.id}/edit`} className="p-1.5 text-gray-400 hover:text-amber-600"><Pencil className="h-4 w-4" /></a>
                    ) : (
                      <button onClick={() => denyToast("edit sales")} className="p-1.5 text-gray-200 dark:text-gray-700 cursor-not-allowed"><Lock className="h-4 w-4" /></button>
                    )}
                    {canDelete ? (
                      <button onClick={() => setDelTarget(s)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    ) : (
                      <button onClick={() => denyToast("delete sales")} className="p-1.5 text-gray-200 dark:text-gray-700 cursor-not-allowed"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmModal isOpen={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={handleDelete} title="Delete Sale"
        message={`Delete sale "${delTarget?.saleNumber}" for ${delTarget?.customerName}?`} confirmLabel="Delete" loading={delLoading} />
    </div>
  );
}

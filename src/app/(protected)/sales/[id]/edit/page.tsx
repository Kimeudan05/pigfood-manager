"use client";
import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { getAllCustomers, getSale, updateSale } from "@/lib/firestore";
import { Customer, Sale, SaleFormData, SaleItems } from "@/types";
import { PRODUCTS, calculateTotals } from "@/utils/pricing";
import { formatCurrency, formatDate, toDate } from "@/utils/formatters";
import { PageSpinner } from "@/components/ui/Spinner";
import Spinner from "@/components/ui/Spinner";
import { ArrowLeft, ShoppingCart, Minus, Plus } from "lucide-react";
import Link from "next/link";

export default function EditSalePage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const params = useParams();
  const saleId = params.id as string;

  const [sale, setSale] = useState<Sale | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<SaleItems>({
    cookedFood: 0, bread: 0, meat25: 0, meat30: 0, bones: 0, gradeA: 0, veggies: 0,
  });

  useEffect(() => {
    Promise.all([getSale(saleId), getAllCustomers()])
      .then(([s, c]) => {
        if (!s) { addToast("error", "Sale not found"); router.push("/sales"); return; }
        setSale(s);
        setCustomers(c);
        setItems({
          cookedFood: s.cookedFood,
          bread: s.bread,
          meat25: s.meat25,
          meat30: s.meat30,
          bones: s.bones,
          gradeA: s.gradeA,
          veggies: s.veggies,
        });
      })
      .catch(() => addToast("error", "Failed to load sale"))
      .finally(() => setLoading(false));
  }, [saleId]);

  const totals = useMemo(() => calculateTotals(items), [items]);

  function updateQty(key: keyof SaleItems, delta: number) {
    setItems(prev => ({ ...prev, [key]: Math.max(0, prev[key] + delta) }));
  }

  function setQty(key: keyof SaleItems, value: string) {
    const num = parseInt(value) || 0;
    setItems(prev => ({ ...prev, [key]: Math.max(0, num) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sale) return;
    if (totals.grandTotal === 0) { addToast("warning", "Add at least one item"); return; }

    const data: SaleFormData = {
      customerId: sale.customerId,
      customerName: sale.customerName,
      ...items,
    };

    setSaving(true);
    try {
      await updateSale(saleId, data);
      addToast("success", "Sale updated successfully!");
      router.push("/sales");
    } catch {
      addToast("error", "Failed to update sale");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageSpinner />;
  if (!sale) return null;

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <Link href="/sales" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Sales
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Sale</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Sale #{sale.saleNumber} &middot; {sale.customerName} &middot; {formatDate(sale.createdAt)}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sale Info (read-only) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50">
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">Customer</label>
            <p className="rounded-xl border border-gray-200 bg-gray-50 py-3 px-4 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {sale.customerName}
            </p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">Sale Date</label>
            <p className="rounded-xl border border-gray-200 bg-gray-50 py-3 px-4 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {formatDate(sale.createdAt)}
            </p>
          </div>
        </div>

        {/* Items Grid */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Items &amp; Quantities</h2>
          <div className="space-y-3">
            {PRODUCTS.map(product => {
              const qty = items[product.key];
              const itemTotal = (totals as unknown as Record<string, number>)[product.totalKey] || 0;
              return (
                <div key={product.key} className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-700/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{product.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">@ KES {product.price} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQty(product.key, -1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500 transition-colors disabled:opacity-30"
                      disabled={qty === 0}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={qty}
                      onChange={e => setQty(product.key, e.target.value)}
                      className="w-16 rounded-lg border border-gray-300 bg-white py-1.5 text-center text-sm font-medium text-gray-900 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => updateQty(product.key, 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="w-24 text-right">
                    <p className={`text-sm font-semibold ${itemTotal > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-300 dark:text-gray-600"}`}>
                      {formatCurrency(itemTotal)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Grand Total */}
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                <ShoppingCart className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">Grand Total</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(totals.grandTotal)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link href="/sales" className="rounded-xl px-5 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 transition-colors">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 disabled:opacity-50 transition-all"
          >
            {saving ? <Spinner size="sm" /> : <><ShoppingCart className="h-4 w-4" /> Save Changes</>}
          </button>
        </div>
      </form>
    </div>
  );
}

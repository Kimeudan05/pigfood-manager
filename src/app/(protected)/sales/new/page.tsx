"use client";
import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { getAllCustomers, getAllSales, addSale } from "@/lib/firestore";
import { Customer, Sale, SaleFormData, SaleItems } from "@/types";
import { PRODUCTS, calculateTotals, getEmptySaleItems } from "@/utils/pricing";
import { formatCurrency, formatDate, toDate } from "@/utils/formatters";
import { PageSpinner } from "@/components/ui/Spinner";
import Spinner from "@/components/ui/Spinner";
import { ConfirmModal } from "@/components/ui/Modal";
import { ArrowLeft, ShoppingCart, Minus, Plus, UserPlus } from "lucide-react";
import Link from "next/link";

export default function NewSalePage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(searchParams.get("customerId") || "");
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [items, setItems] = useState<SaleItems>(getEmptySaleItems());
  const [customerSearch, setCustomerSearch] = useState(searchParams.get("customerName") || "");
  const [showDropdown, setShowDropdown] = useState(false);

  // Duplicate-day confirmation
  const [showDupConfirm, setShowDupConfirm] = useState(false);
  const [dupSale, setDupSale] = useState<Sale | null>(null);
  const [pendingData, setPendingData] = useState<SaleFormData | null>(null);

  useEffect(() => {
    Promise.all([getAllCustomers(), getAllSales()])
      .then(([c, s]) => { setCustomers(c); setSales(s); })
      .catch(() => addToast("error", "Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  // Auto-select customer from URL params
  useEffect(() => {
    const cid = searchParams.get("customerId");
    if (cid) setSelectedCustomerId(cid);
  }, [searchParams]);

  const totals = useMemo(() => calculateTotals(items), [items]);
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  function updateQty(key: keyof SaleItems, delta: number) {
    setItems(prev => ({ ...prev, [key]: Math.max(0, prev[key] + delta) }));
  }

  function setQty(key: keyof SaleItems, value: string) {
    const num = parseInt(value) || 0;
    setItems(prev => ({ ...prev, [key]: Math.max(0, num) }));
  }

  async function doSave(data: SaleFormData) {
    setSaving(true);
    try {
      await addSale(data, user!.uid);
      addToast("success", "Sale recorded successfully!");
      router.push("/sales");
    } catch {
      addToast("error", "Failed to save sale");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomerId) { addToast("warning", "Please select a customer"); return; }
    if (totals.grandTotal === 0) { addToast("warning", "Add at least one item"); return; }

    const data: SaleFormData = {
      customerId: selectedCustomerId,
      customerName: selectedCustomer?.fullName || "",
      saleDate,
      ...items,
    };

    // Check for existing sale for the same customer on the same day
    const duplicate = sales.find(s => {
      if (s.customerId !== selectedCustomerId) return false;
      if (!s.createdAt) return false;
      const sDay = toDate(s.createdAt).toISOString().slice(0, 10);
      return sDay === saleDate;
    });

    if (duplicate) {
      setPendingData(data);
      setDupSale(duplicate);
      setShowDupConfirm(true);
      return;
    }

    await doSave(data);
  }

  async function handleDupConfirm() {
    if (!pendingData) return;
    setShowDupConfirm(false);
    await doSave(pendingData);
  }

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <Link href="/sales" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Sales
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Sale</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Enter quantities for each item</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sale Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50">
          <div className="relative">
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">Select Customer *</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center opacity-60">
                <img src="/pig-icon.png" alt="Search" className="h-full w-full object-contain" />
              </div>
              <input
                type="text"
                placeholder="Search customer..."
                value={customerSearch}
                onChange={e => { setCustomerSearch(e.target.value); setShowDropdown(true); setSelectedCustomerId(""); }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                className="w-full rounded-xl border border-gray-300 bg-gray-50 py-3 pl-10 pr-4 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white transition-all"
              />
            </div>

            {showDropdown && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                {customers
                  .filter(c => c.fullName.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone?.includes(customerSearch))
                  .map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setSelectedCustomerId(c.id); setCustomerSearch(c.fullName); setShowDropdown(false); }}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${selectedCustomerId === c.id ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium" : "text-gray-700 dark:text-gray-300"}`}
                    >
                      {c.fullName} {c.location ? `(${c.location})` : ""}
                    </button>
                  ))}
                {customers.filter(c => c.fullName.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone?.includes(customerSearch)).length === 0 && (
                  <Link href="/customers" className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-emerald-600 rounded-lg hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30">
                    <UserPlus className="h-4 w-4" /> Customer not found. Click to add.
                  </Link>
                )}
              </div>
            )}
            {selectedCustomerId && !showDropdown && (
              <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Selected: {customers.find(c => c.id === selectedCustomerId)?.fullName}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">Sale Date</label>
            <input
              type="date"
              value={saleDate}
              onChange={e => setSaleDate(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-gray-50 py-3 px-4 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white transition-all"
              required
            />
          </div>
        </div>

        {/* Items Grid */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Items & Quantities</h2>
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
            {saving ? <Spinner size="sm" /> : <><ShoppingCart className="h-4 w-4" /> Record Sale</>}
          </button>
        </div>
      </form>

      {/* ── Duplicate-day Confirmation Modal ── */}
      <ConfirmModal
        isOpen={showDupConfirm}
        onClose={() => { setShowDupConfirm(false); setPendingData(null); setDupSale(null); }}
        onConfirm={handleDupConfirm}
        title="Duplicate Sale for This Day?"
        message={`${selectedCustomer?.fullName ?? "This customer"} already has a sale on ${saleDate} (Sale #${dupSale?.saleNumber ?? ""}). A customer can pay 2 receipts for the day — do you want to add another sale anyway?`}
        confirmLabel="Add Anyway"
        confirmVariant="primary"
        loading={saving}
      />
    </div>
  );
}

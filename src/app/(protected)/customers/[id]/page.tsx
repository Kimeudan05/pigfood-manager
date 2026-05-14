"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getCustomer, getCustomerSales } from "@/lib/firestore";
import { Customer, Sale } from "@/types";
import { formatDate, formatCurrency } from "@/utils/formatters";
import { PageSpinner } from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import { ArrowLeft, Phone, MapPin, StickyNote, ShoppingCart, Calendar } from "lucide-react";

export default function CustomerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [c, s] = await Promise.all([getCustomer(id), getCustomerSales(id)]);
        setCustomer(c);
        setSales(s);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    load();
  }, [id]);

  if (loading) return <PageSpinner />;
  if (!customer) return <EmptyState title="Customer not found" description="This customer may have been deleted." />;

  const totalSpent = sales.reduce((sum, s) => sum + (s.grandTotal || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <Link href="/customers" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Customers
      </Link>

      {/* Customer Info Card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700/50 dark:bg-gray-800/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{customer.fullName}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Customer since {formatDate(customer.createdAt)}</p>
          </div>
          <Link href={`/sales/new?customerId=${id}&customerName=${encodeURIComponent(customer.fullName)}`}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-all">
            <ShoppingCart className="h-4 w-4" /> New Sale
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-700/30">
            <Phone className="h-5 w-5 text-emerald-500" />
            <div><p className="text-xs text-gray-500 dark:text-gray-400">Phone</p><p className="text-sm font-medium text-gray-900 dark:text-white">{customer.phone || "—"}</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-700/30">
            <MapPin className="h-5 w-5 text-blue-500" />
            <div><p className="text-xs text-gray-500 dark:text-gray-400">Location</p><p className="text-sm font-medium text-gray-900 dark:text-white">{customer.location || "—"}</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-700/30">
            <ShoppingCart className="h-5 w-5 text-purple-500" />
            <div><p className="text-xs text-gray-500 dark:text-gray-400">Purchases</p><p className="text-sm font-medium text-gray-900 dark:text-white">{sales.length}</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-700/30">
            <Calendar className="h-5 w-5 text-amber-500" />
            <div><p className="text-xs text-gray-500 dark:text-gray-400">Total Spent</p><p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalSpent)}</p></div>
          </div>
        </div>

        {customer.notes && (
          <div className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 p-3 dark:bg-amber-900/10">
            <StickyNote className="h-5 w-5 text-amber-500 mt-0.5" />
            <div><p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Notes</p><p className="text-sm text-gray-700 dark:text-gray-300">{customer.notes}</p></div>
          </div>
        )}
      </div>

      {/* Purchase History */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700/50 dark:bg-gray-800/50 overflow-hidden">
        <div className="p-5"><h2 className="text-lg font-semibold text-gray-900 dark:text-white">Purchase History</h2></div>
        {sales.length === 0 ? (
          <div className="px-5 pb-8"><EmptyState title="No purchases yet" description="Sales for this customer will appear here" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Sale #</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Date</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Items</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Total</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/30">
                {sales.map(s => {
                  const items = [s.cookedFood && `Food:${s.cookedFood}`, s.bread && `Bread:${s.bread}`, s.meat25 && `M25:${s.meat25}`, s.meat30 && `M30:${s.meat30}`, s.bones && `Bones:${s.bones}`, s.gradeA && `GA:${s.gradeA}`, s.veggies && `Veg:${s.veggies}`].filter(Boolean).join(", ");
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20">
                      <td className="px-5 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">{s.saleNumber}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{formatDate(s.createdAt)}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300 max-w-xs truncate">{items || "—"}</td>
                      <td className="px-5 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(s.grandTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

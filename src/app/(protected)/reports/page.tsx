"use client";
import React, { useEffect, useState, useMemo } from "react";
import { useToast } from "@/contexts/ToastContext";
import { getAllSales } from "@/lib/firestore";
import { Sale } from "@/types";
import { formatCurrency, formatDate, toDate } from "@/utils/formatters";
import { PRODUCTS } from "@/utils/pricing";
import { salesToCSV, downloadCSV } from "@/utils/csv";
import { PageSpinner } from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import { BarChart3, Download, Calendar, TrendingUp, Package } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";

const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

export default function ReportsPage() {
  const { addToast } = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterMode, setFilterMode] = useState<"range" | "single">("range");
  const [singleDate, setSingleDate] = useState("");

  useEffect(() => {
    getAllSales().then(setSales).catch(() => addToast("error", "Failed to load sales")).finally(() => setLoading(false));
  }, []);

  const filteredSales = useMemo(() => {
    if (filterMode === "single") {
      if (!singleDate) return sales;
      return sales.filter(s => {
        if (!s.createdAt) return false;
        const d = toDate(s.createdAt);
        const start = startOfDay(new Date(singleDate));
        const end = endOfDay(new Date(singleDate));
        return isWithinInterval(d, { start, end });
      });
    }

    if (!startDate && !endDate) return sales;
    return sales.filter(s => {
      if (!s.createdAt) return false;
      const d = toDate(s.createdAt);
      const start = startDate ? startOfDay(new Date(startDate)) : new Date(0);
      const end = endDate ? endOfDay(new Date(endDate)) : new Date(9999, 11, 31);
      return isWithinInterval(d, { start, end });
    });
  }, [sales, filterMode, startDate, endDate, singleDate]);

  // Daily breakdown for the filtered period
  const dailyData = useMemo(() => {
    const map = new Map<string, { day: string; sales: number; revenue: number }>();
    filteredSales.forEach(s => {
      if (!s.createdAt) return;
      const key = format(toDate(s.createdAt), "yyyy-MM-dd");
      const label = format(toDate(s.createdAt), "MMM dd");
      const existing = map.get(key) || { day: label, sales: 0, revenue: 0 };
      existing.sales += 1;
      existing.revenue += s.grandTotal || 0;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day)).slice(-30);
  }, [filteredSales]);

  // Product distribution
  const productData = useMemo(() => {
    return PRODUCTS.map((p, i) => ({
      name: p.label,
      value: filteredSales.reduce((sum, s) => sum + (s[p.key] || 0), 0),
      color: COLORS[i % COLORS.length],
    })).filter(p => p.value > 0);
  }, [filteredSales]);

  // Top Customers by Spending
  const topCustomersData = useMemo(() => {
    const map = new Map<string, { name: string; spent: number }>();
    filteredSales.forEach(s => {
      const existing = map.get(s.customerId) || { name: s.customerName, spent: 0 };
      existing.spent += s.grandTotal || 0;
      map.set(s.customerId, existing);
    });
    return Array.from(map.values())
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5); // Top 5
  }, [filteredSales]);

  const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.grandTotal || 0), 0);
  const avgSale = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0;

  function handleExport() {
    if (filteredSales.length === 0) { addToast("warning", "No data to export"); return; }
    const csv = salesToCSV(filteredSales);
    const dateLabel = filterMode === "single"
      ? (singleDate || "all")
      : (startDate && endDate ? `${startDate}_to_${endDate}` : "all");
    downloadCSV(csv, `takataka-report-${dateLabel}`);
    addToast("success", "Report exported!");
  }

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Analyze your sales performance</p>
        </div>
        <button onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 transition-all">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* Filter Options */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50">
        <div className="flex flex-col gap-4">
          {/* Mode Switcher */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Filter Type:</span>
            <div className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-gray-700">
              <button
                type="button"
                onClick={() => { setFilterMode("range"); setStartDate(""); setEndDate(""); setSingleDate(""); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  filterMode === "range"
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                Date Range
              </button>
              <button
                type="button"
                onClick={() => { setFilterMode("single"); setStartDate(""); setEndDate(""); setSingleDate(""); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  filterMode === "single"
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                Single Day
              </button>
            </div>
          </div>

          {/* Date Inputs */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Calendar className="h-5 w-5 text-emerald-500 hidden sm:block" />
            
            {filterMode === "range" ? (
              <>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Date Range:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="rounded-xl border border-gray-300 bg-gray-50 py-2 px-3 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <span className="text-gray-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="rounded-xl border border-gray-300 bg-gray-50 py-2 px-3 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </>
            ) : (
              <>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Specific Date:</span>
                <input
                  type="date"
                  value={singleDate}
                  onChange={e => setSingleDate(e.target.value)}
                  className="rounded-xl border border-gray-300 bg-gray-50 py-2 px-3 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </>
            )}

            {((filterMode === "range" && (startDate || endDate)) || (filterMode === "single" && singleDate)) && (
              <button
                onClick={() => { setStartDate(""); setEndDate(""); setSingleDate(""); }}
                className="text-xs font-medium text-red-500 hover:text-red-400 transition-colors ml-auto sm:ml-0"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalRevenue)}</p>
          <p className="text-xs text-gray-500">{filteredSales.length} sales</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Average Sale</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(Math.round(avgSale))}</p>
          <p className="text-xs text-gray-500">per transaction</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Items Sold</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {filteredSales.reduce((sum, s) => sum + (s.cookedFood || 0) + (s.bread || 0) + (s.meat25 || 0) + (s.meat30 || 0) + (s.bones || 0) + (s.gradeA || 0) + (s.veggies || 0), 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">total units</p>
        </div>
      </div>

      {/* Charts */}
      {filteredSales.length === 0 ? (
        <EmptyState icon={<BarChart3 className="h-10 w-10 text-emerald-400" />} title="No data for this period" description="Adjust the date range or add sales" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Daily Sales Chart */}
          <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50">
            <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Daily Sales</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }}
                    formatter={(v: any, n: any) => [n === "revenue" ? formatCurrency(Number(v)) : v, n === "revenue" ? "Revenue" : "Sales"]} />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-4">
            {/* Product Distribution */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50">
              <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Product Distribution</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={productData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} paddingAngle={2}>
                      {productData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [v, "Units"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1">
                {productData.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-gray-600 dark:text-gray-300">{p.name}</span>
                    <span className="ml-auto font-medium text-gray-900 dark:text-white">{p.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Customers */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50">
              <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Top Customers</h3>
              <div className="space-y-3">
                {topCustomersData.map((c, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-bold">
                        #{i + 1}
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[120px]" title={c.name}>{c.name}</p>
                    </div>
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(c.spent)}</p>
                  </div>
                ))}
                {topCustomersData.length === 0 && <p className="text-xs text-gray-500">No data</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Table */}
      {filteredSales.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden dark:border-gray-700/50 dark:bg-gray-800/50">
          <div className="p-5"><h3 className="text-sm font-semibold text-gray-900 dark:text-white">Sales Detail</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Sale #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                {PRODUCTS.map(p => <th key={p.key} className="px-3 py-3 text-center font-medium text-gray-500">{p.label}</th>)}
                <th className="px-4 py-3 text-right font-medium text-gray-500">Total</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/30">
                {filteredSales.slice(0, 50).map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20">
                    <td className="px-4 py-2.5 font-mono text-gray-600 dark:text-gray-300">{s.saleNumber}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{s.customerName}</td>
                    <td className="px-4 py-2.5 text-gray-500">{formatDate(s.createdAt)}</td>
                    {PRODUCTS.map(p => <td key={p.key} className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-300">{(s[p.key] as number) || "—"}</td>)}
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(s.grandTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

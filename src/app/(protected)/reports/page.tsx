"use client";
import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useToast } from "@/contexts/ToastContext";
import { getAllSales } from "@/lib/firestore";
import { Sale } from "@/types";
import { formatCurrency, formatDate, toDate } from "@/utils/formatters";
import { PRODUCTS } from "@/utils/pricing";
import { salesToCSV, downloadCSV } from "@/utils/csv";
import { PageSpinner } from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import { BarChart3, Download, Calendar, TrendingUp, Package, DollarSign, ChevronDown, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from "recharts";
import { format, startOfDay, endOfDay, isWithinInterval, startOfWeek } from "date-fns";

// Helper to get Week Key
const getWeekKey = (date: Date) => {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return format(start, "MMM dd");
};

// ─── Colour palette ──────────────────────────────────────────────────────────
const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

// ─── Report product groups ───────────────────────────────────────────────────
// Defines how individual PRODUCTS collapse into grouped rows in reports.
// Single-member groups still appear as standalone rows.
const REPORT_GROUPS: Array<{
  key: string;
  label: string;
  color: string;
  members: { productKey: string; label: string; totalKey: string; price: number }[];
}> = [
  {
    key: "cookedFood",
    label: "Cooked Food",
    color: COLORS[0],
    members: [{ productKey: "cookedFood", label: "Cooked Food", totalKey: "cookedFoodTotal", price: 20 }],
  },
  {
    key: "bread",
    label: "Bread",
    color: COLORS[1],
    members: [
      { productKey: "bread",   label: "Bread @ 20", totalKey: "breadTotal",   price: 20 },
      { productKey: "bread25", label: "Bread @ 25", totalKey: "bread25Total", price: 25 },
    ],
  },
  {
    key: "meat",
    label: "Meat",
    color: COLORS[2],
    members: [
      { productKey: "meat25", label: "Meat @ 25", totalKey: "meat25Total", price: 25 },
      { productKey: "meat30", label: "Meat @ 30", totalKey: "meat30Total", price: 30 },
    ],
  },
  {
    key: "bones",
    label: "Bones",
    color: COLORS[3],
    members: [
      { productKey: "bones",   label: "Bones @ 15", totalKey: "bonesTotal",   price: 15 },
      { productKey: "bones10", label: "Bones @ 10", totalKey: "bones10Total", price: 10 },
    ],
  },
  {
    key: "gradeA",
    label: "Grade A",
    color: COLORS[4],
    members: [{ productKey: "gradeA", label: "Grade A", totalKey: "gradeATotal", price: 5 }],
  },
  {
    key: "veggies",
    label: "Veggies",
    color: COLORS[5],
    members: [{ productKey: "veggies", label: "Veggies", totalKey: "veggiesTotal", price: 6 }],
  },
];

export default function ReportsPage() {
  const { addToast } = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterMode, setFilterMode] = useState<"range" | "single" | "week">("range");
  const [singleDate, setSingleDate] = useState("");
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
  // Tracks which multi-member groups are expanded in the revenue table
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getAllSales().then(setSales).catch(() => addToast("error", "Failed to load sales")).finally(() => setLoading(false));
  }, []);

  const availableWeeks = useMemo(() => {
    const weeksSet = new Set<string>();
    sales.forEach(s => {
      if (!s.createdAt) return;
      const date = toDate(s.createdAt);
      weeksSet.add(getWeekKey(date));
    });
    const weeksList = Array.from(weeksSet).map(wKey => {
      const sampleSale = sales.find(s => s.createdAt && getWeekKey(toDate(s.createdAt)) === wKey);
      const timestamp = sampleSale ? startOfWeek(toDate(sampleSale.createdAt), { weekStartsOn: 1 }).getTime() : 0;
      return { label: `Week of ${wKey}`, value: wKey, timestamp };
    });
    return weeksList.sort((a, b) => b.timestamp - a.timestamp);
  }, [sales]);

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

    if (filterMode === "week") {
      if (selectedWeeks.length === 0) return sales;
      return sales.filter(s => {
        if (!s.createdAt) return false;
        const wKey = getWeekKey(toDate(s.createdAt));
        return selectedWeeks.includes(wKey);
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
  }, [sales, filterMode, startDate, endDate, singleDate, selectedWeeks]);

  // ── Daily breakdown ───────────────────────────────────────────────────────
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

  // ── Grouped revenue data ──────────────────────────────────────────────────
  // Used for bar chart and pie chart — Meat and Bones are combined totals.
  const groupedRevenueData = useMemo(() => {
    return REPORT_GROUPS.map((group, i) => {
      const units   = group.members.reduce((sum, m) => sum + filteredSales.reduce((s2, sale) => s2 + ((sale as any)[m.productKey] || 0), 0), 0);
      const revenue = group.members.reduce((sum, m) => sum + filteredSales.reduce((s2, sale) => s2 + ((sale as any)[m.totalKey]   || 0), 0), 0);
      return { name: group.label, units, revenue, color: group.color, groupKey: group.key };
    }).filter(g => g.units > 0);
  }, [filteredSales]);

  // ── Pie chart product distribution ───────────────────────────────────────
  const productData = useMemo(() => groupedRevenueData, [groupedRevenueData]);

  // ── Revenue table rows (grouped + expandable sub-rows) ───────────────────
  const revenueTableRows = useMemo(() => {
    const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.grandTotal || 0), 0);

    return REPORT_GROUPS.map((group, i) => {
      const memberStats = group.members.map(m => {
        const units   = filteredSales.reduce((sum, s) => sum + ((s as any)[m.productKey] || 0), 0);
        const revenue = filteredSales.reduce((sum, s) => sum + ((s as any)[m.totalKey]   || 0), 0);
        return { ...m, units, revenue };
      });
      const totalUnits   = memberStats.reduce((sum, m) => sum + m.units,   0);
      const totalRev     = memberStats.reduce((sum, m) => sum + m.revenue, 0);
      const share        = totalRevenue > 0 ? Math.round((totalRev / totalRevenue) * 100) : 0;
      const isMulti      = group.members.length > 1;

      return { group, memberStats, totalUnits, totalRev, share, isMulti, color: group.color };
    }).filter(r => r.totalUnits > 0);
  }, [filteredSales]);

  // ── Top customers ─────────────────────────────────────────────────────────
  const topCustomersData = useMemo(() => {
    const map = new Map<string, { name: string; spent: number }>();
    filteredSales.forEach(s => {
      const existing = map.get(s.customerId) || { name: s.customerName, spent: 0 };
      existing.spent += s.grandTotal || 0;
      map.set(s.customerId, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.spent - a.spent).slice(0, 5);
  }, [filteredSales]);

  const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.grandTotal || 0), 0);
  const avgSale = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0;
  const totalUnits = filteredSales.reduce((sum, s) =>
    sum +
    (s.cookedFood || 0) + (s.bread  || 0) + (s.bread25 || 0) +
    (s.meat25     || 0) + (s.meat30 || 0) +
    (s.bones      || 0) + (s.bones10 || 0) +
    (s.gradeA     || 0) + (s.veggies || 0),
    0
  );

  function handleExport() {
    if (filteredSales.length === 0) { addToast("warning", "No data to export"); return; }
    const csv = salesToCSV(filteredSales);
    const dateLabel = filterMode === "single"
      ? (singleDate || "all")
      : (startDate && endDate ? `${startDate}_to_${endDate}` : "all");
    downloadCSV(csv, `takataka-report-${dateLabel}`);
    addToast("success", "Report exported!");
  }

  function toggleGroup(key: string) {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // --- Multiselect Component ---
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
  const toggleWeek = (val: string) => {
    if (selectedWeeks.includes(val)) setSelectedWeeks(selectedWeeks.filter(v => v !== val));
    else setSelectedWeeks([...selectedWeeks, val]);
  };

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
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Filter Type:</span>
            <div className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-gray-700">
              <button type="button"
                onClick={() => { setFilterMode("range"); setStartDate(""); setEndDate(""); setSingleDate(""); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  filterMode === "range"
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}>Date Range</button>
              <button type="button"
                onClick={() => { setFilterMode("single"); setStartDate(""); setEndDate(""); setSingleDate(""); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  filterMode === "single"
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}>Single Day</button>
              <button type="button"
                onClick={() => { setFilterMode("week"); setStartDate(""); setEndDate(""); setSingleDate(""); setSelectedWeeks([]); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  filterMode === "week"
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}>By Week</button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Calendar className="h-5 w-5 text-emerald-500 hidden sm:block" />
            {filterMode === "range" ? (
              <>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Date Range:</span>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="rounded-xl border border-gray-300 bg-gray-50 py-2 px-3 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                <span className="text-gray-400">to</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="rounded-xl border border-gray-300 bg-gray-50 py-2 px-3 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
              </>
            ) : filterMode === "week" ? (
              <>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Weeks:</span>
                <div className="relative">
                  <div 
                    onClick={() => setWeekDropdownOpen(!weekDropdownOpen)}
                    className="min-w-[160px] cursor-pointer rounded-xl border border-gray-300 bg-gray-50 py-2 px-3 text-sm text-gray-900 focus:border-emerald-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white flex items-center justify-between"
                  >
                    <span className="truncate max-w-[120px]">{selectedWeeks.length === 0 ? "All Weeks" : `${selectedWeeks.length} Selected`}</span>
                    <ChevronDown className="h-4 w-4" />
                  </div>
                  {weekDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setWeekDropdownOpen(false)} />
                      <div className="absolute top-full left-0 mt-1 w-48 max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl z-20 dark:border-gray-700 dark:bg-gray-800 p-2">
                        {availableWeeks.map(opt => (
                          <label key={opt.value} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={selectedWeeks.includes(opt.value)}
                              onChange={() => toggleWeek(opt.value)}
                              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Specific Date:</span>
                <input type="date" value={singleDate} onChange={e => setSingleDate(e.target.value)}
                  className="rounded-xl border border-gray-300 bg-gray-50 py-2 px-3 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
              </>
            )}
            {((filterMode === "range" && (startDate || endDate)) || (filterMode === "single" && singleDate) || (filterMode === "week" && selectedWeeks.length > 0)) && (
              <button onClick={() => { setStartDate(""); setEndDate(""); setSingleDate(""); setSelectedWeeks([]); }}
                className="text-xs font-medium text-red-500 hover:text-red-400 transition-colors ml-auto sm:ml-0">
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
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUnits.toLocaleString()}</p>
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
            {/* Product Distribution Pie (grouped) */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50">
              <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Product Distribution</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={productData} dataKey="units" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} paddingAngle={2}>
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
                    <span className="ml-auto font-medium text-gray-900 dark:text-white">{p.units}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Customers */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Top Customers</h3>
                <Link href="/reports/customer-spending"
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors">
                  View All
                </Link>
              </div>
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

      {/* Revenue per Item (grouped, expandable) */}
      {filteredSales.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Revenue per Item</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Meat and Bones are grouped — click <ChevronRight className="inline h-3 w-3" /> to see per-price breakdown
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart — grouped data */}
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={groupedRevenueData} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis type="number" fontSize={10} tickLine={false} axisLine={false}
                    tickFormatter={(v) => `KES ${Number(v).toLocaleString()}`} />
                  <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} width={80} />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}
                    formatter={(v: any) => [formatCurrency(Number(v)), "Revenue"]}
                  />
                  <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                    {groupedRevenueData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    <LabelList dataKey="revenue" position="right"
                      formatter={(v: any) => {
                        const share = totalRevenue > 0 ? Math.round((Number(v) / totalRevenue) * 100) : 0;
                        return `${share}%`;
                      }}
                      style={{ fontSize: 11, fill: "#6b7280", fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Summary Table — grouped + expandable */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700/50">
                    <th className="pb-2.5 text-left font-semibold text-gray-500 dark:text-gray-400">Product</th>
                    <th className="pb-2.5 text-center font-semibold text-gray-500 dark:text-gray-400">Units</th>
                    <th className="pb-2.5 text-center font-semibold text-gray-500 dark:text-gray-400">Price</th>
                    <th className="pb-2.5 text-right font-semibold text-gray-500 dark:text-gray-400">Revenue</th>
                    <th className="pb-2.5 text-right font-semibold text-gray-500 dark:text-gray-400">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/30">
                  {revenueTableRows.map((row, i) => (
                    <React.Fragment key={row.group.key}>
                      {/* Group / parent row */}
                      <tr
                        className={`transition-colors ${row.isMulti ? "cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10" : "hover:bg-gray-50/50 dark:hover:bg-gray-700/20"}`}
                        onClick={() => row.isMulti && toggleGroup(row.group.key)}
                      >
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                            <span className={`font-semibold text-gray-900 dark:text-white ${row.isMulti ? "text-[13px]" : "font-medium"}`}>
                              {row.group.label}
                            </span>
                            {row.isMulti && (
                              expandedGroups[row.group.key]
                                ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 ml-0.5" />
                                : <ChevronRight className="h-3.5 w-3.5 text-gray-400 ml-0.5" />
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 text-center text-gray-700 dark:text-gray-200 font-medium">{row.totalUnits.toLocaleString()}</td>
                        <td className="py-2.5 text-center text-gray-400 dark:text-gray-500 text-[11px]">
                          {row.isMulti ? "mixed" : `KES ${row.memberStats[0]?.price ?? ""}`}
                        </td>
                        <td className="py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(row.totalRev)}</td>
                        <td className="py-2.5 text-right">
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            {row.share}%
                          </span>
                        </td>
                      </tr>

                      {/* Sub-rows (only for multi-member groups when expanded) */}
                      {row.isMulti && expandedGroups[row.group.key] && row.memberStats.map((m, j) => (
                        m.units > 0 && (
                          <tr key={j} className="bg-gray-50/70 dark:bg-gray-700/20">
                            <td className="py-2 pr-3 pl-6">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
                                <span className="text-gray-500 dark:text-gray-400">{m.label}</span>
                              </div>
                            </td>
                            <td className="py-2 text-center text-gray-500 dark:text-gray-400">{m.units.toLocaleString()}</td>
                            <td className="py-2 text-center text-gray-400 dark:text-gray-500 text-[11px]">KES {m.price}</td>
                            <td className="py-2 text-right text-gray-600 dark:text-gray-300 font-medium">{formatCurrency(m.revenue)}</td>
                            <td className="py-2 text-right">
                              <span className="text-[10px] text-gray-400">
                                {row.totalRev > 0 ? Math.round((m.revenue / row.totalRev) * 100) : 0}% of {row.group.label}
                              </span>
                            </td>
                          </tr>
                        )
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 dark:border-gray-600">
                    <td colSpan={3} className="pt-2.5 font-semibold text-gray-700 dark:text-gray-300">Total</td>
                    <td className="pt-2.5 text-right font-bold text-gray-900 dark:text-white">{formatCurrency(totalRevenue)}</td>
                    <td className="pt-2.5 text-right">
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">100%</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sales Detail — raw granular columns (all individual products shown) */}
      {filteredSales.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden dark:border-gray-700/50 dark:bg-gray-800/50">
          <div className="p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Sales Detail</h3>
            <p className="text-xs text-gray-400 mt-0.5">Individual rows per sale — all product columns</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Sale #</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Customer</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                  {PRODUCTS.map(p => <th key={p.key} className="px-3 py-3 text-center font-medium text-gray-500">{p.label}</th>)}
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/30">
                {filteredSales.slice(0, 50).map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20">
                    <td className="px-4 py-2.5 font-mono text-gray-600 dark:text-gray-300">{s.saleNumber}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{s.customerName}</td>
                    <td className="px-4 py-2.5 text-gray-500">{formatDate(s.createdAt)}</td>
                    {PRODUCTS.map(p => (
                      <td key={p.key} className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-300">
                        {((s as any)[p.key] || 0) > 0 ? (s as any)[p.key] : "—"}
                      </td>
                    ))}
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

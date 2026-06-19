"use client";
// ============================================
// Customer Spending Report Page
// ============================================
// Shows a detailed report of all customers and their total sales spending.
// Supports date range filter, min/max spend, location filter, search,
// sorting, and Excel export. Dynamic recalculations based on date range.

import React, { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { canDo } from "@/lib/rbac";
import { getAllCustomers, getAllSales } from "@/lib/firestore";
import { Customer, Sale } from "@/types";
import { formatDate, formatCurrency, toDate } from "@/utils/formatters";
import { PageSpinner } from "@/components/ui/Spinner";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/contexts/ToastContext";
import {
  ArrowLeft,
  Search,
  Filter,
  Download,
  Phone,
  MapPin,
  Eye,
  EyeOff,
  Calendar,
  Users,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ListFilter,
  X,
  FileSpreadsheet,
} from "lucide-react";
import * as XLSX from "xlsx";
import { startOfDay, endOfDay } from "date-fns";

const PER_PAGE = 10;

export default function CustomerSpendingPage() {
  const { addToast } = useToast();
  const { appUser } = useAuth();
  const router = useRouter();
  
  const canViewReports = canDo(appUser, "canViewReports");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [minSpend, setMinSpend] = useState<number | "">("");
  const [maxSpend, setMaxSpend] = useState<number | "">("");
  const [hideZeroSpend, setHideZeroSpend] = useState(false);
  const [sortBy, setSortBy] = useState("spent-desc");
  const [page, setPage] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Phone visibility visibility state
  const [showPhones, setShowPhones] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!appUser) return;
    if (!canViewReports) {
      router.replace("/dashboard");
      return;
    }

    async function loadData() {
      try {
        const [c, s] = await Promise.all([getAllCustomers(), getAllSales()]);
        setCustomers(c);
        setSales(s);
      } catch (err) {
        console.error(err);
        addToast("error", "Failed to load report data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [appUser, canViewReports, router, addToast]);

  // Dynamic spending calculations per customer based on active date range
  const customerSpending = useMemo(() => {
    const start = startDate ? startOfDay(new Date(startDate)) : null;
    const end = endDate ? endOfDay(new Date(endDate)) : null;

    // Pre-group sales by customer ID within the date range
    const salesByCustomer = new Map<string, Sale[]>();
    sales.forEach((s) => {
      if (!s.createdAt) return;
      const saleDate = toDate(s.createdAt);
      const inRange = (!start || saleDate >= start) && (!end || saleDate <= end);
      if (!inRange) return;

      const list = salesByCustomer.get(s.customerId) || [];
      list.push(s);
      salesByCustomer.set(s.customerId, list);
    });

    return customers.map((c) => {
      const cSales = salesByCustomer.get(c.id) || [];
      const totalSpent = cSales.reduce((sum, s) => sum + (s.grandTotal || 0), 0);
      const purchasesCount = cSales.length;
      const lastPurchase =
        cSales.length > 0
          ? new Date(Math.max(...cSales.map((s) => toDate(s.createdAt).getTime())))
          : null;

      return {
        ...c,
        totalSpent,
        purchasesCount,
        lastPurchase,
      };
    });
  }, [customers, sales, startDate, endDate]);

  // Extract unique locations dynamically for filter dropdown
  const uniqueLocations = useMemo(() => {
    const locs = customers
      .map((c) => c.location?.trim())
      .filter((loc): loc is string => !!loc);
    return Array.from(new Set(locs)).sort();
  }, [customers]);

  // Filter and sort the spending data
  const filteredAndSorted = useMemo(() => {
    let result = customerSpending;

    // Search filter
    if (search.trim()) {
      const t = search.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.fullName.toLowerCase().includes(t) ||
          c.phone.includes(t) ||
          (c.location && c.location.toLowerCase().includes(t))
      );
    }

    // Location filter
    if (locationFilter) {
      result = result.filter((c) => c.location === locationFilter);
    }

    // Spend range filters
    if (minSpend !== "") {
      result = result.filter((c) => c.totalSpent >= Number(minSpend));
    }
    if (maxSpend !== "") {
      result = result.filter((c) => c.totalSpent <= Number(maxSpend));
    }

    // Hide zero spend
    if (hideZeroSpend) {
      result = result.filter((c) => c.totalSpent > 0);
    }

    // Sorting
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "spent-desc":
          return b.totalSpent - a.totalSpent;
        case "spent-asc":
          return a.totalSpent - b.totalSpent;
        case "purchases-desc":
          return b.purchasesCount - a.purchasesCount;
        case "name-asc":
          return a.fullName.localeCompare(b.fullName);
        case "name-desc":
          return b.fullName.localeCompare(a.fullName);
        case "date-desc":
          if (!a.lastPurchase) return 1;
          if (!b.lastPurchase) return -1;
          return b.lastPurchase.getTime() - a.lastPurchase.getTime();
        default:
          return b.totalSpent - a.totalSpent;
      }
    });

    return result;
  }, [customerSpending, search, locationFilter, minSpend, maxSpend, hideZeroSpend, sortBy]);

  // KPI calculations on filtered data
  const kpis = useMemo(() => {
    const count = filteredAndSorted.length;
    const totalSpent = filteredAndSorted.reduce((sum, c) => sum + c.totalSpent, 0);
    const avgSpent = count > 0 ? totalSpent / count : 0;
    const totalPurchases = filteredAndSorted.reduce((sum, c) => sum + c.purchasesCount, 0);

    return {
      count,
      totalSpent,
      avgSpent,
      totalPurchases,
    };
  }, [filteredAndSorted]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSorted.length / PER_PAGE);
  const paginated = filteredAndSorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  useEffect(() => {
    setPage(1);
  }, [search, startDate, endDate, locationFilter, minSpend, maxSpend, hideZeroSpend, sortBy]);

  // Export to Excel
  function handleExport() {
    if (filteredAndSorted.length === 0) {
      addToast("warning", "No data to export");
      return;
    }
    const rows = filteredAndSorted.map((c, i) => ({
      Rank: i + 1,
      Name: c.fullName,
      Phone: c.phone || "—",
      Location: c.location || "—",
      "Total Purchases": c.purchasesCount,
      "Total Spent (KES)": c.totalSpent,
      "Last Purchase": c.lastPurchase ? formatDate(c.lastPurchase) : "—",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customer Spending");
    XLSX.writeFile(wb, `customer-spending-${new Date().toISOString().slice(0, 10)}.xlsx`);
    addToast("success", `Exported ${rows.length} records`);
  }

  // Clear all filters
  function clearAllFilters() {
    setSearch("");
    setStartDate("");
    setEndDate("");
    setLocationFilter("");
    setMinSpend("");
    setMaxSpend("");
    setHideZeroSpend(false);
    setSortBy("spent-desc");
  }

  const isFilterActive =
    search ||
    startDate ||
    endDate ||
    locationFilter ||
    minSpend !== "" ||
    maxSpend !== "" ||
    hideZeroSpend ||
    sortBy !== "spent-desc";

  function togglePhone(id: string) {
    setShowPhones((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function maskPhone(phone: string) {
    if (!phone || phone.length < 6) return phone;
    return phone.slice(0, 4) + "***" + phone.slice(-3);
  }

  if (loading) return <PageSpinner />;
  if (!canViewReports) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/reports"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 transition-colors mb-1"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Reports
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-emerald-500" />
            Customer Spending Report
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total sales and purchase volumes per customer.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={filteredAndSorted.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileSpreadsheet className="h-4 w-4" /> Export Report
        </button>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Active Customers</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {kpis.count.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">shown in list</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Spent</p>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(kpis.totalSpent)}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">during selected period</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Average Spent</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(Math.round(kpis.avgSpent))}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">per customer</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <ShoppingCart className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Purchases</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {kpis.totalPurchases.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">sales recorded</p>
        </div>
      </div>

      {/* Filter panel */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search customer name, phone, location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white transition-all"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Toggle advanced filters */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition-all ${
                showAdvanced || isFilterActive
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              <Filter className="h-4 w-4" /> Filters
            </button>

            {/* Sort by */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-gray-300 bg-white py-2.5 px-4 text-sm font-medium text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="spent-desc">Total Spent (High to Low)</option>
              <option value="spent-asc">Total Spent (Low to High)</option>
              <option value="purchases-desc">Purchases Count</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="date-desc">Last Purchase Date</option>
            </select>

            {/* Clear filters */}
            {isFilterActive && (
              <button
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 transition-all dark:bg-red-900/10 dark:border-red-800 dark:text-red-400"
              >
                <X className="h-4 w-4" /> Clear All
              </button>
            )}
          </div>
        </div>

        {/* Advanced Filters Drawer */}
        {(showAdvanced || isFilterActive) && (
          <div className="pt-4 border-t border-gray-100 dark:border-gray-700/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-down">
            {/* Date range */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Start Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-gray-50 py-2.5 pl-9 pr-3 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                End Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-gray-50 py-2.5 pl-9 pr-3 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            {/* Min spend */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Min Spend (KES)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="number"
                  placeholder="Min amount"
                  value={minSpend === "" ? "" : minSpend}
                  onChange={(e) =>
                    setMinSpend(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="w-full rounded-xl border border-gray-300 bg-gray-50 py-2.5 pl-9 pr-3 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            {/* Max spend */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Max Spend (KES)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="number"
                  placeholder="Max amount"
                  value={maxSpend === "" ? "" : maxSpend}
                  onChange={(e) =>
                    setMaxSpend(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="w-full rounded-xl border border-gray-300 bg-gray-50 py-2.5 pl-9 pr-3 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-gray-50 py-2.5 pl-9 pr-3 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white appearance-none"
                >
                  <option value="">All Locations</option>
                  {uniqueLocations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Hide zero spending */}
            <div className="flex items-center gap-2 pt-6">
              <input
                id="hide-zero-spend"
                type="checkbox"
                checked={hideZeroSpend}
                onChange={(e) => setHideZeroSpend(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <label
                htmlFor="hide-zero-spend"
                className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none"
              >
                Hide customers with zero spent
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Main content list / table */}
      {filteredAndSorted.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10 text-emerald-400" />}
          title={isFilterActive ? "No matching reports" : "No customer records"}
          description={isFilterActive ? "Try clearing or adjusting your filters." : "Customers will appear here once created."}
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-2xl border border-gray-200 bg-white overflow-hidden dark:border-gray-700/50 dark:bg-gray-800/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 w-16">
                    Rank
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Customer Name
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Phone
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Location
                  </th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Purchases Count
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Total Spending
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Last Purchase
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/30">
                {paginated.map((c, index) => {
                  const rank = (page - 1) * PER_PAGE + index + 1;
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            rank === 1
                              ? "bg-amber-500 text-white"
                              : rank === 2
                              ? "bg-gray-400 text-white"
                              : rank === 3
                              ? "bg-amber-700 text-white"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          }`}
                        >
                          {rank}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/customers/${c.id}`}
                          className="font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 hover:underline transition-colors"
                        >
                          {c.fullName}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">
                        {c.phone ? (
                          <div className="flex items-center gap-1.5">
                            <span>{showPhones[c.id] ? c.phone : maskPhone(c.phone)}</span>
                            <button
                              onClick={() => togglePhone(c.id)}
                              className="p-1 text-gray-400 hover:text-emerald-600 transition-colors"
                            >
                              {showPhones[c.id] ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">
                        {c.location || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-center font-medium text-gray-900 dark:text-white">
                        {c.purchasesCount}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(c.totalSpent)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-gray-500 dark:text-gray-400">
                        {c.lastPurchase ? formatDate(c.lastPurchase) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {paginated.map((c, index) => {
              const rank = (page - 1) * PER_PAGE + index + 1;
              return (
                <div
                  key={c.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 dark:bg-gray-800/50 dark:border-gray-700/50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          rank === 1
                            ? "bg-amber-500 text-white"
                            : rank === 2
                            ? "bg-gray-400 text-white"
                            : rank === 3
                            ? "bg-amber-700 text-white"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {rank}
                      </span>
                      <Link
                        href={`/customers/${c.id}`}
                        className="font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 hover:underline transition-colors"
                      >
                        {c.fullName}
                      </Link>
                    </div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {formatCurrency(c.totalSpent)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 border-t border-gray-50 pt-2.5 dark:border-gray-700/30">
                    <div>
                      <p className="text-gray-400">Purchases</p>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">
                        {c.purchasesCount} sales
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400">Last Purchase</p>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">
                        {c.lastPurchase ? formatDate(c.lastPurchase) : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300 pt-1">
                    {c.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {showPhones[c.id] ? c.phone : maskPhone(c.phone)}
                        <button
                          onClick={() => togglePhone(c.id)}
                          className="ml-0.5 text-gray-400 hover:text-emerald-600"
                        >
                          {showPhones[c.id] ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </button>
                      </span>
                    )}
                    {c.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {c.location}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page === totalPages}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

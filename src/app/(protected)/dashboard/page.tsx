"use client";
// ============================================
// Dashboard Page
// ============================================
// Shows KPIs, sales trends, top customers, recent sales.

import React, { useEffect, useState, useMemo } from "react";
import {
  Users,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Calendar,
  Award,
  Package,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { getAllCustomers, getAllSales } from "@/lib/firestore";
import { formatCurrency, formatDate, checkIsToday, checkIsThisWeek, checkIsThisMonth, toDate } from "@/utils/formatters";
import { PRODUCTS } from "@/utils/pricing";
import { Customer, Sale, TopCustomer } from "@/types";
import { PageSpinner } from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import Link from "next/link";

export default function DashboardPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [c, s] = await Promise.all([getAllCustomers(), getAllSales()]);
        setCustomers(c);
        setSales(s);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // --- Computed Stats ---
  const stats = useMemo(() => {
    const todaySalesArr = sales.filter((s) => s.createdAt && checkIsToday(s.createdAt));
    const weekSalesArr = sales.filter((s) => s.createdAt && checkIsThisWeek(s.createdAt));
    const monthSalesArr = sales.filter((s) => s.createdAt && checkIsThisMonth(s.createdAt));

    const totalRevenue = sales.reduce((sum, s) => sum + (s.grandTotal || 0), 0);
    const todayRevenue = todaySalesArr.reduce((sum, s) => sum + (s.grandTotal || 0), 0);
    const weekRevenue = weekSalesArr.reduce((sum, s) => sum + (s.grandTotal || 0), 0);
    const monthRevenue = monthSalesArr.reduce((sum, s) => sum + (s.grandTotal || 0), 0);

    return {
      totalCustomers: customers.length,
      totalSales: sales.length,
      totalRevenue,
      todaySales: todaySalesArr.length,
      todayRevenue,
      weekSales: weekSalesArr.length,
      weekRevenue,
      monthSales: monthSalesArr.length,
      monthRevenue,
    };
  }, [customers, sales]);

  // --- Top Customers ---
  const topCustomers = useMemo((): TopCustomer[] => {
    const map = new Map<string, TopCustomer>();
    sales.forEach((s) => {
      const existing = map.get(s.customerId) || {
        id: s.customerId,
        name: s.customerName,
        totalPurchases: 0,
        totalSpent: 0,
      };
      existing.totalPurchases += 1;
      existing.totalSpent += s.grandTotal || 0;
      map.set(s.customerId, existing);
    });
    return Array.from(map.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);
  }, [sales]);

  // --- Top Selling Item ---
  const topSellingItem = useMemo(() => {
    const totals = PRODUCTS.map((p) => ({
      label: p.label,
      qty: sales.reduce((sum, s) => sum + (s[p.key] || 0), 0),
      revenue: sales.reduce((sum, s) => sum + ((s as unknown as Record<string, number>)[p.totalKey] || 0), 0),
    }));
    return totals.sort((a, b) => b.qty - a.qty)[0] || { label: "N/A", qty: 0, revenue: 0 };
  }, [sales]);

  // --- 7-Day Sales Trend ---
  const weeklyTrend = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayStart = startOfDay(date);
      const dayLabel = format(date, "EEE");
      const daySales = sales.filter((s) => {
        if (!s.createdAt) return false;
        const sDate = startOfDay(toDate(s.createdAt));
        return sDate.getTime() === dayStart.getTime();
      });
      return {
        day: dayLabel,
        sales: daySales.length,
        revenue: daySales.reduce((sum, s) => sum + (s.grandTotal || 0), 0),
      };
    });
    return days;
  }, [sales]);

  // --- Monthly Trend (last 6 months) ---
  const monthlyTrend = useMemo(() => {
    const months: { month: string; sales: number; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthLabel = format(d, "MMM");
      const monthNum = d.getMonth();
      const yearNum = d.getFullYear();
      const monthSales = sales.filter((s) => {
        if (!s.createdAt) return false;
        const sd = toDate(s.createdAt);
        return sd.getMonth() === monthNum && sd.getFullYear() === yearNum;
      });
      months.push({
        month: monthLabel,
        sales: monthSales.length,
        revenue: monthSales.reduce((sum, s) => sum + (s.grandTotal || 0), 0),
      });
    }
    return months;
  }, [sales]);

  // Recent sales (top 8)
  const recentSales = sales.slice(0, 8);

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Overview of your pig food business performance
        </p>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Customers"
          value={stats.totalCustomers.toString()}
          icon={<Users className="h-5 w-5" />}
          color="emerald"
          delay="stagger-1"
        />
        <KPICard
          title="Total Sales"
          value={stats.totalSales.toString()}
          icon={<ShoppingCart className="h-5 w-5" />}
          color="blue"
          delay="stagger-2"
        />
        <KPICard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          icon={<DollarSign className="h-5 w-5" />}
          color="purple"
          delay="stagger-3"
        />
        <KPICard
          title="Today's Sales"
          value={stats.todaySales.toString()}
          subtitle={formatCurrency(stats.todayRevenue)}
          icon={<TrendingUp className="h-5 w-5" />}
          color="amber"
          delay="stagger-4"
        />
      </div>

      {/* Summary Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          title="This Week"
          sales={stats.weekSales}
          revenue={stats.weekRevenue}
          icon={<Calendar className="h-5 w-5 text-emerald-500" />}
        />
        <SummaryCard
          title="This Month"
          sales={stats.monthSales}
          revenue={stats.monthRevenue}
          icon={<Calendar className="h-5 w-5 text-blue-500" />}
        />
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <Award className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Top Selling Item</p>
              <p className="font-semibold text-gray-900 dark:text-white">{topSellingItem.label}</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
            <span>{topSellingItem.qty} units sold</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {formatCurrency(topSellingItem.revenue)}
            </span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly Sales Trend */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
            Weekly Sales Trend (Last 7 Days)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                  }}
                  formatter={(value: any, name: any) => [
                    name === "revenue" ? formatCurrency(Number(value)) : value,
                    name === "revenue" ? "Revenue" : "Sales",
                  ]}
                />
                <Bar dataKey="sales" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Revenue Trend */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
            Monthly Revenue (Last 6 Months)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                  }}
                  formatter={(value: any) => [formatCurrency(Number(value)), "Revenue"]}
                />
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#revenueGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row: Top Customers + Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Customers */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Best Customers</h3>
          {topCustomers.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No data yet</p>
          ) : (
            <div className="space-y-3">
              {topCustomers.map((tc, i) => (
                <Link
                  key={tc.id}
                  href={`/customers/${tc.id}`}
                  className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${
                    i === 0 ? "bg-amber-500" : i === 1 ? "bg-gray-400" : i === 2 ? "bg-amber-700" : "bg-emerald-500"
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{tc.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{tc.totalPurchases} purchases</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    {formatCurrency(tc.totalSpent)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Sales Table */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white dark:border-gray-700/50 dark:bg-gray-800/50 overflow-hidden">
          <div className="flex items-center justify-between p-5 pb-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Sales</h3>
            <Link
              href="/sales"
              className="text-xs font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 flex items-center gap-1"
            >
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {recentSales.length === 0 ? (
            <div className="p-8">
              <EmptyState title="No sales yet" description="Create your first sale to see it here" />
            </div>
          ) : (
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-gray-100 dark:border-gray-700/50">
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Sale #</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Customer</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Date</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/30">
                  {recentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">{sale.saleNumber}</td>
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{sale.customerName}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{formatDate(sale.createdAt)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(sale.grandTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  color: "emerald" | "blue" | "purple" | "amber";
  delay?: string;
}

const colorMap = {
  emerald: {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  blue: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-600 dark:text-blue-400",
  },
  purple: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-600 dark:text-purple-400",
  },
  amber: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-600 dark:text-amber-400",
  },
};

function KPICard({ title, value, subtitle, icon, color, delay }: KPICardProps) {
  return (
    <div className={`kpi-card rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50 animate-slide-up ${delay}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colorMap[color].bg}`}>
          <span className={colorMap[color].text}>{icon}</span>
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{title}</p>
      {subtitle && (
        <p className={`text-xs font-medium mt-1 ${colorMap[color].text}`}>{subtitle}</p>
      )}
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  sales: number;
  revenue: number;
  icon: React.ReactNode;
}

function SummaryCard({ title, sales, revenue, icon }: SummaryCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700/50">
          {icon}
        </div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{sales}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">sales</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(revenue)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">revenue</p>
        </div>
      </div>
    </div>
  );
}

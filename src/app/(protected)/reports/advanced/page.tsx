"use client";
import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { canDo } from "@/lib/rbac";
import { getAllSales, getAllReceivals, getWeeklyNotes, saveWeeklyNote } from "@/lib/firestore";
import { Sale, Receival, WeeklyNote } from "@/types";
import { formatCurrency, toDate } from "@/utils/formatters";
import { PageSpinner } from "@/components/ui/Spinner";
import { useToast } from "@/contexts/ToastContext";
import {
  ArrowLeft,
  Activity,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Info,
  Calendar,
  Filter,
  FileText,
  Save
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  AreaChart,
  BarChart
} from "recharts";
import { startOfWeek, format, subWeeks } from "date-fns";

export default function AdvancedReportPage() {
  const { appUser } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const canViewReports = canDo(appUser, "canViewReports");

  const [sales, setSales] = useState<Sale[]>([]);
  const [receivals, setReceivals] = useState<Receival[]>([]);
  const [weeklyNotes, setWeeklyNotes] = useState<WeeklyNote[]>([]);
  const [loading, setLoading] = useState(true);

  // Notes state
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>("");
  const [currentNote, setCurrentNote] = useState<string>("");
  const [savingNote, setSavingNote] = useState(false);

  // Filters
  const [dateLimit, setDateLimit] = useState<number>(12); // Last 12 weeks

  useEffect(() => {
    if (!appUser) return;
    if (!canViewReports) {
      router.replace("/dashboard");
      return;
    }

    async function loadData() {
      try {
        const [s, r, n] = await Promise.all([getAllSales(), getAllReceivals(), getWeeklyNotes()]);
        setSales(s);
        setReceivals(r);
        setWeeklyNotes(n);
      } catch (err) {
        console.error(err);
        addToast("error", "Failed to load report data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [appUser, canViewReports, router, addToast]);

  // Group data by week
  const weeklyData = useMemo(() => {
    const weeksMap = new Map<string, any>();

    // Helper to get Week Key (Monday as start of week)
    const getWeekKey = (date: Date) => {
      const start = startOfWeek(date, { weekStartsOn: 1 });
      return format(start, "MMM dd");
    };

    // Initialize map with empty weeks for the last N weeks to ensure continuous X-axis
    const now = new Date();
    for (let i = dateLimit - 1; i >= 0; i--) {
      const wDate = subWeeks(now, i);
      const start = startOfWeek(wDate, { weekStartsOn: 1 });
      const wKey = format(start, "MMM dd");
      weeksMap.set(wKey, {
        weekKey: wKey,
        timestamp: start.getTime(),
        salesRevenue: 0,
        salesKgs: 0,
        receivalsKgs: 0,
        pigfoodTruckKgs: 0,
        normalTruckKgs: 0,
        conveyorKgs: 0,
        // Fractions
        salesFractions: { cookedFood: 0, bread: 0, meat: 0, bones: 0, veggies: 0 },
        receivalFractions: { cookedFood: 0, bread: 0, meat: 0, bones: 0, veggies: 0 }
      });
    }

    // Process Sales
    sales.forEach(s => {
      if (!s.createdAt) return;
      const date = toDate(s.createdAt);
      const wKey = getWeekKey(date);
      if (!weeksMap.has(wKey)) return; // skip if outside our range limit

      const w = weeksMap.get(wKey);
      w.salesRevenue += s.grandTotal;
      // Estimate Sales KGs
      // We assume items are sold in units that roughly translate to kgs or are kgs.
      const totalKgs = s.cookedFood + s.bread + s.bread25 + s.meat25 + s.meat30 + s.bones + s.bones10 + s.gradeA + s.veggies;
      w.salesKgs += totalKgs;

      w.salesFractions.cookedFood += s.cookedFood;
      w.salesFractions.bread += s.bread + s.bread25;
      w.salesFractions.meat += s.meat25 + s.meat30;
      w.salesFractions.bones += s.bones + s.bones10;
      w.salesFractions.veggies += s.veggies + s.gradeA;
    });

    // Process Receivals
    receivals.forEach(r => {
      if (!r.createdAt) return;
      const date = toDate(r.createdAt);
      const wKey = getWeekKey(date);
      if (!weeksMap.has(wKey)) return; // skip if outside limit

      const w = weeksMap.get(wKey);
      w.receivalsKgs += r.netWeight;

      if (r.source === "Pigfood Truck") w.pigfoodTruckKgs += r.netWeight;
      else if (r.source === "Normal Truck") w.normalTruckKgs += r.netWeight;
      else if (r.source === "Conveyor (Local)") w.conveyorKgs += r.netWeight;

      w.receivalFractions.cookedFood += r.cookedFood || 0;
      w.receivalFractions.bread += r.bread || 0;
      w.receivalFractions.meat += r.meat || 0;
      w.receivalFractions.bones += r.bones || 0;
      w.receivalFractions.veggies += r.veggies || 0;
    });

    return Array.from(weeksMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [sales, receivals, dateLimit]);

  useEffect(() => {
    if (weeklyData.length > 0 && !selectedWeekKey) {
      setSelectedWeekKey(weeklyData[weeklyData.length - 1].weekKey);
    }
  }, [weeklyData, selectedWeekKey]);

  useEffect(() => {
    if (selectedWeekKey) {
      const noteObj = weeklyNotes.find(n => n.id === selectedWeekKey);
      setCurrentNote(noteObj ? noteObj.note : "");
    }
  }, [selectedWeekKey, weeklyNotes]);

  async function handleSaveNote() {
    if (!appUser || !selectedWeekKey) return;
    setSavingNote(true);
    try {
      await saveWeeklyNote(selectedWeekKey, currentNote, appUser.uid);
      setWeeklyNotes(prev => {
        const existing = prev.find(n => n.id === selectedWeekKey);
        if (existing) {
          return prev.map(n => n.id === selectedWeekKey ? { ...n, note: currentNote } : n);
        } else {
          return [...prev, { id: selectedWeekKey, note: currentNote, createdBy: appUser.uid, updatedAt: new Date() } as any];
        }
      });
      addToast("success", "Explanation saved successfully.");
    } catch (err) {
      console.error(err);
      addToast("error", "Failed to save explanation.");
    } finally {
      setSavingNote(false);
    }
  }

  // Generate Insights
  const insights = useMemo(() => {
    if (weeklyData.length < 2) return [];
    
    const current = weeklyData[weeklyData.length - 1];
    const prev = weeklyData[weeklyData.length - 2];
    const generated: any[] = [];

    // 1. Overall Sales Drop Analysis
    if (current.salesKgs < prev.salesKgs) {
      const salesDropPct = ((prev.salesKgs - current.salesKgs) / prev.salesKgs) * 100;
      const receivalsDiff = current.receivalsKgs - prev.receivalsKgs;
      
      let reason = "";
      if (receivalsDiff < 0) {
        reason = `Lower Receivals. Supply dropped by ${Math.abs(receivalsDiff).toLocaleString()} kg this week, directly causing the sales volume drop.`;
      } else {
        reason = `Reduced Customer Demand. Despite receivals increasing by ${receivalsDiff.toLocaleString()} kg, sales dropped. Customers are buying less.`;
      }

      generated.push({
        type: "negative",
        title: `Sales Volume Dropped by ${salesDropPct.toFixed(1)}%`,
        description: reason
      });
    } else if (current.salesKgs > prev.salesKgs) {
      const salesIncPct = ((current.salesKgs - prev.salesKgs) / prev.salesKgs) * 100;
      generated.push({
        type: "positive",
        title: `Sales Volume Increased by ${salesIncPct.toFixed(1)}%`,
        description: "Great performance this week in moving volume."
      });
    }

    // 2. Fraction Analysis
    const fractions = ["meat", "bread", "cookedFood", "bones", "veggies"];
    fractions.forEach(f => {
      const cSale = current.salesFractions[f] || 0;
      const pSale = prev.salesFractions[f] || 0;
      
      if (cSale < pSale && pSale > 0) {
        const drop = pSale - cSale;
        const cRec = current.receivalFractions[f] || 0;
        const pRec = prev.receivalFractions[f] || 0;
        
        // Only report significant drops (e.g. > 10%)
        if (drop / pSale > 0.1) {
          if (cRec < pRec) {
            generated.push({
              type: "warning",
              title: `${f.charAt(0).toUpperCase() + f.slice(1)} Sales Dropped`,
              description: `Sales decreased because supply of ${f} dropped from ${pRec} to ${cRec} this week.`
            });
          } else {
            generated.push({
              type: "warning",
              title: `${f.charAt(0).toUpperCase() + f.slice(1)} Demand Dropped`,
              description: `Sales decreased despite stable supply. This indicates lower customer interest or pricing issues for ${f}.`
            });
          }
        }
      } else if (cSale > pSale * 1.2 && pSale > 0) {
        // > 20% increase
        generated.push({
          type: "positive",
          title: `${f.charAt(0).toUpperCase() + f.slice(1)} Sales Surging`,
          description: `Sales increased significantly compared to last week.`
        });
      }
    });

    // 3. Source Quality / Receivals Comparison
    const ptDiff = current.pigfoodTruckKgs - prev.pigfoodTruckKgs;
    const ntDiff = current.normalTruckKgs - prev.normalTruckKgs;
    
    if (current.pigfoodTruckKgs > current.normalTruckKgs && current.pigfoodTruckKgs > 0) {
      generated.push({
        type: "info",
        title: "Pigfood Truck leads Receivals",
        description: `Pigfood trucks supplied the bulk of the volume (${current.pigfoodTruckKgs.toLocaleString()} kg) this week. Normal trucks brought in ${current.normalTruckKgs.toLocaleString()} kg.`
      });
    } else if (current.normalTruckKgs > current.pigfoodTruckKgs && current.normalTruckKgs > 0) {
      generated.push({
        type: "info",
        title: "Normal Trucks overtook Pigfood Trucks",
        description: `Normal trucks brought in more volume (${current.normalTruckKgs.toLocaleString()} kg) than Pigfood trucks (${current.pigfoodTruckKgs.toLocaleString()} kg). Ensure quality remains consistent.`
      });
    }

    return generated;
  }, [weeklyData]);

  // Tooltip formatter for currency
  const currencyFormatter = (value: number) => formatCurrency(value);
  const kgFormatter = (value: number) => `${value.toLocaleString()} kg`;

  if (loading) return <PageSpinner />;
  if (!canViewReports) return null;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
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
            <Activity className="h-6 w-6 text-emerald-500" />
            Advanced Analysis
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Inflow vs Outflow, Trend Analysis, and automated insights.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={dateLimit}
            onChange={(e) => setDateLimit(Number(e.target.value))}
            className="rounded-xl border border-gray-300 bg-white py-2 px-3 text-sm focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value={4}>Last 4 Weeks</option>
            <option value={8}>Last 8 Weeks</option>
            <option value={12}>Last 12 Weeks</option>
            <option value={24}>Last 24 Weeks</option>
          </select>
        </div>
      </div>

      {/* Automated Insights Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Info className="h-5 w-5 text-blue-500" />
          This Week's Insights
        </h2>
        {insights.length === 0 ? (
          <p className="text-sm text-gray-500">Not enough data for insights yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {insights.map((insight, idx) => (
              <div
                key={idx}
                className={`rounded-2xl border p-4 shadow-sm ${
                  insight.type === "negative" ? "bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30" :
                  insight.type === "warning" ? "bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30" :
                  insight.type === "positive" ? "bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30" :
                  "bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {insight.type === "negative" ? <TrendingDown className="h-5 w-5 text-red-500" /> :
                     insight.type === "warning" ? <AlertTriangle className="h-5 w-5 text-amber-500" /> :
                     insight.type === "positive" ? <TrendingUp className="h-5 w-5 text-emerald-500" /> :
                     <Activity className="h-5 w-5 text-blue-500" />}
                  </div>
                  <div>
                    <h3 className={`font-semibold text-sm ${
                      insight.type === "negative" ? "text-red-900 dark:text-red-400" :
                      insight.type === "warning" ? "text-amber-900 dark:text-amber-400" :
                      insight.type === "positive" ? "text-emerald-900 dark:text-emerald-400" :
                      "text-blue-900 dark:text-blue-400"
                    }`}>
                      {insight.title}
                    </h3>
                    <p className={`text-xs mt-1 leading-relaxed ${
                      insight.type === "negative" ? "text-red-700 dark:text-red-300" :
                      insight.type === "warning" ? "text-amber-700 dark:text-amber-300" :
                      insight.type === "positive" ? "text-emerald-700 dark:text-emerald-300" :
                      "text-blue-700 dark:text-blue-300"
                    }`}>
                      {insight.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manager's Notes Section */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-500" />
            Manager's Weekly Explanations
          </h2>
          <select
            value={selectedWeekKey}
            onChange={(e) => setSelectedWeekKey(e.target.value)}
            className="rounded-xl border border-gray-300 bg-gray-50 py-1.5 px-3 text-sm focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            {weeklyData.map((w) => (
              <option key={w.weekKey} value={w.weekKey}>Week of {w.weekKey}</option>
            ))}
          </select>
        </div>
        
        <textarea
          rows={3}
          placeholder="Add context or explanations for this week's performance (e.g. public holidays, truck breakdowns, specific sales campaigns...)"
          value={currentNote}
          onChange={(e) => setCurrentNote(e.target.value)}
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white mb-3"
        />
        
        <div className="flex justify-end">
          <button
            onClick={handleSaveNote}
            disabled={savingNote}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-600/25 hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingNote ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Explanation
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 1. Sales Trend (KGs & Revenue) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Sales Trends (Volume vs Revenue)</h2>
          <div className="h-80 w-full min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
              <ComposedChart data={weeklyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                <XAxis dataKey="weekKey" tick={{fontSize: 12}} tickMargin={10} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tickFormatter={(v) => `${v/1000}k`} tick={{fontSize: 12}} axisLine={false} tickLine={false} orientation="left" stroke="#059669" />
                <YAxis yAxisId="right" tickFormatter={(v) => `${v/1000}k`} tick={{fontSize: 12}} axisLine={false} tickLine={false} orientation="right" stroke="#7c3aed" />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any, name: any) => name === "Revenue" ? formatCurrency(Number(value)) : `${value} kg`}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar yAxisId="left" dataKey="salesKgs" name="Volume (kg)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Line yAxisId="right" type="monotone" dataKey="salesRevenue" name="Revenue" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Inflow vs Outflow */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Inflow vs Outflow (Supply vs Sales)</h2>
          <div className="h-80 w-full min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
              <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                <XAxis dataKey="weekKey" tick={{fontSize: 12}} tickMargin={10} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${v/1000}k`} tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => `${Number(value).toLocaleString()} kg`}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Area type="monotone" dataKey="receivalsKgs" name="Receivals (Inflow)" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRec)" />
                <Area type="monotone" dataKey="salesKgs" name="Sales (Outflow)" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Receival Sources Comparison */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50 lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Receival Sources (Pigfood Truck vs Normal Trucks)</h2>
          <div className="h-80 w-full min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
              <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                <XAxis dataKey="weekKey" tick={{fontSize: 12}} tickMargin={10} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${v/1000}k`} tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => `${Number(value).toLocaleString()} kg`}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="pigfoodTruckKgs" name="Pigfood Truck (Onsite)" stackId="a" fill="#34d399" maxBarSize={50} radius={[0, 0, 0, 0]} />
                <Bar dataKey="normalTruckKgs" name="Normal Trucks" stackId="a" fill="#60a5fa" maxBarSize={50} radius={[0, 0, 0, 0]} />
                <Bar dataKey="conveyorKgs" name="Conveyor (Local Sorted)" stackId="a" fill="#a78bfa" maxBarSize={50} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}

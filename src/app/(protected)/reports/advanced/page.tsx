"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { canDo } from "@/lib/rbac";
import { getAllSales, getAllReceivals, getWeeklyNotes, saveWeeklyNote, deleteWeeklyNote } from "@/lib/firestore";
import { Sale, Receival, WeeklyNote } from "@/types";
import { formatCurrency } from "@/utils/formatters";
import { PageSpinner } from "@/components/ui/Spinner";
import { useToast } from "@/contexts/ToastContext";
import { useAdvancedReports } from "@/hooks/useAdvancedReports";
import {
  ArrowLeft,
  Activity,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Info,
  Filter,
  FileText,
  Save,
  Plus,
  Edit2,
  Trash2
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

function NoteFormModal({ 
  isOpen, 
  onClose, 
  initialWeek, 
  initialText, 
  weeklyData, 
  isEdit,
  onSave 
}: {
  isOpen: boolean;
  onClose: () => void;
  initialWeek: string;
  initialText: string;
  weeklyData: any[];
  isEdit: boolean;
  onSave: (week: string, text: string) => Promise<void>;
}) {
  const [week, setWeek] = useState(initialWeek);
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setWeek(initialWeek);
      setText(initialText);
    }
  }, [isOpen, initialWeek, initialText]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    await onSave(week, text);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 border border-gray-200 dark:border-gray-700 animate-slide-up">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          {isEdit ? "Edit Explanation" : "Add Explanation"}
        </h3>
        
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Week</label>
            <select
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              disabled={isEdit}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-900"
            >
              {weeklyData.map(w => (
                <option key={w.weekKey} value={w.weekKey}>Week of {w.weekLabel} ({w.weekKey})</option>
              ))}
            </select>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Explanation</label>
            <textarea
              rows={4}
              placeholder="Context for performance..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !text.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdvancedReportPage() {
  const { appUser } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const canViewReports = canDo(appUser, "canViewReports");

  const [sales, setSales] = useState<Sale[]>([]);
  const [receivals, setReceivals] = useState<Receival[]>([]);
  const [weeklyNotes, setWeeklyNotes] = useState<WeeklyNote[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateLimit, setDateLimit] = useState<number>(12); // Last 12 weeks

  // Fetch data
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

  // Hook for Aggregation and Insights
  const { weeklyData, insights, kpis } = useAdvancedReports(sales, receivals, dateLimit);

  // Notes Modal State
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [initialNoteWeek, setInitialNoteWeek] = useState("");
  const [initialNoteText, setInitialNoteText] = useState("");
  const [isEditingNote, setIsEditingNote] = useState(false);

  function handleOpenNoteForm(weekKey?: string, text?: string) {
    if (weekKey) {
      setIsEditingNote(true);
      setInitialNoteWeek(weekKey);
      setInitialNoteText(text || "");
    } else {
      setIsEditingNote(false);
      // Default to the most recent week without a note
      const unusedWeeks = weeklyData.filter(w => !weeklyNotes.some(n => n.id === w.weekKey));
      setInitialNoteWeek(unusedWeeks.length > 0 ? unusedWeeks[unusedWeeks.length - 1].weekKey : weeklyData[weeklyData.length - 1]?.weekKey || "");
      setInitialNoteText("");
    }
    setIsNoteModalOpen(true);
  }

  async function handleSaveNote(weekKey: string, text: string) {
    if (!appUser || !weekKey) return;
    try {
      await saveWeeklyNote(weekKey, text, appUser.uid);
      setWeeklyNotes(prev => {
        const existing = prev.find(n => n.id === weekKey);
        if (existing) {
          return prev.map(n => n.id === weekKey ? { ...n, note: text } : n);
        } else {
          return [...prev, { id: weekKey, note: text, createdBy: appUser.uid, updatedAt: new Date() } as any];
        }
      });
      addToast("success", "Explanation saved successfully.");
      setIsNoteModalOpen(false);
    } catch (err) {
      console.error(err);
      addToast("error", "Failed to save explanation.");
    }
  }

  async function handleDeleteNote(weekKey: string) {
    if (!window.confirm("Delete this explanation?")) return;
    try {
      await deleteWeeklyNote(weekKey);
      setWeeklyNotes(prev => prev.filter(n => n.id !== weekKey));
      addToast("success", "Explanation deleted.");
    } catch {
      addToast("error", "Failed to delete explanation.");
    }
  }

  // Filter notes to only show those relevant to the currently displayed weeks
  const displayedWeeksKeys = new Set(weeklyData.map(w => w.weekKey));
  const relevantNotes = weeklyNotes.filter(n => displayedWeeksKeys.has(n.id)).sort((a, b) => b.id.localeCompare(a.id));

  if (loading) return <PageSpinner />;
  if (!canViewReports) return null;

  return (
    <div className="space-y-8 animate-fade-in pb-12 relative">
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

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Week of {kpis.current.weekLabel} Revenue</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{formatCurrency(kpis.current.salesRevenue)}</p>
            {kpis.prev.salesRevenue > 0 && (
              <p className={`text-sm mt-1 font-medium ${kpis.current.salesRevenue > kpis.prev.salesRevenue ? "text-emerald-600" : "text-red-500"}`}>
                {kpis.current.salesRevenue > kpis.prev.salesRevenue ? "↑" : "↓"} {Math.abs(((kpis.current.salesRevenue - kpis.prev.salesRevenue) / kpis.prev.salesRevenue) * 100).toFixed(1)}% vs prev week
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Week of {kpis.current.weekLabel} Volume Sold</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{kpis.current.salesKgs.toLocaleString()} kg</p>
            {kpis.prev.salesKgs > 0 && (
              <p className={`text-sm mt-1 font-medium ${kpis.current.salesKgs > kpis.prev.salesKgs ? "text-emerald-600" : "text-red-500"}`}>
                {kpis.current.salesKgs > kpis.prev.salesKgs ? "↑" : "↓"} {Math.abs(((kpis.current.salesKgs - kpis.prev.salesKgs) / kpis.prev.salesKgs) * 100).toFixed(1)}% vs prev week
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Week of {kpis.current.weekLabel} Receivals</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{kpis.current.receivalsKgs.toLocaleString()} kg</p>
            {kpis.prev.receivalsKgs > 0 && (
              <p className={`text-sm mt-1 font-medium ${kpis.current.receivalsKgs > kpis.prev.receivalsKgs ? "text-emerald-600" : "text-red-500"}`}>
                {kpis.current.receivalsKgs > kpis.prev.receivalsKgs ? "↑" : "↓"} {Math.abs(((kpis.current.receivalsKgs - kpis.prev.receivalsKgs) / kpis.prev.receivalsKgs) * 100).toFixed(1)}% vs prev week
              </p>
            )}
          </div>
        </div>
      )}

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

      {/* Manager's Notes Section (CRUD) */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-500" />
            Manager's Weekly Explanations
          </h2>
          <button
            onClick={() => handleOpenNoteForm()}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-600 hover:bg-emerald-100 transition-colors dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
          >
            <Plus className="h-4 w-4" /> Add Note
          </button>
        </div>
        
        {relevantNotes.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">No explanations saved for the selected period.</p>
        ) : (
          <div className="space-y-3">
            {relevantNotes.map(n => {
              const weekAgg = weeklyData.find(w => w.weekKey === n.id);
              const label = weekAgg ? weekAgg.weekLabel : n.id;
              
              return (
                <div key={n.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700/30 dark:bg-gray-800/30 flex justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Week of {label}</h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{n.note}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleOpenNoteForm(n.id, n.note)} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDeleteNote(n.id)} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Note Edit Modal / Inline Form */}
      <NoteFormModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        initialWeek={initialNoteWeek}
        initialText={initialNoteText}
        weeklyData={weeklyData}
        isEdit={isEditingNote}
        onSave={handleSaveNote}
      />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Sales Trend (KGs & Revenue) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Sales Trends (Volume vs Revenue)</h2>
          <div className="h-80 w-full min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
              <ComposedChart data={weeklyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                <XAxis dataKey="weekLabel" height={30} tick={{fontSize: 12}} tickMargin={10} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" width={50} tickFormatter={(v) => `${v/1000}k`} tick={{fontSize: 12}} axisLine={false} tickLine={false} orientation="left" stroke="#059669" />
                <YAxis yAxisId="right" width={50} tickFormatter={(v) => `${v/1000}k`} tick={{fontSize: 12}} axisLine={false} tickLine={false} orientation="right" stroke="#7c3aed" />
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
                <XAxis dataKey="weekLabel" height={30} tick={{fontSize: 12}} tickMargin={10} axisLine={false} tickLine={false} />
                <YAxis width={50} tickFormatter={(v) => `${v/1000}k`} tick={{fontSize: 12}} axisLine={false} tickLine={false} />
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
                <XAxis dataKey="weekLabel" height={30} tick={{fontSize: 12}} tickMargin={10} axisLine={false} tickLine={false} />
                <YAxis width={50} tickFormatter={(v) => `${v/1000}k`} tick={{fontSize: 12}} axisLine={false} tickLine={false} />
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

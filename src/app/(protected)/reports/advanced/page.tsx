"use client";
import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { canDo } from "@/lib/rbac";
import { getAllSales, getAllReceivals, getWeeklyNotes, saveWeeklyNote, deleteWeeklyNote } from "@/lib/firestore";
import { Sale, Receival, WeeklyNote } from "@/types";
import { formatCurrency } from "@/utils/formatters";
import { PageSpinner } from "@/components/ui/Spinner";
import { useToast } from "@/contexts/ToastContext";
import { useAdvancedReports, aggregatePeriod, generateComparisonInsights } from "@/hooks/useAdvancedReports";
import { format, parseISO } from "date-fns";
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
  Trash2,
  ArrowLeftRight,
  X,
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
  BarChart,
} from "recharts";

// ─── Note Modal ───────────────────────────────────────────────────────────────
function NoteFormModal({
  isOpen,
  onClose,
  initialWeek,
  initialText,
  weeklyData,
  isEdit,
  onSave,
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
              {weeklyData.map((w) => (
                <option key={w.weekKey} value={w.weekKey}>
                  Week of {w.weekLabel} ({w.weekKey})
                </option>
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
            {saving ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Insight Card ─────────────────────────────────────────────────────────────
function InsightCard({ insight }: { insight: any }) {
  const colorMap = {
    negative: {
      card: "bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30",
      title: "text-red-900 dark:text-red-400",
      body: "text-red-700 dark:text-red-300",
      footer: "text-red-800 dark:text-red-200",
      icon: <TrendingDown className="h-5 w-5 text-red-500" />,
    },
    warning: {
      card: "bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30",
      title: "text-amber-900 dark:text-amber-400",
      body: "text-amber-700 dark:text-amber-300",
      footer: "text-amber-800 dark:text-amber-200",
      icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    },
    positive: {
      card: "bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30",
      title: "text-emerald-900 dark:text-emerald-400",
      body: "text-emerald-700 dark:text-emerald-300",
      footer: "text-emerald-800 dark:text-emerald-200",
      icon: <TrendingUp className="h-5 w-5 text-emerald-500" />,
    },
    info: {
      card: "bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30",
      title: "text-blue-900 dark:text-blue-400",
      body: "text-blue-700 dark:text-blue-300",
      footer: "text-blue-800 dark:text-blue-200",
      icon: <Activity className="h-5 w-5 text-blue-500" />,
    },
  };

  const c = colorMap[insight.type as keyof typeof colorMap] ?? colorMap.info;

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${c.card}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{c.icon}</div>
        <div>
          <h3 className={`font-semibold text-sm ${c.title}`}>{insight.title}</h3>
          {insight.description && (
            <p className={`text-xs mt-1 leading-relaxed ${c.body}`}>{insight.description}</p>
          )}
          {insight.list && (
            <ul className={`mt-2 space-y-1 text-xs list-disc pl-4 ${c.body}`}>
              {insight.list.map((item: string, i: number) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
          {insight.footer && (
            <p className={`text-xs mt-2 font-semibold ${c.footer}`}>{insight.footer}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Compare KPI Card ─────────────────────────────────────────────────────────
function CompareKpiCard({
  label,
  aValue,
  bValue,
  format: fmt,
  aLabel,
  bLabel,
}: {
  label: string;
  aValue: number;
  bValue: number;
  format: "currency" | "kg";
  aLabel: string;
  bLabel: string;
}) {
  const diff = bValue - aValue;
  const pct = aValue > 0 ? ((diff / aValue) * 100).toFixed(1) : null;
  const isPositive = diff >= 0;

  const fmtVal = (v: number) =>
    fmt === "currency" ? formatCurrency(v) : `${v.toLocaleString()} kg`;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">{label}</h3>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">{aLabel}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{fmtVal(aValue)}</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <ArrowLeftRight className="h-4 w-4 text-gray-300" />
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              isPositive
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            }`}
          >
            {isPositive ? "+" : ""}
            {pct ? `${pct}%` : "N/A"}
          </span>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 mb-0.5">{bLabel}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{fmtVal(bValue)}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span
          className={`text-sm font-semibold ${
            isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
          }`}
        >
          {isPositive ? "▲" : "▼"} {fmtVal(Math.abs(diff))}
        </span>
        <span className="text-xs text-gray-400">change</span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdvancedReportPage() {
  const { appUser } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const canViewReports = canDo(appUser, "canViewReports");

  const [sales, setSales] = useState<Sale[]>([]);
  const [receivals, setReceivals] = useState<Receival[]>([]);
  const [weeklyNotes, setWeeklyNotes] = useState<WeeklyNote[]>([]);
  const [loading, setLoading] = useState(true);

  // Standard filter
  const [dateLimit, setDateLimit] = useState<number>(4);

  // Compare mode
  const [compareMode, setCompareMode] = useState(false);
  const [periodAStart, setPeriodAStart] = useState("");
  const [periodAEnd, setPeriodAEnd] = useState("");
  const [periodBStart, setPeriodBStart] = useState("");
  const [periodBEnd, setPeriodBEnd] = useState("");

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

  // Hook for standard view
  const { weeklyData, insights, kpis } = useAdvancedReports(sales, receivals, dateLimit);

  // Compare mode periods
  const periodA = useMemo(() => {
    if (!compareMode || !periodAStart || !periodAEnd) return null;
    try {
      const start = parseISO(periodAStart);
      const end = parseISO(periodAEnd);
      const label = `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
      return aggregatePeriod(sales, receivals, start, end, label);
    } catch {
      return null;
    }
  }, [compareMode, periodAStart, periodAEnd, sales, receivals]);

  const periodB = useMemo(() => {
    if (!compareMode || !periodBStart || !periodBEnd) return null;
    try {
      const start = parseISO(periodBStart);
      const end = parseISO(periodBEnd);
      const label = `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
      return aggregatePeriod(sales, receivals, start, end, label);
    } catch {
      return null;
    }
  }, [compareMode, periodBStart, periodBEnd, sales, receivals]);

  const comparisonInsights = useMemo(() => {
    if (!periodA || !periodB) return [];
    return generateComparisonInsights(periodA, periodB);
  }, [periodA, periodB]);

  // Comparison chart data (grouped bars)
  const comparisonChartData = useMemo(() => {
    if (!periodA || !periodB) return [];
    return [
      { metric: "Revenue (KES)", [periodA.label]: periodA.salesRevenue, [periodB.label]: periodB.salesRevenue },
      { metric: "Volume Sold (kg)", [periodA.label]: periodA.salesKgs, [periodB.label]: periodB.salesKgs },
      { metric: "Receivals (kg)", [periodA.label]: periodA.receivalsKgs, [periodB.label]: periodB.receivalsKgs },
    ];
  }, [periodA, periodB]);

  const comparisonFractionData = useMemo(() => {
    if (!periodA || !periodB) return [];
    const fractions = ["cookedFood", "bread", "meat", "bones", "veggies"] as const;
    return fractions.map((f) => ({
      fraction: f === "cookedFood" ? "Cooked Food" : f.charAt(0).toUpperCase() + f.slice(1),
      [`${periodA.label} (kg)`]: periodA.salesFractions[f],
      [`${periodB.label} (kg)`]: periodB.salesFractions[f],
      [`${periodA.label} Rev`]: periodA.salesRevenueFractions[f],
      [`${periodB.label} Rev`]: periodB.salesRevenueFractions[f],
    }));
  }, [periodA, periodB]);

  // Notes modal state
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
      const unusedWeeks = weeklyData.filter((w) => !weeklyNotes.some((n) => n.id === w.weekKey));
      setInitialNoteWeek(
        unusedWeeks.length > 0
          ? unusedWeeks[unusedWeeks.length - 1].weekKey
          : weeklyData[weeklyData.length - 1]?.weekKey || ""
      );
      setInitialNoteText("");
    }
    setIsNoteModalOpen(true);
  }

  async function handleSaveNote(weekKey: string, text: string) {
    if (!appUser || !weekKey) return;
    try {
      await saveWeeklyNote(weekKey, text, appUser.uid);
      setWeeklyNotes((prev) => {
        const existing = prev.find((n) => n.id === weekKey);
        if (existing) {
          return prev.map((n) => (n.id === weekKey ? { ...n, note: text } : n));
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
      setWeeklyNotes((prev) => prev.filter((n) => n.id !== weekKey));
      addToast("success", "Explanation deleted.");
    } catch {
      addToast("error", "Failed to delete explanation.");
    }
  }

  const displayedWeeksKeys = new Set(weeklyData.map((w) => w.weekKey));
  const relevantNotes = weeklyNotes
    .filter((n) => displayedWeeksKeys.has(n.id))
    .sort((a, b) => b.id.localeCompare(a.id));

  if (loading) return <PageSpinner />;
  if (!canViewReports) return null;

  const bothPeriodsReady = compareMode && periodA && periodB;

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

        <div className="flex items-center gap-2 flex-wrap">
          {/* Compare Mode Toggle */}
          <button
            onClick={() => setCompareMode((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
              compareMode
                ? "bg-violet-600 border-violet-600 text-white hover:bg-violet-700"
                : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            <ArrowLeftRight className="h-4 w-4" />
            Compare Periods
          </button>

          {/* Standard week filter (hidden in compare mode) */}
          {!compareMode && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* ── COMPARE MODE UI ──────────────────────────────────────────────── */}
      {compareMode && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 dark:border-violet-900/40 dark:bg-violet-900/10 p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-violet-900 dark:text-violet-300 flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              Compare Two Periods
            </h2>
            <button
              onClick={() => setCompareMode(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Period A */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-violet-100 dark:border-violet-900/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
                <span className="text-sm font-semibold text-gray-800 dark:text-white">Period A</span>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-gray-500">From</label>
                  <input
                    type="date"
                    value={periodAStart}
                    onChange={(e) => setPeriodAStart(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-gray-500">To</label>
                  <input
                    type="date"
                    value={periodAEnd}
                    onChange={(e) => setPeriodAEnd(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>
              {periodA && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                  ✓ {periodA.label} · Revenue: {formatCurrency(periodA.salesRevenue)} · {periodA.salesKgs.toLocaleString()} kg
                </p>
              )}
            </div>

            {/* Period B */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-violet-100 dark:border-violet-900/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-violet-500 inline-block" />
                <span className="text-sm font-semibold text-gray-800 dark:text-white">Period B</span>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-gray-500">From</label>
                  <input
                    type="date"
                    value={periodBStart}
                    onChange={(e) => setPeriodBStart(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-gray-500">To</label>
                  <input
                    type="date"
                    value={periodBEnd}
                    onChange={(e) => setPeriodBEnd(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>
              {periodB && (
                <p className="text-xs text-violet-700 dark:text-violet-400 font-medium">
                  ✓ {periodB.label} · Revenue: {formatCurrency(periodB.salesRevenue)} · {periodB.salesKgs.toLocaleString()} kg
                </p>
              )}
            </div>
          </div>

          {!bothPeriodsReady && (
            <p className="text-xs text-center text-violet-500 dark:text-violet-400">
              Select a start and end date for both periods to see the comparison.
            </p>
          )}
        </div>
      )}

      {/* ── COMPARE DASHBOARD ────────────────────────────────────────────── */}
      {bothPeriodsReady && periodA && periodB && (
        <div className="space-y-8 animate-fade-in">
          {/* Compare KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CompareKpiCard
              label="Total Revenue"
              aValue={periodA.salesRevenue}
              bValue={periodB.salesRevenue}
              format="currency"
              aLabel={periodA.label}
              bLabel={periodB.label}
            />
            <CompareKpiCard
              label="Volume Sold"
              aValue={periodA.salesKgs}
              bValue={periodB.salesKgs}
              format="kg"
              aLabel={periodA.label}
              bLabel={periodB.label}
            />
            <CompareKpiCard
              label="Receivals (Inflow)"
              aValue={periodA.receivalsKgs}
              bValue={periodB.receivalsKgs}
              format="kg"
              aLabel={periodA.label}
              bLabel={periodB.label}
            />
          </div>

          {/* Avg price per kg cards */}
          {(() => {
            const fractions = ["meat", "bread", "cookedFood", "bones", "veggies"] as const;
            const cards = fractions
              .filter(
                (f) =>
                  periodA.salesFractions[f] > 0 || periodB.salesFractions[f] > 0
              )
              .map((f) => {
                const aAvg =
                  periodA.salesFractions[f] > 0
                    ? periodA.salesRevenueFractions[f] / periodA.salesFractions[f]
                    : 0;
                const bAvg =
                  periodB.salesFractions[f] > 0
                    ? periodB.salesRevenueFractions[f] / periodB.salesFractions[f]
                    : 0;
                const fName =
                  f === "cookedFood"
                    ? "Cooked Food"
                    : f.charAt(0).toUpperCase() + f.slice(1);
                const changed = Math.abs(bAvg - aAvg) > 0.5;
                return (
                  <div
                    key={f}
                    className={`rounded-xl border p-3 text-sm ${
                      changed
                        ? "bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/30"
                        : "bg-gray-50 border-gray-100 dark:bg-gray-800/30 dark:border-gray-700/30"
                    }`}
                  >
                    <p className="text-xs font-medium text-gray-500 mb-1">{fName} avg price/kg</p>
                    <div className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-200">
                      <span className="text-emerald-600">KES {aAvg.toFixed(0)}</span>
                      <ArrowLeftRight className="h-3 w-3 text-gray-400" />
                      <span className="text-violet-600">KES {bAvg.toFixed(0)}</span>
                      {changed && (
                        <span className="ml-1 text-xs font-bold text-amber-600">
                          ⚠️ {bAvg > aAvg ? "▲" : "▼"} Price changed
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Vol: {periodA.salesFractions[f].toLocaleString()} kg → {periodB.salesFractions[f].toLocaleString()} kg &nbsp;|&nbsp;
                      Rev: {formatCurrency(periodA.salesRevenueFractions[f])} → {formatCurrency(periodB.salesRevenueFractions[f])}
                    </div>
                  </div>
                );
              });
            return cards.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Avg Price per Fraction
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">{cards}</div>
              </div>
            ) : null;
          })()}

          {/* Comparison Insights */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Info className="h-5 w-5 text-violet-500" />
              Period Comparison Insights
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {comparisonInsights.map((insight, idx) => (
                <InsightCard key={idx} insight={insight} />
              ))}
            </div>
          </div>

          {/* Compare Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue & Volume grouped bar */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                Revenue &amp; Volume Comparison
              </h2>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                    <XAxis dataKey="metric" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                      formatter={(value: any) => Number(value).toLocaleString()}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey={periodA.label} fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey={periodB.label} fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Fraction volume comparison */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                Fraction Volume Comparison
              </h2>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonFractionData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                    <XAxis dataKey="fraction" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `${v}kg`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                      formatter={(value: any) => `${Number(value).toLocaleString()} kg`}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey={`${periodA.label} (kg)`} fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={35} />
                    <Bar dataKey={`${periodB.label} (kg)`} fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={35} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STANDARD VIEW (hidden when compare mode is fully active) ──────── */}
      {!bothPeriodsReady && (
        <>
          {/* KPIs */}
          {kpis && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Week of {kpis.current.weekLabel} Revenue
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {formatCurrency(kpis.current.salesRevenue)}
                </p>
                {kpis.prev.salesRevenue > 0 && (
                  <p
                    className={`text-sm mt-1 font-medium ${
                      kpis.current.salesRevenue > kpis.prev.salesRevenue
                        ? "text-emerald-600"
                        : "text-red-500"
                    }`}
                  >
                    {kpis.current.salesRevenue > kpis.prev.salesRevenue ? "↑" : "↓"}{" "}
                    {Math.abs(
                      ((kpis.current.salesRevenue - kpis.prev.salesRevenue) /
                        kpis.prev.salesRevenue) *
                        100
                    ).toFixed(1)}
                    % vs prev week
                  </p>
                )}
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Week of {kpis.current.weekLabel} Volume Sold
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {kpis.current.salesKgs.toLocaleString()} kg
                </p>
                {kpis.prev.salesKgs > 0 && (
                  <p
                    className={`text-sm mt-1 font-medium ${
                      kpis.current.salesKgs > kpis.prev.salesKgs ? "text-emerald-600" : "text-red-500"
                    }`}
                  >
                    {kpis.current.salesKgs > kpis.prev.salesKgs ? "↑" : "↓"}{" "}
                    {Math.abs(
                      ((kpis.current.salesKgs - kpis.prev.salesKgs) / kpis.prev.salesKgs) * 100
                    ).toFixed(1)}
                    % vs prev week
                  </p>
                )}
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Week of {kpis.current.weekLabel} Receivals
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {kpis.current.receivalsKgs.toLocaleString()} kg
                </p>
                {kpis.prev.receivalsKgs > 0 && (
                  <p
                    className={`text-sm mt-1 font-medium ${
                      kpis.current.receivalsKgs > kpis.prev.receivalsKgs
                        ? "text-emerald-600"
                        : "text-red-500"
                    }`}
                  >
                    {kpis.current.receivalsKgs > kpis.prev.receivalsKgs ? "↑" : "↓"}{" "}
                    {Math.abs(
                      ((kpis.current.receivalsKgs - kpis.prev.receivalsKgs) /
                        kpis.prev.receivalsKgs) *
                        100
                    ).toFixed(1)}
                    % vs prev week
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Automated Insights */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-500" />
              Last Week's Insights
            </h2>
            {insights.length === 0 ? (
              <p className="text-sm text-gray-500">Not enough data for insights yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {insights.map((insight, idx) => (
                  <InsightCard key={idx} insight={insight} />
                ))}
              </div>
            )}
          </div>

          {/* Manager's Weekly Explanations */}
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
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
                No explanations saved for the selected period.
              </p>
            ) : (
              <div className="space-y-3">
                {relevantNotes.map((n) => {
                  const weekAgg = weeklyData.find((w) => w.weekKey === n.id);
                  const label = weekAgg ? weekAgg.weekLabel : n.id;
                  return (
                    <div
                      key={n.id}
                      className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700/30 dark:bg-gray-800/30 flex justify-between gap-4"
                    >
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                          Week of {label}
                        </h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {n.note}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenNoteForm(n.id, n.note)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteNote(n.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Trends */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                Sales Trends (Volume vs Revenue)
              </h2>
              <div className="h-80 w-full min-h-[320px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                  <ComposedChart data={weeklyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                    <XAxis dataKey="weekLabel" height={30} tick={{ fontSize: 12 }} tickMargin={10} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" width={50} tickFormatter={(v) => `${v / 1000}k`} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} orientation="left" stroke="#059669" />
                    <YAxis yAxisId="right" width={50} tickFormatter={(v) => `${v / 1000}k`} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} orientation="right" stroke="#7c3aed" />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                      formatter={(value: any, name: any) =>
                        name === "Revenue" ? formatCurrency(Number(value)) : `${value} kg`
                      }
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                    <Bar yAxisId="left" dataKey="salesKgs" name="Volume (kg)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Line yAxisId="right" type="monotone" dataKey="salesRevenue" name="Revenue" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Inflow vs Outflow */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                Inflow vs Outflow (Supply vs Sales)
              </h2>
              <div className="h-80 w-full min-h-[320px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                  <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                    <XAxis dataKey="weekLabel" height={30} tick={{ fontSize: 12 }} tickMargin={10} axisLine={false} tickLine={false} />
                    <YAxis width={50} tickFormatter={(v) => `${v / 1000}k`} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                      formatter={(value: any) => `${Number(value).toLocaleString()} kg`}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                    <Area type="monotone" dataKey="receivalsKgs" name="Receivals (Inflow)" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRec)" />
                    <Area type="monotone" dataKey="salesKgs" name="Sales (Outflow)" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Receival Sources */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50 lg:col-span-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                Receival Sources (Pigfood Truck vs Normal Trucks)
              </h2>
              <div className="h-80 w-full min-h-[320px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                  <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                    <XAxis dataKey="weekLabel" height={30} tick={{ fontSize: 12 }} tickMargin={10} axisLine={false} tickLine={false} />
                    <YAxis width={50} tickFormatter={(v) => `${v / 1000}k`} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                      formatter={(value: any) => `${Number(value).toLocaleString()} kg`}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="pigfoodTruckKgs" name="Pigfood Truck (Onsite)" stackId="a" fill="#34d399" maxBarSize={50} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="normalTruckKgs" name="Normal Trucks" stackId="a" fill="#60a5fa" maxBarSize={50} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="conveyorKgs" name="Conveyor (Local Sorted)" stackId="a" fill="#a78bfa" maxBarSize={50} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Note Form Modal */}
      <NoteFormModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        initialWeek={initialNoteWeek}
        initialText={initialNoteText}
        weeklyData={weeklyData}
        isEdit={isEditingNote}
        onSave={handleSaveNote}
      />
    </div>
  );
}

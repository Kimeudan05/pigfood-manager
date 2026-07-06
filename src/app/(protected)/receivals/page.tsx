"use client";
import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { getAllReceivals, deleteReceival } from "@/lib/firestore";
import { Receival } from "@/types";
import { formatDate, toDate } from "@/utils/formatters";
import { PageSpinner } from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import { ConfirmModal } from "@/components/ui/Modal";
import { canDo } from "@/lib/rbac";
import { Plus, Search, Trash2, Truck, Filter, ChevronLeft, ChevronRight, Lock } from "lucide-react";

const PER_PAGE = 12;

export default function ReceivalsPage() {
  const { appUser } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();

  // Using view reports / view sales as proxy for receivals access
  const canView = canDo(appUser, "canViewReports") || canDo(appUser, "canViewSales");
  const canAdd = canDo(appUser, "canAddSale") || canDo(appUser, "canViewReports");
  const canDelete = canDo(appUser, "canDeleteSale");

  function denyToast(action: string) {
    addToast("warning", `🔒 You don't have permission to ${action}. Contact your admin.`);
  }

  const [receivals, setReceivals] = useState<Receival[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);
  const [delTarget, setDelTarget] = useState<Receival | null>(null);
  const [delLoading, setDelLoading] = useState(false);

  async function load() {
    try {
      setReceivals(await getAllReceivals());
    } catch {
      addToast("error", "Failed to load receivals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!appUser) return;
    if (!canView) {
      router.replace("/dashboard");
      return;
    }
    load();
  }, [appUser, canView, router]);

  const filtered = useMemo(() => {
    let result = receivals;
    if (search) {
      const t = search.toLowerCase();
      result = result.filter(r => 
        r.source.toLowerCase().includes(t) || 
        (r.truckNumber && r.truckNumber.toLowerCase().includes(t)) ||
        (r.notes && r.notes.toLowerCase().includes(t))
      );
    }
    if (dateFilter) {
      result = result.filter(r => {
        if (!r.createdAt) return false;
        const d = toDate(r.createdAt);
        return d.toISOString().slice(0, 10) === dateFilter;
      });
    }
    return result;
  }, [receivals, search, dateFilter]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  useEffect(() => { setPage(1); }, [search, dateFilter]);

  async function handleDelete() {
    if (!delTarget) return;
    if (!canDelete) { denyToast("delete receivals"); setDelTarget(null); return; }
    setDelLoading(true);
    try {
      await deleteReceival(delTarget.id);
      addToast("success", "Receival deleted");
      setDelTarget(null);
      await load();
    } catch {
      addToast("error", "Delete failed");
    } finally {
      setDelLoading(false);
    }
  }

  if (loading) return <PageSpinner />;
  if (!canView) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Truck className="h-6 w-6 text-emerald-500" />
            Receivals
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{receivals.length} logged receivals</p>
        </div>
        {canAdd ? (
          <Link href="/receivals/new" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 transition-all">
            <Plus className="h-4 w-4" /> Log Receival
          </Link>
        ) : (
          <button
            onClick={() => denyToast("add receivals")}
            className="inline-flex items-center gap-2 rounded-xl bg-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500"
          >
            <Lock className="h-4 w-4" /> Log Receival
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Search source or truck #..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white transition-all" />
        </div>
        <div className="relative">
          <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white transition-all" />
        </div>
        {dateFilter && <button onClick={() => setDateFilter("")} className="text-xs text-red-500 hover:text-red-400 self-center">Clear date</button>}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Truck className="h-10 w-10 text-emerald-400" />} title={search || dateFilter ? "No matching receivals" : "No receivals logged"} description="Log the first incoming supply to see it here" />
      ) : (
        <>
          <div className="hidden md:block rounded-2xl border border-gray-200 bg-white overflow-hidden dark:border-gray-700/50 dark:bg-gray-800/50">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50">
                <th className="px-5 py-3.5 text-left text-xs font-medium text-gray-500">Date</th>
                <th className="px-5 py-3.5 text-left text-xs font-medium text-gray-500">Source</th>
                <th className="px-5 py-3.5 text-left text-xs font-medium text-gray-500">Truck #</th>
                <th className="px-5 py-3.5 text-right text-xs font-medium text-gray-500">Net Weight (KG)</th>
                <th className="px-5 py-3.5 text-right text-xs font-medium text-gray-500">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/30">
                {paginated.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                    <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">{formatDate(r.createdAt)}</td>
                    <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                        r.source === 'Pigfood Truck' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        r.source === 'Normal Truck' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                        'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                      }`}>
                        {r.source}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-600 dark:text-gray-300">{r.truckNumber || '—'}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-gray-900 dark:text-white">{r.netWeight.toLocaleString()} kg</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {canDelete ? (
                          <button onClick={() => setDelTarget(r)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors" title="Delete"><Trash2 className="h-4 w-4" /></button>
                        ) : (
                          <button onClick={() => denyToast("delete receivals")} className="rounded-lg p-2 text-gray-200 dark:text-gray-700 cursor-not-allowed" title="Permission required"><Trash2 className="h-4 w-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {paginated.map(r => (
              <div key={r.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700/50 dark:bg-gray-800/50">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{r.source}</p>
                    <p className="text-xs text-gray-500 font-mono">{r.truckNumber || 'No truck #'}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{r.netWeight.toLocaleString()} kg</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{formatDate(r.createdAt)}</span>
                  <div className="flex gap-1">
                    {canDelete ? (
                      <button onClick={() => setDelTarget(r)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    ) : (
                      <button onClick={() => denyToast("delete receivals")} className="p-1.5 text-gray-200 dark:text-gray-700 cursor-not-allowed"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmModal isOpen={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={handleDelete} title="Delete Receival"
        message={`Delete receival of ${delTarget?.netWeight}kg from ${delTarget?.source}?`} confirmLabel="Delete" loading={delLoading} />
    </div>
  );
}

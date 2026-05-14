"use client";
import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { getAllCustomers, addCustomer, updateCustomer, deleteCustomer } from "@/lib/firestore";
import { Customer, CustomerFormData } from "@/types";
import { formatDate } from "@/utils/formatters";
import { PageSpinner } from "@/components/ui/Spinner";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import Modal, { ConfirmModal } from "@/components/ui/Modal";
import { Plus, Search, Edit2, Trash2, Eye, Users, MapPin, Phone, ChevronLeft, ChevronRight } from "lucide-react";

const PER_PAGE = 10;
const inputCls = "w-full rounded-xl border border-gray-300 bg-gray-50 py-2.5 px-4 text-sm text-gray-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white transition-all";

export default function CustomersPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [delTarget, setDelTarget] = useState<Customer | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [delLoading, setDelLoading] = useState(false);
  const [form, setForm] = useState<CustomerFormData>({ fullName: "", phone: "", location: "", notes: "" });

  async function load() {
    try { setCustomers(await getAllCustomers()); } catch { addToast("error", "Failed to load customers"); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const t = search.toLowerCase();
    return customers.filter(c => c.fullName.toLowerCase().includes(t) || c.phone.includes(t) || c.location.toLowerCase().includes(t));
  }, [customers, search]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  useEffect(() => { setPage(1); }, [search]);

  function openAdd() { setEditing(null); setForm({ fullName: "", phone: "", location: "", notes: "" }); setShowForm(true); }
  function openEdit(c: Customer) { setEditing(c); setForm({ fullName: c.fullName, phone: c.phone, location: c.location, notes: c.notes }); setShowForm(true); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) { addToast("warning", "Name is required"); return; }
    setFormLoading(true);
    try {
      if (editing) { await updateCustomer(editing.id, form); addToast("success", "Customer updated"); }
      else { await addCustomer(form, user!.uid); addToast("success", "Customer added"); }
      setShowForm(false); await load();
    } catch { addToast("error", "Operation failed"); } finally { setFormLoading(false); }
  }

  async function handleDelete() {
    if (!delTarget) return;
    setDelLoading(true);
    try { await deleteCustomer(delTarget.id); addToast("success", "Customer deleted"); setDelTarget(null); await load(); }
    catch { addToast("error", "Delete failed"); } finally { setDelLoading(false); }
  }

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{customers.length} total</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 transition-all">
          <Plus className="h-4 w-4" /> Add Customer
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input type="text" placeholder="Search name, phone, location..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white transition-all" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Users className="h-10 w-10 text-emerald-400" />} title={search ? "No results" : "No customers yet"} description={search ? "Try different terms" : "Add your first customer"} />
      ) : (
        <>
          <div className="hidden md:block rounded-2xl border border-gray-200 bg-white overflow-hidden dark:border-gray-700/50 dark:bg-gray-800/50">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50">
                <th className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Name</th>
                <th className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Phone</th>
                <th className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Location</th>
                <th className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Added</th>
                <th className="px-5 py-3.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/30">
                {paginated.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">{c.fullName}</td>
                    <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">{c.phone || "—"}</td>
                    <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">{c.location || "—"}</td>
                    <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">{formatDate(c.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/customers/${c.id}`} className="rounded-lg p-2 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400 transition-colors"><Eye className="h-4 w-4" /></Link>
                        <button onClick={() => openEdit(c)} className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => setDelTarget(c)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {paginated.map(c => (
              <div key={c.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700/50 dark:bg-gray-800/50">
                <div className="flex items-start justify-between mb-2">
                  <div><p className="font-semibold text-gray-900 dark:text-white">{c.fullName}</p><p className="text-xs text-gray-500 mt-0.5">Added {formatDate(c.createdAt)}</p></div>
                  <div className="flex gap-1">
                    <Link href={`/customers/${c.id}`} className="p-1.5 text-gray-400 hover:text-emerald-600"><Eye className="h-4 w-4" /></Link>
                    <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => setDelTarget(c)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-300">
                  {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                  {c.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.location}</span>}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</p>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Customer" : "Add Customer"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Full Name *</label>
            <input type="text" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="Enter name" className={inputCls} required /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Phone</label>
            <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0712345678" className={inputCls} /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Location</label>
            <input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Nairobi" className={inputCls} /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." rows={3} className={inputCls + " resize-none"} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 transition-colors">Cancel</button>
            <button type="submit" disabled={formLoading} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-all">
              {formLoading ? <Spinner size="sm" /> : editing ? "Update" : "Add"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal isOpen={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={handleDelete} title="Delete Customer"
        message={`Delete "${delTarget?.fullName}"? This cannot be undone.`} loading={delLoading} />
    </div>
  );
}

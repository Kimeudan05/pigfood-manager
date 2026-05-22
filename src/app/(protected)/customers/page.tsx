"use client";
import React, { useEffect, useState, useMemo, useRef } from "react";
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
import {
  Plus, Search, Edit2, Trash2, Eye, EyeOff, Users, MapPin, Phone,
  ChevronLeft, ChevronRight, FileUp, Download, CheckSquare, Sheet, X,
} from "lucide-react";
import * as XLSX from "xlsx";

const PER_PAGE = 10;
const inputCls =
  "w-full rounded-xl border border-gray-300 bg-gray-50 py-2.5 px-4 text-sm text-gray-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white transition-all";

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
  const [showConfirmAdd, setShowConfirmAdd] = useState(false);
  const [pendingCustomer, setPendingCustomer] = useState<CustomerFormData | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPhones, setShowPhones] = useState<Record<string, boolean>>({});

  // ── Select / Bulk-delete state ──
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkDelLoading, setBulkDelLoading] = useState(false);

  // ── Google Sheet import state ──
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetImporting, setSheetImporting] = useState(false);

  async function load() {
    try { setCustomers(await getAllCustomers()); }
    catch { addToast("error", "Failed to load customers"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const t = search.toLowerCase();
    return customers.filter(
      c =>
        c.fullName.toLowerCase().includes(t) ||
        c.phone.includes(t) ||
        c.location.toLowerCase().includes(t)
    );
  }, [customers, search]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  useEffect(() => { setPage(1); }, [search]);

  function openAdd() { setEditing(null); setForm({ fullName: "", phone: "", location: "", notes: "" }); setShowForm(true); }
  function openEdit(c: Customer) { setEditing(c); setForm({ fullName: c.fullName, phone: c.phone, location: c.location, notes: c.notes }); setShowForm(true); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) { addToast("warning", "Name is required"); return; }
    if (!editing) {
      const exists = customers.some(c => c.fullName.toLowerCase().trim() === form.fullName.toLowerCase().trim());
      if (exists) { setPendingCustomer(form); setShowConfirmAdd(true); return; }
    }
    await proceedAdd(form);
  }

  async function proceedAdd(formData: CustomerFormData) {
    setFormLoading(true);
    try {
      if (editing) { await updateCustomer(editing.id, formData); addToast("success", "Customer updated"); }
      else { await addCustomer(formData, user!.uid); addToast("success", "Customer added"); }
      setShowForm(false); setShowConfirmAdd(false); setPendingCustomer(null); await load();
    } catch { addToast("error", "Operation failed"); } finally { setFormLoading(false); }
  }

  // ── Excel Import ──
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(worksheet) as any[];
      let added = 0;
      for (const row of json) {
        if (!row["Full Name"]) continue;
        const nc: CustomerFormData = {
          fullName: String(row["Full Name"] || "").trim(),
          phone: String(row["Phone"] || "").trim(),
          location: String(row["Location"] || "").trim(),
          notes: String(row["Notes"] || "").trim(),
        };
        if (!customers.some(c => c.fullName.toLowerCase().trim() === nc.fullName.toLowerCase().trim())) {
          await addCustomer(nc, user!.uid); added++;
        }
      }
      if (added > 0) { addToast("success", `Imported ${added} customers`); await load(); }
      else { addToast("info", "No new customers to import"); }
    } catch { addToast("error", "Failed to parse Excel file"); }
    finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  }

  // ── Export ──
  function handleExport() {
    const rows = filtered.map(c => ({
      "Full Name": c.fullName,
      "Phone": c.phone,
      "Location": c.location,
      "Notes": c.notes,
      "Added": formatDate(c.createdAt),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, `customers-${new Date().toISOString().slice(0, 10)}.xlsx`);
    addToast("success", `Exported ${rows.length} customers`);
  }

  // ── Google Sheet Import ──
  function extractSheetId(url: string): string | null {
    // Handles full URL like https://docs.google.com/spreadsheets/d/SHEET_ID/edit...
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    // Maybe they pasted just the ID
    if (/^[a-zA-Z0-9_-]{20,}$/.test(url.trim())) return url.trim();
    return null;
  }

  async function handleSheetImport() {
    const id = extractSheetId(sheetUrl.trim());
    if (!id) { addToast("warning", "Invalid Google Sheet URL or ID"); return; }
    setSheetImporting(true);
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error("Could not fetch sheet. Make sure it is set to 'Anyone with the link can view'.");
      const text = await res.text();
      // Parse CSV
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) { addToast("info", "Sheet appears empty"); setSheetImporting(false); return; }
      // Header row — case-insensitive column matching
      const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
      const colIndex = (name: string) => headers.findIndex(h => h === name.toLowerCase());
      const nameIdx = colIndex("full name");
      const phoneIdx = colIndex("phone");
      const locIdx = colIndex("location");
      const notesIdx = colIndex("notes");
      if (nameIdx === -1) { addToast("warning", "Column 'Full Name' not found in sheet"); setSheetImporting(false); return; }

      function parseRow(line: string): string[] {
        // Simple CSV parser (handles quoted fields with commas)
        const result: string[] = [];
        let cur = ""; let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { inQ = !inQ; }
          else if (ch === "," && !inQ) { result.push(cur.trim()); cur = ""; }
          else { cur += ch; }
        }
        result.push(cur.trim());
        return result;
      }

      let added = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = parseRow(lines[i]);
        const fullName = (cols[nameIdx] || "").replace(/^"|"$/g, "").trim();
        if (!fullName) continue;
        const nc: CustomerFormData = {
          fullName,
          phone: phoneIdx >= 0 ? (cols[phoneIdx] || "").replace(/^"|"$/g, "").trim() : "",
          location: locIdx >= 0 ? (cols[locIdx] || "").replace(/^"|"$/g, "").trim() : "",
          notes: notesIdx >= 0 ? (cols[notesIdx] || "").replace(/^"|"$/g, "").trim() : "",
        };
        if (!customers.some(c => c.fullName.toLowerCase().trim() === nc.fullName.toLowerCase().trim())) {
          await addCustomer(nc, user!.uid); added++;
        }
      }
      if (added > 0) { addToast("success", `Imported ${added} customers from Google Sheet`); await load(); }
      else { addToast("info", "No new customers found in sheet"); }
      setShowSheetModal(false); setSheetUrl("");
    } catch (err: any) {
      addToast("error", err?.message || "Failed to import from Google Sheet");
    } finally { setSheetImporting(false); }
  }

  // ── Select / Bulk delete ──
  function toggleSelectMode() {
    setSelectMode(s => !s);
    setSelected(new Set());
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const allOnPageSelected = paginated.length > 0 && paginated.every(c => selected.has(c.id));

  function toggleSelectAll() {
    if (allOnPageSelected) {
      setSelected(prev => { const next = new Set(prev); paginated.forEach(c => next.delete(c.id)); return next; });
    } else {
      setSelected(prev => { const next = new Set(prev); paginated.forEach(c => next.add(c.id)); return next; });
    }
  }

  async function handleBulkDelete() {
    setBulkDelLoading(true);
    try {
      await Promise.all([...selected].map(id => deleteCustomer(id)));
      addToast("success", `Deleted ${selected.size} customer${selected.size !== 1 ? "s" : ""}`);
      setSelected(new Set()); setShowBulkConfirm(false); setSelectMode(false); await load();
    } catch { addToast("error", "Some deletes failed"); } finally { setBulkDelLoading(false); }
  }

  function togglePhone(id: string) { setShowPhones(p => ({ ...p, [id]: !p[id] })); }
  function maskPhone(phone: string) { return (!phone || phone.length < 6) ? phone : phone.slice(0, 4) + "***" + phone.slice(-3); }

  async function handleDelete() {
    if (!delTarget) return;
    setDelLoading(true);
    try { await deleteCustomer(delTarget.id); addToast("success", "Customer deleted"); setDelTarget(null); await load(); }
    catch { addToast("error", "Delete failed"); } finally { setDelLoading(false); }
  }

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{customers.length} total</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Hidden Excel file input */}
          <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

          {/* Import Excel */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 transition-all"
            title="Import from Excel (.xlsx)"
          >
            {importing ? <Spinner size="sm" /> : <FileUp className="h-4 w-4" />}
            <span className="hidden sm:inline">Import Excel</span>
          </button>

          {/* Import Google Sheet */}
          <button
            onClick={() => setShowSheetModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 transition-all"
            title="Import from Google Sheets"
          >
            <Sheet className="h-4 w-4 text-emerald-600" />
            <span className="hidden sm:inline">Google Sheet</span>
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 transition-all"
            title="Export to Excel"
          >
            <Download className="h-4 w-4 text-blue-500" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Select toggle */}
          <button
            onClick={toggleSelectMode}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold border shadow-sm transition-all ${
              selectMode
                ? "bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/30 dark:border-amber-600 dark:text-amber-400"
                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
            title="Select customers"
          >
            <CheckSquare className="h-4 w-4" />
            <span className="hidden sm:inline">{selectMode ? "Cancel" : "Select"}</span>
          </button>

          {/* Bulk Delete — only visible in select mode when items are selected */}
          {selectMode && selected.size > 0 && (
            <button
              onClick={() => setShowBulkConfirm(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-all animate-fade-in"
            >
              <Trash2 className="h-4 w-4" />
              Delete ({selected.size})
            </button>
          )}

          {/* Add Customer */}
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 transition-all"
          >
            <Plus className="h-4 w-4" /> Add Customer
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center opacity-60">
          <img src="/pig-icon.png" alt="Search" className="h-full w-full object-contain" />
        </div>
        <input
          type="text"
          placeholder="Search name, phone, location..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white transition-all"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10 text-emerald-400" />}
          title={search ? "No results" : "No customers yet"}
          description={search ? "Try different terms" : "Add your first customer"}
        />
      ) : (
        <>
          {/* ── Desktop Table ── */}
          <div className="hidden md:block rounded-2xl border border-gray-200 bg-white overflow-hidden dark:border-gray-700/50 dark:bg-gray-800/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50">
                  {selectMode && (
                    <th className="px-4 py-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        title="Select all on this page"
                      />
                    </th>
                  )}
                  <th className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Name</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Phone</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Location</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Added</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/30">
                {paginated.map(c => (
                  <tr
                    key={c.id}
                    className={`hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors ${selectMode && selected.has(c.id) ? "bg-emerald-50/60 dark:bg-emerald-900/10" : ""}`}
                  >
                    {selectMode && (
                      <td className="px-4 py-3.5">
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          onChange={() => toggleOne(c.id)}
                          className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">{c.fullName}</td>
                    <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">
                      {c.phone ? (
                        <div className="flex items-center gap-1.5">
                          <span>{showPhones[c.id] ? c.phone : maskPhone(c.phone)}</span>
                          <button onClick={() => togglePhone(c.id)} className="p-1 text-gray-400 hover:text-emerald-600 transition-colors">
                            {showPhones[c.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </button>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">{c.location || "—"}</td>
                    <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">{formatDate(c.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/customers/${c.id}`} className="rounded-lg p-2 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400 transition-colors">
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button onClick={() => openEdit(c)} className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDelTarget(c)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile Cards ── */}
          <div className="md:hidden space-y-3">
            {paginated.map(c => (
              <div
                key={c.id}
                className={`rounded-2xl border bg-white p-4 dark:bg-gray-800/50 transition-colors ${
                  selectMode && selected.has(c.id)
                    ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50/40 dark:bg-emerald-900/10"
                    : "border-gray-200 dark:border-gray-700/50"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-2">
                    {selectMode && (
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleOne(c.id)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    )}
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{c.fullName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Added {formatDate(c.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Link href={`/customers/${c.id}`} className="p-1.5 text-gray-400 hover:text-emerald-600"><Eye className="h-4 w-4" /></Link>
                    <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => setDelTarget(c)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-300">
                  {c.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {showPhones[c.id] ? c.phone : maskPhone(c.phone)}
                      <button onClick={() => togglePhone(c.id)} className="ml-0.5 text-gray-400 hover:text-emerald-600">
                        {showPhones[c.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                    </span>
                  )}
                  {c.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.location}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* ── Pagination ── */}
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

      {/* ── Add / Edit Form Modal ── */}
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

      {/* ── Google Sheet Import Modal ── */}
      <Modal isOpen={showSheetModal} onClose={() => { setShowSheetModal(false); setSheetUrl(""); }} title="Import from Google Sheet">
        <div className="space-y-4">
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 dark:bg-blue-900/20 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-300 font-medium mb-1">Requirements</p>
            <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
              <li>The sheet must be set to <strong>"Anyone with the link can view"</strong></li>
              <li>Expected columns: <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">Full Name</code>, <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">Phone</code>, <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">Location</code>, <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">Notes</code></li>
              <li>Existing customers (by name) will be skipped</li>
            </ul>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Google Sheet URL or ID</label>
            <input
              type="text"
              value={sheetUrl}
              onChange={e => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className={inputCls}
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => { setShowSheetModal(false); setSheetUrl(""); }}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSheetImport}
              disabled={sheetImporting || !sheetUrl.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-all"
            >
              {sheetImporting ? <Spinner size="sm" /> : <Sheet className="h-4 w-4" />}
              {sheetImporting ? "Importing..." : "Import"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Single Delete Confirm ── */}
      <ConfirmModal
        isOpen={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={handleDelete}
        title="Delete Customer"
        message={`Delete "${delTarget?.fullName}"? This cannot be undone.`}
        loading={delLoading}
      />

      {/* ── Duplicate name confirm ── */}
      <ConfirmModal
        isOpen={showConfirmAdd}
        onClose={() => { setShowConfirmAdd(false); setPendingCustomer(null); }}
        onConfirm={() => pendingCustomer && proceedAdd(pendingCustomer)}
        title="Duplicate Customer"
        message={`A customer with the name "${pendingCustomer?.fullName}" already exists. Do you want to add them anyway?`}
        loading={formLoading}
      />

      {/* ── Bulk Delete Confirm ── */}
      <ConfirmModal
        isOpen={showBulkConfirm}
        onClose={() => setShowBulkConfirm(false)}
        onConfirm={handleBulkDelete}
        title="Delete Selected Customers"
        message={`Delete ${selected.size} customer${selected.size !== 1 ? "s" : ""}? This cannot be undone.`}
        loading={bulkDelLoading}
      />
    </div>
  );
}

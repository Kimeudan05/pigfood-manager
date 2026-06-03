"use client";
// ============================================
// Admin: Users & Permissions Management
// ============================================
// Accessible only by owner/admin roles.
// Tab 1 — All Users: list, role change, approve/reject
// Tab 2 — Permissions: per-role defaults grid + per-user overrides

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  getAllUsers,
  updateUserRole,
  updateUserStatus,
  updateUserPermissions,
} from "@/lib/firestore";
import { AppUser, UserRole, GranularPermissions } from "@/types";
import {
  ROLE_LABELS,
  ROLE_BADGE_CLASSES,
  STATUS_BADGE_CLASSES,
  GRANULAR_LABELS,
  GRANULAR_DEFAULTS,
} from "@/lib/rbac";
import { PageSpinner } from "@/components/ui/Spinner";
import Spinner from "@/components/ui/Spinner";
import {
  Users,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  Lock,
  Search,
} from "lucide-react";
import { formatDate } from "@/utils/formatters";

type Tab = "users" | "permissions";

// ── helper ──────────────────────────────────────────────────────────────────

function Avatar({ user }: { user: AppUser }) {
  const initials = (user.displayName || user.email || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="relative h-9 w-9 shrink-0">
      {user.photoURL ? (
        <img src={user.photoURL} alt={initials} className="h-9 w-9 rounded-full object-cover" />
      ) : (
        <div className="h-9 w-9 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
          {initials}
        </div>
      )}
    </div>
  );
}

// ── main page ────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { userRole, appUser } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionUid, setActionUid] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Permissions tab state
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [localPerms, setLocalPerms] = useState<Partial<GranularPermissions>>({});
  const [savingPerms, setSavingPerms] = useState(false);

  const PERM_KEYS = Object.keys(GRANULAR_LABELS) as (keyof GranularPermissions)[];
  const ROLES: UserRole[] = ["staff", "admin", "owner"];

  // Access guard
  const isAllowed = userRole === "owner" || userRole === "admin";

  useEffect(() => {
    if (!isAllowed) { router.replace("/dashboard"); return; }
    loadUsers();
  }, [isAllowed]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllUsers();
      setUsers(all);
    } catch {
      addToast("error", "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleRoleChange(uid: string, role: UserRole) {
    setActionUid(uid);
    try {
      await updateUserRole(uid, role);
      setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, role } : u)));
      addToast("success", "Role updated");
    } catch {
      addToast("error", "Failed to update role");
    } finally {
      setActionUid(null);
    }
  }

  async function handleStatusChange(uid: string, status: "approved" | "rejected") {
    setActionUid(uid);
    try {
      await updateUserStatus(uid, status);
      setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, status } : u)));
      addToast("success", status === "approved" ? "User approved" : "User rejected");
    } catch {
      addToast("error", "Failed to update status");
    } finally {
      setActionUid(null);
    }
  }

  // Permissions tab handlers
  function selectUserForPerms(u: AppUser) {
    setSelectedUser(u);
    setLocalPerms({ ...u.permissions });
  }

  function togglePerm(key: keyof GranularPermissions) {
    const roleDefault = GRANULAR_DEFAULTS[selectedUser!.role][key];
    const current = key in localPerms ? localPerms[key] : roleDefault;
    setLocalPerms((prev) => ({ ...prev, [key]: !current }));
  }

  async function savePerms() {
    if (!selectedUser) return;
    setSavingPerms(true);
    try {
      await updateUserPermissions(selectedUser.uid, localPerms);
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === selectedUser.uid ? { ...u, permissions: localPerms } : u
        )
      );
      setSelectedUser((prev) => prev ? { ...prev, permissions: localPerms } : prev);
      addToast("success", "Permissions saved");
    } catch {
      addToast("error", "Failed to save permissions");
    } finally {
      setSavingPerms(false);
    }
  }

  function getEffective(u: AppUser | null, key: keyof GranularPermissions, role?: UserRole): boolean {
    if (!u && role) return GRANULAR_DEFAULTS[role][key];
    if (!u) return false;
    if (u.permissions && key in u.permissions) return u.permissions[key] ?? false;
    return GRANULAR_DEFAULTS[u.role][key];
  }

  const filteredUsers = users.filter((u) => {
    const t = search.toLowerCase();
    return (
      u.email?.toLowerCase().includes(t) ||
      u.displayName?.toLowerCase().includes(t)
    );
  });

  if (!isAllowed) return null;
  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-amber-500" />
            Admin Panel
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{users.length} registered users</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit dark:bg-gray-800">
        {(["users", "permissions"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t
                ? "bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            {t === "users" ? (
              <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> All Users</span>
            ) : (
              <span className="flex items-center gap-1.5"><Lock className="h-4 w-4" /> Permissions</span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: Users ── */}
      {tab === "users" && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {/* Table — desktop */}
          <div className="hidden md:block rounded-2xl border border-gray-200 bg-white overflow-hidden dark:border-gray-700/50 dark:bg-gray-800/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 dark:border-gray-700/50 dark:bg-gray-800/50">
                  <th className="px-5 py-3.5 text-left text-xs font-medium text-gray-500">User</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium text-gray-500">Role</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium text-gray-500">Joined</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/30">
                {filteredUsers.map((u) => (
                  <tr key={u.uid} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar user={u} />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {u.displayName || "—"}
                          </p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </div>
                        {u.uid === appUser?.uid && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded dark:bg-emerald-900/30 dark:text-emerald-300">You</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE_CLASSES[u.status ?? "approved"]}`}>
                        {u.status === "pending" && <Clock className="h-3 w-3" />}
                        {u.status === "approved" && <CheckCircle2 className="h-3 w-3" />}
                        {u.status === "rejected" && <XCircle className="h-3 w-3" />}
                        {u.status === "pending" ? "Pending" : u.status === "rejected" ? "Rejected" : "Approved"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {u.uid === appUser?.uid ? (
                        <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_BADGE_CLASSES[u.role]}`}>
                          {ROLE_LABELS[u.role]}
                        </span>
                      ) : (
                        <div className="relative inline-block">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                            disabled={!!actionUid}
                            className="appearance-none rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-3 pr-7 text-xs font-medium text-gray-700 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">{formatDate(u.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        {u.uid !== appUser?.uid && (
                          <>
                            {(u.status === "pending" || u.status === "rejected") && (
                              <button
                                onClick={() => handleStatusChange(u.uid, "approved")}
                                disabled={actionUid === u.uid}
                                className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors dark:bg-emerald-900/20 dark:text-emerald-400"
                              >
                                {actionUid === u.uid ? <Spinner size="sm" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                Approve
                              </button>
                            )}
                            {(u.status === "pending" || u.status === "approved") && (
                              <button
                                onClick={() => handleStatusChange(u.uid, "rejected")}
                                disabled={actionUid === u.uid}
                                className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors dark:bg-red-900/20 dark:text-red-400"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Reject
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredUsers.map((u) => (
              <div key={u.uid} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700/50 dark:bg-gray-800/50">
                <div className="flex items-start gap-3 mb-3">
                  <Avatar user={u} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">
                      {u.displayName || u.email}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE_CLASSES[u.status ?? "approved"]}`}>
                    {u.status ?? "approved"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE_CLASSES[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                  <div className="flex gap-2">
                    {u.uid !== appUser?.uid && (u.status === "pending" || u.status === "rejected") && (
                      <button onClick={() => handleStatusChange(u.uid, "approved")} disabled={actionUid === u.uid} className="text-xs text-emerald-600 hover:underline">Approve</button>
                    )}
                    {u.uid !== appUser?.uid && (u.status === "pending" || u.status === "approved") && (
                      <button onClick={() => handleStatusChange(u.uid, "rejected")} disabled={actionUid === u.uid} className="text-xs text-red-600 hover:underline">Reject</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: Permissions ── */}
      {tab === "permissions" && (
        <div className="space-y-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            The table below shows default permissions per role. Select a specific user below to customise their permissions individually.
          </p>

          {/* Role defaults matrix */}
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden dark:border-gray-700/50 dark:bg-gray-800/50">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Role Defaults</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700/50">
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 w-64">Permission</th>
                    {ROLES.map((r) => (
                      <th key={r} className="px-4 py-3 text-center text-xs font-medium">
                        <span className={`inline-block px-2.5 py-1 rounded-full ${ROLE_BADGE_CLASSES[r]}`}>
                          {ROLE_LABELS[r]}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/30">
                  {PERM_KEYS.map((key) => (
                    <tr key={key} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20">
                      <td className="px-5 py-3 text-sm text-gray-700 dark:text-gray-300">{GRANULAR_LABELS[key]}</td>
                      {ROLES.map((r) => (
                        <td key={r} className="px-4 py-3 text-center">
                          {GRANULAR_DEFAULTS[r][key] ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                          ) : (
                            <div className="h-4 w-4 rounded border-2 border-gray-200 mx-auto dark:border-gray-600" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-user permission override */}
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden dark:border-gray-700/50 dark:bg-gray-800/50">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50 flex flex-col sm:flex-row sm:items-center gap-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white shrink-0">User Overrides</h3>
              <div className="relative flex-1 max-w-xs">
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  value={selectedUser?.uid ?? ""}
                  onChange={(e) => {
                    const u = users.find((x) => x.uid === e.target.value);
                    if (u) selectUserForPerms(u);
                    else { setSelectedUser(null); setLocalPerms({}); }
                  }}
                  className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-3 pr-8 text-sm focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">— Select a user —</option>
                  {users.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName || u.email} ({ROLE_LABELS[u.role]})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedUser ? (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700/50">
                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Permission</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-gray-500">Role Default</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-gray-500">Override for {selectedUser.displayName || selectedUser.email}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700/30">
                      {PERM_KEYS.map((key) => {
                        const roleDefault = GRANULAR_DEFAULTS[selectedUser.role][key];
                        const hasOverride = key in localPerms;
                        const effectiveVal = hasOverride ? localPerms[key] : roleDefault;
                        return (
                          <tr key={key} className={`hover:bg-gray-50/50 dark:hover:bg-gray-700/20 ${hasOverride ? "bg-amber-50/40 dark:bg-amber-900/10" : ""}`}>
                            <td className="px-5 py-3 text-gray-700 dark:text-gray-300">
                              {GRANULAR_LABELS[key]}
                              {hasOverride && (
                                <span className="ml-2 text-xs text-amber-600 dark:text-amber-400 font-medium">overridden</span>
                              )}
                            </td>
                            <td className="px-5 py-3 text-center">
                              {roleDefault ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto opacity-50" />
                              ) : (
                                <div className="h-4 w-4 rounded border-2 border-gray-200 mx-auto dark:border-gray-600 opacity-50" />
                              )}
                            </td>
                            <td className="px-5 py-3 text-center">
                              <button
                                onClick={() => togglePerm(key)}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                                  effectiveVal ? "bg-emerald-500" : "bg-gray-200 dark:bg-gray-600"
                                }`}
                                role="switch"
                                aria-checked={effectiveVal}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${
                                    effectiveVal ? "translate-x-4" : "translate-x-0"
                                  }`}
                                />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 dark:border-gray-700/50">
                  <button
                    onClick={() => { setLocalPerms({}); }}
                    className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    Reset to role defaults
                  </button>
                  <button
                    onClick={savePerms}
                    disabled={savingPerms}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-600/25"
                  >
                    {savingPerms ? <Spinner size="sm" /> : <ShieldCheck className="h-4 w-4" />}
                    Save Permissions
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                Select a user above to customise their permissions
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

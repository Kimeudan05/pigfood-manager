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
  updateUserDoc,
  deleteUserDoc,
} from "@/lib/firestore";
import { auth } from "@/lib/firebase";
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
import Modal, { ConfirmModal } from "@/components/ui/Modal";
import {
  Users,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  Lock,
  Search,
  AlertTriangle,
  Pencil,
  Trash2,
  Ban,
  MessageSquare,
  Unlock,
  RefreshCw,
  LayoutDashboard,
  ShoppingCart,
  BarChart3,
  PlusCircle,
  User,
  Leaf,
  EyeOff,
  TrendingUp,
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

  // Modals state
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AppUser | null>(null);
  const [suspendingUser, setSuspendingUser] = useState<AppUser | null>(null);
  const [messagingUser, setMessagingUser] = useState<AppUser | null>(null);

  const [editDisplayName, setEditDisplayName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("staff");
  const [adminMessage, setAdminMessage] = useState("");
  const [savingAction, setSavingAction] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const all = await getAllUsers();
      setUsers(all);
      addToast("success", "User list refreshed");
    } catch {
      addToast("error", "Failed to refresh users");
    } finally {
      setRefreshing(false);
    }
  }, [addToast]);

  const PERM_KEYS = Object.keys(GRANULAR_LABELS) as (keyof GranularPermissions)[];
  const ROLES: UserRole[] = ["viewer", "staff", "admin", "owner"];

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

  async function handleEditConfirm() {
    if (!editingUser) return;
    setSavingAction(true);
    try {
      await updateUserDoc(editingUser.uid, {
        displayName: editDisplayName,
        role: editRole,
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === editingUser.uid ? { ...u, displayName: editDisplayName, role: editRole } : u
        )
      );
      addToast("success", "User details updated successfully");
      setEditingUser(null);
    } catch {
      addToast("error", "Failed to update user details");
    } finally {
      setSavingAction(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingUser) return;
    setSavingAction(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Authentication token not found. Please log in again.");

      const response = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ uid: deletingUser.uid }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to delete user");
      }

      setUsers((prev) => prev.filter((u) => u.uid !== deletingUser.uid));
      addToast("success", "User permanently deleted from Auth and Firestore");
      setDeletingUser(null);
    } catch (err: any) {
      console.error(err);
      addToast("error", err.message || "Failed to delete user");
    } finally {
      setSavingAction(false);
    }
  }

  async function handleSuspendConfirm() {
    if (!suspendingUser) return;
    setSavingAction(true);
    const newStatus = suspendingUser.status === "suspended" ? "approved" : "suspended";
    try {
      await updateUserStatus(suspendingUser.uid, newStatus);
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === suspendingUser.uid ? { ...u, status: newStatus } : u
        )
      );
      addToast(
        "success",
        newStatus === "suspended"
          ? "User account suspended"
          : "User account unsuspended"
      );
      setSuspendingUser(null);
    } catch {
      addToast("error", "Failed to change suspension status");
    } finally {
      setSavingAction(false);
    }
  }

  async function handleSendMessageConfirm() {
    if (!messagingUser) return;
    setSavingAction(true);
    try {
      await updateUserDoc(messagingUser.uid, {
        adminMessage: adminMessage,
        adminMessageRead: false,
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === messagingUser.uid ? { ...u, adminMessage: adminMessage, adminMessageRead: false } : u
        )
      );
      addToast("success", "Message sent to user");
      setMessagingUser(null);
    } catch {
      addToast("error", "Failed to send message");
    } finally {
      setSavingAction(false);
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
      addToast("success", "Permissions saved successfully! Reloading page...");
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch {
      addToast("error", "Failed to save permissions");
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

  // Build a set of duplicate emails (same email, >1 UID in Firestore)
  const emailCount: Record<string, number> = {};
  users.forEach((u) => {
    const e = u.email?.toLowerCase() ?? "";
    emailCount[e] = (emailCount[e] ?? 0) + 1;
  });
  const isDuplicate = (u: AppUser) => (emailCount[u.email?.toLowerCase() ?? ""] ?? 0) > 1;

  const pendingCount = users.filter((u) => u.status === "pending").length;

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
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">{users.length} registered users</p>
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full dark:bg-amber-900/30 dark:text-amber-300">
                <Clock className="h-3 w-3" />
                {pendingCount} pending
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="sm:ml-auto inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 transition-all shrink-0"
          title="Refresh User List"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-emerald-500" : ""}`} />
          Refresh List
        </button>
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
                  <tr key={u.uid} className={`hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors ${isDuplicate(u) ? "bg-orange-50/60 dark:bg-orange-900/10" : ""}`}>
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
                        {isDuplicate(u) && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 dark:bg-orange-900/30 dark:text-orange-300">
                            <AlertTriangle className="h-3 w-3" /> Duplicate
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE_CLASSES[u.status ?? "approved"]}`}>
                        {u.status === "pending" && <Clock className="h-3 w-3" />}
                        {u.status === "approved" && <CheckCircle2 className="h-3 w-3" />}
                        {u.status === "rejected" && <XCircle className="h-3 w-3" />}
                        {u.status === "suspended" && <Ban className="h-3 w-3" />}
                        {u.status === "pending" ? "Pending" : u.status === "rejected" ? "Rejected" : u.status === "suspended" ? "Suspended" : "Approved"}
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
                            {u.status === "pending" && (
                              <>
                                <button
                                  onClick={() => handleStatusChange(u.uid, "approved")}
                                  disabled={!!actionUid}
                                  className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors dark:bg-emerald-900/20 dark:text-emerald-400"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleStatusChange(u.uid, "rejected")}
                                  disabled={!!actionUid}
                                  className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors dark:bg-red-900/20 dark:text-red-400"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {u.status === "rejected" && (
                              <button
                                onClick={() => handleStatusChange(u.uid, "approved")}
                                disabled={!!actionUid}
                                className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors dark:bg-emerald-900/20 dark:text-emerald-400"
                              >
                                Approve
                              </button>
                            )}
                          </>
                        )}

                        {/* Edit User */}
                        <button
                          onClick={() => {
                            setEditingUser(u);
                            setEditDisplayName(u.displayName || "");
                            setEditRole(u.role);
                          }}
                          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                          title="Edit User"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        {/* Send Message */}
                        <button
                          onClick={() => {
                            setMessagingUser(u);
                            setAdminMessage(u.adminMessage || "");
                          }}
                          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                          title="Send Message"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>

                        {/* Suspend / Unsuspend */}
                        {u.uid !== appUser?.uid && (
                          u.status === "suspended" ? (
                            <button
                              onClick={() => {
                                setSuspendingUser(u);
                              }}
                              className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/20 transition-colors"
                              title="Unsuspend User"
                            >
                              <Unlock className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSuspendingUser(u);
                              }}
                              className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20 transition-colors"
                              title="Suspend User"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )
                        )}

                        {/* Delete User */}
                        {u.uid !== appUser?.uid && (
                          <button
                            onClick={() => {
                              setDeletingUser(u);
                            }}
                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
                    {u.status === "pending" ? "Pending" : u.status === "rejected" ? "Rejected" : u.status === "suspended" ? "Suspended" : "Approved"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE_CLASSES[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                  <div className="flex gap-3 items-center">
                    {u.uid !== appUser?.uid && u.status === "pending" && (
                      <>
                        <button onClick={() => handleStatusChange(u.uid, "approved")} disabled={!!actionUid} className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline">Approve</button>
                        <button onClick={() => handleStatusChange(u.uid, "rejected")} disabled={!!actionUid} className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline">Reject</button>
                      </>
                    )}
                    {u.uid !== appUser?.uid && u.status === "rejected" && (
                      <button onClick={() => handleStatusChange(u.uid, "approved")} disabled={!!actionUid} className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline">Approve</button>
                    )}

                    <button
                      onClick={() => {
                        setEditingUser(u);
                        setEditDisplayName(u.displayName || "");
                        setEditRole(u.role);
                      }}
                      className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:underline"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => {
                        setMessagingUser(u);
                        setAdminMessage(u.adminMessage || "");
                      }}
                      className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:underline"
                    >
                      Message
                    </button>

                    {u.uid !== appUser?.uid && (
                      u.status === "suspended" ? (
                        <button onClick={() => setSuspendingUser(u)} className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline">Unsuspend</button>
                      ) : (
                        <button onClick={() => setSuspendingUser(u)} className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline">Suspend</button>
                      )
                    )}

                    {u.uid !== appUser?.uid && (
                      <button onClick={() => setDeletingUser(u)} className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline">Delete</button>
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
              <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-gray-100 dark:divide-gray-700/50">
                {/* Left: Overrides Table */}
                <div className="flex-1">
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

                {/* Right: Live Sidebar Preview */}
                <div className="w-full lg:w-80 p-5 bg-gray-50/50 dark:bg-gray-900/10 flex flex-col justify-start shrink-0 border-t lg:border-t-0">
                  <div className="mb-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                      <LayoutDashboard className="h-3.5 w-3.5 text-emerald-600" /> Sidebar Live Preview
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Visual preview of sidebar navigation for <strong>{selectedUser.displayName || selectedUser.email}</strong>.
                    </p>
                  </div>

                  {/* Emerald Gradient Sidebar Mockup */}
                  <div className="rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 text-white p-4 shadow-xl border border-emerald-800/50 flex flex-col space-y-4 w-full">
                    {/* Brand */}
                    <div className="flex items-center gap-2.5 pb-3 border-b border-emerald-800/50">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600/50 backdrop-blur-sm">
                        <Leaf className="h-4.5 w-4.5 text-emerald-300" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold tracking-tight">Takataka</h5>
                        <p className="text-[9px] text-emerald-300/70">Pigfood Manager</p>
                      </div>
                    </div>

                    {/* Navigation Links Mockup */}
                    <div className="space-y-1">
                      {[
                        { label: "Dashboard", icon: LayoutDashboard, show: true },
                        { label: "Customers", icon: Users, show: (() => {
                            const roleDefault = GRANULAR_DEFAULTS[selectedUser.role]["canViewCustomers"];
                            return "canViewCustomers" in localPerms ? (localPerms["canViewCustomers"] ?? false) : roleDefault;
                          })()
                        },
                        { label: "Sales", icon: ShoppingCart, show: (() => {
                            const roleDefault = GRANULAR_DEFAULTS[selectedUser.role]["canViewSales"];
                            return "canViewSales" in localPerms ? (localPerms["canViewSales"] ?? false) : roleDefault;
                          })()
                        },
                        { label: "New Sale", icon: PlusCircle, show: (() => {
                            const roleDefault = GRANULAR_DEFAULTS[selectedUser.role]["canAddSale"];
                            return "canAddSale" in localPerms ? (localPerms["canAddSale"] ?? false) : roleDefault;
                          })()
                        },
                        { label: "Customer Spending", icon: TrendingUp, show: (() => {
                            const roleDefault = GRANULAR_DEFAULTS[selectedUser.role]["canViewReports"];
                            return "canViewReports" in localPerms ? (localPerms["canViewReports"] ?? false) : roleDefault;
                          })()
                        },
                        { label: "Reports", icon: BarChart3, show: (() => {
                            const roleDefault = GRANULAR_DEFAULTS[selectedUser.role]["canViewReports"];
                            return "canViewReports" in localPerms ? (localPerms["canViewReports"] ?? false) : roleDefault;
                          })()
                        },
                        { label: "Profile", icon: User, show: true },
                        { label: "Admin", icon: ShieldCheck, show: selectedUser.role === "owner" || selectedUser.role === "admin" }
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <div
                            key={item.label}
                            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-xs font-medium transition-all ${
                              item.show
                                ? "text-emerald-100/90 bg-white/10"
                                : "text-emerald-950/40 bg-black/10 border border-transparent line-through select-none"
                            }`}
                          >
                            <Icon
                              className={`h-4 w-4 shrink-0 ${
                                item.show ? "text-emerald-400" : "text-emerald-950/25"
                              }`}
                            />
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.show ? (
                              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded font-semibold">Visible</span>
                            ) : (
                              <div className="flex items-center gap-0.5 text-[9px] text-emerald-950/45 font-semibold">
                                <Lock className="h-2.5 w-2.5" /> Hidden
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
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

      {/* ── Edit User Modal ── */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Edit User Details"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={editDisplayName}
              onChange={(e) => setEditDisplayName(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 px-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role
            </label>
            <div className="relative">
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-4 pr-10 text-sm focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700/50">
            <button
              onClick={() => setEditingUser(null)}
              disabled={savingAction}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleEditConfirm}
              disabled={savingAction || !editDisplayName.trim()}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 transition-colors"
            >
              {savingAction ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Send Message Modal ── */}
      <Modal
        isOpen={!!messagingUser}
        onClose={() => setMessagingUser(null)}
        title={`Send Message to ${messagingUser?.displayName || messagingUser?.email || ""}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Message text (will be shown on their suspended screen)
            </label>
            <textarea
              value={adminMessage}
              onChange={(e) => setAdminMessage(e.target.value)}
              placeholder="e.g. Please contact administration regarding your dues."
              rows={4}
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 px-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700/50">
            <button
              onClick={() => setMessagingUser(null)}
              disabled={savingAction}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSendMessageConfirm}
              disabled={savingAction}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 transition-colors"
            >
              {savingAction ? "Saving..." : "Save Message"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Suspend Confirmation Modal ── */}
      <ConfirmModal
        isOpen={!!suspendingUser}
        onClose={() => setSuspendingUser(null)}
        onConfirm={handleSuspendConfirm}
        title={suspendingUser?.status === "suspended" ? "Unsuspend User?" : "Suspend User?"}
        message={
          suspendingUser?.status === "suspended"
            ? `Are you sure you want to restore access for ${suspendingUser.displayName || suspendingUser.email}?`
            : `Are you sure you want to suspend access for ${suspendingUser?.displayName || suspendingUser?.email}? They will be immediately blocked from dashboard access.`
        }
        confirmLabel={suspendingUser?.status === "suspended" ? "Unsuspend" : "Suspend"}
        confirmVariant={suspendingUser?.status === "suspended" ? "primary" : "danger"}
        loading={savingAction}
      />

      {/* ── Delete Confirmation Modal ── */}
      <ConfirmModal
        isOpen={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={handleDeleteConfirm}
        title="Permanently Delete User?"
        message={`Are you sure you want to permanently delete ${deletingUser?.displayName || deletingUser?.email}? This will delete their document from Firestore AND permanently delete their account from Firebase Authentication. This cannot be undone.`}
        confirmLabel="Delete Permanently"
        confirmVariant="danger"
        loading={savingAction}
      />
    </div>
  );
}

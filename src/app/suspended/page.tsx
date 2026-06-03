"use client";
// ============================================
// Suspended Account Page
// ============================================
// Shown to users whose accounts have been suspended by an admin.
// When unsuspended (approved): signs out + redirects to /login.

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  Ban,
  Mail,
  RefreshCw,
  LogOut,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import Spinner from "@/components/ui/Spinner";

type CheckResult = "idle" | "still-suspended" | "approved" | "error";

export default function SuspendedPage() {
  const { user, appUser } = useAuth();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResult>("idle");
  const [dbAdminMessage, setDbAdminMessage] = useState<string | null>(null);

  // Load message dynamically from DB in case it changes
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    getDoc(ref)
      .then((snap) => {
        if (snap.exists()) {
          setDbAdminMessage(snap.data().adminMessage || null);
        }
      })
      .catch(() => {});
  }, [user]);

  async function refreshStatus() {
    if (!user) return;
    setChecking(true);
    setResult("idle");
    try {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        const status = data.status as string;
        setDbAdminMessage(data.adminMessage || null);
        if (status === "approved") {
          setResult("approved");
          await new Promise((r) => setTimeout(r, 1500));
          await signOut(auth);
          window.location.href = "/login?approved=1";
          return;
        }
      }
      setResult("still-suspended");
    } catch {
      setResult("error");
    } finally {
      setChecking(false);
    }
  }

  async function handleSignOut() {
    await signOut(auth);
    window.location.href = "/login";
  }

  const displayMessage = dbAdminMessage || appUser?.adminMessage;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-red-50/20 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="rounded-3xl border border-red-100 bg-white shadow-2xl shadow-gray-200/60 p-8 dark:border-gray-800/50 dark:bg-gray-800 dark:shadow-none">

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/30">
              <Ban className="h-10 w-10 text-red-500 animate-pulse" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
            Account Suspended
          </h1>
          <p className="text-center text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
            Your access to Takataka Pigfood Manager has been suspended by an administrator. Please review the details below.
          </p>

          {/* Admin message display */}
          {displayMessage ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4 mb-6 dark:border-rose-950/40 dark:bg-rose-950/20">
              <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-semibold text-sm mb-1.5">
                <MessageSquare className="h-4 w-4 shrink-0" />
                Message from Administrator
              </div>
              <p className="text-sm text-rose-700 dark:text-rose-400 whitespace-pre-wrap leading-relaxed">
                {displayMessage}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 mb-6 dark:border-gray-700/50 dark:bg-gray-700/30 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No suspension reason was specified. Please contact the administrator directly.
              </p>
            </div>
          )}

          {/* Admin contact */}
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 mb-6 dark:border-gray-700/50 dark:bg-gray-700/30 flex items-center gap-3">
            <Mail className="h-5 w-5 text-gray-400 shrink-0" />
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Contact the admin directly at:{" "}
              <a href="mailto:kimeudan05@gmail.com" className="text-red-600 font-medium hover:underline dark:text-red-400">
                kimeudan05@gmail.com
              </a>
            </div>
          </div>

          {/* Registered as */}
          <p className="text-center text-xs text-gray-400 mb-5">
            Account:{" "}
            <span className="font-semibold text-gray-600 dark:text-gray-300">{user?.email}</span>
          </p>

          {/* Feedback states */}
          {result === "approved" && (
            <div className="flex items-center gap-2 justify-center rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300 mb-4">
              Access restored! Redirecting to login…
            </div>
          )}
          {result === "still-suspended" && (
            <div className="flex items-center gap-2 justify-center text-sm text-rose-600 dark:text-rose-400 mb-4">
              <Ban className="h-4 w-4" />
              Your account is still suspended.
            </div>
          )}
          {result === "error" && (
            <div className="flex items-center gap-2 justify-center text-sm text-red-500 mb-4">
              Could not reach the server. Try again.
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={refreshStatus}
              disabled={checking || result === "approved"}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-all dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              {checking ? <Spinner size="sm" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
            <button
              onClick={handleSignOut}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

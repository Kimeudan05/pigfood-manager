"use client";
// ============================================
// Pending Approval Page
// ============================================
// Shown to newly-registered users whose accounts are awaiting
// admin approval. Polls Firestore on demand and redirects
// to the dashboard once the status changes to 'approved'.

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Clock, Mail, RefreshCw, LogOut, CheckCircle2, XCircle } from "lucide-react";
import Spinner from "@/components/ui/Spinner";

export default function PendingApprovalPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [justChecked, setJustChecked] = useState(false);

  async function refreshStatus() {
    if (!user) return;
    setChecking(true);
    setJustChecked(false);
    try {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const status = snap.data().status;
        if (status === "approved") {
          router.replace("/dashboard");
          return;
        }
        if (status === "rejected") {
          setJustChecked(true);
        }
      }
    } catch {
      /* ignore */
    } finally {
      setChecking(false);
      setJustChecked(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-amber-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-3xl border border-gray-100 bg-white shadow-2xl shadow-gray-200/60 p-8 dark:border-gray-700/50 dark:bg-gray-800 dark:shadow-none">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-10 w-10 text-amber-500" />
              <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-amber-400 animate-pulse" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
            Account Pending Approval
          </h1>
          <p className="text-center text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
            Your account has been created and is awaiting review by a
            Takataka Pigfood administrator. You&apos;ll receive an email once
            your account is approved.
          </p>

          {/* Admin notified box */}
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 mb-4 dark:border-emerald-900/40 dark:bg-emerald-900/20 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              We&apos;ve notified the admin. You&apos;ll hear back at{" "}
              <span className="font-semibold">kimeudan05@gmail.com</span>.
            </p>
          </div>

          {/* What happens next */}
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4 mb-6 dark:border-amber-900/40 dark:bg-amber-900/20">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">What happens next?</p>
            <ul className="space-y-1.5 text-sm text-amber-700 dark:text-amber-400">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                An admin will review your registration
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                They will assign you a role within the system
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                You&apos;ll be notified by email when approved
              </li>
            </ul>
          </div>

          {/* Admin contact */}
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 mb-6 dark:border-gray-700/50 dark:bg-gray-700/30 flex items-center gap-3">
            <Mail className="h-5 w-5 text-gray-400 shrink-0" />
            <div className="text-sm text-gray-500 dark:text-gray-400">
              You can also reach the admin directly at:{" "}
              <a href="mailto:kimeudan05@gmail.com" className="text-emerald-600 font-medium hover:underline dark:text-emerald-400">
                kimeudan05@gmail.com
              </a>
            </div>
          </div>

          {/* Registered as */}
          <p className="text-center text-xs text-gray-400 mb-6">
            Registered as: <span className="font-semibold text-gray-600 dark:text-gray-300">{user?.email}</span>
          </p>

          {/* Just checked feedback */}
          {justChecked && (
            <div className="flex items-center gap-2 justify-center text-sm text-gray-500 dark:text-gray-400 mb-4">
              <XCircle className="h-4 w-4 text-amber-400" />
              Still pending — the admin hasn&apos;t approved yet.
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={refreshStatus}
              disabled={checking}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-all dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              {checking ? <Spinner size="sm" /> : <RefreshCw className="h-4 w-4" />}
              Refresh Status
            </button>
            <button
              onClick={() => logout()}
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

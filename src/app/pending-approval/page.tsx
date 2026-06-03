"use client";
// ============================================
// Pending Approval Page
// ============================================
// Shown to newly-registered users whose accounts are awaiting
// admin approval. When approved: signs out + redirects to /login
// so AuthContext reloads fresh with the new 'approved' status.

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  Clock,
  Mail,
  RefreshCw,
  LogOut,
  CheckCircle2,
  XCircle,
  PartyPopper,
} from "lucide-react";
import Spinner from "@/components/ui/Spinner";

type CheckResult = "idle" | "still-pending" | "approved" | "rejected" | "error";

export default function PendingApprovalPage() {
  const { user } = useAuth();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResult>("idle");

  async function refreshStatus() {
    if (!user) return;
    setChecking(true);
    setResult("idle");
    try {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const status = snap.data().status as string;
        if (status === "approved") {
          // ── KEY FIX ──────────────────────────────────────────────
          // Sign the user out then go to /login so AuthContext
          // re-initialises from Firestore with the new approved status.
          // (We cannot navigate to /dashboard while context still
          //  holds the old 'pending' state — it would bounce back here.)
          setResult("approved");
          await new Promise((r) => setTimeout(r, 1500)); // show success msg briefly
          await signOut(auth);
          window.location.href = "/login?approved=1";
          return;
        }
        if (status === "rejected") {
          setResult("rejected");
          return;
        }
      }
      setResult("still-pending");
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-amber-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <div className="w-full max-w-md">
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

          {/* Admin notified */}
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
          <p className="text-center text-xs text-gray-400 mb-5">
            Registered as:{" "}
            <span className="font-semibold text-gray-600 dark:text-gray-300">{user?.email}</span>
          </p>

          {/* Status feedback banner */}
          {result === "approved" && (
            <div className="flex items-center gap-2 justify-center rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300 mb-4 animate-pulse">
              <PartyPopper className="h-4 w-4 shrink-0" />
              Your account was approved! Redirecting to login…
            </div>
          )}
          {result === "still-pending" && (
            <div className="flex items-center gap-2 justify-center text-sm text-gray-500 dark:text-gray-400 mb-4">
              <XCircle className="h-4 w-4 text-amber-400" />
              Still pending — the admin hasn&apos;t approved yet.
            </div>
          )}
          {result === "rejected" && (
            <div className="flex items-center gap-2 justify-center rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 mb-4">
              <XCircle className="h-4 w-4 shrink-0" />
              Your account has been rejected. Contact the admin for details.
            </div>
          )}
          {result === "error" && (
            <div className="flex items-center gap-2 justify-center text-sm text-red-500 mb-4">
              <XCircle className="h-4 w-4" />
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
              Refresh Status
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

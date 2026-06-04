"use client";
// ============================================
// Forgot Password Page
// ============================================
// Sends a Firebase password-reset email and shows
// a friendly confirmation state.

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { Leaf, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import Spinner from "@/components/ui/Spinner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const { sendPasswordReset } = useAuth();
  const { addToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      addToast("warning", "Please enter your email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      addToast("warning", "Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      // Check if user is registered using the backend API
      let userExists = true;
      try {
        const res = await fetch("/api/auth/check-user-exists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.toLowerCase().trim() }),
        });
        if (res.ok) {
          const data = await res.json();
          userExists = data.exists;
        } else {
          console.warn("User existence endpoint returned status", res.status);
        }
      } catch (apiErr) {
        console.warn("Failed to check if user exists, falling back to standard reset:", apiErr);
      }

      if (!userExists) {
        addToast("error", "No account found with this email address");
        setLoading(false);
        return;
      }

      await sendPasswordReset(email);
      setSent(true);
    } catch (err: unknown) {
      const error = err as { code?: string };
      switch (error.code) {
        case "auth/user-not-found":
          addToast("error", "No account found with this email address");
          break;
        case "auth/invalid-email":
          addToast("error", "Invalid email address");
          break;
        case "auth/too-many-requests":
          addToast("error", "Too many requests. Please wait and try again");
          break;
        default:
          addToast("error", "Failed to send reset email. Please try again");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Decorative left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        <div className="relative z-10 flex flex-col justify-center px-16">
          <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
            <Leaf className="h-9 w-9 text-emerald-300" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Reset your
            <br />
            password
          </h1>
          <p className="text-emerald-200/80 text-lg max-w-md leading-relaxed">
            We&apos;ll send you a secure link to reset your password. Check
            your inbox after submitting.
          </p>
          <div className="mt-12 space-y-3 text-emerald-200/70">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Link expires in 1 hour</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Check spam if you don&apos;t see it</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Contact owner if you need help</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex w-full lg:w-1/2 items-center justify-center px-6 py-12 bg-white dark:bg-gray-900">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 mb-4">
              <Leaf className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Takataka Pigfood
            </h1>
          </div>

          {sent ? (
            /* ── Success state ────────────────────────────────────────── */
            <div className="text-center animate-fade-in">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Check your inbox
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-2">
                We sent a password reset link to
              </p>
              <p className="font-semibold text-gray-800 dark:text-gray-200 mb-8 break-all">
                {email}
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mb-8">
                Didn&apos;t receive it? Check your spam folder, or{" "}
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 font-medium transition-colors"
                >
                  try a different email
                </button>
                .
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>
            </div>
          ) : (
            /* ── Form state ────────────────────────────────────────────── */
            <>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Forgot password?
                </h2>
                <p className="mt-2 text-gray-500 dark:text-gray-400">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div>
                  <label
                    htmlFor="reset-email"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-gray-300 bg-gray-50 py-3 pl-11 pr-4 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-emerald-500 dark:focus:bg-gray-800 transition-all"
                      required
                    />
                  </div>
                </div>

                <button
                  id="btn-send-reset"
                  type="submit"
                  disabled={loading}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 hover:shadow-emerald-700/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 dark:focus:ring-offset-gray-900"
                >
                  {loading ? <Spinner size="sm" /> : "Send reset link"}
                </button>
              </form>

              <div className="mt-8 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

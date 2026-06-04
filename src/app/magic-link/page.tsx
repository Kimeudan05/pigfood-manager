"use client";
// ============================================
// Magic Link Verification Handler
// ============================================
// Handles email link verification redirect from Firebase.
// Automatically retrieves email from localStorage, or prompts
// the user if they're on a different device.

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { isSignInWithEmailLink } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Leaf, Mail, AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
import Spinner from "@/components/ui/Spinner";
import { validateEmail } from "@/lib/emailValidation";

export default function MagicLinkPage() {
  const router = useRouter();
  const { completeMagicLinkSignIn, user, loading: authLoading } = useAuth();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailNeeded, setEmailNeeded] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [signInComplete, setSignInComplete] = useState(false);
  
  // Ref to prevent duplicate execution in React 18 StrictMode mount
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    if (user) {
      router.replace("/dashboard");
      return;
    }

    if (verifiedRef.current) return;

    const handleVerification = async () => {
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        setError("This does not appear to be a valid sign-in link. Please check the URL or request a new link.");
        setLoading(false);
        return;
      }

      let emailForSignIn = window.localStorage.getItem("emailForSignIn");

      if (!emailForSignIn) {
        setEmailNeeded(true);
        setLoading(false);
        return;
      }

      verifiedRef.current = true;
      try {
        await completeMagicLinkSignIn(emailForSignIn);
        setSignInComplete(true);
        addToast("success", "Successfully signed in!");
        router.push("/dashboard");
      } catch (err: any) {
        console.error("Magic link sign in error:", err);
        setError(err.message || "Failed to sign in. The link may have expired or already been used.");
        setLoading(false);
      }
    };

    handleVerification();
  }, [authLoading, user, completeMagicLinkSignIn, router, addToast]);

  const handleEmailBlur = () => {
    if (email) {
      const result = validateEmail(email);
      setEmailError(result.error);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      addToast("warning", "Please enter your email address");
      return;
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setEmailError(emailValidation.error);
      return;
    }

    setLoading(true);
    setEmailNeeded(false);
    setError(null);

    try {
      await completeMagicLinkSignIn(email);
      setSignInComplete(true);
      addToast("success", "Successfully signed in!");
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Magic link sign in error:", err);
      setError(err.message || "Failed to sign in. The link may have expired or already been used.");
      setLoading(false);
    }
  };

  if (authLoading || (loading && !emailNeeded && !error && !signInComplete)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto text-emerald-600 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Verifying your sign-in link...</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">This will only take a moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Left decorative panel */}
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
            Passwordless
            <br />
            Sign In
          </h1>
          <p className="text-emerald-200/80 text-lg max-w-md leading-relaxed">
            Secure, fast, and simple. Magic links verify your identity directly through your email inbox.
          </p>
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

          {emailNeeded && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Confirm your email
              </h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400 mb-6">
                Please enter the email address where you received the sign-in link to complete the process.
              </p>

              <form onSubmit={handleEmailSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="confirm-email"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 ${emailError ? "text-rose-400" : "text-gray-400"}`} />
                    <input
                      id="confirm-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) setEmailError(null);
                      }}
                      onBlur={handleEmailBlur}
                      placeholder="you@example.com"
                      className={`w-full rounded-xl border bg-gray-50 py-3 pl-11 pr-4 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500 dark:focus:bg-gray-800 transition-all ${
                        emailError
                          ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500 dark:focus:border-rose-500"
                          : "border-gray-300 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-gray-600 dark:focus:border-emerald-500"
                      }`}
                      required
                    />
                  </div>
                  {emailError && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-rose-600 dark:text-rose-400">
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {emailError}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 hover:shadow-emerald-700/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all duration-200 dark:focus:ring-offset-gray-900"
                >
                  Complete Sign In
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </form>
            </div>
          )}

          {signInComplete && (
            <div className="text-center animate-fade-in">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Successfully Verified!
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-8">
                You are being redirected to your dashboard...
              </p>
            </div>
          )}

          {error && (
            <div className="text-center animate-fade-in">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30">
                <AlertTriangle className="h-10 w-10 text-rose-600 dark:text-rose-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Verification Failed
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">
                {error}
              </p>
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="inline-flex items-center gap-2 rounded-xl bg-gray-100 dark:bg-gray-800 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

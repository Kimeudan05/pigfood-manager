"use client";
// ============================================
// Login Page
// ============================================
// Supports: email/password, Google OAuth, magic link (passwordless)

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  Leaf,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Zap,
  ChevronRight,
  PartyPopper,
} from "lucide-react";
import Spinner from "@/components/ui/Spinner";

// Extracted into its own component because useSearchParams() requires Suspense
function ApprovedBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("approved") !== "1") return null;
  return (
    <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/20">
      <PartyPopper className="h-5 w-5 text-emerald-500 shrink-0" />
      <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
        Your account has been approved! Sign in below.
      </p>
    </div>
  );
}

// Google logo SVG (official colors)
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

type LoginTab = "password" | "magic";

export default function LoginPage() {
  const [tab, setTab] = useState<LoginTab>("password");

  // Password form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Magic link form
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);

  // Google
  const [googleLoading, setGoogleLoading] = useState(false);

  const { login, signInWithGoogle, sendMagicLink, user, loading: authLoading } =
    useAuth();
  const { addToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) router.replace("/dashboard");
  }, [user, authLoading, router]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      addToast("warning", "Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      addToast("success", "Welcome back!");
      router.push("/dashboard");
    } catch (err: unknown) {
      const error = err as { code?: string };
      switch (error.code) {
        case "auth/user-not-found":
          addToast("error", "No account found with this email");
          break;
        case "auth/wrong-password":
        case "auth/invalid-credential":
          addToast("error", "Invalid email or password");
          break;
        case "auth/too-many-requests":
          addToast("error", "Too many attempts. Please try again later");
          break;
        default:
          addToast("error", "Login failed. Please try again");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      addToast("success", "Welcome!");
      router.push("/dashboard");
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code !== "auth/popup-closed-by-user") {
        addToast("error", "Google sign-in failed. Please try again");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!magicEmail) {
      addToast("warning", "Please enter your email address");
      return;
    }
    setMagicLoading(true);
    try {
      await sendMagicLink(magicEmail);
      setMagicSent(true);
    } catch {
      addToast("error", "Failed to send magic link. Please try again");
    } finally {
      setMagicLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Left decorative panel ───────────────────────────────────────── */}
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
            Takataka
            <br />
            Pigfood Manager
          </h1>
          <p className="text-emerald-200/80 text-lg max-w-md leading-relaxed">
            Streamline your pig food business with smart customer management,
            sales tracking, and real-time analytics.
          </p>
          <div className="mt-12 flex gap-8 text-emerald-200/60">
            <div>
              <div className="text-3xl font-bold text-white">Smart</div>
              <div className="text-sm">Analytics</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">Fast</div>
              <div className="text-sm">Sales Entry</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">Easy</div>
              <div className="text-sm">Reports</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel — sign-in form ────────────────────────────────── */}
      <div className="flex w-full lg:w-1/2 items-center justify-center px-6 py-12 bg-white dark:bg-gray-900 overflow-y-auto">
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

          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Welcome back
            </h2>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Sign in to your account to continue
            </p>
          </div>

          {/* Approved banner — wrapped in Suspense per Next.js requirement */}
          <Suspense fallback={null}>
            <ApprovedBanner />
          </Suspense>

          {/* Google button */}
          <button
            id="btn-google-signin"
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:focus:ring-offset-gray-900"
          >
            {googleLoading ? <Spinner size="sm" /> : <GoogleIcon />}
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wider">
              <span className="bg-white px-3 text-gray-400 dark:bg-gray-900 dark:text-gray-500">
                or continue with
              </span>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800 mb-6">
            <button
              id="tab-password"
              type="button"
              onClick={() => setTab("password")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${
                tab === "password"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <Lock className="h-3.5 w-3.5" />
              Password
            </button>
            <button
              id="tab-magic-link"
              type="button"
              onClick={() => setTab("magic")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${
                tab === "magic"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              Magic Link
            </button>
          </div>

          {/* ── Password tab ─────────────────────────────────────────── */}
          {tab === "password" && (
            <form onSubmit={handlePasswordLogin} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-gray-300 bg-gray-50 py-3 pl-11 pr-4 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-emerald-500 dark:focus:bg-gray-800 transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-gray-300 bg-gray-50 py-3 pl-11 pr-12 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-emerald-500 dark:focus:bg-gray-800 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                id="btn-password-signin"
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 hover:shadow-emerald-700/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 dark:focus:ring-offset-gray-900"
              >
                {loading ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ── Magic link tab ───────────────────────────────────────── */}
          {tab === "magic" && (
            <>
              {magicSent ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-800/50 dark:bg-emerald-900/20">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                    <Zap className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    Check your inbox!
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    We sent a sign-in link to{" "}
                    <strong className="text-gray-700 dark:text-gray-300">
                      {magicEmail}
                    </strong>
                    . Click the link in the email to sign in — no password
                    needed.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMagicSent(false);
                      setMagicEmail("");
                    }}
                    className="mt-4 text-sm font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                  >
                    Use a different email
                  </button>
                </div>
              ) : (
                <form onSubmit={handleMagicLink} className="space-y-5">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Enter your email and we&apos;ll send you a one-click sign-in
                    link — no password required.
                  </p>
                  <div>
                    <label
                      htmlFor="magic-email"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        id="magic-email"
                        type="email"
                        value={magicEmail}
                        onChange={(e) => setMagicEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-xl border border-gray-300 bg-gray-50 py-3 pl-11 pr-4 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-emerald-500 dark:focus:bg-gray-800 transition-all"
                        required
                      />
                    </div>
                  </div>
                  <button
                    id="btn-send-magic-link"
                    type="submit"
                    disabled={magicLoading}
                    className="group flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 hover:shadow-emerald-700/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 dark:focus:ring-offset-gray-900"
                  >
                    {magicLoading ? (
                      <Spinner size="sm" />
                    ) : (
                      <>
                        Send magic link
                        <Zap className="h-4 w-4 transition-transform group-hover:scale-110" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </>
          )}

          {/* Create account link */}
          <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors inline-flex items-center gap-0.5"
            >
              Create account
              <ChevronRight className="h-3 w-3" />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

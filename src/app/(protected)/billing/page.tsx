"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { PLANS, isSubscriptionActive, getStatusLabel } from "@/lib/billing";
import { Check, Zap, Star, Shield, CreditCard, ExternalLink, RefreshCw } from "lucide-react";
import { PlanTier } from "@/types";

const PLAN_ICONS = {
  basic: <Zap className="h-6 w-6" />,
  standard: <Star className="h-6 w-6" />,
  pro: <Shield className="h-6 w-6" />,
};

const PLAN_GRADIENTS = {
  basic: "from-emerald-500 to-teal-600",
  standard: "from-blue-500 to-indigo-600",
  pro: "from-purple-500 to-pink-600",
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  trialing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  past_due: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  canceled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  none: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

export default function BillingPage() {
  const { appUser } = useAuth();
  const { addToast } = useToast();
  const [loadingTier, setLoadingTier] = useState<PlanTier | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const sub = appUser?.subscription;
  const isOwner = appUser?.role === "owner";
  const currentTier = sub?.planTier;
  const subActive = isSubscriptionActive(sub);

  // Handle success/cancel query params
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") {
      addToast("success", "🎉 Subscription activated! Welcome aboard.");
      window.history.replaceState({}, "", "/billing");
    } else if (params.get("canceled") === "1") {
      addToast("info", "Checkout was canceled. No charge was made.");
      window.history.replaceState({}, "", "/billing");
    }
  }, [addToast]);

  async function handleSubscribe(tier: PlanTier) {
    if (!appUser) return;
    setLoadingTier(tier);
    try {
      const res = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planTier: tier, userId: appUser.uid, email: appUser.email }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error ?? "Failed to create checkout");
      }
    } catch (err: any) {
      addToast("error", err.message ?? "Failed to start checkout. Please try again.");
      setLoadingTier(null);
    }
  }

  async function handleManageBilling() {
    if (!sub?.stripeCustomerId) return;
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/create-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stripeCustomerId: sub.stripeCustomerId }),
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error(data.error ?? "Failed to open billing portal");
      }
    } catch (err: any) {
      addToast("error", err.message ?? "Failed to open billing portal.");
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-3 pt-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          <CreditCard className="h-4 w-4" />
          Subscription Plans
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Choose your plan
        </h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          All prices in Kenyan Shillings. Billed monthly. Cancel anytime.
        </p>
      </div>

      {/* Current Subscription Banner */}
      {isOwner && (
        <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-4 dark:from-amber-900/10 dark:to-orange-900/10 dark:border-amber-800/50 flex items-center gap-3">
          <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <span className="font-semibold">Owner account</span> — You have full access to all features without a subscription.
          </p>
        </div>
      )}

      {sub && !isOwner && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/50 dark:bg-gray-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Current subscription</p>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-gray-900 dark:text-white capitalize">
                {sub.planTier} Plan
              </span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[sub.status] ?? STATUS_BADGE.none}`}>
                {getStatusLabel(sub.status)}
              </span>
            </div>
            {sub.currentPeriodEnd && (
              <p className="text-xs text-gray-500 mt-1">
                {sub.cancelAtPeriodEnd ? "Cancels on" : "Renews on"}{" "}
                {sub.currentPeriodEnd?.toDate?.().toLocaleDateString("en-KE", { dateStyle: "long" })}
              </p>
            )}
          </div>
          {sub.stripeCustomerId && (
            <button
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {portalLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Manage Billing
            </button>
          )}
        </div>
      )}

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = currentTier === plan.tier && subActive;
          const isUpgrade = currentTier && !isCurrent;
          const loading = loadingTier === plan.tier;

          return (
            <div
              key={plan.tier}
              className={`relative rounded-2xl border flex flex-col transition-all duration-200 ${
                plan.popular
                  ? "border-blue-400 shadow-xl shadow-blue-500/10 dark:border-blue-500/50 scale-105"
                  : "border-gray-200 shadow-sm hover:shadow-md dark:border-gray-700/50"
              } bg-white dark:bg-gray-800/50`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-lg">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Card Header */}
              <div className={`rounded-t-2xl bg-gradient-to-br ${PLAN_GRADIENTS[plan.tier]} p-6 text-white`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {PLAN_ICONS[plan.tier]}
                    <span className="font-semibold text-lg">{plan.name}</span>
                  </div>
                  {isCurrent && (
                    <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white border border-white/30">
                      Current
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-medium text-white/70">KES</span>
                  <span className="text-4xl font-bold">{plan.price.toLocaleString()}</span>
                  <span className="text-sm text-white/70">/mo</span>
                </div>
                <p className="mt-2 text-sm text-white/80">{plan.description}</p>
              </div>

              {/* Features */}
              <div className="flex-1 p-6 space-y-3">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{f}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="p-6 pt-0">
                {isOwner ? (
                  <div className="rounded-xl bg-gray-50 dark:bg-gray-900/30 py-2.5 text-center text-sm text-gray-500">
                    Owner — Full access
                  </div>
                ) : isCurrent ? (
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 py-2.5 text-center text-sm font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    ✓ Current Plan
                  </div>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan.tier)}
                    disabled={loading || !!loadingTier}
                    className={`w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r ${PLAN_GRADIENTS[plan.tier]} hover:shadow-lg hover:scale-[1.02] active:scale-100`}
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2 justify-center">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Redirecting...
                      </span>
                    ) : isUpgrade ? (
                      "Switch to this plan"
                    ) : (
                      `Subscribe — KES ${plan.price.toLocaleString()}/mo`
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-700/50 dark:bg-gray-800/30 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Frequently Asked Questions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-gray-700 dark:text-gray-300">How is billing handled?</p>
            <p className="text-gray-500 mt-1">Payments are processed securely by Stripe. Your card is charged monthly on the same date.</p>
          </div>
          <div>
            <p className="font-medium text-gray-700 dark:text-gray-300">Can I cancel anytime?</p>
            <p className="text-gray-500 mt-1">Yes! Click "Manage Billing" above to cancel. You keep access until the end of the billing period.</p>
          </div>
          <div>
            <p className="font-medium text-gray-700 dark:text-gray-300">Can I upgrade or downgrade?</p>
            <p className="text-gray-500 mt-1">Yes, plan changes take effect immediately. Stripe prorates any unused time.</p>
          </div>
          <div>
            <p className="font-medium text-gray-700 dark:text-gray-300">What payment methods are accepted?</p>
            <p className="text-gray-500 mt-1">We accept Visa, Mastercard, and other major credit/debit cards via Stripe.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

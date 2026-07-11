// ============================================
// Billing Logic — Plan tiers, feature access
// ============================================

import { PlanTier, SubscriptionStatus, Subscription, AppUser } from "@/types";

// ---------- Plan Definitions ----------

export const PLANS = [
  {
    tier: "basic" as PlanTier,
    name: "Basic",
    price: 5,
    priceEnvKey: "STRIPE_PRICE_BASIC",
    description: "Perfect for small operations",
    color: "emerald",
    features: [
      "Dashboard & analytics",
      "Sales management",
      "Customer records",
      "Up to 3 users",
    ],
  },
  {
    tier: "standard" as PlanTier,
    name: "Standard",
    price: 10,
    priceEnvKey: "STRIPE_PRICE_STANDARD",
    description: "For growing farms",
    color: "blue",
    popular: true,
    features: [
      "Everything in Basic",
      "Receivals / Supply tracking",
      "Truck & conveyor logging",
      "Up to 10 users",
    ],
  },
  {
    tier: "pro" as PlanTier,
    name: "Pro",
    price: 20,
    priceEnvKey: "STRIPE_PRICE_PRO",
    description: "Full power for large operations",
    color: "purple",
    features: [
      "Everything in Standard",
      "Advanced weekly reports",
      "User role management",
      "Session tracking",
      "Unlimited users",
    ],
  },
] as const;

// ---------- Feature Access ----------

const TIER_RANK: Record<PlanTier, number> = { basic: 1, standard: 2, pro: 3 };

const ACTIVE_STATUSES: SubscriptionStatus[] = ["active", "trialing"];

/**
 * Returns true if the subscription permits access to a given minimum plan tier.
 * The owner role is always exempt.
 */
export function canAccessPlan(
  user: AppUser | null | undefined,
  requiredTier: PlanTier
): boolean {
  if (!user) return false;
  // Owner is always exempt from subscription requirements
  if (user.role === "owner") return true;

  const sub = user.subscription;
  if (!sub) return false;
  if (!ACTIVE_STATUSES.includes(sub.status)) return false;

  return TIER_RANK[sub.planTier] >= TIER_RANK[requiredTier];
}

/**
 * Returns whether a subscription is currently active/trialing.
 */
export function isSubscriptionActive(sub: Subscription | undefined): boolean {
  if (!sub) return false;
  return ACTIVE_STATUSES.includes(sub.status);
}

/**
 * Returns a human-readable label for a subscription status.
 */
export function getStatusLabel(status: SubscriptionStatus): string {
  const labels: Record<SubscriptionStatus, string> = {
    active: "Active",
    trialing: "Trial",
    past_due: "Payment Overdue",
    canceled: "Canceled",
    none: "No Subscription",
  };
  return labels[status] ?? status;
}

/**
 * Returns the Stripe Price ID for a given tier from env vars.
 * Only safe to call server-side.
 */
export function getStripePriceId(tier: PlanTier): string {
  const map: Record<PlanTier, string | undefined> = {
    basic: process.env.STRIPE_PRICE_BASIC,
    standard: process.env.STRIPE_PRICE_STANDARD,
    pro: process.env.STRIPE_PRICE_PRO,
  };
  const id = map[tier];
  if (!id) throw new Error(`Missing env var for plan tier: ${tier}`);
  return id;
}

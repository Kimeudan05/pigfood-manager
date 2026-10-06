// ============================================
// Billing / Plan Access
// Multi-Tenant Version
// ============================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import type {
  PlanTier,
  Subscription,
  SubscriptionStatus,
  TenantDoc,
  TenantSubscription,
} from "@/types";

// ============================================================
// PLAN DEFINITIONS
// ============================================================

export const PLANS = [
  {
    tier: "basic" as PlanTier,
    name: "Basic",
    price: 5,
    priceEnvKey:
      "STRIPE_PRICE_BASIC",
    description:
      "Perfect for small operations",
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
    priceEnvKey:
      "STRIPE_PRICE_STANDARD",
    description:
      "For growing farms",
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
    priceEnvKey:
      "STRIPE_PRICE_PRO",
    description:
      "Full power for large operations",
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

// ============================================================
// ACCESS
// ============================================================

const TIER_RANK: Record<
  PlanTier,
  number
> = {
  basic: 1,
  standard: 2,
  pro: 3,
};

const ACTIVE_STATUSES:
  SubscriptionStatus[] = [
    "active",
    "trialing",
  ];

/**
 * Tenant subscription is authoritative.
 */
export function canAccessTenantPlan(
  subscription:
    | TenantSubscription
    | null
    | undefined,
  requiredTier: PlanTier
): boolean {
  if (!subscription) {
    return false;
  }

  if (
    !ACTIVE_STATUSES.includes(
      subscription.status
    )
  ) {
    return false;
  }

  return (
    TIER_RANK[
      subscription.planTier
    ] >=
    TIER_RANK[requiredTier]
  );
}

/**
 * Backward-compatible helper.
 *
 * IMPORTANT:
 * New tenant pages should NOT use this.
 *
 * Subscription access belongs to the tenant.
 */
export function canAccessPlan(
  _user: unknown,
  _requiredTier: PlanTier
): boolean {
  console.warn(
    "canAccessPlan(user, tier) is deprecated. Use useTenant().canAccess(tier)."
  );

  return false;
}

// ============================================================
// STATUS
// ============================================================

export function isTenantSubscriptionActive(
  subscription:
    | TenantSubscription
    | null
    | undefined
): boolean {
  if (!subscription) {
    return false;
  }

  return ACTIVE_STATUSES.includes(
    subscription.status
  );
}

export function isSubscriptionActive(
  subscription:
    | Subscription
    | undefined
): boolean {
  if (!subscription) {
    return false;
  }

  return ACTIVE_STATUSES.includes(
    subscription.status
  );
}

export function getStatusLabel(
  status: SubscriptionStatus
): string {
  const labels: Record<
    SubscriptionStatus,
    string
  > = {
    active: "Active",
    trialing: "Trial",
    past_due:
      "Payment Overdue",
    canceled: "Canceled",
    none: "No Subscription",
  };

  return labels[status] ?? status;
}

// ============================================================
// STRIPE PRICE IDS
// ============================================================

export function getStripePriceId(
  tier: PlanTier
): string {
  const map: Record<
    PlanTier,
    string | undefined
  > = {
    basic:
      process.env
        .STRIPE_PRICE_BASIC,

    standard:
      process.env
        .STRIPE_PRICE_STANDARD,

    pro:
      process.env
        .STRIPE_PRICE_PRO,
  };

  const priceId =
    map[tier];

  if (!priceId) {
    throw new Error(
      `Missing Stripe price ID for plan: ${tier}`
    );
  }

  return priceId;
}

// ============================================================
// TENANT SUBSCRIPTION
// ============================================================

export async function getTenantByStripeCustomerId(
  stripeCustomerId: string
): Promise<TenantDoc | null> {
  const q = query(
    collection(db, "tenants"),
    where(
      "subscription.stripeCustomerId",
      "==",
      stripeCustomerId
    )
  );

  const snapshot =
    await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const snap =
    snapshot.docs[0];

  return {
    id: snap.id,
    ...snap.data(),
  } as TenantDoc;
}

export async function updateTenantSubscription(
  tenantId: string,
  subscription: TenantSubscription
): Promise<void> {
  await updateDoc(
    doc(
      db,
      "tenants",
      tenantId
    ),
    {
      subscription,
    }
  );
}

export async function getTenantSubscription(
  tenantId: string
): Promise<TenantSubscription | null> {
  const snap =
    await getDoc(
      doc(
        db,
        "tenants",
        tenantId
      )
    );

  if (!snap.exists()) {
    return null;
  }

  const tenant =
    snap.data() as TenantDoc;

  return (
    tenant.subscription ??
    null
  );
}

export async function getTenantPlanTier(
  tenantId: string
): Promise<PlanTier> {
  const subscription =
    await getTenantSubscription(
      tenantId
    );

  return (
    subscription?.planTier ??
    "basic"
  );
}
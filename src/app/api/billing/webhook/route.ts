import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { Timestamp } from "firebase/firestore";
import { updateUserSubscription, getUserByStripeCustomerId } from "@/lib/firestore";
import { PlanTier, SubscriptionStatus, Subscription } from "@/types";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-06-24.dahlia",
});

// Disable body parsing so we can verify the raw Stripe signature
export const config = { api: { bodyParser: false } };

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, sig!, webhookSecret);
  } catch (err: any) {
    console.error("[webhook] Signature verification failed:", err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const userId = session.metadata?.userId;
        const planTier = session.metadata?.planTier as PlanTier;
        const stripeSubscriptionId = session.subscription as string;
        const stripeCustomerId = session.customer as string;

        if (!userId || !planTier || !stripeSubscriptionId) break;

        // Fetch the subscription to get period end
        const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);

        const subscription: Subscription = {
          planTier,
          status: "active",
          stripeCustomerId,
          stripeSubscriptionId,
          currentPeriodEnd: Timestamp.fromMillis((sub.items.data[0]?.current_period_end || 0) * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        };

        await updateUserSubscription(userId, subscription);
        console.log(`[webhook] Subscription activated for user ${userId} — ${planTier}`);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const stripeCustomerId = sub.customer as string;
        const user = await getUserByStripeCustomerId(stripeCustomerId);
        if (!user) break;

        const planTier = (sub.metadata?.planTier ?? user.subscription?.planTier ?? "basic") as PlanTier;
        const stripeStatus = sub.status;

        const statusMap: Record<string, SubscriptionStatus> = {
          active: "active",
          trialing: "trialing",
          past_due: "past_due",
          canceled: "canceled",
          unpaid: "past_due",
          incomplete: "past_due",
          incomplete_expired: "canceled",
          paused: "past_due",
        };

        const subscription: Subscription = {
          planTier,
          status: statusMap[stripeStatus] ?? "none",
          stripeCustomerId,
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: Timestamp.fromMillis((sub.items.data[0]?.current_period_end || 0) * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        };

        await updateUserSubscription(user.uid, subscription);
        console.log(`[webhook] Subscription updated for ${user.email} — ${planTier} (${stripeStatus})`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const stripeCustomerId = sub.customer as string;
        const user = await getUserByStripeCustomerId(stripeCustomerId);
        if (!user) break;

        const subscription: Subscription = {
          planTier: user.subscription?.planTier ?? "basic",
          status: "canceled",
          stripeCustomerId,
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: user.subscription?.currentPeriodEnd ?? Timestamp.now(),
          cancelAtPeriodEnd: false,
        };

        await updateUserSubscription(user.uid, subscription);
        console.log(`[webhook] Subscription canceled for ${user.email}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId = invoice.customer as string;
        const user = await getUserByStripeCustomerId(stripeCustomerId);
        if (!user || !user.subscription) break;

        await updateUserSubscription(user.uid, {
          ...user.subscription,
          status: "past_due",
        });
        console.log(`[webhook] Payment failed for ${user.email}`);
        break;
      }

      default:
        // Unhandled event types
        break;
    }
  } catch (err: any) {
    console.error("[webhook] Handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

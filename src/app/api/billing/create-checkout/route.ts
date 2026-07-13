import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripePriceId } from "@/lib/billing";
import { PlanTier } from "@/types";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-06-24.dahlia",
});

export async function POST(req: NextRequest) {
  try {
    const { planTier, userId, email } = (await req.json()) as {
      planTier: PlanTier;
      userId: string;
      email: string;
    };

    if (!planTier || !userId || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const priceId = getStripePriceId(planTier);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId, planTier },
      success_url: `${appUrl}/billing?session_id={CHECKOUT_SESSION_ID}&success=1`,
      cancel_url: `${appUrl}/billing?canceled=1`,
      subscription_data: {
        metadata: { userId, planTier },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("[create-checkout]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

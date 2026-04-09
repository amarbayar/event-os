import { getStripe } from "@/lib/stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { isStripeWebhookEnabled } from "@/lib/helpers/check-stripe";
import Stripe from "stripe";
import { handleStripeWebhook } from "@/lib/payments/stripe-webhook";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isStripeWebhookEnabled()) {
    console.warn("Stripe webhook received but not configured");
    return NextResponse.json({ ok: true });
  }

  const body = await req.text();
  const sig = (await headers()).get("stripe-signature");

  if (!sig) {
    return new NextResponse("Missing signature", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  try {
    await handleStripeWebhook(event);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return new NextResponse("Webhook error", { status: 500 });
  }
}

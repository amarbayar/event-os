import { getStripe } from "@/lib/stripe";
import { db } from "@/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { updatePayment } from "@/lib/payments/payment-service";
import { isStripeWebhookEnabled } from "@/lib/helpers/check-stripe";
import Stripe from "stripe";
import { log } from "console";

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
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = session.metadata?.paymentId;

      if (!paymentId) {
        console.error("Missing paymentId in metadata");
        return NextResponse.json({ ok: true });
      }

      const existing = await db.query.payments.findFirst({
        where: (
          p: { id: string },
          { eq }: { eq: (a: string, b: string) => boolean },
        ) => eq(p.id, paymentId),
      });

      if (!existing) {
        console.error("Payment not found:", paymentId);
        return NextResponse.json({ ok: true });
      }

      if (existing.status === "paid") {
        return NextResponse.json({ ok: true });
      }

      console.log("Setting paid");

      await updatePayment(paymentId, {
        status: "paid",
        paidAt: new Date(),
      });
    } else {
      console.log("Unhandled Stripe event:", event.type);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return new NextResponse("Webhook error", { status: 500 });
  }
}

import { stripe } from "@/lib/stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  updatePayment,
  findPaymentByProviderRef,
} from "@/lib/payments/payment-service";
import { isStripeWebhookEnabled } from "@/lib/helpers/check-stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isStripeWebhookEnabled()) {
    console.warn(
      "Stripe webhook received but Stripe webhook is disabled or not configured",
    );
    return NextResponse.json({ ok: true });
  }

  const body = await req.text();
  const sig = (await headers()).get("stripe-signature");

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const sessionId = session.id;

      const payment = await findPaymentByProviderRef(sessionId);
      if (!payment) {
        console.error("Payment not found for session:", sessionId);
        return NextResponse.json({ ok: true });
      }
      await updatePayment(payment.id, {
        status: "paid",
        paidAt: new Date(),
      });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return new NextResponse("Webhook error", { status: 500 });
  }
}

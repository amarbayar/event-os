import { db } from "@/db";
import { updatePayment } from "@/lib/payments/payment-service";
import Stripe from "stripe";

export async function handleStripeWebhook(event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentId = session.metadata?.paymentId;

    if (!paymentId) {
      console.error("Missing paymentId in metadata");
      return;
    }

    const existing = await db.query.payments.findFirst({
      where: (
        p: { id: string },
        { eq }: { eq: (a: string, b: string) => boolean },
      ) => eq(p.id, paymentId),
    });

    if (!existing) {
      console.error("Payment not found:", paymentId);
      return;
    }

    if (existing.status === "paid") {
      return;
    }
    await updatePayment(paymentId, {
      status: "paid",
      paidAt: new Date(),
    });
  } else {
    console.log("Unhandled Stripe event:", event.type);
  }
}

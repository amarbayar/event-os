import { getStripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import { createPayment, updatePayment } from "@/lib/payments/payment-service";
import { isStripeApiEnabled } from "@/lib/helpers/check-stripe";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function POST(req: Request) {
  if (!isStripeApiEnabled()) {
    console.log("Stripe API not configured");
    return NextResponse.json(
      { error: "Stripe API not configured" },
      { status: 503 },
    );
  }

  const { amount, description } = await req.json();

  const payment = await createPayment({
    amount,
    description,
    provider: "stripe",
  });

  const session = await getStripe().checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: description,
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    metadata: {
      paymentId: payment.id,
    },
    success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/payment/cancel`,
  });

  await updatePayment(payment.id, {
    providerRef: session.id,
  });
  return NextResponse.json({ url: session.url });
}

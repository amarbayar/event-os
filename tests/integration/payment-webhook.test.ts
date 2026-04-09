import { it, expect } from "vitest";
import { createPayment } from "@/lib/payments/payment-service";
import { handleStripeWebhook } from "@/lib/payments/stripe-webhook";
import { getPaymentById } from "@/lib/payments/payment-service";

it("marks payment as paid when checkout completes", async () => {
  const payment = await createPayment({
    amount: 1000,
    description: "Test",
    provider: "stripe",
  });

  const mockSession = {
    metadata: { paymentId: payment.id },
  };

  await handleStripeWebhook({
    type: "checkout.session.completed",
    data: { object: mockSession },
  } as any);

  const updated = await getPaymentById(payment.id);

  expect(updated?.status).toBe("paid");
});

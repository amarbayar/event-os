import { it, expect } from "vitest";
import { createPayment } from "@/lib/payments/payment-service";

it("creates payment with pending status", async () => {
  const payment = await createPayment({
    amount: 1000,
    description: "Test",
    provider: "stripe",
  });

  expect(payment.status).toBe("pending");
});

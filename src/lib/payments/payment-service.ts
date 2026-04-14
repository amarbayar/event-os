import { payments } from "@/db/schema";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { PaymentProvider, PaymentStatus } from "@/types/payment-types";

export async function createPayment(data: {
  amount: number;
  description: string;
  userId?: string;
  provider: PaymentProvider;
}) {
  const [payment] = await db
    .insert(payments)
    .values({
      amount: data.amount,
      description: data.description,
      userId: data.userId ?? null,
      provider: data.provider,
      status: "pending",
    })
    .returning();

  return payment;
}

export async function updatePayment(
  id: string,
  data: Partial<{
    providerRef: string;
    status: PaymentStatus;
    paidAt: Date | number;
  }>,
) {
  const [payment] = await db
    .update(payments)
    .set(data)
    .where(eq(payments.id, id))
    .returning();

  return payment;
}

export async function getPaymentById(id: string) {
  return db.query.payments.findFirst({
    where: (
      p: { id: string },
      { eq }: { eq: (a: string, b: string) => boolean },
    ) => eq(p.id, id),
  });
}

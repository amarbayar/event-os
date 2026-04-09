import { payments } from "@/db/schema";
import { db } from "@/db";
import { eq } from "drizzle-orm";

export async function createPayment(data: {
  amount: number;
  description: string;
  userId?: string;
  provider: "stripe";
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
    status: string;
    paidAt: Date;
  }>,
) {
  const [payment] = await db
    .update(payments)
    .set(data)
    .where(eq(payments.id, id))
    .returning();

  return payment;
}

export async function findPaymentByProviderRef(ref: string) {
  return db.query.payments.findFirst({
    where: (
      p: { providerRef: string },
      { eq }: { eq: (a: string, b: string) => boolean },
    ) => eq(p.providerRef, ref),
  });
}

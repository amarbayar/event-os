export const PAYMENT_STATUS = [
  "pending",
  "paid",
  "failed",
  "cancelled",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export const PAYMENT_PROVIDER = ["stripe", "qpay", "bank"] as const;

export type PaymentProvider = (typeof PAYMENT_PROVIDER)[number];

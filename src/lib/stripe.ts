import Stripe from "stripe";
import { isStripeApiEnabled } from "@/lib/helpers/check-stripe";

export function getStripe() {
  if (!isStripeApiEnabled()) {
    throw new Error("Stripe API is not enabled");
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-03-25.dahlia",
  });
}

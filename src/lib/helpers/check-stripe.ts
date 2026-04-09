function isValidStripeKey(key?: string) {
  return typeof key === "string" && key.startsWith("sk_");
}

function isValidWebhookSecret(secret?: string) {
  return typeof secret === "string" && secret.startsWith("whsec_");
}

export function isStripeApiEnabled() {
  return isValidStripeKey(process.env.STRIPE_SECRET_KEY);
}

export function isStripeWebhookEnabled() {
  return (
    isValidStripeKey(process.env.STRIPE_SECRET_KEY) &&
    isValidWebhookSecret(process.env.STRIPE_WEBHOOK_SECRET)
  );
}

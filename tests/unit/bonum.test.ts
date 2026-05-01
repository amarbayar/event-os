import { createHmac } from "crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { verifyBonumWebhookChecksum } from "@/lib/payments/bonum";

describe("Bonum webhook checksum", () => {
  beforeEach(() => {
    process.env.BONUM_WEBHOOK_CHECKSUM_KEY = "test-checksum-key";
    delete process.env.BONUM_SKIP_WEBHOOK_CHECKSUM;
  });

  it("accepts a valid x-checksum-v2 HMAC over the raw body", () => {
    const rawBody = JSON.stringify({
      type: "PAYMENT",
      status: "SUCCESS",
      body: { invoiceId: "inv-1", transactionId: "tx-1" },
    });
    const checksum = createHmac("sha256", "test-checksum-key")
      .update(rawBody, "utf8")
      .digest("hex");

    expect(verifyBonumWebhookChecksum(rawBody, checksum)).toBe(true);
  });

  it("rejects missing or tampered checksums", () => {
    const rawBody = JSON.stringify({ type: "PAYMENT", status: "SUCCESS" });

    expect(verifyBonumWebhookChecksum(rawBody, null)).toBe(false);
    expect(verifyBonumWebhookChecksum(rawBody, "bad-checksum")).toBe(false);
  });
});

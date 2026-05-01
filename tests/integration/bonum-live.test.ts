import { describe, expect, it } from "vitest";
import {
  createBonumInvoice,
  getBonumInvoiceStatus,
  isBonumEnabled,
} from "@/lib/payments/bonum";

const runLiveBonum = process.env.RUN_BONUM_LIVE_TEST === "true";
const describeLive = runLiveBonum ? describe : describe.skip;

describeLive("Bonum live integration", () => {
  it("creates a real Bonum all-in-one test invoice", async () => {
    expect(isBonumEnabled()).toBe(true);

    const transactionId = `event-os-live-${Date.now()}`;
    const invoice = await createBonumInvoice({
      amount: 1,
      transactionId,
      callback:
        process.env.BONUM_LIVE_CALLBACK_URL ||
        "https://platform.devsummit.dev/api/payments/bonum/webhook",
      expiresIn: 600,
      providers: ["QPAY"],
      items: [
        {
          title: "Event OS Bonum Live Test",
          remark: "Automated live invoice smoke test",
          amount: 1,
          count: 1,
        },
      ],
    });

    expect(invoice.invoiceId).toEqual(expect.any(String));
    expect(invoice.followUpLink).toMatch(/^https?:\/\//);

    if (process.env.BONUM_LIVE_CHECK_STATUS === "true") {
      const status = await getBonumInvoiceStatus(invoice.invoiceId);
      expect(status).toEqual(expect.any(Object));
    }
  });
});

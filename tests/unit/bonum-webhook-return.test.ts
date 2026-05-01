import { beforeEach, describe, expect, it, vi } from "vitest";

const syncBonumTicketOrderFromProviderMock = vi.fn();

vi.mock("@/lib/ticketing", () => ({
  handleBonumTicketWebhook: vi.fn(),
  syncBonumTicketOrderFromProvider: (...args: unknown[]) =>
    syncBonumTicketOrderFromProviderMock(...args),
}));

describe("Bonum browser return", () => {
  beforeEach(() => {
    syncBonumTicketOrderFromProviderMock.mockReset();
  });

  it("redirects GET returns away from the webhook endpoint", async () => {
    process.env.PUBLIC_TICKET_RETURN_URL = "http://localhost:5173/tickets";
    const { GET } = await import("@/app/api/payments/bonum/webhook/route");

    const res = await GET(new Request("http://localhost/api/payments/bonum/webhook"));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost:5173/tickets?payment=return");
  });

  it("preserves order context without leaking Bonum transaction id on browser returns", async () => {
    process.env.PUBLIC_TICKET_RETURN_URL = "http://localhost:5173/tickets";
    syncBonumTicketOrderFromProviderMock.mockResolvedValue({
      ignored: true,
      reason: "Order not found",
    });
    const { GET } = await import("@/app/api/payments/bonum/webhook/route");

    const res = await GET(
      new Request("http://localhost/api/payments/bonum/webhook?orderId=order-1&txn=tx-1"),
    );

    expect(syncBonumTicketOrderFromProviderMock).toHaveBeenCalledWith({
      orderId: "order-1",
      transactionId: "tx-1",
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "http://localhost:5173/tickets?payment=return&orderId=order-1",
    );
  });

  it("marks the return as paid when provider reconciliation succeeds", async () => {
    process.env.PUBLIC_TICKET_RETURN_URL = "http://localhost:5173/tickets";
    syncBonumTicketOrderFromProviderMock.mockResolvedValue({
      ok: true,
      orderId: "order-1",
    });
    const { GET } = await import("@/app/api/payments/bonum/webhook/route");

    const res = await GET(
      new Request("http://localhost/api/payments/bonum/webhook?orderId=order-1&txn=tx-1"),
    );

    expect(res.headers.get("location")).toBe(
      "http://localhost:5173/tickets?payment=paid&orderId=order-1",
    );
  });
});

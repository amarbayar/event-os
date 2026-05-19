import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createBonumTicketCheckoutMock = vi.fn();

vi.mock("@/lib/payments/bonum", () => ({
  isBonumEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/ticketing", () => ({
  createBonumTicketCheckout: (...args: unknown[]) =>
    createBonumTicketCheckoutMock(...args),
}));

describe("public ticket checkout API", () => {
  beforeEach(() => {
    createBonumTicketCheckoutMock.mockReset();
  });

  it("rejects client-supplied amount fields before creating checkout", async () => {
    const { POST } = await import("@/app/api/public/events/[slug]/checkout/route");
    const req = new NextRequest("http://localhost/api/public/events/devsummit/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketTypeSlug: "regular",
        quantity: 1,
        amount: 1,
        purchaser: {
          name: "Attacker",
          email: "attacker@example.com",
        },
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ slug: "devsummit" }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("amount is calculated by the server");
    expect(createBonumTicketCheckoutMock).not.toHaveBeenCalled();
  });

  it("rejects unknown checkout fields before creating checkout", async () => {
    const { POST } = await import("@/app/api/public/events/[slug]/checkout/route");
    const req = new NextRequest("http://localhost/api/public/events/devsummit/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketTypeSlug: "regular",
        quantity: 1,
        purchaser: {
          name: "Buyer",
          email: "buyer@example.com",
        },
        role: "admin",
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ slug: "devsummit" }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("Unexpected checkout field");
    expect(createBonumTicketCheckoutMock).not.toHaveBeenCalled();
  });

  it("rejects malformed purchaser fields before creating checkout", async () => {
    const { POST } = await import("@/app/api/public/events/[slug]/checkout/route");
    const req = new NextRequest("http://localhost/api/public/events/devsummit/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketTypeSlug: "regular",
        quantity: 1,
        purchaser: {
          name: "<script>alert(1)</script>",
          email: "not-email",
          phone: "9".repeat(80),
          unknown: "x",
        },
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ slug: "devsummit" }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("purchaser");
    expect(createBonumTicketCheckoutMock).not.toHaveBeenCalled();
  });

  it("passes only ticket identity, quantity, and purchaser data to checkout creation", async () => {
    createBonumTicketCheckoutMock.mockResolvedValue({
      ok: true,
      order: {
        id: "order-1",
        status: "pending",
        expiresAt: new Date("2026-06-01T00:20:00Z"),
      },
      checkoutUrl: "https://ecommerce.bonum.mn/ecommerce?invoiceId=inv-1",
      customerAccessToken: "customer-access-token",
    });

    const { POST } = await import("@/app/api/public/events/[slug]/checkout/route");
    const req = new NextRequest("http://localhost/api/public/events/devsummit/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "idem-1",
      },
      body: JSON.stringify({
        ticketTypeSlug: "regular",
        quantity: 2,
        purchaser: {
          name: "Buyer",
          email: "buyer@example.com",
          phone: "99119911",
          purchaserType: "company",
          company: "DevSummit LLC",
          companyRegistrationNumber: "1234567",
        },
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ slug: "devsummit" }) });
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.customerAccessToken).toBe("customer-access-token");
    expect(createBonumTicketCheckoutMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventSlug: "devsummit",
        ticketTypeSlug: "regular",
        quantity: 2,
        idempotencyKey: "idem-1",
        purchaser: expect.objectContaining({
          name: "Buyer",
          email: "buyer@example.com",
          purchaserType: "company",
          company: "DevSummit LLC",
          companyRegistrationNumber: "1234567",
        }),
      }),
    );
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { testDb } from "../setup";
import { createTestFixtures, type TestFixtures } from "../fixtures";
import * as schema from "@/db/schema";

const createBonumInvoiceMock = vi.fn();
type AttendeeRow = typeof schema.attendees.$inferSelect;
let invoiceSequence = 0;

vi.mock("@/db", async () => {
  const setup = await import("../setup");
  return { db: setup.testDb };
});

vi.mock("@/lib/payments/bonum", () => ({
  createBonumInvoice: (...args: unknown[]) => createBonumInvoiceMock(...args),
  getBonumTerminalId: vi.fn(() => "terminal-test"),
}));

describe("ticketing checkout and Bonum fulfillment", () => {
  let f: TestFixtures;

  beforeAll(async () => {
    f = await createTestFixtures();
  });

  afterAll(async () => {
    await testDb
      .delete(schema.ticketOrderItems)
      .where(eq(schema.ticketOrderItems.ticketTypeId, "11111111-1111-4111-8111-111111111111"));
    await testDb
      .delete(schema.ticketTypes)
      .where(eq(schema.ticketTypes.id, "11111111-1111-4111-8111-111111111111"));
    await f?.cleanup();
  });

  beforeEach(async () => {
    createBonumInvoiceMock.mockReset().mockImplementation(() => {
      const invoiceId = `bonum-invoice-test-${++invoiceSequence}`;
      return Promise.resolve({
        invoiceId,
        followUpLink: `https://ecommerce.bonum.mn/ecommerce?invoiceId=${invoiceId}`,
      });
    });

    await testDb
      .delete(schema.attendees)
      .where(eq(schema.attendees.organizationId, f.orgId));
    await testDb
      .delete(schema.ticketOrderItems)
      .where(eq(schema.ticketOrderItems.ticketTypeId, "11111111-1111-4111-8111-111111111111"));
    await testDb
      .delete(schema.ticketOrders)
      .where(eq(schema.ticketOrders.organizationId, f.orgId));
    await testDb
      .delete(schema.ticketTypes)
      .where(eq(schema.ticketTypes.organizationId, f.orgId));

    await testDb.insert(schema.ticketTypes).values({
      id: "11111111-1111-4111-8111-111111111111",
      editionId: f.editionId,
      organizationId: f.orgId,
      name: "Regular",
      slug: "regular",
      price: 100_000,
      currency: "MNT",
      capacity: 5,
      maxPerOrder: 3,
      active: true,
    });
  });

  it("calculates Bonum invoice amount from the server-side ticket price and reserves capacity", async () => {
    const { createBonumTicketCheckout } = await import("@/lib/ticketing");

    const result = await createBonumTicketCheckout({
      eventSlug: `test-${f.orgId.slice(0, 8)}`,
      ticketTypeSlug: "regular",
      quantity: 2,
      purchaser: {
        name: "Buyer",
        email: "BUYER@example.com",
      },
      request: new Request("http://localhost/api/public/events/devsummit/checkout"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const invoiceInput = createBonumInvoiceMock.mock.calls[0]?.[0];
    const callbackUrl = new URL(invoiceInput.callback);

    expect(callbackUrl.pathname).toBe("/api/payments/bonum/webhook");
    expect(callbackUrl.searchParams.get("orderId")).toBe(result.order.id);
    expect(callbackUrl.searchParams.get("txn")).toBe(result.order.providerTransactionId);

    expect(createBonumInvoiceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 200_000,
        transactionId: expect.stringMatching(/^eos_/),
        items: [
          expect.objectContaining({
            title: "Regular",
            amount: 100_000,
            count: 2,
          }),
        ],
      }),
    );

    const order = await testDb.query.ticketOrders.findFirst({
      where: eq(schema.ticketOrders.id, result.order.id),
    });
    const ticket = await testDb.query.ticketTypes.findFirst({
      where: eq(schema.ticketTypes.slug, "regular"),
    });

    expect(order).toMatchObject({
      totalAmount: 200_000,
      currency: "MNT",
      purchaserEmail: "buyer@example.com",
      providerInvoiceId: expect.stringMatching(/^bonum-invoice-test-/),
      status: "pending",
    });
    expect(ticket?.reservedCount).toBe(2);
    expect(ticket?.soldCount).toBe(0);
  });

  it("reuses a pending checkout for a repeated idempotency key without reserving twice", async () => {
    const { createBonumTicketCheckout } = await import("@/lib/ticketing");
    const input = {
      eventSlug: `test-${f.orgId.slice(0, 8)}`,
      ticketTypeSlug: "regular",
      quantity: 2,
      purchaser: {
        name: "Buyer",
        email: "buyer@example.com",
      },
      request: new Request("http://localhost/api/public/events/devsummit/checkout"),
      idempotencyKey: "idem-repeat-1",
    };

    const first = await createBonumTicketCheckout(input);
    const second = await createBonumTicketCheckout(input);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.order.id).toBe(first.order.id);
    expect(second.checkoutUrl).toBe(first.checkoutUrl);
    expect(createBonumInvoiceMock).toHaveBeenCalledOnce();

    const ticket = await testDb.query.ticketTypes.findFirst({
      where: eq(schema.ticketTypes.slug, "regular"),
    });
    expect(ticket?.reservedCount).toBe(2);
  });

  it("fulfills a paid Bonum webhook once and creates QR-backed attendees", async () => {
    const { createBonumTicketCheckout, handleBonumTicketWebhook } = await import(
      "@/lib/ticketing"
    );

    const checkout = await createBonumTicketCheckout({
      eventSlug: `test-${f.orgId.slice(0, 8)}`,
      ticketTypeSlug: "regular",
      quantity: 2,
      purchaser: {
        name: "Buyer",
        email: "buyer@example.com",
      },
      request: new Request("http://localhost/api/public/events/devsummit/checkout"),
    });

    expect(checkout.ok).toBe(true);
    if (!checkout.ok) return;

    const webhook = {
      type: "PAYMENT",
      status: "SUCCESS",
      body: {
        amount: 200_000,
        currency: "MNT",
        completedAt: "2026-01-29 11:20:33",
        terminalId: "terminal-test",
        invoiceId: checkout.order.providerInvoiceId!,
        paymentVendor: "QPAY",
        initType: "ECOMMERCE",
        status: "PAID",
        transactionId: checkout.order.providerTransactionId,
      },
    };

    await handleBonumTicketWebhook(webhook);
    await handleBonumTicketWebhook(webhook);

    const order = await testDb.query.ticketOrders.findFirst({
      where: eq(schema.ticketOrders.id, checkout.order.id),
    });
    const ticket = await testDb.query.ticketTypes.findFirst({
      where: eq(schema.ticketTypes.slug, "regular"),
    });
    const attendees = await testDb.query.attendees.findMany({
      where: and(
        eq(schema.attendees.organizationId, f.orgId),
        eq(schema.attendees.ticketOrderId, checkout.order.id),
      ),
    });

    expect(order?.status).toBe("paid");
    expect(order?.fulfilledAt).toBeTruthy();
    expect(ticket?.soldCount).toBe(2);
    expect(ticket?.reservedCount).toBe(0);
    expect(attendees).toHaveLength(2);
    expect(
      attendees.every((attendee: AttendeeRow) => attendee.qrHash.length >= 16),
    ).toBe(true);
    expect(new Set(attendees.map((attendee: AttendeeRow) => attendee.id)).size).toBe(2);
    expect(new Set(attendees.map((attendee: AttendeeRow) => attendee.qrHash)).size).toBe(2);

    const { getPublicTicketOrder } = await import("@/lib/ticketing");
    const publicWithoutTxn = await getPublicTicketOrder(checkout.order.id);
    const publicWithTxn = await getPublicTicketOrder(
      checkout.order.id,
      checkout.customerAccessToken,
    );

    expect(publicWithoutTxn?.tickets).toBeUndefined();
    expect((publicWithoutTxn as Record<string, unknown> | null)?.customerAccessToken).toBeUndefined();
    expect((order as Record<string, unknown>)?.customerAccessTokenHash).toBeTruthy();
    expect((order as Record<string, unknown>)?.customerAccessTokenHash).not.toBe(
      checkout.customerAccessToken,
    );
    expect(publicWithTxn?.tickets).toHaveLength(2);
    expect(new Set(publicWithTxn?.tickets?.map((ticket: { id: string }) => ticket.id)).size).toBe(2);
    expect(new Set(publicWithTxn?.tickets?.map((ticket: { qrHash: string }) => ticket.qrHash)).size).toBe(2);
    expect(publicWithTxn?.tickets?.[0]).toEqual(
      expect.objectContaining({
        name: "Buyer",
        email: "buyer@example.com",
        ticketType: "regular",
        qrHash: expect.any(String),
        checkedIn: false,
      }),
    );
  });

  it("releases reserved capacity when Bonum reports an expired invoice", async () => {
    const { createBonumTicketCheckout, handleBonumTicketWebhook } = await import(
      "@/lib/ticketing"
    );

    const checkout = await createBonumTicketCheckout({
      eventSlug: `test-${f.orgId.slice(0, 8)}`,
      ticketTypeSlug: "regular",
      quantity: 2,
      purchaser: {
        name: "Buyer",
        email: "buyer@example.com",
      },
      request: new Request("http://localhost/api/public/events/devsummit/checkout"),
    });

    expect(checkout.ok).toBe(true);
    if (!checkout.ok) return;

    await handleBonumTicketWebhook({
      type: "PAYMENT",
      status: "FAILED",
      body: {
        amount: 200_000,
        currency: "MNT",
        terminalId: "terminal-test",
        invoiceId: checkout.order.providerInvoiceId!,
        transactionId: checkout.order.providerTransactionId,
        invoiceStatus: "EXPIRED",
      },
    });

    const order = await testDb.query.ticketOrders.findFirst({
      where: eq(schema.ticketOrders.id, checkout.order.id),
    });
    const ticket = await testDb.query.ticketTypes.findFirst({
      where: eq(schema.ticketTypes.slug, "regular"),
    });

    expect(order?.status).toBe("expired");
    expect(ticket?.reservedCount).toBe(0);
    expect(ticket?.soldCount).toBe(0);
  });
});

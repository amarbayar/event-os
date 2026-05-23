import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindOrder = vi.fn();
const mockTxFindOrder = vi.fn();
const mockTxFindItems = vi.fn();
const mockTxFindAttendee = vi.fn();
const getBonumInvoiceStatusMock = vi.fn();
const postTicketSaleDiscordMessageMock = vi.fn();
const updateSets: Record<string, unknown>[] = [];
const txInserts: unknown[] = [];
const txUpdates: unknown[] = [];

const dbMock = {
  query: {
    ticketOrders: {
      findFirst: (...args: unknown[]) => mockFindOrder(...args),
    },
  },
  update: vi.fn(() => ({
    set: vi.fn((value: Record<string, unknown>) => {
      updateSets.push(value);
      return {
        where: vi.fn(() => Promise.resolve()),
      };
    }),
  })),
  transaction: vi.fn(async (callback: (tx: unknown) => Promise<void>) => {
    const tx = {
      query: {
        ticketOrders: {
          findFirst: (...args: unknown[]) => mockTxFindOrder(...args),
        },
        ticketOrderItems: {
          findMany: (...args: unknown[]) => mockTxFindItems(...args),
        },
        attendees: {
          findFirst: (...args: unknown[]) => mockTxFindAttendee(...args),
        },
      },
      update: vi.fn(() => {
        txUpdates.push({});
        return {
          set: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve()),
          })),
        };
      }),
      insert: vi.fn(() => {
        txInserts.push({});
        return {
          values: vi.fn(() => Promise.resolve()),
        };
      }),
    };
    return callback(tx);
  }),
};

vi.mock("@/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/payments/bonum", () => ({
  createBonumInvoice: vi.fn(),
  getBonumTerminalId: vi.fn(() => "terminal-1"),
  getBonumInvoiceStatus: (...args: unknown[]) => getBonumInvoiceStatusMock(...args),
}));

vi.mock("@/lib/ticket-sales-discord", () => ({
  postTicketSaleDiscordMessage: (...args: unknown[]) =>
    postTicketSaleDiscordMessageMock(...args),
}));

describe("Bonum ticket webhook fulfillment", () => {
  beforeEach(() => {
    mockFindOrder.mockReset();
    mockTxFindOrder.mockReset();
    mockTxFindItems.mockReset();
    mockTxFindAttendee.mockReset().mockResolvedValue(null);
    getBonumInvoiceStatusMock.mockReset();
    postTicketSaleDiscordMessageMock.mockReset().mockResolvedValue(undefined);
    dbMock.update.mockClear();
    dbMock.transaction.mockClear();
    updateSets.length = 0;
    txInserts.length = 0;
    txUpdates.length = 0;
  });

  it("marks a pending order failed when Bonum paid amount does not match server total", async () => {
    mockFindOrder.mockResolvedValue({
      id: "order-1",
      provider: "bonum",
      providerInvoiceId: "inv-1",
      providerTransactionId: "tx-1",
      status: "pending",
      totalAmount: 100_000,
      currency: "MNT",
    });

    const { handleBonumTicketWebhook } = await import("@/lib/ticketing");
    const result = await handleBonumTicketWebhook({
      type: "PAYMENT",
      status: "SUCCESS",
      body: {
        invoiceId: "inv-1",
        transactionId: "tx-1",
        terminalId: "terminal-1",
        amount: 1,
        currency: "MNT",
        status: "PAID",
      },
    });

    expect(result).toEqual({ ignored: true, reason: "Amount or currency mismatch" });
    expect(updateSets[0]).toMatchObject({
      status: "failed",
      metadata: expect.objectContaining({
        failure: "Bonum paid amount or currency did not match order",
        receivedAmount: 1,
      }),
    });
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it("does not create duplicate attendees for an already fulfilled order", async () => {
    mockFindOrder.mockResolvedValue({
      id: "order-1",
      provider: "bonum",
      providerInvoiceId: "inv-1",
      providerTransactionId: "tx-1",
      status: "paid",
      totalAmount: 100_000,
      currency: "MNT",
    });
    mockTxFindOrder.mockResolvedValue({
      id: "order-1",
      status: "paid",
      fulfilledAt: new Date("2026-06-01T00:00:00Z"),
    });

    const { handleBonumTicketWebhook } = await import("@/lib/ticketing");
    const result = await handleBonumTicketWebhook({
      type: "PAYMENT",
      status: "SUCCESS",
      body: {
        invoiceId: "inv-1",
        transactionId: "tx-1",
        terminalId: "terminal-1",
        amount: 100_000,
        currency: "MNT",
        status: "PAID",
      },
    });

    expect(result).toEqual({ ok: true, orderId: "order-1" });
    expect(dbMock.transaction).toHaveBeenCalledOnce();
    expect(mockTxFindItems).not.toHaveBeenCalled();
    expect(txInserts).toHaveLength(0);
    expect(txUpdates).toHaveLength(0);
    expect(postTicketSaleDiscordMessageMock).not.toHaveBeenCalled();
  });

  it("reconciles a paid Bonum invoice status into normal fulfillment", async () => {
    mockFindOrder.mockResolvedValueOnce({
      id: "order-1",
      provider: "bonum",
      providerInvoiceId: "inv-1",
      providerTransactionId: "tx-1",
      status: "pending",
      totalAmount: 100_000,
      currency: "MNT",
    });
    mockFindOrder.mockResolvedValueOnce({
      id: "order-1",
      provider: "bonum",
      providerInvoiceId: "inv-1",
      providerTransactionId: "tx-1",
      status: "pending",
      totalAmount: 100_000,
      currency: "MNT",
    });
    getBonumInvoiceStatusMock.mockResolvedValue({
      status: "PAID",
      amount: 100_000,
      currency: "MNT",
      transactionId: "tx-1",
      updatedAt: "2026-01-29 11:20:33",
    });
    mockTxFindOrder.mockResolvedValue({
      id: "order-1",
      status: "pending",
      fulfilledAt: null,
      editionId: "edition-1",
      organizationId: "org-1",
      purchaserName: "Buyer",
      purchaserEmail: "buyer@example.com",
      totalAmount: 100_000,
      currency: "MNT",
    });
    mockTxFindItems.mockResolvedValue([
      {
        id: "item-1",
        ticketTypeId: "ticket-1",
        ticketTypeName: "Regular",
        ticketTypeSlug: "regular",
        quantity: 1,
        totalAmount: 100_000,
        currency: "MNT",
      },
    ]);

    const { syncBonumTicketOrderFromProvider } = await import("@/lib/ticketing");
    const result = await syncBonumTicketOrderFromProvider({
      orderId: "order-1",
      transactionId: "tx-1",
    });

    expect(getBonumInvoiceStatusMock).toHaveBeenCalledWith("inv-1");
    expect(result).toEqual({ ok: true, orderId: "order-1" });
    expect(dbMock.transaction).toHaveBeenCalledOnce();
    expect(mockTxFindAttendee).toHaveBeenCalledOnce();
    expect(txInserts).toHaveLength(1);
    expect(postTicketSaleDiscordMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
        purchaserName: "Buyer",
        purchaserEmail: "buyer@example.com",
        totalAmount: 100_000,
        currency: "MNT",
        items: [
          expect.objectContaining({
            ticketTypeName: "Regular",
            quantity: 1,
            totalAmount: 100_000,
          }),
        ],
      }),
    );
  });
});

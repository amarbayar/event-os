import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.fn();
const ticketTypesFindManyMock = vi.fn();
const ticketOrdersFindManyMock = vi.fn();
const ticketOrderItemsFindManyMock = vi.fn();

vi.mock("@/lib/rbac", () => ({
  requirePermission: (...args: unknown[]) => requirePermissionMock(...args),
  isRbacError: (value: unknown) => value instanceof Response,
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      ticketTypes: {
        findMany: (...args: unknown[]) => ticketTypesFindManyMock(...args),
      },
      ticketOrders: {
        findMany: (...args: unknown[]) => ticketOrdersFindManyMock(...args),
      },
      ticketOrderItems: {
        findMany: (...args: unknown[]) => ticketOrderItemsFindManyMock(...args),
      },
    },
  },
}));

function ctx() {
  return {
    user: { id: "user-1", role: "organizer", name: "Organizer", email: "o@test.local" },
    orgId: "org-1",
    editionId: "edition-1",
    source: "web" as const,
  };
}

describe("ticket sales summary route", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset().mockResolvedValue(ctx());
    ticketTypesFindManyMock.mockReset().mockResolvedValue([
      {
        id: "ticket-regular",
        name: "Regular",
        slug: "regular",
        capacity: 100,
        soldCount: 2,
        reservedCount: 1,
      },
      {
        id: "ticket-vip",
        name: "VIP",
        slug: "vip",
        capacity: 10,
        soldCount: 0,
        reservedCount: 0,
      },
    ]);
    ticketOrdersFindManyMock.mockReset().mockResolvedValue([
      {
        id: "paid-1",
        status: "paid",
        totalAmount: 200000,
        currency: "MNT",
      },
      {
        id: "pending-1",
        status: "pending",
        totalAmount: 100000,
        currency: "MNT",
      },
      {
        id: "failed-1",
        status: "failed",
        totalAmount: 100000,
        currency: "MNT",
      },
    ]);
    ticketOrderItemsFindManyMock.mockReset().mockResolvedValue([
      {
        orderId: "paid-1",
        ticketTypeId: "ticket-regular",
        ticketTypeName: "Regular",
        ticketTypeSlug: "regular",
        quantity: 2,
        totalAmount: 200000,
        currency: "MNT",
      },
      {
        orderId: "pending-1",
        ticketTypeId: "ticket-vip",
        ticketTypeName: "VIP",
        ticketTypeSlug: "vip",
        quantity: 1,
        totalAmount: 100000,
        currency: "MNT",
      },
    ]);
  });

  it("summarizes paid revenue, order statuses, and ticket type progress", async () => {
    const { GET } = await import("@/app/api/ticket-sales/summary/route");
    const req = new NextRequest("http://localhost/api/ticket-sales/summary");

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(requirePermissionMock).toHaveBeenCalledWith(req, "ticket", "read");
    expect(ticketTypesFindManyMock).toHaveBeenCalledOnce();
    expect(ticketOrdersFindManyMock).toHaveBeenCalledOnce();
    expect(ticketOrderItemsFindManyMock).toHaveBeenCalledOnce();
    expect(json.data).toMatchObject({
      currency: "MNT",
      grossPaidAmount: 200000,
      paidOrders: 1,
      pendingOrders: 1,
      failedOrders: 1,
      expiredOrders: 0,
      ticketsSold: 2,
      ticketsReserved: 1,
    });
    expect(json.data.byTicketType).toEqual([
      expect.objectContaining({
        ticketTypeId: "ticket-regular",
        name: "Regular",
        slug: "regular",
        capacity: 100,
        soldCount: 2,
        reservedCount: 1,
        remaining: 97,
        paidQuantity: 2,
        paidAmount: 200000,
      }),
      expect.objectContaining({
        ticketTypeId: "ticket-vip",
        name: "VIP",
        slug: "vip",
        capacity: 10,
        soldCount: 0,
        reservedCount: 0,
        remaining: 10,
        paidQuantity: 0,
        paidAmount: 0,
      }),
    ]);
  });
});

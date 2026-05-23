import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.fn();
const createDirectTicketSaleMock = vi.fn();
const listDirectTicketSalesMock = vi.fn();

vi.mock("@/lib/rbac", () => ({
  requirePermission: (...args: unknown[]) => requirePermissionMock(...args),
  isRbacError: (value: unknown) => value instanceof Response,
}));

vi.mock("@/lib/ticketing", () => ({
  createDirectTicketSale: (...args: unknown[]) => createDirectTicketSaleMock(...args),
  listDirectTicketSales: (...args: unknown[]) => listDirectTicketSalesMock(...args),
}));

function ctx() {
  return {
    user: { id: "user-1", role: "organizer", name: "Organizer", email: "o@test.local" },
    orgId: "org-1",
    editionId: "edition-1",
    source: "web" as const,
  };
}

describe("direct ticket sales route", () => {
  beforeEach(() => {
    vi.resetModules();
    requirePermissionMock.mockReset().mockResolvedValue(ctx());
    createDirectTicketSaleMock.mockReset().mockResolvedValue({
      ok: true,
      order: {
        id: "order-1",
        status: "paid",
        totalAmount: 200000,
        currency: "MNT",
      },
      item: {
        ticketTypeName: "Regular",
      },
      attendees: [
        { id: "attendee-1", name: "Buyer", email: "buyer@example.com", qrHash: "qr-1", ticketType: "regular" },
        { id: "attendee-2", name: "Buyer", email: "buyer@example.com", qrHash: "qr-2", ticketType: "regular" },
      ],
    });
    listDirectTicketSalesMock.mockReset().mockResolvedValue([
      {
        order: {
          id: "order-1",
          status: "paid",
          totalAmount: 200000,
          currency: "MNT",
          paidAt: new Date("2026-05-23T01:00:00.000Z"),
          fulfilledAt: new Date("2026-05-23T01:00:00.000Z"),
          purchaserName: "Buyer",
          purchaserEmail: "buyer@example.com",
          purchaserCompany: null,
        },
        item: {
          ticketTypeName: "Regular",
          quantity: 2,
          unitAmount: 100000,
          totalAmount: 200000,
          currency: "MNT",
        },
        metadata: {
          paymentMethod: "bank_transfer",
          paymentReference: "INV-100",
        },
        attendees: [
          { id: "attendee-1", name: "Buyer", email: "buyer@example.com", qrHash: "qr-1", ticketType: "regular", checkedIn: false },
          { id: "attendee-2", name: "Buyer", email: "buyer@example.com", qrHash: "qr-2", ticketType: "regular", checkedIn: false },
        ],
      },
    ]);
  });

  it("creates a paid direct sale through the server-side ticketing service", async () => {
    const { POST } = await import("@/app/api/ticket-sales/direct/route");
    const req = new NextRequest("http://localhost/api/ticket-sales/direct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketTypeId: "ticket-1",
        quantity: 2,
        purchaser: {
          name: "Buyer",
          email: "buyer@example.com",
          purchaserType: "company",
          company: "DevSummit LLC",
          companyRegistrationNumber: "1234567",
        },
        paymentMethod: "bank_transfer",
        paymentReference: "INV-100",
        notes: "Paid outside Bonum",
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(requirePermissionMock).toHaveBeenCalledWith(req, "ticket", "create");
    expect(createDirectTicketSaleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        editionId: "edition-1",
        organizationId: "org-1",
        ticketTypeId: "ticket-1",
        quantity: 2,
        purchaser: expect.objectContaining({
          name: "Buyer",
          email: "buyer@example.com",
          purchaserType: "company",
          companyRegistrationNumber: "1234567",
        }),
        paymentMethod: "bank_transfer",
        paymentReference: "INV-100",
        notes: "Paid outside Bonum",
        createdBy: expect.objectContaining({
          id: "user-1",
          email: "o@test.local",
        }),
      }),
    );
    expect(json.data.attendees).toHaveLength(2);
    expect(json.data.attendees[0]).toMatchObject({ qrHash: "qr-1", ticketTypeName: "Regular" });
  });

  it("returns a clean error when direct sale validation fails", async () => {
    createDirectTicketSaleMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      error: "Ticket type is sold out",
    });

    const { POST } = await import("@/app/api/ticket-sales/direct/route");
    const req = new NextRequest("http://localhost/api/ticket-sales/direct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketTypeId: "ticket-1",
        quantity: 99,
        purchaser: { name: "Buyer", email: "buyer@example.com" },
        paymentMethod: "cash",
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("Ticket type is sold out");
  });

  it("lists prior direct sales for ticket PDF re-downloads", async () => {
    const { GET } = await import("@/app/api/ticket-sales/direct/route");
    const req = new NextRequest("http://localhost/api/ticket-sales/direct");

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(requirePermissionMock).toHaveBeenCalledWith(req, "ticket", "read");
    expect(listDirectTicketSalesMock).toHaveBeenCalledWith({
      editionId: "edition-1",
      organizationId: "org-1",
    });
    expect(json.data).toHaveLength(1);
    expect(json.data[0]).toMatchObject({
      order: {
        id: "order-1",
        purchaserName: "Buyer",
        purchaserEmail: "buyer@example.com",
      },
      item: {
        ticketTypeName: "Regular",
      },
      paymentMethod: "bank_transfer",
      paymentReference: "INV-100",
    });
    expect(json.data[0].attendees).toHaveLength(2);
    expect(json.data[0].attendees[0]).toMatchObject({ qrHash: "qr-1", ticketTypeName: "Regular" });
  });
});

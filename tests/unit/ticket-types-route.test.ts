import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.fn();
const findManyMock = vi.fn();
const insertValuesMock = vi.fn();
const returningMock = vi.fn();

vi.mock("@/lib/rbac", () => ({
  requirePermission: (...args: unknown[]) => requirePermissionMock(...args),
  isRbacError: (value: unknown) => value instanceof Response,
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      ticketTypes: {
        findMany: (...args: unknown[]) => findManyMock(...args),
      },
    },
    insert: vi.fn(() => ({
      values: (...args: unknown[]) => {
        insertValuesMock(...args);
        return { returning: returningMock };
      },
    })),
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

describe("ticket type admin route", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset().mockResolvedValue(ctx());
    findManyMock.mockReset().mockResolvedValue([
      {
        id: "ticket-1",
        editionId: "edition-1",
        organizationId: "org-1",
        name: "Regular",
        slug: "regular",
        price: 100000,
      },
    ]);
    insertValuesMock.mockReset();
    returningMock.mockReset().mockResolvedValue([
      {
        id: "ticket-1",
        name: "Regular",
        slug: "regular",
        price: 100000,
        soldCount: 0,
        reservedCount: 0,
      },
    ]);
  });

  it("lists ticket types for the active edition with read permission", async () => {
    const { GET } = await import("@/app/api/ticket-types/route");
    const req = new NextRequest("http://localhost/api/ticket-types");

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(requirePermissionMock).toHaveBeenCalledWith(req, "ticket", "read");
    expect(findManyMock).toHaveBeenCalledOnce();
    expect(json.data).toHaveLength(1);
    expect(json.data[0]).toMatchObject({ name: "Regular", price: 100000 });
  });

  it("creates ticket type using server-controlled edition/org and zero sales counters", async () => {
    const { POST } = await import("@/app/api/ticket-types/route");
    const req = new NextRequest("http://localhost/api/ticket-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Regular",
        slug: "regular",
        description: "Main conference ticket",
        price: 100000,
        currency: "MNT",
        capacity: 200,
        maxPerOrder: 4,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(requirePermissionMock).toHaveBeenCalledWith(req, "ticket", "create");
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        editionId: "edition-1",
        organizationId: "org-1",
        name: "Regular",
        slug: "regular",
        price: 100000,
        currency: "MNT",
        capacity: 200,
        maxPerOrder: 4,
        soldCount: 0,
        reservedCount: 0,
      }),
    );
    expect(json.data).toMatchObject({ name: "Regular", price: 100000 });
  });

  it("rejects client-supplied sales counters", async () => {
    const { POST } = await import("@/app/api/ticket-types/route");
    const req = new NextRequest("http://localhost/api/ticket-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Regular",
        slug: "regular",
        price: 1,
        soldCount: 999,
        reservedCount: 999,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("sales counters");
    expect(insertValuesMock).not.toHaveBeenCalled();
  });
});

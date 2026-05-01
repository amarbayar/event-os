import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.fn();
const txInsertValuesMock = vi.fn();
const txReturningMock = vi.fn();

vi.mock("@/lib/rbac", () => ({
  requirePermission: (...args: unknown[]) => requirePermissionMock(...args),
  isRbacError: (value: unknown) => value instanceof Response,
}));

vi.mock("@/db", () => ({
  db: {
    transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback({
        insert: vi.fn(() => ({
          values: (...args: unknown[]) => {
            txInsertValuesMock(...args);
            return { returning: txReturningMock };
          },
        })),
      }),
    ),
    query: {
      invitations: {
        findMany: vi.fn(),
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

describe("invitations route", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset().mockResolvedValue(ctx());
    txInsertValuesMock.mockReset();
    txReturningMock.mockReset().mockResolvedValue([
      {
        id: "invitation-1",
        editionId: "edition-1",
        organizationId: "org-1",
        name: "VIP Guest",
        email: "vip@example.com",
        type: "vip",
        qrHash: "qr-test",
      },
    ]);
  });

  it("creates an attendee check-in record for an invited guest", async () => {
    const { POST } = await import("@/app/api/invitations/route");
    const req = new NextRequest("http://localhost/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "VIP Guest",
        email: "VIP@Example.com",
        type: "vip",
        invitedBy: "Organizer",
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(requirePermissionMock).toHaveBeenCalledWith(req, "invitation", "create");
    expect(txInsertValuesMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        editionId: "edition-1",
        organizationId: "org-1",
        name: "VIP Guest",
        email: "vip@example.com",
        type: "vip",
        invitedBy: "Organizer",
        qrHash: expect.any(String),
      }),
    );
    const invitationValues = txInsertValuesMock.mock.calls[0][0] as { qrHash: string };
    expect(txInsertValuesMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        editionId: "edition-1",
        organizationId: "org-1",
        name: "VIP Guest",
        email: "vip@example.com",
        ticketType: "vip",
        source: "internal",
        stage: "confirmed",
        qrHash: invitationValues.qrHash,
      }),
    );
    expect(json.data).toMatchObject({ id: "invitation-1", type: "vip" });
  });
});

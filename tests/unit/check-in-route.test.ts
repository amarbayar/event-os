import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.fn();
const attendeeFindFirstMock = vi.fn();
const updateSetMock = vi.fn();
const updateWhereMock = vi.fn();
const returningMock = vi.fn();

vi.mock("@/lib/rbac", () => ({
  requirePermission: (...args: unknown[]) => requirePermissionMock(...args),
  isRbacError: (value: unknown) => value instanceof Response,
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      attendees: {
        findFirst: (...args: unknown[]) => attendeeFindFirstMock(...args),
      },
    },
    update: vi.fn(() => ({
      set: (...args: unknown[]) => {
        updateSetMock(...args);
        return {
          where: (...whereArgs: unknown[]) => {
            updateWhereMock(...whereArgs);
            return { returning: returningMock };
          },
        };
      },
    })),
  },
}));

function ctx(role = "organizer") {
  return {
    user: { id: "user-1", role, name: "Organizer", email: "o@test.local" },
    orgId: "org-1",
    editionId: "edition-1",
    source: "web" as const,
  };
}

function post(body: unknown) {
  return new NextRequest("http://localhost/api/check-in", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("check-in route", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset().mockResolvedValue(ctx());
    attendeeFindFirstMock.mockReset();
    updateSetMock.mockReset();
    updateWhereMock.mockReset();
    returningMock.mockReset();
  });

  it("rejects missing or malformed QR payloads", async () => {
    const { POST } = await import("@/app/api/check-in/route");

    const res = await POST(post({ editionId: "edition-1", qrHash: "<script>" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("qrHash");
    expect(attendeeFindFirstMock).not.toHaveBeenCalled();
  });

  it("blocks stakeholder portal users from check-in scans", async () => {
    requirePermissionMock.mockResolvedValue(ctx("stakeholder"));

    const { POST } = await import("@/app/api/check-in/route");
    const res = await POST(post({ editionId: "edition-1", qrHash: "abc123", stationId: "gate-1" }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("Forbidden");
    expect(attendeeFindFirstMock).not.toHaveBeenCalled();
  });

  it("checks in a valid attendee once", async () => {
    const attendee = {
      id: "attendee-1",
      editionId: "edition-1",
      organizationId: "org-1",
      name: "Buyer",
      ticketType: "regular",
      checkedIn: false,
      checkedInAt: null,
    };
    attendeeFindFirstMock.mockResolvedValue(attendee);
    returningMock.mockResolvedValue([{ ...attendee, checkedIn: true, checkedInBy: "gate-1" }]);

    const { POST } = await import("@/app/api/check-in/route");
    const res = await POST(post({ editionId: "edition-1", qrHash: "abc123", stationId: "gate-1" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(requirePermissionMock).toHaveBeenCalledWith(expect.any(NextRequest), "attendee", "update");
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        checkedIn: true,
        checkedInBy: "gate-1",
      }),
    );
    expect(json.data).toMatchObject({ id: "attendee-1", checkedIn: true });
  });

  it("returns already checked in without updating again", async () => {
    attendeeFindFirstMock.mockResolvedValue({
      id: "attendee-1",
      name: "Buyer",
      ticketType: "regular",
      checkedIn: true,
      checkedInAt: new Date("2026-05-30T09:00:00Z"),
    });

    const { POST } = await import("@/app/api/check-in/route");
    const res = await POST(post({ editionId: "edition-1", qrHash: "abc123" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.warning).toBe("Already checked in");
    expect(updateSetMock).not.toHaveBeenCalled();
  });

  it("returns not found for a QR outside the current organization", async () => {
    attendeeFindFirstMock.mockResolvedValue(null);

    const { POST } = await import("@/app/api/check-in/route");
    const res = await POST(post({ editionId: "edition-1", qrHash: "missing" }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Attendee not found");
  });
});

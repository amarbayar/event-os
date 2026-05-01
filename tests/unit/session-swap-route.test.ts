import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.fn();
const sessionFindManyMock = vi.fn();
const editionFindFirstMock = vi.fn();
const speakerFindManyMock = vi.fn();
const updateSetMock = vi.fn();
const returningMock = vi.fn();

vi.mock("@/lib/rbac", () => ({
  requirePermission: (...args: unknown[]) => requirePermissionMock(...args),
  isRbacError: (value: unknown) => value instanceof Response,
}));

const dbMock = {
  query: {
    sessions: {
      findMany: (...args: unknown[]) => sessionFindManyMock(...args),
    },
    eventEditions: {
      findFirst: (...args: unknown[]) => editionFindFirstMock(...args),
    },
    speakerApplications: {
      findMany: (...args: unknown[]) => speakerFindManyMock(...args),
    },
  },
  update: vi.fn(() => ({
    set: (...args: unknown[]) => {
      updateSetMock(...args);
      return {
        where: () => ({ returning: returningMock }),
      };
    },
  })),
  transaction: vi.fn(async (callback: (tx: typeof dbMock) => unknown) => callback(dbMock)),
};

vi.mock("@/db", () => ({
  db: dbMock,
}));

function ctx() {
  return {
    user: { id: "user-1", role: "organizer", name: "Organizer", email: "o@test.local" },
    orgId: "org-1",
    editionId: "edition-1",
    source: "web" as const,
  };
}

describe("session swap route", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset().mockResolvedValue(ctx());
    sessionFindManyMock.mockReset();
    editionFindFirstMock.mockReset().mockResolvedValue({
      id: "edition-1",
      agendaGapMinutes: 0,
      agendaStartTime: "10:00",
      agendaEndTime: "18:00",
      startDate: new Date("2026-05-30T00:00:00.000Z"),
      endDate: new Date("2026-05-31T00:00:00.000Z"),
    });
    speakerFindManyMock.mockReset().mockResolvedValue([]);
    updateSetMock.mockReset();
    returningMock.mockReset();
    dbMock.transaction.mockClear();
  });

  it("swaps type and schedule slot fields without swapping speaker content", async () => {
    const source = {
      id: "source-1",
      organizationId: "org-1",
      editionId: "edition-1",
      version: 3,
      title: "Source speaker topic",
      type: "lightning",
      day: 1,
      trackId: "track-lightning",
      startTime: new Date("2026-01-01T10:39:00.000Z"),
      endTime: new Date("2026-01-01T10:49:00.000Z"),
      durationMinutes: 10,
      room: "Main",
      sortOrder: 1,
    };
    const target = {
      id: "target-1",
      organizationId: "org-1",
      editionId: "edition-1",
      version: 7,
      title: "Target speaker topic",
      type: "keynote",
      day: 1,
      trackId: "track-keynote",
      startTime: new Date("2026-01-01T11:14:00.000Z"),
      endTime: new Date("2026-01-01T11:30:00.000Z"),
      durationMinutes: 16,
      room: "Stage",
      sortOrder: 2,
    };
    sessionFindManyMock
      .mockResolvedValueOnce([source, target])
      .mockResolvedValueOnce([source, target]);
    returningMock
      .mockResolvedValueOnce([{ ...source, type: target.type }])
      .mockResolvedValueOnce([{ ...target, type: source.type }]);

    const { POST } = await import("@/app/api/sessions/swap/route");
    const req = new NextRequest("http://localhost/api/sessions/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: source.id,
        targetId: target.id,
        sourceVersion: source.version,
        targetVersion: target.version,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(requirePermissionMock).toHaveBeenCalledWith(req, "session", "update");
    expect(updateSetMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: "keynote",
        trackId: "track-keynote",
        startTime: target.startTime,
        endTime: target.endTime,
        durationMinutes: 16,
        room: "Stage",
      })
    );
    expect(updateSetMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: "lightning",
        trackId: "track-lightning",
        startTime: source.startTime,
        endTime: source.endTime,
        durationMinutes: 10,
        room: "Main",
      })
    );
    expect(updateSetMock.mock.calls[0][0]).not.toHaveProperty("title");
    expect(updateSetMock.mock.calls[1][0]).not.toHaveProperty("title");
    expect(json.data.source).toMatchObject({ id: source.id });
    expect(json.data.target).toMatchObject({ id: target.id });
  });
});

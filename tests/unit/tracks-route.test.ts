import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.fn();
const findManyMock = vi.fn();
const findFirstMock = vi.fn();
const insertValuesMock = vi.fn();
const updateSetMock = vi.fn();
const deleteWhereMock = vi.fn();
const returningMock = vi.fn();

vi.mock("@/lib/rbac", () => ({
  requirePermission: (...args: unknown[]) => requirePermissionMock(...args),
  isRbacError: (value: unknown) => value instanceof Response,
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      tracks: {
        findMany: (...args: unknown[]) => findManyMock(...args),
        findFirst: (...args: unknown[]) => findFirstMock(...args),
      },
    },
    insert: vi.fn(() => ({
      values: (...args: unknown[]) => {
        insertValuesMock(...args);
        return { returning: returningMock };
      },
    })),
    update: vi.fn(() => ({
      set: (...args: unknown[]) => {
        updateSetMock(...args);
        return { where: () => ({ returning: returningMock }) };
      },
    })),
    delete: vi.fn(() => ({
      where: (...args: unknown[]) => {
        deleteWhereMock(...args);
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

describe("tracks admin routes", () => {
  beforeEach(() => {
    vi.resetModules();
    requirePermissionMock.mockReset().mockResolvedValue(ctx());
    findManyMock.mockReset().mockResolvedValue([
      { id: "track-1", editionId: "edition-1", name: "Sponsor", color: "#f59e0b", sortOrder: 10 },
    ]);
    findFirstMock.mockReset().mockResolvedValue({
      id: "track-1",
      editionId: "edition-1",
      name: "Sponsor",
      color: "#f59e0b",
      sortOrder: 10,
    });
    insertValuesMock.mockReset();
    updateSetMock.mockReset();
    deleteWhereMock.mockReset();
    returningMock.mockReset().mockResolvedValue([
      { id: "track-1", editionId: "edition-1", name: "Sponsor", color: "#f59e0b", sortOrder: 10 },
    ]);
  });

  it("lists tracks for the active edition with session read permission", async () => {
    const { GET } = await import("@/app/api/tracks/route");
    const req = new NextRequest("http://localhost/api/tracks");

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(requirePermissionMock).toHaveBeenCalledWith(req, "session", "read");
    expect(findManyMock).toHaveBeenCalledOnce();
    expect(json.data).toEqual([
      expect.objectContaining({ name: "Sponsor", color: "#f59e0b" }),
    ]);
  });

  it("creates a track in the active edition and ignores client-owned identity fields", async () => {
    const { POST } = await import("@/app/api/tracks/route");
    const req = new NextRequest("http://localhost/api/tracks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "client-track",
        editionId: "wrong-edition",
        name: "Sponsor",
        color: "#f59e0b",
        sortOrder: 10,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(requirePermissionMock).toHaveBeenCalledWith(req, "session", "create");
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        editionId: "edition-1",
        name: "Sponsor",
        color: "#f59e0b",
        sortOrder: 10,
      }),
    );
    expect(insertValuesMock.mock.calls[0][0]).not.toMatchObject({ id: "client-track" });
    expect(json.data).toMatchObject({ name: "Sponsor" });
  });

  it("rejects invalid track colors", async () => {
    const { POST } = await import("@/app/api/tracks/route");
    const req = new NextRequest("http://localhost/api/tracks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Sponsor", color: "orange" }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("color");
    expect(insertValuesMock).not.toHaveBeenCalled();
  });

  it("updates a track only after confirming it belongs to the active edition", async () => {
    const { PATCH } = await import("@/app/api/tracks/[id]/route");
    const req = new NextRequest("http://localhost/api/tracks/track-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Sponsor Stage", color: "#0ea5e9" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "track-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(requirePermissionMock).toHaveBeenCalledWith(req, "session", "update");
    expect(findFirstMock).toHaveBeenCalledOnce();
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Sponsor Stage", color: "#0ea5e9" }),
    );
    expect(json.data).toMatchObject({ id: "track-1" });
  });

  it("deletes a track only after confirming it belongs to the active edition", async () => {
    const { DELETE } = await import("@/app/api/tracks/[id]/route");
    const req = new NextRequest("http://localhost/api/tracks/track-1", { method: "DELETE" });

    const res = await DELETE(req, { params: Promise.resolve({ id: "track-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(requirePermissionMock).toHaveBeenCalledWith(req, "session", "delete");
    expect(findFirstMock).toHaveBeenCalledOnce();
    expect(deleteWhereMock).toHaveBeenCalledOnce();
    expect(json.data).toEqual({ id: "track-1" });
  });
});

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getToken } from "next-auth/jwt";

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
}));

const getTokenMock = vi.mocked(getToken);

function authedRequest(path: string) {
  return new NextRequest(`https://platform.devsummit.dev${path}`, {
    headers: { cookie: "authjs.session-token=test-session" },
  });
}

describe("stakeholder access boundary", () => {
  beforeEach(() => {
    getTokenMock.mockReset();
    getTokenMock.mockResolvedValue({
      role: "stakeholder",
      organizationId: "org-1",
      forcePasswordChange: false,
    });
  });

  it("redirects stakeholder browser access away from organizer pages", async () => {
    const { middleware } = await import("@/middleware");

    const res = await middleware(authedRequest("/events/devsummit-2026/settings"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://platform.devsummit.dev/portal");
  });

  it("returns 403 for stakeholder organizer APIs", async () => {
    const { middleware } = await import("@/middleware");

    const res = await middleware(authedRequest("/api/speakers"));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ error: "Forbidden" });
  });

  it("allows stakeholder portal, upload, auth, and checklist APIs", async () => {
    const { middleware } = await import("@/middleware");

    for (const path of [
      "/portal",
      "/api/portal/me",
      "/api/portal/update-profile",
      "/api/checklist-items/checklist-1",
      "/api/upload",
      "/api/auth/password-status",
    ]) {
      const res = await middleware(authedRequest(path));
      expect(res.status).toBe(200);
    }
  });
});

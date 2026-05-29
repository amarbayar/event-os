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

describe("coordinator check-in middleware boundary", () => {
  beforeEach(() => {
    getTokenMock.mockReset();
    getTokenMock.mockResolvedValue({
      role: "coordinator",
      organizationId: "org-1",
      forcePasswordChange: false,
    });
  });

  it("allows coordinators to open the event check-in page", async () => {
    const { middleware } = await import("@/middleware");

    const res = await middleware(authedRequest("/events/devsummit-2026/check-in"));

    expect(res.status).toBe(200);
  });

  it("redirects coordinators from other event pages to check-in", async () => {
    const { middleware } = await import("@/middleware");

    const res = await middleware(authedRequest("/events/devsummit-2026/tickets"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://platform.devsummit.dev/events/devsummit-2026/check-in",
    );
  });

  it("returns 403 for coordinator access to non-check-in APIs", async () => {
    const { middleware } = await import("@/middleware");

    const res = await middleware(authedRequest("/api/speakers"));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ error: "Forbidden" });
  });

  it("allows coordinator access to check-in APIs", async () => {
    const { middleware } = await import("@/middleware");

    for (const path of ["/api/check-in", "/api/check-in/stats"]) {
      const res = await middleware(authedRequest(path));
      expect(res.status).toBe(200);
    }
  });
});

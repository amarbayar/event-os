import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { testDb } from "../setup";
import * as schema from "@/db/schema";
import { createTestFixtures, type TestFixtures } from "../fixtures";

const authMock = vi.fn();
const storeUploadedFileMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => authMock(),
}));

vi.mock("@/lib/uploads", () => ({
  storeUploadedFile: (...args: unknown[]) => storeUploadedFileMock(...args),
}));

let f: TestFixtures;

function buildUploadRequest(folder: string) {
  const formData = new FormData();
  formData.append(
    "file",
    new File(["image"], "headshot.png", { type: "image/png" })
  );
  formData.append("folder", folder);

  return new NextRequest("http://localhost/api/upload", {
    method: "POST",
    body: formData,
  });
}

function mockSession(userName: keyof TestFixtures["users"]) {
  const user = f.users[userName];
  authMock.mockResolvedValue({
    user: {
      id: user.id,
      role: user.role,
      organizationId: f.orgId,
    },
  });
}

describe("upload route", () => {
  beforeAll(async () => {
    f = await createTestFixtures();
  });

  afterAll(async () => {
    await f.cleanup();
  });

  beforeEach(async () => {
    authMock.mockReset();
    storeUploadedFileMock.mockReset().mockResolvedValue({
      url: "/uploads/speaker/file.png",
      fileName: "file.png",
      provider: "local",
    });

    await testDb
      .update(schema.userOrganizations)
      .set({
        linkedEntityType: "speaker",
        linkedEntityId: f.speakerId,
      })
      .where(
        and(
          eq(schema.userOrganizations.userId, f.users.TestStakeholder.id),
          eq(schema.userOrganizations.organizationId, f.orgId)
        )
      );
  });

  it("allows stakeholders to upload under their linked entity folder", async () => {
    mockSession("TestStakeholder");
    const { POST } = await import("@/app/api/upload/route");

    const res = await POST(
      buildUploadRequest(`speaker/${f.speakerId}/headshoturl`)
    );

    expect(res.status).toBe(201);
    expect(storeUploadedFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: `speaker/${f.speakerId}/headshoturl`,
      })
    );
  });

  it("blocks stakeholders from uploading under another entity folder", async () => {
    mockSession("TestStakeholder");
    const { POST } = await import("@/app/api/upload/route");

    const res = await POST(
      buildUploadRequest(`sponsor/${f.sponsorId}/logourl`)
    );

    expect(res.status).toBe(403);
    expect(storeUploadedFileMock).not.toHaveBeenCalled();
  });

  it("keeps staff uploads unrestricted by entity folder", async () => {
    mockSession("TestOrganizer");
    const { POST } = await import("@/app/api/upload/route");

    const res = await POST(buildUploadRequest("logos"));

    expect(res.status).toBe(201);
    expect(storeUploadedFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: "logos",
      })
    );
  });
});

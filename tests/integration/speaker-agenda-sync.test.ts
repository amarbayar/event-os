import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { testDb } from "../setup";
import { createTestFixtures, type TestFixtures } from "../fixtures";
import * as schema from "@/db/schema";
import {
  cleanupSpeakerDependencies,
  syncSpeakerAgendaSessions,
} from "@/lib/speaker-agenda";

const requirePermissionMock = vi.fn();

vi.mock("@/lib/rbac", () => ({
  requirePermission: (...args: unknown[]) => requirePermissionMock(...args),
  isRbacError: (value: unknown) => value instanceof Response,
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/notify", () => ({
  notify: vi.fn(),
}));

describe("speaker agenda synchronization", () => {
  let f: TestFixtures;

  beforeAll(async () => {
    f = await createTestFixtures();
  });

  afterAll(async () => {
    await f.cleanup();
  });

  function organizerCtx() {
    return {
      user: {
        id: f.users.TestOrganizer.id,
        role: "organizer",
        name: "Test Organizer",
        email: "organizer@test.local",
      },
      orgId: f.orgId,
      editionId: f.editionId,
      source: "web" as const,
    };
  }

  it("propagates speaker sheet talk updates to assigned agenda sessions", async () => {
    const trackId = uuid();
    const sessionId = uuid();
    await testDb.insert(schema.tracks).values({
      id: trackId,
      editionId: f.editionId,
      name: "Sponsor",
      color: "#f59e0b",
      sortOrder: 9,
    });
    await testDb.insert(schema.sessions).values({
      id: sessionId,
      editionId: f.editionId,
      organizationId: f.orgId,
      speakerId: f.speakerId,
      title: "Old title",
      description: "Old abstract",
      type: "talk",
      day: 1,
      durationMinutes: 10,
    });

    await syncSpeakerAgendaSessions(testDb, {
      speakerId: f.speakerId,
      editionId: f.editionId,
      organizationId: f.orgId,
      updates: {
        talkTitle: "Sponsor keynote",
        talkAbstract: "Updated abstract",
        talkType: "keynote",
        trackPreference: "Sponsor",
      },
    });

    const session = await testDb.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    expect(session).toMatchObject({
      title: "Sponsor keynote",
      description: "Updated abstract",
      type: "keynote",
      trackId,
    });
  });

  it("speaker PATCH route propagates drawer talk updates to assigned agenda sessions", async () => {
    requirePermissionMock.mockReset().mockResolvedValue(organizerCtx());
    const sessionId = uuid();
    await testDb.insert(schema.sessions).values({
      id: sessionId,
      editionId: f.editionId,
      organizationId: f.orgId,
      speakerId: f.speakerId,
      title: "Old title",
      description: "Old abstract",
      type: "talk",
      day: 1,
      durationMinutes: 10,
    });

    const { PATCH } = await import("@/app/api/speakers/[id]/route");
    const req = new NextRequest(`http://localhost/api/speakers/${f.speakerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "If-Match": "999" },
      body: JSON.stringify({
        talkTitle: "Updated from drawer",
        talkAbstract: "Drawer abstract",
        talkType: "lightning",
      }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: f.speakerId }) });
    expect(res.status).toBe(200);

    const session = await testDb.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });
    expect(session).toMatchObject({
      title: "Updated from drawer",
      description: "Drawer abstract",
      type: "lightning",
    });
  });

  it("cleans agenda, checklist, notes, notifications, and linked tasks for a deleted speaker", async () => {
    const directSessionId = uuid();
    const panelSessionId = uuid();
    const otherSpeakerId = uuid();
    const noteId = uuid();
    const taskId = uuid();
    const notificationId = uuid();
    const template = await testDb.query.checklistTemplates.findFirst({
      where: and(
        eq(schema.checklistTemplates.organizationId, f.orgId),
        eq(schema.checklistTemplates.entityType, "speaker"),
      ),
    });
    if (!template) throw new Error("speaker checklist template missing");

    await testDb.insert(schema.sessions).values([
      {
        id: directSessionId,
        editionId: f.editionId,
        organizationId: f.orgId,
        speakerId: f.speakerId,
        title: "Speaker slot",
        type: "talk",
      },
      {
        id: panelSessionId,
        editionId: f.editionId,
        organizationId: f.orgId,
        title: "Panel",
        type: "panel",
        panelSpeakerIds: [f.speakerId, otherSpeakerId],
      },
    ]);
    await testDb.insert(schema.checklistItems).values({
      id: uuid(),
      templateId: template.id,
      editionId: f.editionId,
      organizationId: f.orgId,
      entityType: "speaker",
      entityId: f.speakerId,
      status: "submitted",
      value: "/uploads/speaker/headshot.png",
    });
    await testDb.insert(schema.entityNotes).values({
      id: noteId,
      organizationId: f.orgId,
      entityType: "speaker",
      entityId: f.speakerId,
      authorName: "Organizer",
      content: "Internal note",
    });
    await testDb.insert(schema.tasks).values({
      id: taskId,
      editionId: f.editionId,
      organizationId: f.orgId,
      title: "Follow up with speaker",
      linkedEntityType: "speaker",
      linkedEntityId: f.speakerId,
    });
    await testDb.insert(schema.notifications).values({
      id: notificationId,
      userId: f.users.TestOrganizer.id,
      organizationId: f.orgId,
      editionId: f.editionId,
      type: "assignment",
      title: "Assigned",
      entityType: "speaker",
      entityId: f.speakerId,
    });

    await cleanupSpeakerDependencies(testDb, {
      speakerId: f.speakerId,
      editionId: f.editionId,
      organizationId: f.orgId,
    });

    await expect(
      testDb.query.sessions.findFirst({ where: eq(schema.sessions.id, directSessionId) }),
    ).resolves.toBeUndefined();
    await expect(
      testDb.query.checklistItems.findFirst({
        where: and(
          eq(schema.checklistItems.entityType, "speaker"),
          eq(schema.checklistItems.entityId, f.speakerId),
        ),
      }),
    ).resolves.toBeUndefined();
    await expect(
      testDb.query.entityNotes.findFirst({ where: eq(schema.entityNotes.id, noteId) }),
    ).resolves.toBeUndefined();
    await expect(
      testDb.query.tasks.findFirst({ where: eq(schema.tasks.id, taskId) }),
    ).resolves.toBeUndefined();
    await expect(
      testDb.query.notifications.findFirst({ where: eq(schema.notifications.id, notificationId) }),
    ).resolves.toBeUndefined();

    const panel = await testDb.query.sessions.findFirst({
      where: eq(schema.sessions.id, panelSessionId),
    });
    expect(panel?.panelSpeakerIds).toEqual([otherSpeakerId]);
  });

  it("speaker DELETE route removes the speaker and assigned agenda session", async () => {
    requirePermissionMock.mockReset().mockResolvedValue(organizerCtx());
    const speakerId = uuid();
    const sessionId = uuid();
    await testDb.insert(schema.speakerApplications).values({
      id: speakerId,
      editionId: f.editionId,
      organizationId: f.orgId,
      name: "Delete Me",
      email: "delete-me@test.local",
      talkTitle: "Disposable talk",
      talkType: "talk",
      stage: "lead",
    });
    await testDb.insert(schema.sessions).values({
      id: sessionId,
      editionId: f.editionId,
      organizationId: f.orgId,
      speakerId,
      title: "Disposable slot",
      type: "talk",
      day: 1,
      durationMinutes: 10,
    });

    const { DELETE } = await import("@/app/api/speakers/[id]/route");
    const req = new NextRequest(`http://localhost/api/speakers/${speakerId}`, {
      method: "DELETE",
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: speakerId }) });
    expect(res.status).toBe(200);

    await expect(
      testDb.query.speakerApplications.findFirst({ where: eq(schema.speakerApplications.id, speakerId) }),
    ).resolves.toBeUndefined();
    await expect(
      testDb.query.sessions.findFirst({ where: eq(schema.sessions.id, sessionId) }),
    ).resolves.toBeUndefined();
  });
});

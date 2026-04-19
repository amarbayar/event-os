/**
 * Test fixtures — creates isolated test data that doesn't depend on seed scripts.
 *
 * Each call to createTestFixtures() creates a fresh org with users, teams,
 * editions, and entities. Returns IDs for use in test assertions.
 * Call cleanup() in afterAll to remove everything.
 */

import { testDb } from "./setup";
import * as schema from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { hashSync } from "bcryptjs";

export interface TestFixtures {
  orgId: string;
  editionId: string;
  users: Record<string, { id: string; role: string }>;
  teams: Record<string, string>; // teamName → teamId
  speakerId: string;
  sponsorId: string;
  templateCount: number;
  cleanup: () => Promise<void>;
}

export async function createTestFixtures(): Promise<TestFixtures> {
  const orgId = uuid();
  const editionId = uuid();
  const password = hashSync("test-password", 4); // fast rounds for tests
  const speakerEmail = `fixture-speaker-${orgId.slice(0, 8)}@test.local`;
  const sponsorEmail = `fixture-sponsor-${orgId.slice(0, 8)}@test.local`;

  // ─── Organization ──────────────────────────────────
  await testDb.insert(schema.organizations).values({
    id: orgId,
    name: "Test Org (fixture)",
    slug: `test-org-${orgId.slice(0, 8)}`,
  });

  // ─── Event Series + Edition ─────────────────────────
  const seriesId = uuid();
  await testDb.insert(schema.eventSeries).values({
    id: seriesId,
    name: "Test Event Series",
    slug: `test-series-${orgId.slice(0, 8)}`,
    organizationId: orgId,
  });

  await testDb.insert(schema.eventEditions).values({
    id: editionId,
    name: "Test Edition 2026",
    slug: `test-${orgId.slice(0, 8)}`,
    seriesId,
    organizationId: orgId,
    startDate: new Date("2026-06-15"),
    endDate: new Date("2026-06-16"),
  });

  // ─── Users with different roles ────────────────────
  const userDefs = [
    { name: "TestOwner", email: `owner-${orgId.slice(0, 8)}@test.local`, role: "owner" },
    { name: "TestAdmin", email: `admin-${orgId.slice(0, 8)}@test.local`, role: "admin" },
    { name: "TestOrganizer", email: `organizer-${orgId.slice(0, 8)}@test.local`, role: "organizer" },
    { name: "TestCoordinator", email: `coordinator-${orgId.slice(0, 8)}@test.local`, role: "coordinator" },
    { name: "TestViewer", email: `viewer-${orgId.slice(0, 8)}@test.local`, role: "viewer" },
    { name: "TestStakeholder", email: `stakeholder-${orgId.slice(0, 8)}@test.local`, role: "stakeholder" },
  ];

  const users: Record<string, { id: string; role: string }> = {};
  const userIds: string[] = [];

  for (const u of userDefs) {
    const id = uuid();
    userIds.push(id);
    await testDb.insert(schema.users).values({
      id,
      name: u.name,
      email: u.email,
      password,
    });
    await testDb.insert(schema.userOrganizations).values({
      id: uuid(),
      userId: id,
      organizationId: orgId,
      role: u.role,
    });
    users[u.name] = { id, role: u.role };
  }

  // ─── Teams + entity type ownership ─────────────────
  const teamDefs: { name: string; entityTypes: string[]; members: string[] }[] = [
    { name: "Program", entityTypes: ["speaker", "session"], members: ["TestOrganizer", "TestCoordinator"] },
    { name: "Logistics", entityTypes: ["venue", "booth"], members: ["TestOrganizer"] },
    { name: "Sponsor/Partnership", entityTypes: ["sponsor"], members: ["TestCoordinator"] },
    { name: "Operations", entityTypes: ["volunteer", "media", "attendee"], members: ["TestOrganizer"] },
    { name: "Marketing", entityTypes: ["campaign"], members: ["TestCoordinator"] },
  ];

  const teams: Record<string, string> = {};

  for (const t of teamDefs) {
    const teamId = uuid();
    teams[t.name] = teamId;

    await testDb.insert(schema.teams).values({
      id: teamId,
      name: t.name,
      organizationId: orgId,
      // org-wide team (no editionId)
    });

    for (const et of t.entityTypes) {
      await testDb.insert(schema.teamEntityTypes).values({
        id: uuid(),
        teamId,
        entityType: et,
      });
    }

    for (const memberName of t.members) {
      if (users[memberName]) {
        await testDb.insert(schema.teamMembers).values({
          id: uuid(),
          teamId,
          userId: users[memberName].id,
          name: memberName,
        });
      }
    }
  }

  // ─── Sample entities ───────────────────────────────
  const speakerId = uuid();
  await testDb.insert(schema.speakerApplications).values({
    id: speakerId,
    name: "Fixture Speaker",
    email: speakerEmail,
    talkTitle: "Test Talk",
    stage: "confirmed",
    organizationId: orgId,
    editionId,
  });

  const sponsorId = uuid();
  await testDb.insert(schema.sponsorApplications).values({
    id: sponsorId,
    companyName: "Fixture Sponsor Co",
    contactName: "Fixture Contact",
    contactEmail: sponsorEmail,
    stage: "lead",
    organizationId: orgId,
    editionId,
  });

  // ─── Checklist templates ───────────────────────────
  const templateDefs: { entityType: string; name: string; itemType: string; fieldKey?: string; required: boolean; sortOrder: number; dueOffsetDays?: number }[] = [
    // Speaker templates
    { entityType: "speaker", name: "Upload headshot photo", itemType: "file_upload", fieldKey: "headshotUrl", required: true, sortOrder: 0, dueOffsetDays: -21 },
    { entityType: "speaker", name: "Submit bio", itemType: "text", fieldKey: "bio", required: true, sortOrder: 1, dueOffsetDays: -21 },
    { entityType: "speaker", name: "Submit talk abstract", itemType: "text", fieldKey: "talkAbstract", required: true, sortOrder: 2, dueOffsetDays: -14 },
    { entityType: "speaker", name: "Upload slides", itemType: "file_upload", fieldKey: "slideUrl", required: false, sortOrder: 3, dueOffsetDays: -7 },
    // Sponsor templates
    { entityType: "sponsor", name: "Upload logo", itemType: "file_upload", fieldKey: "logoUrl", required: true, sortOrder: 0, dueOffsetDays: -21 },
    { entityType: "sponsor", name: "Confirm package", itemType: "checkbox", required: true, sortOrder: 1, dueOffsetDays: -14 },
    { entityType: "sponsor", name: "Submit description", itemType: "text", required: false, sortOrder: 2, dueOffsetDays: -14 },
    // Venue templates
    { entityType: "venue", name: "Submit floor plan", itemType: "file_upload", fieldKey: "floorPlanUrl", required: true, sortOrder: 0 },
    { entityType: "venue", name: "Confirm AV setup", itemType: "checkbox", required: true, sortOrder: 1 },
    { entityType: "venue", name: "Upload venue photos", itemType: "file_upload", required: false, sortOrder: 2 },
    // Booth templates
    { entityType: "booth", name: "Upload company logo", itemType: "file_upload", required: true, sortOrder: 0 },
    { entityType: "booth", name: "Submit booth requirements", itemType: "text", required: true, sortOrder: 1 },
    // Volunteer templates
    { entityType: "volunteer", name: "Upload headshot", itemType: "file_upload", fieldKey: "headshotUrl", required: true, sortOrder: 0 },
    { entityType: "volunteer", name: "Confirm availability", itemType: "checkbox", required: true, sortOrder: 1 },
    { entityType: "volunteer", name: "T-shirt size", itemType: "text", required: false, sortOrder: 2 },
    // Media templates
    { entityType: "media", name: "Upload logo", itemType: "file_upload", fieldKey: "logoUrl", required: true, sortOrder: 0 },
    { entityType: "media", name: "Submit coverage plan", itemType: "text", required: false, sortOrder: 1 },
  ];

  const templateIds: string[] = [];
  for (const t of templateDefs) {
    const id = uuid();
    templateIds.push(id);
    await testDb.insert(schema.checklistTemplates).values({
      id,
      editionId,
      organizationId: orgId,
      entityType: t.entityType,
      name: t.name,
      itemType: t.itemType,
      fieldKey: t.fieldKey || null,
      required: t.required,
      sortOrder: t.sortOrder,
      dueOffsetDays: t.dueOffsetDays ?? null,
    });
  }

  // ─── Cleanup function ──────────────────────────────
  async function cleanup() {
    // Delete in reverse dependency order
    await testDb.delete(schema.checklistItems).where(eq(schema.checklistItems.organizationId, orgId));
    await testDb.delete(schema.checklistTemplates).where(eq(schema.checklistTemplates.organizationId, orgId));
    const teamIds = Object.values(teams);
    if (teamIds.length > 0) {
      await testDb.delete(schema.teamMembers).where(inArray(schema.teamMembers.teamId, teamIds));
      await testDb.delete(schema.teamEntityTypes).where(inArray(schema.teamEntityTypes.teamId, teamIds));
      await testDb.delete(schema.teams).where(inArray(schema.teams.id, teamIds));
    }
    await testDb.delete(schema.speakerApplications).where(eq(schema.speakerApplications.organizationId, orgId));
    await testDb.delete(schema.sponsorApplications).where(eq(schema.sponsorApplications.organizationId, orgId));
    await testDb.delete(schema.userOrganizations).where(eq(schema.userOrganizations.organizationId, orgId));
    await testDb
      .delete(schema.users)
      .where(inArray(schema.users.email, [speakerEmail, sponsorEmail]));
    if (userIds.length > 0) {
      await testDb.delete(schema.users).where(inArray(schema.users.id, userIds));
    }
    await testDb.delete(schema.eventEditions).where(eq(schema.eventEditions.organizationId, orgId));
    await testDb.delete(schema.eventSeries).where(eq(schema.eventSeries.organizationId, orgId));
    await testDb.delete(schema.organizations).where(eq(schema.organizations.id, orgId));
  }

  return { orgId, editionId, users, teams, speakerId, sponsorId, templateCount: templateDefs.length, cleanup };
}

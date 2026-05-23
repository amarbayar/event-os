import { NextRequest } from "next/server";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { testDb } from "../setup";
import * as schema from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { createTestFixtures, type TestFixtures } from "../fixtures";
import { isRbacError, requirePermission } from "@/lib/rbac";

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

// ════════════════════════════════════════════════════════
// RBAC PERMISSION TESTS
// Tests the team-scoped permission model:
//   owner > admin > organizer > coordinator > viewer
//   Teams own entity types via team_entity_types junction
//
// Uses self-contained fixtures — no dependency on seed data.
// ════════════════════════════════════════════════════════

let fixtures: TestFixtures;

beforeAll(async () => {
  fixtures = await createTestFixtures();
});

beforeEach(() => {
  authMock.mockReset();
});

afterAll(async () => {
  await fixtures.cleanup();
});

// ─── Schema Validation ─────────────────────────────

describe("RBAC schema", () => {
  it("has at least one user per core role", () => {
    const roles = Object.values(fixtures.users).map((u) => u.role);
    expect(roles).toContain("owner");
    expect(roles).toContain("organizer");
    expect(roles).toContain("coordinator");
  });

  it("every user has a valid role", () => {
    const validRoles = ["owner", "admin", "organizer", "coordinator", "viewer", "stakeholder"];
    for (const [, u] of Object.entries(fixtures.users)) {
      expect(validRoles).toContain(u.role);
    }
  });

  it("has 5 org-wide RBAC teams", () => {
    expect(Object.keys(fixtures.teams).length).toBe(5);
    expect(fixtures.teams["Program"]).toBeDefined();
    expect(fixtures.teams["Logistics"]).toBeDefined();
    expect(fixtures.teams["Sponsor/Partnership"]).toBeDefined();
    expect(fixtures.teams["Operations"]).toBeDefined();
    expect(fixtures.teams["Marketing"]).toBeDefined();
  });

  it("Program team owns speaker + session entity types", async () => {
    const types = await testDb
      .select({ entityType: schema.teamEntityTypes.entityType })
      .from(schema.teamEntityTypes)
      .where(eq(schema.teamEntityTypes.teamId, fixtures.teams["Program"]));

    const typeNames = types.map((t: { entityType: string }) => t.entityType).sort();
    expect(typeNames).toEqual(["session", "speaker"]);
  });

  it("Logistics team owns venue + booth entity types", async () => {
    const types = await testDb
      .select({ entityType: schema.teamEntityTypes.entityType })
      .from(schema.teamEntityTypes)
      .where(eq(schema.teamEntityTypes.teamId, fixtures.teams["Logistics"]));

    const typeNames = types.map((t: { entityType: string }) => t.entityType).sort();
    expect(typeNames).toEqual(["booth", "venue"]);
  });

  it("Operations team owns volunteer + media + attendee", async () => {
    const types = await testDb
      .select({ entityType: schema.teamEntityTypes.entityType })
      .from(schema.teamEntityTypes)
      .where(eq(schema.teamEntityTypes.teamId, fixtures.teams["Operations"]));

    const typeNames = types.map((t: { entityType: string }) => t.entityType).sort();
    expect(typeNames).toEqual(["attendee", "media", "volunteer"]);
  });
});

// ─── Team Membership ────────────────────────────────

describe("Team membership", () => {
  it("Organizer is on Program and Logistics teams", async () => {
    const memberships = await testDb
      .select({ teamId: schema.teamMembers.teamId })
      .from(schema.teamMembers)
      .where(eq(schema.teamMembers.userId, fixtures.users["TestOrganizer"].id));

    const teamIds = memberships.map((m: { teamId: string }) => m.teamId);
    expect(teamIds).toContain(fixtures.teams["Program"]);
    expect(teamIds).toContain(fixtures.teams["Logistics"]);
  });

  it("Coordinator is on Sponsor/Partnership and Marketing teams", async () => {
    const memberships = await testDb
      .select({ teamId: schema.teamMembers.teamId })
      .from(schema.teamMembers)
      .where(eq(schema.teamMembers.userId, fixtures.users["TestCoordinator"].id));

    const teamIds = memberships.map((m: { teamId: string }) => m.teamId);
    expect(teamIds).toContain(fixtures.teams["Sponsor/Partnership"]);
    expect(teamIds).toContain(fixtures.teams["Marketing"]);
  });
});

// ─── Permission Logic (DB-level verification) ───────

async function userOwnsEntityType(
  userId: string,
  entityType: string
): Promise<boolean> {
  const result = await testDb
    .select({ entityType: schema.teamEntityTypes.entityType })
    .from(schema.teamMembers)
    .innerJoin(schema.teams, eq(schema.teamMembers.teamId, schema.teams.id))
    .innerJoin(
      schema.teamEntityTypes,
      eq(schema.teams.id, schema.teamEntityTypes.teamId)
    )
    .where(
      and(
        eq(schema.teamMembers.userId, userId),
        eq(schema.teams.organizationId, fixtures.orgId),
        isNull(schema.teams.editionId),
        eq(schema.teamEntityTypes.entityType, entityType)
      )
    );
  return result.length > 0;
}

describe("Permission scope checks", () => {
  it("Organizer CAN edit speakers (on Program team)", async () => {
    expect(await userOwnsEntityType(fixtures.users["TestOrganizer"].id, "speaker")).toBe(true);
  });

  it("Organizer CAN edit venues (on Logistics team)", async () => {
    expect(await userOwnsEntityType(fixtures.users["TestOrganizer"].id, "venue")).toBe(true);
  });

  it("Organizer CANNOT edit sponsors (not on Sponsor team)", async () => {
    expect(await userOwnsEntityType(fixtures.users["TestOrganizer"].id, "sponsor")).toBe(false);
  });

  it("Organizer CANNOT edit campaigns (not on Marketing team)", async () => {
    expect(await userOwnsEntityType(fixtures.users["TestOrganizer"].id, "campaign")).toBe(false);
  });

  it("Coordinator CAN edit sponsors (on Sponsor/Partnership team)", async () => {
    expect(await userOwnsEntityType(fixtures.users["TestCoordinator"].id, "sponsor")).toBe(true);
  });

  it("Coordinator CAN edit campaigns (on Marketing team)", async () => {
    expect(await userOwnsEntityType(fixtures.users["TestCoordinator"].id, "campaign")).toBe(true);
  });

  it("Coordinator CANNOT edit venues (not on Logistics team)", async () => {
    expect(await userOwnsEntityType(fixtures.users["TestCoordinator"].id, "venue")).toBe(false);
  });

  it("Coordinator CAN edit speakers (on Program team)", async () => {
    expect(await userOwnsEntityType(fixtures.users["TestCoordinator"].id, "speaker")).toBe(true);
  });

  it("Viewer has no team scope", async () => {
    expect(await userOwnsEntityType(fixtures.users["TestViewer"].id, "speaker")).toBe(false);
    expect(await userOwnsEntityType(fixtures.users["TestViewer"].id, "sponsor")).toBe(false);
  });

  it("Stakeholder has no team scope", async () => {
    expect(await userOwnsEntityType(fixtures.users["TestStakeholder"].id, "speaker")).toBe(false);
  });
});

describe("Stakeholder portal confinement", () => {
  function mockStakeholderSession() {
    authMock.mockResolvedValue({
      user: {
        id: fixtures.users["TestStakeholder"].id,
        role: "stakeholder",
        organizationId: fixtures.orgId,
      },
    });
  }

  it("denies stakeholders broad reads to organizer APIs", async () => {
    mockStakeholderSession();

    const res = await requirePermission(
      new NextRequest("https://platform.devsummit.dev/api/speakers"),
      "speaker",
      "read"
    );

    expect(isRbacError(res)).toBe(true);
    if (!isRbacError(res)) throw new Error("Expected RBAC error response");
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      error: "Forbidden",
      message: "Stakeholder accounts can only access the portal.",
    });
  });

  it("allows stakeholder checklist reads and updates for route-level ownership checks", async () => {
    mockStakeholderSession();

    for (const action of ["read", "update"] as const) {
      const res = await requirePermission(
        new NextRequest("https://platform.devsummit.dev/api/checklist-items/checklist-1"),
        "speaker",
        action
      );

      expect(isRbacError(res)).toBe(false);
    }
  });
});

describe("Invitation permissions", () => {
  it("allows organizers to create guest invitations", async () => {
    authMock.mockResolvedValue({
      user: {
        id: fixtures.users["TestOrganizer"].id,
        role: "organizer",
        organizationId: fixtures.orgId,
      },
    });

    const res = await requirePermission(
      new NextRequest("https://platform.devsummit.dev/api/invitations"),
      "invitation",
      "create",
    );

    expect(isRbacError(res)).toBe(false);
    if (isRbacError(res)) throw new Error("Expected organizer invitation access");
    expect(res.user.role).toBe("organizer");
  });
});

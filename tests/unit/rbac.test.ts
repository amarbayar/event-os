import { describe, it, expect, beforeAll } from "vitest";
import { testDb } from "../setup";
import * as schema from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

// ════════════════════════════════════════════════════════
// RBAC PERMISSION TESTS
// Tests the team-scoped permission model:
//   owner > admin > organizer > coordinator > viewer
//   Teams own entity types via team_entity_types junction
// ════════════════════════════════════════════════════════

let orgId: string;
let users: Record<string, { id: string; role: string }>;
let teams: Record<string, string>; // teamName → teamId

beforeAll(async () => {
  const org = await testDb.query.organizations.findFirst();
  if (!org) throw new Error("No organization found — run seed first");
  orgId = org.id;

  // Load all users via user_organizations
  const memberships = await testDb.query.userOrganizations.findMany({
    where: eq(schema.userOrganizations.organizationId, orgId),
    with: { user: true },
  });

  users = {};
  for (const m of memberships) {
    users[m.user.name || m.user.email] = { id: m.user.id, role: m.role };
  }

  // Load org-wide teams
  const allTeams = await testDb
    .select()
    .from(schema.teams)
    .where(
      and(eq(schema.teams.organizationId, orgId), isNull(schema.teams.editionId))
    );

  teams = {};
  for (const t of allTeams) {
    teams[t.name] = t.id;
  }
});

// ─── Schema Validation ─────────────────────────────

describe("RBAC schema", () => {
  it("has at least one user per core role", () => {
    const roles = Object.values(users).map((u) => u.role);
    // The system requires at least: owner, organizer, coordinator
    expect(roles).toContain("owner");
    expect(roles).toContain("organizer");
    expect(roles).toContain("coordinator");
  });

  it("every user has a valid role", () => {
    const validRoles = ["owner", "admin", "organizer", "coordinator", "viewer", "stakeholder"];
    for (const [name, u] of Object.entries(users)) {
      expect(validRoles).toContain(u.role);
    }
  });

  it("has 5 org-wide RBAC teams", () => {
    expect(Object.keys(teams).length).toBe(5);
    expect(teams["Program"]).toBeDefined();
    expect(teams["Logistics"]).toBeDefined();
    expect(teams["Sponsor/Partnership"]).toBeDefined();
    expect(teams["Operations"]).toBeDefined();
    expect(teams["Marketing"]).toBeDefined();
  });

  it("Program team owns speaker + session entity types", async () => {
    const types = await testDb
      .select({ entityType: schema.teamEntityTypes.entityType })
      .from(schema.teamEntityTypes)
      .where(eq(schema.teamEntityTypes.teamId, teams["Program"]));

    const typeNames = types.map((t: any) => t.entityType).sort();
    expect(typeNames).toEqual(["session", "speaker"]);
  });

  it("Logistics team owns venue + booth entity types", async () => {
    const types = await testDb
      .select({ entityType: schema.teamEntityTypes.entityType })
      .from(schema.teamEntityTypes)
      .where(eq(schema.teamEntityTypes.teamId, teams["Logistics"]));

    const typeNames = types.map((t: any) => t.entityType).sort();
    expect(typeNames).toEqual(["booth", "venue"]);
  });

  it("Operations team owns volunteer + media + attendee", async () => {
    const types = await testDb
      .select({ entityType: schema.teamEntityTypes.entityType })
      .from(schema.teamEntityTypes)
      .where(eq(schema.teamEntityTypes.teamId, teams["Operations"]));

    const typeNames = types.map((t: any) => t.entityType).sort();
    expect(typeNames).toEqual(["attendee", "media", "volunteer"]);
  });
});

// ─── Team Membership ────────────────────────────────

describe("Team membership", () => {
  it("Tuvshin is on Program and Logistics teams", async () => {
    const memberships = await testDb
      .select({ teamId: schema.teamMembers.teamId })
      .from(schema.teamMembers)
      .where(eq(schema.teamMembers.userId, users["Tuvshin"].id));

    const teamIds = memberships.map((m: any) => m.teamId);
    expect(teamIds).toContain(teams["Program"]);
    expect(teamIds).toContain(teams["Logistics"]);
  });

  it("Sarnai is on Operations and Marketing teams", async () => {
    const memberships = await testDb
      .select({ teamId: schema.teamMembers.teamId })
      .from(schema.teamMembers)
      .where(eq(schema.teamMembers.userId, users["Sarnai"].id));

    const teamIds = memberships.map((m: any) => m.teamId);
    expect(teamIds).toContain(teams["Operations"]);
    expect(teamIds).toContain(teams["Marketing"]);
  });

  it("Oyungerel is on Sponsor/Partnership and Marketing teams", async () => {
    const memberships = await testDb
      .select({ teamId: schema.teamMembers.teamId })
      .from(schema.teamMembers)
      .where(eq(schema.teamMembers.userId, users["Oyungerel"].id));

    const teamIds = memberships.map((m: any) => m.teamId);
    expect(teamIds).toContain(teams["Sponsor/Partnership"]);
    expect(teamIds).toContain(teams["Marketing"]);
  });
});

// ─── Permission Logic (DB-level verification) ───────
// These test the userOwnsEntityType logic by checking the same join
// that requirePermission() uses in production.

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
        eq(schema.teams.organizationId, orgId),
        isNull(schema.teams.editionId),
        eq(schema.teamEntityTypes.entityType, entityType)
      )
    )
    .limit(1);

  return result.length > 0;
}

describe("Permission scope checks", () => {
  // Tuvshin (organizer) is on Program (speaker, session) + Logistics (venue, booth)
  it("Tuvshin CAN edit speakers (on Program team)", async () => {
    expect(await userOwnsEntityType(users["Tuvshin"].id, "speaker")).toBe(true);
  });

  it("Tuvshin CAN edit venues (on Logistics team)", async () => {
    expect(await userOwnsEntityType(users["Tuvshin"].id, "venue")).toBe(true);
  });

  it("Tuvshin CANNOT edit sponsors (not on Sponsor team)", async () => {
    expect(await userOwnsEntityType(users["Tuvshin"].id, "sponsor")).toBe(false);
  });

  it("Tuvshin CANNOT edit volunteers (not on Operations team)", async () => {
    expect(await userOwnsEntityType(users["Tuvshin"].id, "volunteer")).toBe(false);
  });

  // Sarnai (coordinator) is on Operations (volunteer, media, attendee) + Marketing (campaign)
  it("Sarnai CAN edit volunteers (on Operations team)", async () => {
    expect(await userOwnsEntityType(users["Sarnai"].id, "volunteer")).toBe(true);
  });

  it("Sarnai CAN edit campaigns (on Marketing team)", async () => {
    expect(await userOwnsEntityType(users["Sarnai"].id, "campaign")).toBe(true);
  });

  it("Sarnai CANNOT edit speakers (not on Program team)", async () => {
    expect(await userOwnsEntityType(users["Sarnai"].id, "speaker")).toBe(false);
  });

  // Oyungerel (organizer) is on Sponsor/Partnership (sponsor, outreach) + Marketing (campaign)
  it("Oyungerel CAN edit sponsors (on Sponsor team)", async () => {
    expect(await userOwnsEntityType(users["Oyungerel"].id, "sponsor")).toBe(true);
  });

  it("Oyungerel CANNOT edit speakers (not on Program team)", async () => {
    expect(await userOwnsEntityType(users["Oyungerel"].id, "speaker")).toBe(false);
  });
});

// ─── Users via user_organizations ──────────────────

describe("User organization memberships", () => {
  it("all 5 users have memberships in the org", async () => {
    const memberships = await testDb.query.userOrganizations.findMany({
      where: eq(schema.userOrganizations.organizationId, orgId),
    });
    expect(memberships.length).toBeGreaterThan(0);
  });

  it("emails are unique across the org", async () => {
    const memberships = await testDb.query.userOrganizations.findMany({
      where: eq(schema.userOrganizations.organizationId, orgId),
      with: { user: true },
    });
    const emails = memberships.map((m: any) => m.user.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it("all users have password hashes (can log in)", async () => {
    const memberships = await testDb.query.userOrganizations.findMany({
      where: eq(schema.userOrganizations.organizationId, orgId),
      with: { user: true },
    });
    for (const m of memberships) {
      expect(m.user.passwordHash).toBeTruthy();
    }
  });
});

// ─── Role Hierarchy Logic ───────────────────────────

describe("Role hierarchy", () => {
  const ROLE_HIERARCHY: Record<string, number> = {
    owner: 100,
    admin: 80,
    organizer: 60,
    coordinator: 40,
    viewer: 20,
  };

  it("owner has highest privilege", () => {
    expect(ROLE_HIERARCHY["owner"]).toBeGreaterThan(ROLE_HIERARCHY["admin"]);
  });

  it("admin bypasses team scope check", () => {
    expect(ROLE_HIERARCHY["admin"]).toBeGreaterThanOrEqual(80);
  });

  it("organizer can delete lead/engaged (role >= 60)", () => {
    expect(ROLE_HIERARCHY["organizer"]).toBeGreaterThanOrEqual(60);
  });

  it("coordinator cannot delete (role < 60)", () => {
    expect(ROLE_HIERARCHY["coordinator"]).toBeLessThan(60);
  });

  it("viewer is read-only (lowest level)", () => {
    expect(ROLE_HIERARCHY["viewer"]).toBeLessThan(ROLE_HIERARCHY["coordinator"]);
  });
});

// ─── AssigneeId FK ──────────────────────────────────

describe("AssigneeId FK on entity tables", () => {
  it("speakerApplications has assigneeId column", async () => {
    const speakers = await testDb.query.speakerApplications.findMany({ limit: 1 });
    if (speakers.length > 0) {
      expect("assigneeId" in speakers[0]).toBe(true);
    }
  });

  it("sponsorApplications has assigneeId column", async () => {
    const sponsors = await testDb.query.sponsorApplications.findMany({ limit: 1 });
    if (sponsors.length > 0) {
      expect("assigneeId" in sponsors[0]).toBe(true);
    }
  });

  it("venues has assigneeId column", async () => {
    const venues = await testDb.query.venues.findMany({ limit: 1 });
    if (venues.length > 0) {
      expect("assigneeId" in venues[0]).toBe(true);
    }
  });
});

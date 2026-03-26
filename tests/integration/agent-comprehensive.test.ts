/**
 * Comprehensive Agent Intelligence Test Suite
 *
 * Tests the FULL chain: LLM classify → dispatcher (RBAC) → handler → DB
 * Uses real Gemini LLM — not mocked.
 *
 * Test matrix:
 *   8 entity types × 6 operations (create, update, delete, count, list, search)
 *   + RBAC (6 roles × mutation types)
 *   + Edge cases (empty params, unknown entity, disambiguation, multilingual)
 *   + Error handling (friendly messages, no system errors)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import { ilikeFn as ilike } from "@/db/dialect";
import { dispatch, AgentContext } from "@/lib/agent/dispatcher";
import { AgentIntent, DispatchResult } from "@/lib/agent/types";

// ─── Test Helpers ─────────────────────────────────────

let orgId: string;
let editionId: string;
// Real user IDs for team-scoped roles (looked up in beforeAll)
let organizerUserId: string;
let organizerEntityType: string; // entity type this organizer can manage
let coordinatorUserId: string;
let coordinatorEntityType: string;

function ctx(role = "admin", userId?: string): AgentContext {
  return { orgId, editionId, userId: userId || "test-user", userRole: role, userName: "Test User" };
}

function intent(overrides: Partial<AgentIntent>): AgentIntent {
  return {
    intent: "manage",
    entityType: null,
    action: null,
    params: {},
    searchBy: null,
    searchValue: null,
    message: "",
    confirmation: false,
    ...overrides,
  };
}

// ─── Setup / Teardown ─────────────────────────────────

beforeAll(async () => {
  const orgs = await db.select({ id: schema.organizations.id }).from(schema.organizations).limit(1);
  const editions = await db.select({ id: schema.eventEditions.id }).from(schema.eventEditions).limit(1);
  orgId = orgs[0]?.id;
  editionId = editions[0]?.id;
  if (!orgId || !editionId) throw new Error("Need org + edition in DB to run agent tests");

  // Look up real organizer/coordinator with team scope for RBAC tests
  const teamScoped = await db
    .select({
      userId: schema.teamMembers.userId,
      role: schema.userOrganizations.role,
      entityType: schema.teamEntityTypes.entityType,
    })
    .from(schema.teamMembers)
    .innerJoin(schema.teams, eq(schema.teamMembers.teamId, schema.teams.id))
    .innerJoin(schema.teamEntityTypes, eq(schema.teams.id, schema.teamEntityTypes.teamId))
    .innerJoin(schema.userOrganizations, and(
      eq(schema.teamMembers.userId, schema.userOrganizations.userId),
      eq(schema.userOrganizations.organizationId, orgId)
    ))
    .where(and(eq(schema.teams.organizationId, orgId), isNull(schema.teams.editionId)))
    .limit(20);

  const org = teamScoped.find((r: any) => r.role === "organizer");
  const coord = teamScoped.find((r: any) => r.role === "coordinator");
  organizerUserId = org?.userId || "no-organizer";
  organizerEntityType = org?.entityType || "speaker";
  coordinatorUserId = coord?.userId || "no-coordinator";
  coordinatorEntityType = coord?.entityType || "volunteer";
});

afterAll(async () => {
  // Cleanup any test entities created during tests
  const tables = [
    schema.speakerApplications,
    schema.sponsorApplications,
    schema.venues,
    schema.booths,
    schema.volunteerApplications,
    schema.mediaPartners,
    schema.tasks,
    schema.campaigns,
  ];
  for (const table of tables) {
    await db.delete(table).where(
      and(
        eq((table as any).organizationId, orgId),
        ilike((table as any)[("name" in table) ? "name" : ("title" in table) ? "title" : "companyName"], "%AgentTest%")
      )
    ).catch(() => {}); // ignore if column doesn't exist
  }
});

// ─── Helper to clean up a specific entity ─────────────

async function cleanup(table: any, nameField: string, pattern: string) {
  await db.delete(table).where(
    and(eq(table.organizationId, orgId), ilike(table[nameField], `%${pattern}%`))
  ).catch(() => {});
}

// ═══════════════════════════════════════════════════════
// SECTION 1: CREATE — All entity types
// ═══════════════════════════════════════════════════════

describe("Agent CREATE operations", () => {
  it("creates a speaker with all fields", async () => {
    const result = await dispatch(
      intent({
        intent: "manage", action: "create", entityType: "speaker",
        params: { name: "AgentTest Speaker", email: "at@test.com", company: "TestCo", talkTitle: "AI Talk" },
      }),
      ctx()
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain("AgentTest Speaker");

    const rows = await db.select().from(schema.speakerApplications)
      .where(and(eq(schema.speakerApplications.organizationId, orgId), ilike(schema.speakerApplications.name, "%AgentTest Speaker%")));
    expect(rows.length).toBe(1);
    expect(rows[0].company).toBe("TestCo");
    expect(rows[0].talkTitle).toBe("AI Talk");
    await cleanup(schema.speakerApplications, "name", "AgentTest Speaker");
  });

  it("creates a speaker with minimal fields (name only)", async () => {
    const result = await dispatch(
      intent({ intent: "manage", action: "create", entityType: "speaker", params: { name: "AgentTest Minimal" } }),
      ctx()
    );
    expect(result.success).toBe(true);
    const rows = await db.select().from(schema.speakerApplications)
      .where(and(eq(schema.speakerApplications.organizationId, orgId), ilike(schema.speakerApplications.name, "%AgentTest Minimal%")));
    expect(rows.length).toBe(1);
    expect(rows[0].email).toBe(""); // default
    expect(rows[0].talkTitle).toBe("TBD"); // default
    expect(rows[0].source).toBe("intake"); // default
    expect(rows[0].stage).toBe("lead"); // default
    await cleanup(schema.speakerApplications, "name", "AgentTest Minimal");
  });

  it("creates a sponsor", async () => {
    const result = await dispatch(
      intent({
        intent: "manage", action: "create", entityType: "sponsor",
        params: { companyName: "AgentTest Sponsor Corp", contactEmail: "s@test.com", packagePreference: "gold" },
      }),
      ctx()
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain("AgentTest Sponsor Corp");
    await cleanup(schema.sponsorApplications, "companyName", "AgentTest Sponsor");
  });

  it("creates a venue", async () => {
    const result = await dispatch(
      intent({
        intent: "manage", action: "create", entityType: "venue",
        params: { name: "AgentTest Hall", address: "123 Test St", capacity: "500" },
      }),
      ctx()
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain("AgentTest Hall");
    await cleanup(schema.venues, "name", "AgentTest Hall");
  });

  it("creates a booth", async () => {
    const result = await dispatch(
      intent({
        intent: "manage", action: "create", entityType: "booth",
        params: { name: "AgentTest Booth A", companyName: "BoothCo", size: "3x3" },
      }),
      ctx()
    );
    expect(result.success).toBe(true);
    await cleanup(schema.booths, "name", "AgentTest Booth");
  });

  it("creates a volunteer", async () => {
    const result = await dispatch(
      intent({
        intent: "manage", action: "create", entityType: "volunteer",
        params: { name: "AgentTest Volunteer", email: "v@test.com", phone: "99001122" },
      }),
      ctx()
    );
    expect(result.success).toBe(true);
    await cleanup(schema.volunteerApplications, "name", "AgentTest Volunteer");
  });

  it("creates a media partner", async () => {
    const result = await dispatch(
      intent({
        intent: "manage", action: "create", entityType: "media",
        params: { companyName: "AgentTest Media Co", type: "online", contactEmail: "m@test.com" },
      }),
      ctx()
    );
    expect(result.success).toBe(true);
    await cleanup(schema.mediaPartners, "companyName", "AgentTest Media");
  });

  it("creates a task", async () => {
    const result = await dispatch(
      intent({
        intent: "manage", action: "create", entityType: "task",
        params: { title: "AgentTest Task", description: "Do something", priority: "high" },
      }),
      ctx()
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain("AgentTest Task");

    const rows = await db.select().from(schema.tasks)
      .where(and(eq(schema.tasks.organizationId, orgId), ilike(schema.tasks.title, "%AgentTest Task%")));
    expect(rows.length).toBe(1);
    expect(rows[0].priority).toBe("high");
    expect(rows[0].status).toBe("todo"); // default
    await cleanup(schema.tasks, "title", "AgentTest Task");
  });

  it("creates a campaign", async () => {
    const result = await dispatch(
      intent({
        intent: "manage", action: "create", entityType: "campaign",
        params: { title: "AgentTest Campaign", type: "speaker_announcement", platform: "twitter" },
      }),
      ctx()
    );
    expect(result.success).toBe(true);
    await cleanup(schema.campaigns, "title", "AgentTest Campaign");
  });

  it("rejects create with no name", async () => {
    const result = await dispatch(
      intent({ intent: "manage", action: "create", entityType: "speaker", params: { email: "no-name@test.com" } }),
      ctx()
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("need at least a name");
  });

  it("rejects create with unknown entity type", async () => {
    const result = await dispatch(
      intent({ intent: "manage", action: "create", entityType: null, params: {} }),
      ctx()
    );
    expect(result.success).toBe(true); // returns guidance, not error
    expect(result.message).toContain("Which one");
  });
});

// ═══════════════════════════════════════════════════════
// SECTION 2: UPDATE — Find + modify
// ═══════════════════════════════════════════════════════

describe("Agent UPDATE operations", () => {
  let testSpeakerId: string;

  beforeAll(async () => {
    // Create a speaker to update
    const [s] = await db.insert(schema.speakerApplications).values({
      editionId, organizationId: orgId,
      name: "AgentTest UpdateMe", email: "update@test.com", talkTitle: "Old Talk",
      source: "intake", stage: "lead",
    }).returning();
    testSpeakerId = s.id;
  });

  afterAll(async () => {
    await cleanup(schema.speakerApplications, "name", "AgentTest UpdateMe");
  });

  it("updates a speaker field by name search", async () => {
    const result = await dispatch(
      intent({
        intent: "manage", action: "update", entityType: "speaker",
        searchValue: "UpdateMe",
        params: { phone: "99887766" },
      }),
      ctx()
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain("phone: 99887766");

    const [updated] = await db.select().from(schema.speakerApplications).where(eq(schema.speakerApplications.id, testSpeakerId));
    expect(updated.phone).toBe("99887766");
  });

  it("updates stage field", async () => {
    const result = await dispatch(
      intent({
        intent: "manage", action: "update", entityType: "speaker",
        searchValue: "AgentTest UpdateMe",
        params: { stage: "engaged" },
      }),
      ctx()
    );
    expect(result.success).toBe(true);
    const [updated] = await db.select().from(schema.speakerApplications).where(eq(schema.speakerApplications.id, testSpeakerId));
    expect(updated.stage).toBe("engaged");
  });

  it("rejects update with no search value", async () => {
    const result = await dispatch(
      intent({ intent: "manage", action: "update", entityType: "speaker", params: { phone: "123" } }),
      ctx()
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("Which speaker");
  });

  it("rejects update when no matching entity found", async () => {
    const result = await dispatch(
      intent({
        intent: "manage", action: "update", entityType: "speaker",
        searchValue: "NonexistentPerson12345",
        params: { phone: "123" },
      }),
      ctx()
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("No speaker found");
  });

  it("rejects update with no fields to change", async () => {
    const result = await dispatch(
      intent({
        intent: "manage", action: "update", entityType: "speaker",
        searchValue: "AgentTest UpdateMe",
        params: {}, // no fields
      }),
      ctx()
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("What do you want to change");
  });

  it("filters out disallowed fields on update", async () => {
    const result = await dispatch(
      intent({
        intent: "manage", action: "update", entityType: "speaker",
        searchValue: "AgentTest UpdateMe",
        params: { id: "hacked-id", organizationId: "hacked-org", bio: "legit update" },
      }),
      ctx()
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain("bio: legit update");
    // Verify id and orgId were NOT changed
    const [row] = await db.select().from(schema.speakerApplications).where(eq(schema.speakerApplications.id, testSpeakerId));
    expect(row.id).toBe(testSpeakerId);
    expect(row.organizationId).toBe(orgId);
  });
});

// ═══════════════════════════════════════════════════════
// SECTION 3: DELETE — confirmation flow
// ═══════════════════════════════════════════════════════

describe("Agent DELETE operations", () => {
  it("executes delete when confirmation flag is set", async () => {
    await db.insert(schema.volunteerApplications).values({
      editionId, organizationId: orgId, name: "AgentTest DeleteVol", email: "del@test.com", source: "intake", stage: "lead",
    });

    const result = await dispatch(
      intent({
        intent: "manage", action: "delete", entityType: "volunteer",
        searchValue: "AgentTest DeleteVol",
        confirmation: true,
      }),
      ctx()
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain("Deleted");

    // Verify actually deleted from DB
    const remaining = await db.select().from(schema.volunteerApplications)
      .where(ilike(schema.volunteerApplications.name, "%AgentTest DeleteVol%"));
    expect(remaining.length).toBe(0);
  });

  it("rejects delete with no search value", async () => {
    const result = await dispatch(
      intent({ intent: "manage", action: "delete", entityType: "speaker", confirmation: true }),
      ctx()
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("Which speaker");
  });
});

// ═══════════════════════════════════════════════════════
// SECTION 4: QUERY — count, list, search
// ═══════════════════════════════════════════════════════

describe("Agent QUERY operations", () => {
  it("counts all speakers", async () => {
    const result = await dispatch(
      intent({ intent: "query", action: "count", entityType: "speaker", params: {} }),
      ctx()
    );
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/\*\*\d+\*\*/); // **N** format
    expect(result.message).toContain("speakers");
  });

  it("counts speakers with filter", async () => {
    const result = await dispatch(
      intent({ intent: "query", action: "count", entityType: "speaker", params: { filters: { stage: "lead" } } }),
      ctx()
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain("lead");
  });

  it("lists sponsors", async () => {
    const result = await dispatch(
      intent({ intent: "query", action: "list", entityType: "sponsor", params: {} }),
      ctx()
    );
    expect(result.success).toBe(true);
    // Either shows list or "No sponsors found" — both are valid
    expect(result.message).toBeDefined();
  });

  it("lists tasks with status filter", async () => {
    const result = await dispatch(
      intent({ intent: "query", action: "list", entityType: "task", params: { filters: { status: "todo" } } }),
      ctx()
    );
    expect(result.success).toBe(true);
  });

  it("searches speaker by name", async () => {
    // Create a known speaker
    await db.insert(schema.speakerApplications).values({
      editionId, organizationId: orgId,
      name: "AgentTest Searchable", email: "search@test.com", talkTitle: "Talk",
      source: "intake", stage: "lead",
    });

    const result = await dispatch(
      intent({ intent: "query", action: "search", entityType: "speaker", searchValue: "AgentTest Searchable" }),
      ctx()
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain("AgentTest Searchable");

    await cleanup(schema.speakerApplications, "name", "AgentTest Searchable");
  });

  it("returns empty result for nonexistent search", async () => {
    const result = await dispatch(
      intent({ intent: "query", action: "search", entityType: "speaker", searchValue: "ZzzNobodyXyz999" }),
      ctx()
    );
    expect(result.success).toBe(true); // not an error, just empty
    expect(result.message).toContain("No");
  });

  it("counts all entity types without error", async () => {
    const types = ["speaker", "sponsor", "venue", "booth", "volunteer", "media", "task", "campaign"] as const;
    for (const entityType of types) {
      const result = await dispatch(
        intent({ intent: "query", action: "count", entityType, params: {} }),
        ctx()
      );
      expect(result.success).toBe(true);
      expect(result.message).not.toContain("Failed");
      expect(result.message).not.toContain("error");
    }
  });

  it("returns helpful message for missing entity type on query", async () => {
    const result = await dispatch(
      intent({ intent: "query", action: "count", entityType: null }),
      ctx()
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain("I can query");
  });

  it("search includes checklist info for confirmed entity", async () => {
    // Find a speaker with checklist items
    const items = await db.select({ entityId: schema.checklistItems.entityId })
      .from(schema.checklistItems)
      .where(and(eq(schema.checklistItems.entityType, "speaker"), eq(schema.checklistItems.organizationId, orgId)))
      .limit(1);

    if (items.length > 0) {
      const [speaker] = await db.select().from(schema.speakerApplications)
        .where(eq(schema.speakerApplications.id, items[0].entityId));
      if (speaker) {
        const result = await dispatch(
          intent({ intent: "query", action: "search", entityType: "speaker", searchValue: speaker.name.split(" ")[0] }),
          ctx()
        );
        expect(result.success).toBe(true);
        expect(result.message).toContain("Checklist");
      }
    }
    // If no checklist items exist, test is a no-op (acceptable)
  });
});

// ═══════════════════════════════════════════════════════
// SECTION 5: RBAC — Role-based access control
// ═══════════════════════════════════════════════════════

describe("Agent RBAC enforcement", () => {
  // ─── Viewer role ────────────────────────────────────
  describe("viewer role", () => {
    it("can query (count)", async () => {
      const result = await dispatch(
        intent({ intent: "query", action: "count", entityType: "speaker", params: {} }),
        ctx("viewer")
      );
      expect(result.success).toBe(true);
    });

    it("can query (list)", async () => {
      const result = await dispatch(
        intent({ intent: "query", action: "list", entityType: "task", params: {} }),
        ctx("viewer")
      );
      expect(result.success).toBe(true);
    });

    it("can query (search)", async () => {
      const result = await dispatch(
        intent({ intent: "query", action: "search", entityType: "speaker", searchValue: "test" }),
        ctx("viewer")
      );
      expect(result.success).toBe(true);
    });

    it("CANNOT create", async () => {
      const result = await dispatch(
        intent({ intent: "manage", action: "create", entityType: "speaker", params: { name: "Hacked Speaker" } }),
        ctx("viewer")
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("view-only");
      expect(result.message).not.toContain("Error");
      expect(result.message).not.toContain("error");
    });

    it("CANNOT update", async () => {
      const result = await dispatch(
        intent({ intent: "manage", action: "update", entityType: "speaker", searchValue: "test", params: { phone: "hacked" } }),
        ctx("viewer")
      );
      expect(result.success).toBe(false);
    });

    it("CANNOT delete", async () => {
      const result = await dispatch(
        intent({ intent: "manage", action: "delete", entityType: "speaker", searchValue: "test", confirmation: true }),
        ctx("viewer")
      );
      expect(result.success).toBe(false);
    });

    it("can chitchat", async () => {
      const result = await dispatch(
        intent({ intent: "chitchat", message: "Hello!" }),
        ctx("viewer")
      );
      expect(result.success).toBe(true);
    });
  });

  // ─── Stakeholder role ───────────────────────────────
  describe("stakeholder role", () => {
    it("can query", async () => {
      const result = await dispatch(
        intent({ intent: "query", action: "count", entityType: "speaker", params: {} }),
        ctx("stakeholder")
      );
      expect(result.success).toBe(true);
    });

    it("CANNOT create", async () => {
      const result = await dispatch(
        intent({ intent: "manage", action: "create", entityType: "speaker", params: { name: "Hacked" } }),
        ctx("stakeholder")
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("portal");
    });

    it("CANNOT update via agent", async () => {
      const result = await dispatch(
        intent({ intent: "manage", action: "update", entityType: "sponsor", searchValue: "x", params: { message: "hack" } }),
        ctx("stakeholder")
      );
      expect(result.success).toBe(false);
    });

    it("CANNOT delete", async () => {
      const result = await dispatch(
        intent({ intent: "manage", action: "delete", entityType: "volunteer", searchValue: "x", confirmation: true }),
        ctx("stakeholder")
      );
      expect(result.success).toBe(false);
    });
  });

  // ─── Coordinator role ───────────────────────────────
  describe("coordinator role", () => {
    it("can create entity within their team scope", async () => {
      // Use real coordinator userId + an entity type they have scope for
      const result = await dispatch(
        intent({ intent: "manage", action: "create", entityType: coordinatorEntityType as any, params: { name: "AgentTest CoordScoped" } }),
        ctx("coordinator", coordinatorUserId)
      );
      expect(result.success).toBe(true);
      // Cleanup — find the right table by entity type
      const tables: Record<string, any> = {
        volunteer: schema.volunteerApplications, venue: schema.venues,
        booth: schema.booths, media: schema.mediaPartners, attendee: schema.attendees,
        campaign: schema.campaigns,
      };
      const table = tables[coordinatorEntityType];
      if (table) {
        const nameField = "companyName" in table ? "companyName" : "name" in table ? "name" : "title";
        await cleanup(table, nameField, "AgentTest CoordScoped");
      }
    });

    it("CANNOT create entity outside their team scope", async () => {
      // Use an entity type the coordinator does NOT have scope for
      const outOfScope = coordinatorEntityType === "speaker" ? "sponsor" : "speaker";
      const result = await dispatch(
        intent({ intent: "manage", action: "create", entityType: outOfScope as any, params: { name: "AgentTest CoordNoScope" } }),
        ctx("coordinator", coordinatorUserId)
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("permission");
    });

    it("CANNOT delete", async () => {
      const result = await dispatch(
        intent({ intent: "manage", action: "delete", entityType: coordinatorEntityType as any, searchValue: "x", confirmation: true }),
        ctx("coordinator", coordinatorUserId)
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("Coordinators");
    });
  });

  // ─── Organizer role ─────────────────────────────────
  describe("organizer role", () => {
    it("can create entity within their team scope", async () => {
      const result = await dispatch(
        intent({ intent: "manage", action: "create", entityType: organizerEntityType as any, params: { name: "AgentTest OrgScoped" } }),
        ctx("organizer", organizerUserId)
      );
      expect(result.success).toBe(true);
      const tables: Record<string, any> = {
        speaker: schema.speakerApplications, sponsor: schema.sponsorApplications,
        venue: schema.venues, booth: schema.booths, volunteer: schema.volunteerApplications,
        media: schema.mediaPartners, campaign: schema.campaigns,
      };
      const table = tables[organizerEntityType];
      if (table) {
        const nameField = "companyName" in table ? "companyName" : "name" in table ? "name" : "title";
        await cleanup(table, nameField, "AgentTest OrgScoped");
      }
    });

    it("CANNOT create entity outside their team scope", async () => {
      // Find an entity type this organizer does NOT have scope for
      const scopedTypes = await db
        .select({ entityType: schema.teamEntityTypes.entityType })
        .from(schema.teamMembers)
        .innerJoin(schema.teams, eq(schema.teamMembers.teamId, schema.teams.id))
        .innerJoin(schema.teamEntityTypes, eq(schema.teams.id, schema.teamEntityTypes.teamId))
        .where(and(
          eq(schema.teamMembers.userId, organizerUserId),
          eq(schema.teams.organizationId, orgId),
          isNull(schema.teams.editionId)
        ));
      const scopedSet = new Set(scopedTypes.map((r: any) => r.entityType));
      const manageable = ["speaker", "sponsor", "venue", "booth", "volunteer", "media", "task", "campaign"];
      const outOfScope = manageable.find((t) => !scopedSet.has(t));
      if (!outOfScope) return; // organizer has scope for everything — skip test

      const result = await dispatch(
        intent({ intent: "manage", action: "create", entityType: outOfScope as any, params: { name: "AgentTest OrgNoScope" } }),
        ctx("organizer", organizerUserId)
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("permission");
    });

    it("can initiate delete within scope (gets confirmation)", async () => {
      // Use a simple entity type the organizer has scope for
      // Create a lead-stage volunteer/venue/speaker in their scope
      const entityType = organizerEntityType;
      const tables: Record<string, any> = {
        speaker: schema.speakerApplications, sponsor: schema.sponsorApplications,
        venue: schema.venues, booth: schema.booths, volunteer: schema.volunteerApplications,
        media: schema.mediaPartners, campaign: schema.campaigns, task: schema.tasks,
      };
      const table = tables[entityType];
      if (!table) return; // skip if entity type isn't manageable

      // Build insert values dynamically using schema introspection
      const { getTableColumns } = await import("drizzle-orm");
      const cols = getTableColumns(table);
      const nameField = "companyName" in cols ? "companyName" : "name" in cols ? "name" : "title";
      const vals: any = { editionId, organizationId: orgId };
      vals[nameField] = "AgentTest OrgDel";
      // Fill required NOT NULL fields
      if ("email" in cols) vals.email = "";
      if ("talkTitle" in cols) vals.talkTitle = "TBD";
      if ("contactName" in cols) vals.contactName = "TBD";
      if ("contactEmail" in cols) vals.contactEmail = "";
      if ("source" in cols) vals.source = "intake";
      if ("stage" in cols) vals.stage = "lead";
      if ("type" in cols && entityType === "campaign") vals.type = "event_update";
      if ("status" in cols && entityType === "task") vals.status = "todo";
      if ("priority" in cols) vals.priority = "medium";
      if ("title" in cols && !vals.title) vals.title = vals.name || "AgentTest OrgDel";

      await db.insert(table).values(vals);

      const result = await dispatch(
        intent({
          intent: "manage", action: "delete", entityType: entityType as any,
          searchValue: "AgentTest OrgDel", confirmation: true,
        }),
        ctx("organizer", organizerUserId),
        "Delete " + entityType + " AgentTest OrgDel"
      );
      expect(result.success).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
      await cleanup(table, nameField, "AgentTest OrgDel");
    });
  });

  // ─── Admin/Owner roles ──────────────────────────────
  describe("admin and owner roles", () => {
    it("admin can create", async () => {
      const result = await dispatch(
        intent({ intent: "manage", action: "create", entityType: "booth", params: { name: "AgentTest AdminBooth" } }),
        ctx("admin")
      );
      expect(result.success).toBe(true);
      await cleanup(schema.booths, "name", "AgentTest AdminBooth");
    });

    it("owner can create", async () => {
      const result = await dispatch(
        intent({ intent: "manage", action: "create", entityType: "campaign", params: { title: "AgentTest OwnerCamp" } }),
        ctx("owner")
      );
      expect(result.success).toBe(true);
      await cleanup(schema.campaigns, "title", "AgentTest OwnerCamp");
    });
  });

  // ─── Friendly error messages ────────────────────────
  describe("error messages are user-friendly", () => {
    const restrictedRoles = ["viewer", "stakeholder"];
    const mutations = [
      { action: "create" as const, entityType: "speaker" as const, params: { name: "X" }, searchValue: null },
      { action: "update" as const, entityType: "speaker" as const, params: { phone: "1" }, searchValue: "X" },
      { action: "delete" as const, entityType: "speaker" as const, params: {}, searchValue: "X" },
    ];

    for (const role of restrictedRoles) {
      for (const mut of mutations) {
        it(`${role} gets friendly message for ${mut.action}`, async () => {
          const result = await dispatch(
            intent({
              intent: "manage",
              action: mut.action,
              entityType: mut.entityType,
              searchValue: mut.searchValue,
              params: mut.params,
              confirmation: mut.action === "delete",
            }),
            ctx(role)
          );
          expect(result.success).toBe(false);
          // Must NOT contain system error language
          expect(result.message).not.toMatch(/exception/i);
          expect(result.message).not.toMatch(/stack trace/i);
          expect(result.message).not.toMatch(/undefined/i);
          expect(result.message).not.toMatch(/null/i);
          expect(result.message).not.toMatch(/TypeError/i);
          expect(result.message).not.toMatch(/Cannot read/i);
          // Must contain helpful guidance
          expect(result.message.length).toBeGreaterThan(10);
        });
      }
    }
  });
});

// ═══════════════════════════════════════════════════════
// SECTION 6: Edge cases
// ═══════════════════════════════════════════════════════

describe("Agent edge cases", () => {
  it("handles unknown entity type gracefully", async () => {
    const result = await dispatch(
      intent({ intent: "manage", entityType: "spaceship" as any, action: "create", params: { name: "X" } }),
      ctx()
    );
    expect(result.success).toBe(true); // guidance, not crash
    expect(result.message).toContain("Which one");
  });

  it("handles null action gracefully", async () => {
    const result = await dispatch(
      intent({ intent: "manage", entityType: "speaker", action: null, params: {} }),
      ctx()
    );
    expect(result.success).toBe(true); // guidance
    expect(result.message).toContain("create, update, or delete");
  });

  it("handles empty input gracefully", async () => {
    const result = await dispatch(
      intent({ intent: "chitchat", message: "" }),
      ctx()
    );
    expect(result.success).toBe(true);
  });

  it("handles very long name without crashing", async () => {
    const longName = "AgentTest " + "A".repeat(250);
    const result = await dispatch(
      intent({ intent: "manage", action: "create", entityType: "volunteer", params: { name: longName } }),
      ctx()
    );
    // Either succeeds (truncated) or fails gracefully — must not throw
    expect(result.message).toBeDefined();
    expect(result.message).not.toMatch(/TypeError|Cannot read/i);
    await cleanup(schema.volunteerApplications, "name", "AgentTest AAA");
  });

  it("handles disambiguation for multiple matches on update", async () => {
    // Create two similar speakers
    await db.insert(schema.speakerApplications).values([
      { editionId, organizationId: orgId, name: "AgentTest Smith Alice", email: "a@t.com", talkTitle: "T1", source: "intake", stage: "lead" },
      { editionId, organizationId: orgId, name: "AgentTest Smith Bob", email: "b@t.com", talkTitle: "T2", source: "intake", stage: "lead" },
    ]);

    const result = await dispatch(
      intent({
        intent: "manage", action: "update", entityType: "speaker",
        searchValue: "AgentTest Smith",
        params: { phone: "123" },
      }),
      ctx()
    );
    expect(result.success).toBe(false); // disambiguation required
    expect(result.message).toContain("Multiple");
    expect(result.message).toContain("AgentTest Smith Alice");
    expect(result.message).toContain("AgentTest Smith Bob");

    await cleanup(schema.speakerApplications, "name", "AgentTest Smith");
  });

  it("disallowed fields are silently filtered (id, organizationId)", async () => {
    const result = await dispatch(
      intent({
        intent: "manage", action: "create", entityType: "speaker",
        params: { name: "AgentTest Filtered", id: "injected-id", organizationId: "injected-org" },
      }),
      ctx()
    );
    expect(result.success).toBe(true);
    const rows = await db.select().from(schema.speakerApplications)
      .where(and(eq(schema.speakerApplications.organizationId, orgId), ilike(schema.speakerApplications.name, "%AgentTest Filtered%")));
    expect(rows.length).toBe(1);
    expect(rows[0].id).not.toBe("injected-id");
    expect(rows[0].organizationId).toBe(orgId); // real org, not injected
    await cleanup(schema.speakerApplications, "name", "AgentTest Filtered");
  });

  it("org scoping prevents cross-org reads", async () => {
    // Search in our org — should work
    const result = await dispatch(
      intent({ intent: "query", action: "count", entityType: "speaker", params: {} }),
      ctx()
    );
    expect(result.success).toBe(true);

    // With a fake org — should return 0 (data isolated)
    const fakeCtx = { ...ctx(), orgId: "00000000-0000-0000-0000-000000000000" };
    const result2 = await dispatch(
      intent({ intent: "query", action: "count", entityType: "speaker", params: {} }),
      fakeCtx
    );
    expect(result2.success).toBe(true);
    expect(result2.data).toEqual({ count: 0 });
  });
});

// ═══════════════════════════════════════════════════════
// SECTION 7: Field alias resolution
// ═══════════════════════════════════════════════════════

describe("Agent field alias resolution", () => {
  it("resolves 'company' correctly for speakers (stays as company)", async () => {
    const result = await dispatch(
      intent({
        intent: "manage", action: "create", entityType: "speaker",
        params: { name: "AgentTest AliasSpk", company: "AliasCo" },
      }),
      ctx()
    );
    expect(result.success).toBe(true);
    const rows = await db.select().from(schema.speakerApplications)
      .where(and(eq(schema.speakerApplications.organizationId, orgId), ilike(schema.speakerApplications.name, "%AgentTest AliasSpk%")));
    expect(rows[0].company).toBe("AliasCo");
    await cleanup(schema.speakerApplications, "name", "AgentTest AliasSpk");
  });

  it("resolves 'company' correctly for sponsors (maps to companyName)", async () => {
    const result = await dispatch(
      intent({
        intent: "manage", action: "create", entityType: "sponsor",
        params: { companyName: "AgentTest AliasSponsor" },
      }),
      ctx()
    );
    expect(result.success).toBe(true);
    await cleanup(schema.sponsorApplications, "companyName", "AgentTest AliasSponsor");
  });

  it("resolves 'assigned_to' to assignedTo", async () => {
    const result = await dispatch(
      intent({
        intent: "manage", action: "create", entityType: "task",
        params: { title: "AgentTest AliasTask", assigned_to: "john" },
      }),
      ctx()
    );
    expect(result.success).toBe(true);
    const rows = await db.select().from(schema.tasks)
      .where(and(eq(schema.tasks.organizationId, orgId), ilike(schema.tasks.title, "%AgentTest AliasTask%")));
    expect(rows[0].assignedTo).toBe("john");
    await cleanup(schema.tasks, "title", "AgentTest AliasTask");
  });

  it("resolves 'track' to trackPreference for speakers", async () => {
    const result = await dispatch(
      intent({
        intent: "manage", action: "create", entityType: "speaker",
        params: { name: "AgentTest AliasTrack", track: "AI & ML" },
      }),
      ctx()
    );
    expect(result.success).toBe(true);
    const rows = await db.select().from(schema.speakerApplications)
      .where(and(eq(schema.speakerApplications.organizationId, orgId), ilike(schema.speakerApplications.name, "%AgentTest AliasTrack%")));
    expect(rows[0].trackPreference).toBe("AI & ML");
    await cleanup(schema.speakerApplications, "name", "AgentTest AliasTrack");
  });
});

// ═══════════════════════════════════════════════════════
// SECTION 8: LLM integration (real Gemini calls)
// ═══════════════════════════════════════════════════════

describe("Agent LLM integration (real Gemini)", () => {
  let provider: any;

  beforeAll(async () => {
    try {
      const { getProvider } = await import("@/lib/agent");
      provider = await getProvider();
    } catch {
      // No API key — skip LLM tests
      provider = null;
    }
  });

  // Helper that skips if no LLM available
  function llmIt(name: string, fn: () => Promise<void>) {
    it(name, async () => {
      if (!provider) return; // skip gracefully
      await fn();
    });
  }

  llmIt("classifies 'add speaker John' as manage/create/speaker", async () => {
    const intent = await provider.classify("Add speaker John Kim, email john@test.com");
    expect(intent.intent).toBe("manage");
    expect(intent.entityType).toBe("speaker");
    expect(intent.action).toBe("create");
    expect(intent.params).toHaveProperty("name");
  });

  llmIt("classifies 'how many sponsors' as query/count/sponsor", async () => {
    const intent = await provider.classify("How many sponsors do we have?");
    expect(intent.intent).toBe("query");
    expect(intent.entityType).toBe("sponsor");
    expect(["count", "list"]).toContain(intent.action);
  });

  llmIt("classifies 'find venue Blue Sky' as query/search/venue", async () => {
    const intent = await provider.classify("Find venue Blue Sky Hall");
    expect(intent.intent).toBe("query");
    expect(intent.entityType).toBe("venue");
    expect(intent.action).toBe("search");
    expect(intent.searchValue).toBeTruthy();
  });

  llmIt("classifies 'delete booth X' with confirmation flag", async () => {
    const intent = await provider.classify("Delete booth TechZone");
    expect(intent.intent).toBe("manage");
    expect(intent.action).toBe("delete");
    expect(intent.confirmation).toBe(true);
  });

  llmIt("classifies 'hello' as chitchat", async () => {
    const intent = await provider.classify("Hey, what's up?");
    expect(intent.intent).toBe("chitchat");
  });

  llmIt("classifies Mongolian Cyrillic input", async () => {
    const intent = await provider.classify("Сайн байна уу, хэдэн speaker бүртгэгдсэн бэ?");
    expect(intent.intent).toBe("query");
    expect(intent.entityType).toBe("speaker");
  });

  llmIt("classifies Monglish (transliterated) input", async () => {
    const intent = await provider.classify("Speaker nemne, ner ni Batbold, email batbold@test.mn");
    expect(intent.intent).toBe("manage");
    expect(intent.entityType).toBe("speaker");
    expect(intent.action).toBe("create");
  });

  llmIt("extracts multiple fields from natural language", async () => {
    const intent = await provider.classify(
      "Add a new booth called AgentTest LLM Booth for Mobicom, contact is Bold at bold@mobicom.mn, size 4x4"
    );
    expect(intent.intent).toBe("manage");
    expect(intent.entityType).toBe("booth");
    expect(intent.action).toBe("create");
    expect(intent.params).toHaveProperty("name");
    // At least companyName or contactName should be extracted
    const params = intent.params as Record<string, unknown>;
    const hasContact = params.companyName || params.contactName || params.company_name || params.contact_name;
    expect(hasContact).toBeTruthy();
  });

  llmIt("full e2e: LLM classify → dispatch → DB create + verify + cleanup", async () => {
    const classified = await provider.classify("Add media partner AgentTest LLM Media, type is podcast, contact media@test.com");
    const result = await dispatch(classified, ctx());
    expect(result.success).toBe(true);
    expect(result.message).toContain("AgentTest LLM Media");

    // Verify in DB
    const rows = await db.select().from(schema.mediaPartners)
      .where(and(eq(schema.mediaPartners.organizationId, orgId), ilike(schema.mediaPartners.companyName, "%AgentTest LLM Media%")));
    expect(rows.length).toBe(1);

    await cleanup(schema.mediaPartners, "companyName", "AgentTest LLM Media");
  });

  llmIt("full e2e: LLM classify → dispatch → DB count", async () => {
    const classified = await provider.classify("List all confirmed speakers");
    const result = await dispatch(classified, ctx());
    expect(result.success).toBe(true);
    // Should not crash even if 0 confirmed
    expect(result.message).not.toMatch(/TypeError|Cannot read/i);
  });
});

// ═══════════════════════════════════════════════════════
// SECTION 9: Error resilience
// ═══════════════════════════════════════════════════════

describe("Agent error resilience", () => {
  it("dispatcher catches handler errors and returns friendly message", async () => {
    // Force an error with corrupted context
    const badCtx: AgentContext = { orgId: "", editionId: "", userId: "", userRole: "admin", userName: null };
    const result = await dispatch(
      intent({ intent: "query", action: "count", entityType: "speaker", params: {} }),
      badCtx
    );
    // Should either work (empty org returns 0) or return friendly error — never crash
    expect(result.message).toBeDefined();
    expect(result.message).not.toMatch(/TypeError|Cannot read|undefined/i);
  });

  it("handles SQL-injection-like input in search safely", async () => {
    const result = await dispatch(
      intent({
        intent: "query", action: "search", entityType: "speaker",
        searchValue: "'; DROP TABLE speaker_applications; --",
      }),
      ctx()
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain("No"); // no results, not a crash
    // Verify table still exists
    const count = await db.select({ c: sql<number>`count(*)` }).from(schema.speakerApplications);
    expect(Number(count[0].c)).toBeGreaterThanOrEqual(0);
  });

  it("never returns system errors to user on any entity/action combo", async () => {
    const entities = ["speaker", "sponsor", "venue", "booth", "volunteer", "media", "task", "campaign"] as const;
    const actions = ["count", "list"] as const;

    for (const entityType of entities) {
      for (const action of actions) {
        const result = await dispatch(
          intent({ intent: "query", action, entityType, params: {} }),
          ctx()
        );
        expect(result.message).not.toMatch(/TypeError|ReferenceError|SyntaxError|Cannot read|undefined is not/i);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════
// SECTION 10: Destructive action prevention
// ═══════════════════════════════════════════════════════

describe("Destructive action prevention", () => {
  // ─── Bulk operation blocking ────────────────────────
  describe("bulk operations blocked", () => {
    it("blocks 'delete all speakers'", async () => {
      const result = await dispatch(
        intent({ intent: "manage", action: "delete", entityType: "speaker", confirmation: true }),
        ctx(),
        "Delete all speakers because we want to start over"
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("one record at a time");
    });

    it("blocks 'update every sponsor'", async () => {
      const result = await dispatch(
        intent({ intent: "manage", action: "update", entityType: "sponsor", searchValue: "x", params: { stage: "declined" } }),
        ctx(),
        "Update every sponsor's stage to declined"
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("one record at a time");
    });

    it("blocks 'remove all booths'", async () => {
      const result = await dispatch(
        intent({ intent: "manage", action: "delete", entityType: "booth", confirmation: true }),
        ctx(),
        "Remove all booths from the event"
      );
      expect(result.success).toBe(false);
    });

    it("blocks 'wipe' language", async () => {
      const result = await dispatch(
        intent({ intent: "manage", action: "delete", entityType: "volunteer", confirmation: true }),
        ctx(),
        "Wipe the volunteer list"
      );
      expect(result.success).toBe(false);
    });

    it("blocks 'start over' language", async () => {
      const result = await dispatch(
        intent({ intent: "manage", action: "delete", entityType: "speaker", confirmation: true }),
        ctx(),
        "Delete all speakers, let's start over"
      );
      expect(result.success).toBe(false);
    });

    it("allows single-entity delete (not bulk)", async () => {
      const result = await dispatch(
        intent({ intent: "manage", action: "delete", entityType: "speaker", searchValue: "SpecificPerson", confirmation: true }),
        ctx(),
        "Delete speaker SpecificPerson"
      );
      // Should NOT be blocked by bulk detection (it's a single entity)
      // It may fail for other reasons (not found) but should not say "one record at a time"
      expect(result.message).not.toContain("one record at a time");
    });
  });

  // ─── Stage protection ──────────────────────────────
  describe("confirmed entity protection", () => {
    let confirmedSpeakerId: string;

    beforeAll(async () => {
      const [s] = await db.insert(schema.speakerApplications).values({
        editionId, organizationId: orgId,
        name: "AgentTest ConfirmedSpk", email: "c@t.com", talkTitle: "Talk",
        source: "intake", stage: "confirmed",
      }).returning();
      confirmedSpeakerId = s.id;
    });

    afterAll(async () => {
      await db.delete(schema.speakerApplications)
        .where(eq(schema.speakerApplications.id, confirmedSpeakerId))
        .catch(() => {});
    });

    it("organizer CANNOT delete confirmed entity", async () => {
      const result = await dispatch(
        intent({
          intent: "manage", action: "delete", entityType: "speaker",
          searchValue: "AgentTest ConfirmedSpk", confirmation: true,
        }),
        ctx("organizer", organizerUserId),
        "Delete speaker AgentTest ConfirmedSpk"
      );
      expect(result.success).toBe(false);
      // Blocked either by stage protection or team scope — both are valid
      expect(result.message.toLowerCase()).toMatch(/confirmed|permission/);
    });

    it("admin CAN delete confirmed entity (executes directly)", async () => {
      const result = await dispatch(
        intent({
          intent: "manage", action: "delete", entityType: "speaker",
          searchValue: "AgentTest ConfirmedSpk", confirmation: true,
        }),
        ctx("admin"),
        "Delete speaker AgentTest ConfirmedSpk"
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain("Deleted");
      // Re-create for afterAll cleanup
      const [s] = await db.insert(schema.speakerApplications).values({
        editionId, organizationId: orgId,
        name: "AgentTest ConfirmedSpk", email: "c@t.com", talkTitle: "Talk",
        source: "intake", stage: "confirmed",
      }).returning();
      confirmedSpeakerId = s.id;
    });
  });

  // ─── Team scope in agent ───────────────────────────
  describe("team scope enforcement", () => {
    it("organizer without team scope gets denied", async () => {
      // Use a user ID that exists but has no team assignments for this entity type
      // We test with a fake userId that won't match any team membership
      const result = await dispatch(
        intent({ intent: "manage", action: "create", entityType: "speaker", params: { name: "Test" } }),
        { ...ctx("organizer"), userId: "00000000-0000-0000-0000-000000000099" },
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("permission");
    });

    it("admin bypasses team scope", async () => {
      const result = await dispatch(
        intent({ intent: "manage", action: "create", entityType: "speaker", params: { name: "AgentTest AdminBypass" } }),
        ctx("admin"),
      );
      expect(result.success).toBe(true);
      await cleanup(schema.speakerApplications, "name", "AgentTest AdminBypass");
    });
  });
});

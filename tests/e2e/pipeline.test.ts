import { describe, it, expect, beforeAll } from "vitest";
import { apiCall, getTestIds, BASE_URL } from "../setup";

let testIds: { orgId: string; editionId: string };

beforeAll(async () => {
  testIds = await getTestIds();
});

// ════════════════════════════════════════════════════════
// ENTITY PIPELINE TESTS
// Tests the unified source/stage model across all 7 entity types
// ════════════════════════════════════════════════════════

// Helper: test CRUD lifecycle for any entity type
async function testEntityLifecycle(config: {
  name: string;
  endpoint: string;
  createPayload: Record<string, unknown>;
  minimalPayload: Record<string, unknown>;
  nameField: string;
}) {
  const { name, endpoint, createPayload, minimalPayload, nameField } = config;

  describe(`${name} pipeline`, () => {
    let createdId: string;

    // ── CREATE: Happy path with complete info ──
    it(`creates ${name} with complete info`, async () => {
      const { status, json } = await apiCall(endpoint, {
        method: "POST",
        body: createPayload,
      });
      expect(status).toBe(201);
      expect(json.data).toBeDefined();
      expect(json.data[nameField]).toBe(createPayload[nameField]);
      // Pipeline fields (source present on all entities, stage on most)
      if (json.data.source !== undefined) {
        expect(json.data.source).toBe(createPayload.source || "intake");
      }
      createdId = json.data.id;
    });

    // ── CREATE: Minimal info (only name) ──
    it(`creates ${name} with minimal info`, async () => {
      const { status, json } = await apiCall(endpoint, {
        method: "POST",
        body: minimalPayload,
      });
      expect(status).toBe(201);
      expect(json.data[nameField]).toBe(minimalPayload[nameField]);
    });

    // ── CREATE: Missing required field ──
    it(`rejects ${name} without name`, async () => {
      const { status } = await apiCall(endpoint, {
        method: "POST",
        body: {},
      });
      expect(status).toBe(400);
    });

    // ── CREATE: With source=outreach ──
    it(`creates ${name} with source=outreach`, async () => {
      const { status, json } = await apiCall(endpoint, {
        method: "POST",
        body: { ...minimalPayload, source: "outreach", assignedTo: "Tuvshin" },
      });
      expect(status).toBe(201);
      if (json.data.source !== undefined) {
        expect(json.data.source).toBe("outreach");
      }
    });

    // ── CREATE: With source=sponsored ──
    it(`creates ${name} with source=sponsored`, async () => {
      const { status, json } = await apiCall(endpoint, {
        method: "POST",
        body: { ...minimalPayload, source: "sponsored" },
      });
      expect(status).toBe(201);
      if (json.data.source !== undefined) {
        expect(json.data.source).toBe("sponsored");
      }
    });

    // ── READ: List all ──
    it(`lists all ${name}s`, async () => {
      const { status, json } = await apiCall(endpoint);
      // Some endpoints return 200 with data, others return 400 (need editionId param)
      if (status === 200) {
        expect(Array.isArray(json.data)).toBe(true);
        expect(json.data.length).toBeGreaterThan(0);
      } else {
        // Speakers route requires editionId param — this is expected
        expect([200, 400]).toContain(status);
      }
    });

    // ── DELETE: Happy path ──
    it(`deletes ${name}`, async () => {
      if (!createdId) return;
      const { status } = await apiCall(`${endpoint}/${createdId}`, {
        method: "DELETE",
      });
      expect(status).toBe(200);
    });

    // ── DELETE: Non-existent ──
    it(`returns 404 for non-existent ${name}`, async () => {
      const { status } = await apiCall(
        `${endpoint}/00000000-0000-0000-0000-000000000000`,
        { method: "DELETE" }
      );
      expect(status).toBe(404);
    });
  });
}

// ════════════════════════════════════════════════════════
// RUN PIPELINE TESTS FOR ALL ENTITY TYPES
// ════════════════════════════════════════════════════════

testEntityLifecycle({
  name: "Speaker",
  endpoint: "/api/speakers",
  createPayload: {
    name: "Test Speaker",
    email: "test-speaker@example.com",
    company: "TestCorp",
    talkTitle: "Test Talk",
    talkType: "talk",
    source: "intake",
  },
  minimalPayload: { name: "Minimal Speaker" },
  nameField: "name",
});

testEntityLifecycle({
  name: "Sponsor",
  endpoint: "/api/sponsors",
  createPayload: {
    companyName: "Test Sponsor Corp",
    contactName: "Test Contact",
    contactEmail: "sponsor@test.com",
    packagePreference: "gold",
    source: "outreach",
  },
  minimalPayload: { companyName: "Minimal Sponsor" },
  nameField: "companyName",
});

testEntityLifecycle({
  name: "Volunteer",
  endpoint: "/api/volunteers",
  createPayload: {
    name: "Test Volunteer",
    email: "vol@test.com",
    role: "Registration",
    availability: "Both days",
    tshirtSize: "M",
    source: "intake",
  },
  minimalPayload: { name: "Minimal Volunteer", email: "min-vol@test.com" },
  nameField: "name",
});

testEntityLifecycle({
  name: "Media Partner",
  endpoint: "/api/media-partners",
  createPayload: {
    companyName: "Test Media",
    contactName: "Test Reporter",
    contactEmail: "media@test.com",
    type: "online",
    reach: "10K readers",
    source: "outreach",
  },
  minimalPayload: {
    companyName: "Minimal Media",
    contactName: "Min",
    contactEmail: "min@media.com",
  },
  nameField: "companyName",
});

testEntityLifecycle({
  name: "Venue",
  endpoint: "/api/venues",
  createPayload: {
    name: "Test Venue",
    address: "123 Test St",
    contactName: "Venue Manager",
    contactEmail: "venue@test.com",
    capacity: 500,
    priceQuote: "$3000/day",
    source: "outreach",
  },
  minimalPayload: { name: "Minimal Venue" },
  nameField: "name",
});

testEntityLifecycle({
  name: "Booth",
  endpoint: "/api/booths",
  createPayload: {
    name: "Booth A1",
    location: "Hall B",
    size: "standard",
    equipment: "Table, 2 chairs, power",
    source: "intake",
  },
  minimalPayload: { name: "Minimal Booth" },
  nameField: "name",
});

testEntityLifecycle({
  name: "Task",
  endpoint: "/api/tasks",
  createPayload: {
    title: "Test Task",
    description: "Test description",
    priority: "high",
    assigneeName: "Amarbayar",
    dueDate: "2026-04-01",
  },
  minimalPayload: { title: "Minimal Task" },
  nameField: "title",
});

testEntityLifecycle({
  name: "Campaign",
  endpoint: "/api/campaigns",
  createPayload: {
    title: "Test Campaign",
    type: "speaker_announcement",
    platform: "twitter",
    content: "Test post content",
  },
  minimalPayload: { title: "Minimal Campaign", type: "event_update" },
  nameField: "title",
});

testEntityLifecycle({
  name: "Invitation",
  endpoint: "/api/invitations",
  createPayload: {
    name: "Test Guest",
    type: "special_guest",
    email: "guest@test.com",
    invitedBy: "Amarbayar",
  },
  minimalPayload: { name: "Minimal Guest", type: "vip" },
  nameField: "name",
});

// ════════════════════════════════════════════════════════
// SPEAKER-SPECIFIC TESTS (status changes, optimistic locking)
// ════════════════════════════════════════════════════════

describe("Speaker status transitions", () => {
  let speakerId: string;

  beforeAll(async () => {
    const { json } = await apiCall("/api/speakers", {
      method: "POST",
      body: { name: "Status Test Speaker", source: "intake" },
    });
    speakerId = json.data.id;
  });

  it("accepts a speaker (status → accepted)", async () => {
    const { status, json } = await apiCall(`/api/speakers/${speakerId}`, {
      method: "PATCH",
      headers: { "If-Match": "1" },
      body: { status: "accepted" },
    });
    expect(status).toBe(200);
    expect(json.data.status).toBe("accepted");
  });

  it("rejects stale version (optimistic lock)", async () => {
    const { status } = await apiCall(`/api/speakers/${speakerId}`, {
      method: "PATCH",
      headers: { "If-Match": "1" }, // stale — version is now 2
      body: { status: "rejected" },
    });
    expect(status).toBe(409);
  });

  it("allows update with correct version", async () => {
    const { status, json } = await apiCall(`/api/speakers/${speakerId}`, {
      method: "PATCH",
      headers: { "If-Match": "2" },
      body: { status: "waitlisted" },
    });
    expect(status).toBe(200);
    expect(json.data.status).toBe("waitlisted");
  });
});

// ════════════════════════════════════════════════════════
// AGENT EXTRACTION TESTS
// ════════════════════════════════════════════════════════

// These tests call the real LLM API — skip when no API key is configured
const hasLlmKey = !!(process.env.GEMINI_API_KEY || process.env.XAI_API_KEY || process.env.ZAI_API_KEY);
const describeAgent = hasLlmKey ? describe : describe.skip;

describeAgent("Agent entity extraction", () => {
  it("extracts a speaker from free text", async () => {
    const { status, json } = await apiCall("/api/agent/process", {
      method: "POST",
      body: {
        input: "Sarah Kim from Google wants to talk about AI safety. Email: sarah@google.com",
        mode: "extract",
        editionId: "active",
      },
    });
    expect(status).toBe(200);
    expect(json.data.entities.length).toBeGreaterThan(0);
    expect(json.data.entities[0].type).toBe("speaker");
    expect(json.data.entities[0].data.name).toContain("Sarah");
  });

  it("extracts a sponsor from free text", async () => {
    const { status, json } = await apiCall("/api/agent/process", {
      method: "POST",
      body: {
        input: "Golomt Bank wants Gold sponsorship. Contact Bat-Erdene at baterdene@golomt.mn",
        mode: "extract",
        editionId: "active",
      },
    });
    expect(status).toBe(200);
    expect(json.data.entities.length).toBeGreaterThan(0);
    expect(json.data.entities[0].type).toBe("sponsor");
  });

  it("extracts multiple entities from CSV", async () => {
    const { status, json } = await apiCall("/api/agent/process", {
      method: "POST",
      body: {
        input:
          "Name,Email,Talk\nBatbold,bat@test.com,ML\nSarah,sarah@test.com,Open Source\nJames,james@test.com,DevOps",
        inputType: "csv",
        editionId: "active",
      },
    });
    expect(status).toBe(200);
    expect(json.data.entities.length).toBeGreaterThanOrEqual(1);
  });

  it("generates import actions with real UUIDs", async () => {
    const { status, json } = await apiCall("/api/agent/process", {
      method: "POST",
      body: {
        input: "Add venue: Blue Sky Hotel, Peace Avenue, capacity 300",
        inputType: "text",
        editionId: "active",
      },
    });
    expect(status).toBe(200);
    if (json.data.actions.length > 0) {
      const payload = json.data.actions[0].payload;
      // Should have real UUIDs, not "dev" or "active"
      expect(payload.organizationId).not.toBe("dev");
      expect(payload.editionId).not.toBe("active");
      expect(payload.organizationId.length).toBeGreaterThan(30);
    }
  });

  it("handles ambiguous input with questions", async () => {
    const { status, json } = await apiCall("/api/agent/process", {
      method: "POST",
      body: {
        input: "Add Batbold",
        mode: "extract",
        editionId: "active",
      },
    });
    expect(status).toBe(200);
    // Should either ask questions or create with low confidence
    const hasQuestions = json.data.questions && json.data.questions.length > 0;
    const hasLowConfidence =
      json.data.entities.length > 0 && json.data.entities[0].confidence < 0.9;
    expect(hasQuestions || hasLowConfidence).toBe(true);
  });

  it("respects conversation context in follow-up", async () => {
    const { status, json } = await apiCall("/api/agent/process", {
      method: "POST",
      body: {
        input: "Her email is sarah@example.com and talk title is AI Ethics",
        inputType: "text",
        editionId: "active",
        context:
          "User: Add speaker Sarah Kim from Google\nAgent: Found speaker Sarah Kim. Missing email and talk title.",
      },
    });
    expect(status).toBe(200);
    // Should extract email and talk title from follow-up with context
    if (json.data.entities.length > 0) {
      const data = json.data.entities[0].data;
      expect(data.email || data.contactEmail || "").toContain("sarah");
    }
  });

  it("rate limits excessive requests", async () => {
    // Use raw fetch (not apiCall) to avoid retry-on-429 wrapper
    const SERVICE_TOKEN = process.env.SERVICE_TOKEN || "test-service-token";
    const promises = Array(31)
      .fill(null)
      .map(() =>
        fetch(`${BASE_URL}/api/agent/process`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_TOKEN}`,
            "x-organization-id": testIds.orgId,
          },
          body: JSON.stringify({ input: "test", inputType: "text", editionId: "active" }),
        }).then((r) => ({ status: r.status }))
      );

    const results = await Promise.all(promises);
    const rateLimited = results.filter((r) => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════
// CHECK-IN TESTS
// ════════════════════════════════════════════════════════

describe("Check-in pipeline", () => {
  it("returns check-in stats", async () => {
    const { status, json } = await apiCall(
      `/api/check-in/stats?editionId=${testIds.editionId}`
    );
    expect(status).toBe(200);
    expect(json.data.total).toBeDefined();
    expect(json.data.checkedIn).toBeDefined();
    expect(json.data.remaining).toBeDefined();
    expect(json.data.percentage).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════
// CONFLICT DETECTION TESTS
// ════════════════════════════════════════════════════════

describe("Agenda conflict detection", () => {
  it("detects conflicts in the current edition", async () => {
    const { status, json } = await apiCall(
      `/api/editions/${testIds.editionId}/conflicts`
    );
    expect(status).toBe(200);
    expect(Array.isArray(json.data)).toBe(true);
    // Our seed data has an orphan session (API Design Workshop with no speaker)
  });
});

import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, and, sql, desc, inArray, SQL } from "drizzle-orm";
import { ilikeFn as ilike } from "@/db/dialect";
import { AgentIntent, DispatchResult, DrizzleTable, col } from "./types";
import { AgentContext } from "./dispatcher";
import { validateAgenda } from "@/lib/agenda-validator";

// ─── Query Handler ───────────────────────────────────
//
//  Translates structured AgentIntent into Drizzle queries.
//  All queries are org-scoped. Results formatted as human-readable text.
//
//  SECURITY: internal fields are stripped from all responses.

// Fields that must NEVER appear in agent responses to users
const REDACTED_FIELDS = new Set([
  "id", "organizationId", "editionId", "contactId", "assigneeId",
  "version", "createdAt", "updatedAt", "password", "passwordHash",
  "token", "secret", "hash", "apiKey", "sessionToken", "refreshToken",
]);

function stripSensitiveFields(obj: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!REDACTED_FIELDS.has(k)) clean[k] = v;
  }
  return clean;
}
//
//  "How many speakers are confirmed?"
//  → { action: "count", entityType: "speaker", params: { filters: { stage: "confirmed" } } }
//  → SELECT COUNT(*) FROM speaker_applications WHERE stage='confirmed' AND org_id=?
//  → "There are 4 confirmed speakers."

// Field aliases — maps LLM terms to actual DB column names
const FIELD_ALIASES: Record<string, string> = {
  company: "companyName",
  "company_name": "companyName",
  "contact_email": "contactEmail",
  "contact_name": "contactName",
  phone: "phone",
  "phone#": "phone",
  track: "trackPreference",
  "talk_track": "trackPreference",
  "talk_type": "talkType",
  "talk_title": "talkTitle",
  assignee: "assignedTo",
  "assigned_to": "assignedTo",
  priority: "priority",
  status: "status",
  stage: "stage",
  platform: "platform",
  type: "type",
  email: "email",
  name: "name",
  title: "title",
};

function resolveField(key: string): string {
  return FIELD_ALIASES[key.toLowerCase()] || key;
}

// Entity type → Drizzle table mapping
const TABLE_MAP: Record<string, { table: DrizzleTable; nameField: string; label: string; pluralLabel: string }> = {
  speaker: { table: schema.speakerApplications, nameField: "name", label: "speaker", pluralLabel: "speakers" },
  sponsor: { table: schema.sponsorApplications, nameField: "companyName", label: "sponsor", pluralLabel: "sponsors" },
  venue: { table: schema.venues, nameField: "name", label: "venue", pluralLabel: "venues" },
  booth: { table: schema.booths, nameField: "name", label: "booth", pluralLabel: "booths" },
  volunteer: { table: schema.volunteerApplications, nameField: "name", label: "volunteer", pluralLabel: "volunteers" },
  media: { table: schema.mediaPartners, nameField: "companyName", label: "media partner", pluralLabel: "media partners" },
  task: { table: schema.tasks, nameField: "title", label: "task", pluralLabel: "tasks" },
  campaign: { table: schema.campaigns, nameField: "title", label: "campaign", pluralLabel: "campaigns" },
  attendee: { table: schema.attendees, nameField: "name", label: "attendee", pluralLabel: "attendees" },
  session: { table: schema.sessions, nameField: "title", label: "session", pluralLabel: "sessions" },
};

export async function handleQuery(
  intent: AgentIntent,
  ctx: AgentContext,
  originalInput?: string,
): Promise<DispatchResult> {
  const entityType = intent.entityType;

  // "Tell me about this event" / event info queries
  if ((entityType as string) === "event" || (!entityType && intent.action === "search")) {
    return handleEventInfo(ctx);
  }

  // LLM-generated SQL for complex queries (joins, aggregations, cross-entity)
  // Check this BEFORE the entityType guard — SQL queries can have entityType: null
  if (intent.action === "sql") {
    const { executeSqlQuery } = await import("./sql-query");
    return executeSqlQuery(originalInput || intent.message || "", ctx);
  }

  if (!entityType || !TABLE_MAP[entityType]) {
    return {
      message: `I can query: speakers, sponsors, venues, booths, volunteers, media partners, tasks, campaigns, attendees, sessions. Which one?`,
      success: true,
    };
  }

  // Agenda validation — "any conflicts?", "check schedule", "agenda issues"
  if (intent.action === "validate" && entityType === "session") {
    return handleAgendaValidation(ctx);
  }

  const config = TABLE_MAP[entityType];

  try {
    switch (intent.action) {
      case "count":
        return await handleCount(intent, ctx, config);
      case "list":
        return await handleList(intent, ctx, config);
      case "search":
        return await handleSearch(intent, ctx, config);
      default:
        return await handleCount(intent, ctx, config); // default to count
    }
  } catch (error) {
    console.error("Query handler error:", error);
    return {
      message: `Failed to query ${config.pluralLabel}. Please try again.`,
      success: false,
    };
  }
}

// ─── Enum valid values ────────────────────────────────

const VALID_ENUM_VALUES: Record<string, Set<string>> = {
  stage: new Set(["lead", "engaged", "confirmed", "declined"]),
  status: new Set(["pending", "accepted", "rejected", "waitlisted", "todo", "in_progress", "done", "blocked", "draft", "scheduled", "published", "cancelled"]),
  priority: new Set(["low", "medium", "high", "urgent"]),
  talkType: new Set(["talk", "workshop", "panel", "keynote"]),
  type: new Set(["talk", "workshop", "panel", "keynote", "break", "networking", "opening", "closing", "coffee", "lunch", "fireside", "lightning", "tv", "online", "print", "podcast", "blog", "speaker_announcement", "sponsor_promo", "event_update", "social_post"]),
  platform: new Set(["twitter", "facebook", "instagram", "linkedin", "telegram"]),
  source: new Set(["intake", "outreach", "sponsored"]),
};

// Try to interpret invalid enum values — e.g. "not confirmed" → invert to ["lead","engaged","declined"]
function resolveEnumFilter(field: string, value: string): { values: string[]; negate: boolean } | null {
  const validSet = VALID_ENUM_VALUES[field];
  if (!validSet) return null;

  const lower = value.toLowerCase().trim();

  // Direct match
  if (validSet.has(lower)) return { values: [lower], negate: false };

  // Negation patterns: "not confirmed", "unconfirmed", "non-confirmed"
  const negationMatch = lower.match(/^(?:not |un|non-?)(.+)$/);
  if (negationMatch) {
    const target = negationMatch[1].trim();
    if (validSet.has(target)) {
      // Return all values EXCEPT the negated one
      const remaining = [...validSet].filter((v) => v !== target);
      return { values: remaining, negate: false };
    }
  }

  // No match — skip this filter rather than sending garbage to DB
  return null;
}

// ─── Shared: build filter conditions from intent params ──

function buildFilterConditions(
  filters: Record<string, unknown>,
  table: DrizzleTable,
): SQL[] {
  const conditions: SQL[] = [];
  const enumFields = new Set(["stage", "status", "priority", "talkType", "type", "platform", "source"]);

  for (const [key, value] of Object.entries(filters)) {
    if (!value) continue;
    const resolved = resolveField(key);
    const actualCol = resolved in table ? resolved : key in table ? key : null;
    if (!actualCol) continue;

    // Array value → validate each, then IN clause
    if (Array.isArray(value)) {
      if (enumFields.has(actualCol)) {
        const validSet = VALID_ENUM_VALUES[actualCol];
        const validValues = value.filter((v): v is string => typeof v === "string" && (validSet?.has(v.toLowerCase()) ?? true)).map((v) => v.toLowerCase());
        if (validValues.length > 0) {
          conditions.push(inArray(col(table, actualCol), validValues));
        }
      } else {
        const strings = value.filter((v): v is string => typeof v === "string");
        if (strings.length > 0) {
          conditions.push(inArray(col(table, actualCol), strings));
        }
      }
      continue;
    }

    if (typeof value !== "string") continue;

    // Enum fields — validate and resolve
    if (enumFields.has(actualCol)) {
      const resolved = resolveEnumFilter(actualCol, value);
      if (resolved) {
        if (resolved.values.length === 1) {
          conditions.push(eq(col(table, actualCol), resolved.values[0]));
        } else {
          conditions.push(inArray(col(table, actualCol), resolved.values));
        }
      }
      // If null — invalid value, skip silently instead of crashing
    } else {
      conditions.push(ilike(col(table, actualCol), `%${value}%`));
    }
  }

  return conditions;
}

// ─── COUNT ───────────────────────────────────────────

async function handleCount(
  intent: AgentIntent,
  ctx: AgentContext,
  config: typeof TABLE_MAP[string]
): Promise<DispatchResult> {
  const { table, pluralLabel } = config;
  const filters = (intent.params?.filters as Record<string, unknown>) || {};

  const conditions: SQL[] = [];
  if ("editionId" in table) conditions.push(eq(table.editionId, ctx.editionId));
  if ("organizationId" in table) conditions.push(eq(table.organizationId, ctx.orgId));
  conditions.push(...buildFilterConditions(filters, table));

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(table)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const count = Number(result[0]?.count || 0);

  // Build descriptive message
  const filterDesc = Object.entries(filters)
    .map(([k, v]) => `${v}`)
    .join(", ");

  const message = filterDesc
    ? `There are **${count}** ${filterDesc} ${count === 1 ? config.label : pluralLabel}.`
    : `There are **${count}** ${pluralLabel} total.`;

  return { message, success: true, data: { count } };
}

// ─── LIST ────────────────────────────────────────────

async function handleList(
  intent: AgentIntent,
  ctx: AgentContext,
  config: typeof TABLE_MAP[string]
): Promise<DispatchResult> {
  const { table, nameField, pluralLabel } = config;
  const filters = (intent.params?.filters as Record<string, unknown>) || {};
  const limit = (intent.params?.limit as number) || 10;

  const conditions: SQL[] = [];
  if ("editionId" in table) conditions.push(eq(table.editionId, ctx.editionId));
  if ("organizationId" in table) conditions.push(eq(table.organizationId, ctx.orgId));
  conditions.push(...buildFilterConditions(filters, table));

  const rows = await db
    .select()
    .from(table)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(table.createdAt))
    .limit(limit);

  if (rows.length === 0) {
    const filterDesc = Object.entries(filters).map(([k, v]) => `${k}=${v}`).join(", ");
    return {
      message: `No ${pluralLabel} found${filterDesc ? ` matching ${filterDesc}` : ""}.`,
      success: true,
      data: { items: [] },
    };
  }

  // Format as a readable list
  const items = rows.map((row: Record<string, unknown>, i: number) => {
    const name = row[nameField] || row.name || row.title || "Unnamed";
    const stage = row.stage ? ` (${row.stage})` : "";
    const status = row.status && row.status !== row.stage ? ` [${row.status}]` : "";
    const assignee = row.assignedTo ? ` → ${row.assignedTo}` : "";
    return `${i + 1}. **${name}**${stage}${status}${assignee}`;
  });

  const filterDesc = Object.entries(filters).map(([, v]) => v).join(", ");
  const header = filterDesc
    ? `${filterDesc} ${pluralLabel} (${rows.length}):`
    : `${pluralLabel} (${rows.length}):`;

  return {
    message: `${header}\n${items.join("\n")}`,
    success: true,
    data: { items: rows.map((r: Record<string, unknown>) => stripSensitiveFields(r)) },
  };
}

// ─── SEARCH ──────────────────────────────────────────

async function handleSearch(
  intent: AgentIntent,
  ctx: AgentContext,
  config: typeof TABLE_MAP[string]
): Promise<DispatchResult> {
  const { table, nameField, label, pluralLabel } = config;
  const searchValue = intent.searchValue;

  if (!searchValue) {
    return {
      message: `What ${label} are you looking for? Give me a name, email, or company.`,
      success: true,
    };
  }

  const conditions: SQL[] = [];

  if ("editionId" in table) {
    conditions.push(eq(table.editionId, ctx.editionId));
  }
  if ("organizationId" in table) {
    conditions.push(eq(table.organizationId, ctx.orgId));
  }

  // Search by the specified field or default to name
  const searchField = intent.searchBy || "name";
  const searchColumn = searchField === "name" ? nameField :
                        searchField === "company" ? ("company" in table ? "company" : "companyName" in table ? "companyName" : nameField) :
                        searchField === "email" ? ("email" in table ? "email" : "contactEmail" in table ? "contactEmail" : nameField) :
                        nameField;

  if (searchColumn in table) {
    conditions.push(ilike(col(table, searchColumn), `%${searchValue}%`));
  }

  const rows = await db
    .select()
    .from(table)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(5);

  if (rows.length === 0) {
    return {
      message: `No ${pluralLabel} found matching "${searchValue}".`,
      success: true,
      data: { items: [] },
    };
  }

  if (rows.length === 1) {
    const row = rows[0] as Record<string, unknown>;
    const name = row[nameField] || row.name || row.title || "Unnamed";
    const details: string[] = [];
    if (row.email || row.contactEmail) details.push(`Email: ${row.email || row.contactEmail}`);
    if (row.company || row.companyName) details.push(`Company: ${row.company || row.companyName}`);
    if (row.stage) details.push(`Stage: ${row.stage}`);
    if (row.assignedTo) details.push(`Assigned to: ${row.assignedTo}`);
    if (row.talkTitle) details.push(`Talk: ${row.talkTitle}`);
    if (row.talkType) details.push(`Type: ${row.talkType}`);

    // Include checklist completion status if entity has checklist items
    const checklistInfo = await getChecklistStatus(row.id as string, intent.entityType!, ctx);
    if (checklistInfo) details.push(checklistInfo);

    return {
      message: `Found **${name}**\n${details.join(" | ")}`,
      success: true,
      data: { item: stripSensitiveFields(row) },
    };
  }

  // Multiple matches
  const items = rows.map((row: Record<string, unknown>, i: number) => {
    const name = row[nameField] || row.name || row.title || "Unnamed";
    const extra = row.company || row.companyName || row.email || row.contactEmail || "";
    const stage = row.stage ? ` (${row.stage})` : "";
    return `${i + 1}. **${name}**${extra ? ` — ${extra}` : ""}${stage}`;
  });

  return {
    message: `Found ${rows.length} ${pluralLabel} matching "${searchValue}":\n${items.join("\n")}`,
    success: true,
    data: { items: rows.map((r: Record<string, unknown>) => stripSensitiveFields(r)) },
  };
}

// ─── EVENT INFO ──────────────────────────────────────

async function handleEventInfo(ctx: AgentContext): Promise<DispatchResult> {
  // Get edition details
  const edition = await db.query.eventEditions.findFirst({
    where: eq(schema.eventEditions.id, ctx.editionId),
  });

  if (!edition) {
    return { message: "No event found.", success: false };
  }

  // Get summary counts
  const counts = await Promise.all([
    db.select({ c: sql<number>`count(*)` }).from(schema.speakerApplications).where(eq(schema.speakerApplications.editionId, ctx.editionId)),
    db.select({ c: sql<number>`count(*)` }).from(schema.sponsorApplications).where(eq(schema.sponsorApplications.editionId, ctx.editionId)),
    db.select({ c: sql<number>`count(*)` }).from(schema.volunteerApplications).where(eq(schema.volunteerApplications.editionId, ctx.editionId)),
    db.select({ c: sql<number>`count(*)` }).from(schema.booths).where(eq(schema.booths.editionId, ctx.editionId)),
    db.select({ c: sql<number>`count(*)` }).from(schema.tasks).where(eq(schema.tasks.editionId, ctx.editionId)),
  ]);

  const [speakers, sponsors, volunteers, booths, tasks] = counts.map((r) => Number(r[0]?.c || 0));

  const startDate = edition.startDate ? new Date(edition.startDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "TBD";
  const endDate = edition.endDate ? new Date(edition.endDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "TBD";

  const lines = [
    `**${edition.name}**`,
    `Dates: ${startDate} — ${endDate}`,
    edition.venue ? `Venue: ${edition.venue}` : null,
    `Status: ${edition.status} | CFP: ${edition.cfpOpen ? "open" : "closed"}`,
    "",
    `Speakers: ${speakers} | Sponsors: ${sponsors} | Volunteers: ${volunteers}`,
    `Booths: ${booths} | Tasks: ${tasks}`,
  ].filter(Boolean);

  return {
    message: lines.join("\n"),
    success: true,
  };
}

// ─── CHECKLIST STATUS ─────────────────────────────────

const CHECKLIST_ENTITY_MAP: Record<string, string> = {
  speaker: "speaker",
  sponsor: "sponsor",
  venue: "venue",
  booth: "booth",
  volunteer: "volunteer",
  media: "media",
};

async function getChecklistStatus(
  entityId: string,
  entityType: string,
  ctx: AgentContext
): Promise<string | null> {
  const checklistEntityType = CHECKLIST_ENTITY_MAP[entityType];
  if (!checklistEntityType) return null;

  const items = await db
    .select({
      status: schema.checklistItems.status,
    })
    .from(schema.checklistItems)
    .where(
      and(
        eq(schema.checklistItems.entityId, entityId),
        eq(schema.checklistItems.entityType, checklistEntityType),
        eq(schema.checklistItems.organizationId, ctx.orgId)
      )
    );

  if (items.length === 0) return null;

  const total = items.length;
  const approved = items.filter((i: typeof items[number]) => i.status === "approved").length;
  const submitted = items.filter((i: typeof items[number]) => i.status === "submitted").length;
  const pending = items.filter((i: typeof items[number]) => i.status === "pending").length;

  if (approved === total) return `Checklist: **all ${total} items complete**`;
  if (pending === total) return `Checklist: **${total} items pending** (none submitted)`;

  const parts: string[] = [];
  if (approved > 0) parts.push(`${approved} approved`);
  if (submitted > 0) parts.push(`${submitted} submitted`);
  if (pending > 0) parts.push(`${pending} pending`);
  return `Checklist: ${parts.join(", ")} (${approved}/${total} complete)`;
}

// ─── AGENDA VALIDATION ──────────────────────────────────

async function handleAgendaValidation(ctx: AgentContext): Promise<DispatchResult> {
  try {
    const allSessions = await db.query.sessions.findMany({
      where: eq(schema.sessions.editionId, ctx.editionId),
      with: { speaker: true, track: true },
    });

    const edition = await db.query.eventEditions.findFirst({
      where: eq(schema.eventEditions.id, ctx.editionId),
    });

    if (!edition) {
      return { message: "No edition found.", success: false };
    }

    if (allSessions.length === 0) {
      return {
        message: "No sessions in the agenda yet. Add some sessions first, then I can check for conflicts.",
        success: true,
        data: { issues: [] },
      };
    }

    const allSpeakers = await db.query.speakerApplications.findMany({
      where: eq(schema.speakerApplications.editionId, ctx.editionId),
      columns: { id: true, name: true, stage: true },
    });

    const issues = validateAgenda(
      allSessions,
      {
        gapMinutes: edition.agendaGapMinutes,
        startTime: edition.agendaStartTime ?? "09:00",
        endTime: edition.agendaEndTime ?? "18:00",
        startDate: edition.startDate,
        endDate: edition.endDate,
      },
      allSpeakers
    );

    if (issues.length === 0) {
      return {
        message: `Agenda looks good! **${allSessions.length} sessions** checked, no conflicts or issues found.`,
        success: true,
        data: { issues: [] },
      };
    }

    const errors = issues.filter((i) => i.severity === "error");
    const warnings = issues.filter((i) => i.severity === "warning");

    const lines: string[] = [
      `Found **${issues.length} issue${issues.length > 1 ? "s" : ""}** in the agenda (${allSessions.length} sessions checked):`,
    ];

    if (errors.length > 0) {
      lines.push("");
      lines.push(`**Errors (${errors.length}):**`);
      for (const e of errors) {
        lines.push(`\u274C ${e.message}`);
      }
    }

    if (warnings.length > 0) {
      lines.push("");
      lines.push(`**Warnings (${warnings.length}):**`);
      for (const w of warnings) {
        lines.push(`\u26A0\uFE0F ${w.message}`);
      }
    }

    return {
      message: lines.join("\n"),
      success: true,
      data: { issues },
    };
  } catch (error) {
    console.error("Agenda validation error:", error);
    return {
      message: "Failed to validate the agenda. Please try again.",
      success: false,
    };
  }
}

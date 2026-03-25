import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, and, ilike, sql, desc } from "drizzle-orm";
import { AgentIntent, DispatchResult } from "./types";
import { AgentContext } from "./dispatcher";

// ─── Query Handler ───────────────────────────────────
//
//  Translates structured AgentIntent into Drizzle queries.
//  All queries are org-scoped. Results formatted as human-readable text.
//
//  "How many speakers are confirmed?"
//  → { action: "count", entityType: "speaker", params: { filters: { stage: "confirmed" } } }
//  → SELECT COUNT(*) FROM speaker_applications WHERE stage='confirmed' AND org_id=?
//  → "There are 4 confirmed speakers."

// Entity type → Drizzle table mapping
const TABLE_MAP: Record<string, { table: any; nameField: string; label: string; pluralLabel: string }> = {
  speaker: { table: schema.speakerApplications, nameField: "name", label: "speaker", pluralLabel: "speakers" },
  sponsor: { table: schema.sponsorApplications, nameField: "companyName", label: "sponsor", pluralLabel: "sponsors" },
  venue: { table: schema.venues, nameField: "name", label: "venue", pluralLabel: "venues" },
  booth: { table: schema.booths, nameField: "name", label: "booth", pluralLabel: "booths" },
  volunteer: { table: schema.volunteerApplications, nameField: "name", label: "volunteer", pluralLabel: "volunteers" },
  media: { table: schema.mediaPartners, nameField: "companyName", label: "media partner", pluralLabel: "media partners" },
  task: { table: schema.tasks, nameField: "title", label: "task", pluralLabel: "tasks" },
  campaign: { table: schema.campaigns, nameField: "title", label: "campaign", pluralLabel: "campaigns" },
  attendee: { table: schema.attendees, nameField: "name", label: "attendee", pluralLabel: "attendees" },
};

export async function handleQuery(
  intent: AgentIntent,
  ctx: AgentContext
): Promise<DispatchResult> {
  const entityType = intent.entityType;
  if (!entityType || !TABLE_MAP[entityType]) {
    return {
      message: `I can query: speakers, sponsors, venues, booths, volunteers, media partners, tasks, campaigns, attendees. Which one?`,
      success: true,
    };
  }

  const config = TABLE_MAP[entityType];
  const { table } = config;

  try {
    switch (intent.action) {
      case "count":
        return handleCount(intent, ctx, config);
      case "list":
        return handleList(intent, ctx, config);
      case "search":
        return handleSearch(intent, ctx, config);
      default:
        return handleCount(intent, ctx, config); // default to count
    }
  } catch (error) {
    console.error("Query handler error:", error);
    return {
      message: `Failed to query ${config.pluralLabel}. Please try again.`,
      success: false,
    };
  }
}

// ─── COUNT ───────────────────────────────────────────

async function handleCount(
  intent: AgentIntent,
  ctx: AgentContext,
  config: typeof TABLE_MAP[string]
): Promise<DispatchResult> {
  const { table, pluralLabel } = config;
  const filters = (intent.params?.filters as Record<string, string>) || {};

  // Build conditions
  const conditions: any[] = [];

  // Org scoping — use editionId for entity tables, orgId for tasks/campaigns
  if ("editionId" in table) {
    conditions.push(eq(table.editionId, ctx.editionId));
  }
  if ("organizationId" in table) {
    conditions.push(eq(table.organizationId, ctx.orgId));
  }

  // Apply filters from intent
  for (const [key, value] of Object.entries(filters)) {
    if (key in table && value) {
      conditions.push(eq((table as any)[key], value));
    }
  }

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
  const filters = (intent.params?.filters as Record<string, string>) || {};
  const limit = (intent.params?.limit as number) || 10;

  const conditions: any[] = [];

  if ("editionId" in table) {
    conditions.push(eq(table.editionId, ctx.editionId));
  }
  if ("organizationId" in table) {
    conditions.push(eq(table.organizationId, ctx.orgId));
  }

  for (const [key, value] of Object.entries(filters)) {
    if (key in table && value) {
      conditions.push(eq((table as any)[key], value));
    }
  }

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
  const items = rows.map((row: any, i: number) => {
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
    data: { items: rows },
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

  const conditions: any[] = [];

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
    conditions.push(ilike((table as any)[searchColumn], `%${searchValue}%`));
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
    const row = rows[0] as any;
    const name = row[nameField] || row.name || row.title || "Unnamed";
    const details: string[] = [];
    if (row.email || row.contactEmail) details.push(`Email: ${row.email || row.contactEmail}`);
    if (row.company || row.companyName) details.push(`Company: ${row.company || row.companyName}`);
    if (row.stage) details.push(`Stage: ${row.stage}`);
    if (row.assignedTo) details.push(`Assigned to: ${row.assignedTo}`);
    if (row.talkTitle) details.push(`Talk: ${row.talkTitle}`);
    if (row.talkType) details.push(`Type: ${row.talkType}`);

    return {
      message: `Found **${name}**\n${details.join(" | ")}`,
      success: true,
      data: { item: row },
    };
  }

  // Multiple matches
  const items = rows.map((row: any, i: number) => {
    const name = row[nameField] || row.name || row.title || "Unnamed";
    const extra = row.company || row.companyName || row.email || row.contactEmail || "";
    const stage = row.stage ? ` (${row.stage})` : "";
    return `${i + 1}. **${name}**${extra ? ` — ${extra}` : ""}${stage}`;
  });

  return {
    message: `Found ${rows.length} ${pluralLabel} matching "${searchValue}":\n${items.join("\n")}`,
    success: true,
    data: { items: rows },
  };
}

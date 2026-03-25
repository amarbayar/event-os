import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, and, ilike, sql } from "drizzle-orm";
import { AgentIntent, DispatchResult } from "./types";
import { AgentContext } from "./dispatcher";
import { notify } from "@/lib/notify";

// ─── Manage Handler ──────────────────────────────────
//
//  Creates, updates, and deletes entities via natural language.
//  All mutations go through org scoping + field validation.

// Table + config map (shared with query handler pattern)
const ENTITY_CONFIG: Record<string, {
  table: any;
  nameField: string;
  label: string;
  allowedCreateFields: string[];
  allowedUpdateFields: string[];
}> = {
  speaker: {
    table: schema.speakerApplications,
    nameField: "name",
    label: "speaker",
    allowedCreateFields: ["name", "email", "phone", "company", "title", "bio", "talkTitle", "talkAbstract", "talkType", "trackPreference", "source", "stage", "assignedTo"],
    allowedUpdateFields: ["name", "email", "phone", "company", "title", "bio", "talkTitle", "talkAbstract", "talkType", "trackPreference", "slideUrl", "headshotUrl", "source", "stage", "status", "assignedTo"],
  },
  sponsor: {
    table: schema.sponsorApplications,
    nameField: "companyName",
    label: "sponsor",
    allowedCreateFields: ["companyName", "contactName", "contactEmail", "logoUrl", "packagePreference", "message", "source", "stage", "assignedTo"],
    allowedUpdateFields: ["companyName", "contactName", "contactEmail", "logoUrl", "packagePreference", "message", "source", "stage", "status", "assignedTo"],
  },
  venue: {
    table: schema.venues,
    nameField: "name",
    label: "venue",
    allowedCreateFields: ["name", "address", "contactName", "contactEmail", "contactPhone", "capacity", "priceQuote", "source", "stage", "assignedTo"],
    allowedUpdateFields: ["name", "address", "contactName", "contactEmail", "contactPhone", "capacity", "priceQuote", "source", "stage", "status", "assignedTo"],
  },
  booth: {
    table: schema.booths,
    nameField: "name",
    label: "booth",
    allowedCreateFields: ["name", "companyName", "contactName", "contactEmail", "location", "size", "equipment", "source", "stage", "assignedTo"],
    allowedUpdateFields: ["name", "companyName", "contactName", "contactEmail", "location", "size", "equipment", "source", "stage", "assignedTo"],
  },
  volunteer: {
    table: schema.volunteerApplications,
    nameField: "name",
    label: "volunteer",
    allowedCreateFields: ["name", "email", "phone", "source", "stage", "assignedTo"],
    allowedUpdateFields: ["name", "email", "phone", "headshotUrl", "source", "stage", "assignedTo"],
  },
  media: {
    table: schema.mediaPartners,
    nameField: "companyName",
    label: "media partner",
    allowedCreateFields: ["companyName", "contactName", "contactEmail", "type", "source", "stage", "assignedTo"],
    allowedUpdateFields: ["companyName", "contactName", "contactEmail", "type", "source", "stage", "assignedTo"],
  },
  task: {
    table: schema.tasks,
    nameField: "title",
    label: "task",
    allowedCreateFields: ["title", "description", "status", "priority", "assigneeName", "assignedTo", "dueDate"],
    allowedUpdateFields: ["title", "description", "status", "priority", "assigneeName", "assignedTo", "dueDate"],
  },
  campaign: {
    table: schema.campaigns,
    nameField: "title",
    label: "campaign",
    allowedCreateFields: ["title", "type", "platform", "content", "scheduledDate", "assignedTo"],
    allowedUpdateFields: ["title", "type", "platform", "content", "scheduledDate", "status", "assignedTo"],
  },
};

// Field aliases
const FIELD_ALIASES: Record<string, string> = {
  company: "companyName", "company_name": "companyName",
  "contact_email": "contactEmail", "contact_name": "contactName",
  phone: "phone", "phone#": "phone", track: "trackPreference",
  "talk_track": "trackPreference", "talk_type": "talkType",
  "talk_title": "talkTitle", assignee: "assignedTo",
  "assigned_to": "assignedTo", "due_date": "dueDate",
};

function resolveField(key: string): string {
  return FIELD_ALIASES[key.toLowerCase()] || key;
}

export async function handleManage(
  intent: AgentIntent,
  ctx: AgentContext
): Promise<DispatchResult> {
  const entityType = intent.entityType;
  if (!entityType || !ENTITY_CONFIG[entityType]) {
    return { message: `I can manage: speakers, sponsors, venues, booths, volunteers, media partners, tasks, campaigns. Which one?`, success: true };
  }

  const config = ENTITY_CONFIG[entityType];

  try {
    switch (intent.action) {
      case "create":
        return await handleCreate(intent, ctx, config);
      case "update":
        return await handleUpdate(intent, ctx, config);
      case "delete":
        return await handleDelete(intent, ctx, config);
      default:
        return { message: `I can create, update, or delete ${config.label}s. What would you like to do?`, success: true };
    }
  } catch (error) {
    console.error("Manage handler error:", error);
    return { message: `Failed to ${intent.action} ${config.label}. Please try again.`, success: false };
  }
}

// ─── CREATE ──────────────────────────────────────────

async function handleCreate(
  intent: AgentIntent,
  ctx: AgentContext,
  config: typeof ENTITY_CONFIG[string]
): Promise<DispatchResult> {
  const { table, nameField, label, allowedCreateFields } = config;
  const params = intent.params || {};

  // Filter to allowed fields + resolve aliases
  const values: Record<string, unknown> = {
    editionId: ctx.editionId,
    organizationId: ctx.orgId,
  };

  for (const [key, value] of Object.entries(params)) {
    const resolved = resolveField(key);
    if (allowedCreateFields.includes(resolved) && value) {
      values[resolved] = value;
    } else if (allowedCreateFields.includes(key) && value) {
      // Fallback: use original key if alias doesn't match (e.g. speaker has "company" not "companyName")
      values[key] = value;
    }
  }

  // Require at least a name/title
  const nameValue = values[nameField] || values.name || values.title;
  if (!nameValue) {
    return { message: `I need at least a name to create a ${label}. What's the name?`, success: false };
  }
  if (!(nameField in values)) {
    values[nameField] = nameValue;
  }

  // Set defaults
  if (!values.source) values.source = "intake";
  if (!values.stage && "stage" in table) values.stage = "lead";
  if (!values.status && label === "task") values.status = "todo";
  if (!values.priority && label === "task") values.priority = "medium";

  // Required field defaults per entity type
  if (intent.entityType === "speaker") {
    if (!values.email) values.email = "";
    if (!values.talkTitle) values.talkTitle = "TBD";
  }
  if (intent.entityType === "sponsor") {
    if (!values.contactName) values.contactName = String(values.companyName || "TBD");
    if (!values.contactEmail) values.contactEmail = "";
  }
  if (intent.entityType === "media") {
    if (!values.contactName) values.contactName = String(values.companyName || "TBD");
    if (!values.contactEmail) values.contactEmail = "";
  }
  if (intent.entityType === "task") {
    if (!values.title && values.name) values.title = values.name;
    if (!values.title) values.title = "Untitled task";
  }
  if (intent.entityType === "volunteer") {
    if (!values.email) values.email = "";
  }
  if (intent.entityType === "attendee") {
    if (!values.email) values.email = "";
  }
  if (intent.entityType === "campaign") {
    if (!values.type) values.type = "event_update";
  }

  // Truncate string values to avoid DB varchar overflow
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === "string" && v.length > 255 && k !== "bio" && k !== "content" && k !== "description" && k !== "talkAbstract" && k !== "notes" && k !== "message") {
      values[k] = v.slice(0, 255);
    }
  }

  const [created] = await db.insert(table).values(values).returning();

  const createdName = (created as any)[nameField] || "New record";
  const details: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v && k !== nameField && k !== "name") details.push(`${k}: ${v}`);
  }

  return {
    message: `Created ${label} **${createdName}**${details.length > 0 ? ` (${details.join(", ")})` : ""} — stage: ${(created as any).stage || (created as any).status || "created"}.`,
    success: true,
    data: created,
  };
}

// ─── UPDATE ──────────────────────────────────────────

async function handleUpdate(
  intent: AgentIntent,
  ctx: AgentContext,
  config: typeof ENTITY_CONFIG[string]
): Promise<DispatchResult> {
  const { table, nameField, label, allowedUpdateFields } = config;
  const searchValue = intent.searchValue || (intent.params as any)?.name || (intent.params as any)?.[nameField];

  if (!searchValue) {
    return { message: `Which ${label} do you want to update? Give me a name.`, success: false };
  }

  // Find entity by name (ILIKE, org-scoped)
  const conditions: any[] = [];
  if ("editionId" in table) conditions.push(eq(table.editionId, ctx.editionId));
  if ("organizationId" in table) conditions.push(eq(table.organizationId, ctx.orgId));
  conditions.push(ilike((table as any)[nameField], `%${searchValue}%`));

  const matches = await db.select().from(table).where(and(...conditions)).limit(5);

  if (matches.length === 0) {
    // Retry with shorter search
    const shortSearch = searchValue.split(" ")[0];
    conditions.pop();
    conditions.push(ilike((table as any)[nameField], `%${shortSearch}%`));
    const retryMatches = await db.select().from(table).where(and(...conditions)).limit(5);

    if (retryMatches.length === 0) {
      return { message: `No ${label} found matching "${searchValue}". Check the name and try again.`, success: false };
    }
    if (retryMatches.length > 1) {
      const list = retryMatches.map((r: any, i: number) => `${i + 1}. **${r[nameField]}**`).join("\n");
      return { message: `Multiple matches for "${searchValue}":\n${list}\nWhich one? Reply with the number or full name.`, success: false };
    }
    // Single match on retry
    return applyUpdate(retryMatches[0], intent, ctx, config);
  }

  if (matches.length > 1) {
    const list = matches.map((r: any, i: number) => {
      const extra = r.company || r.companyName || r.email || r.contactEmail || "";
      return `${i + 1}. **${r[nameField]}**${extra ? ` — ${extra}` : ""}`;
    }).join("\n");
    return { message: `Multiple ${label}s match "${searchValue}":\n${list}\nWhich one did you mean?`, success: false };
  }

  return applyUpdate(matches[0], intent, ctx, config);
}

async function applyUpdate(
  entity: any,
  intent: AgentIntent,
  ctx: AgentContext,
  config: typeof ENTITY_CONFIG[string]
): Promise<DispatchResult> {
  const { table, nameField, label, allowedUpdateFields } = config;
  const params = intent.params || {};

  // Filter to allowed fields + resolve aliases, exclude search-related keys
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key === "name" && config.nameField !== "name") continue; // skip search key
    if (key === nameField) continue; // don't update the name field from params (it's the search key)
    const resolved = resolveField(key);
    if (allowedUpdateFields.includes(resolved) && value !== undefined) {
      updates[resolved] = value;
    } else if (allowedUpdateFields.includes(key) && value !== undefined) {
      updates[key] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return { message: `What do you want to change about **${entity[nameField]}**?`, success: false };
  }

  // Apply update with version bump
  const setClause: Record<string, unknown> = { ...updates, updatedAt: new Date() };
  if ("version" in table) {
    setClause.version = sql`${table.version} + 1`;
  }

  await db.update(table).set(setClause).where(
    and(eq(table.id, entity.id), eq(table.organizationId, ctx.orgId))
  );

  const changedFields = Object.entries(updates).map(([k, v]) => `${k}: ${v}`).join(", ");
  return {
    message: `Updated **${entity[nameField]}** — ${changedFields}.`,
    success: true,
    data: { id: entity.id, ...updates },
  };
}

// ─── DELETE ──────────────────────────────────────────

export async function handleDelete(
  intent: AgentIntent,
  ctx: AgentContext,
  config: typeof ENTITY_CONFIG[string]
): Promise<DispatchResult> {
  const { table, nameField, label } = config;
  const searchValue = intent.searchValue || (intent.params as any)?.name || (intent.params as any)?.[nameField];

  if (!searchValue) {
    return { message: `Which ${label} do you want to delete? Give me a name.`, success: false };
  }

  // Confirmation required
  if (intent.confirmation) {
    // Find and delete
    const conditions: any[] = [];
    if ("editionId" in table) conditions.push(eq(table.editionId, ctx.editionId));
    if ("organizationId" in table) conditions.push(eq(table.organizationId, ctx.orgId));
    conditions.push(ilike((table as any)[nameField], `%${searchValue}%`));

    const matches = await db.select().from(table).where(and(...conditions)).limit(1);
    if (matches.length === 0) {
      return { message: `No ${label} found matching "${searchValue}".`, success: false };
    }

    const entity = matches[0] as any;
    return {
      message: `Are you sure you want to delete **${entity[nameField]}**? This cannot be undone. Reply "yes" to confirm.`,
      success: true,
      requiresConfirmation: true,
      pendingAction: { ...intent, searchValue: entity.id }, // store ID for confirmed delete
    };
  }

  // This shouldn't be reached — the dispatcher should handle confirmation
  return { message: `Delete requires confirmation. Please confirm to proceed.`, success: false };
}

// Execute a confirmed delete (called by dispatcher after user confirms)
export async function executeDelete(
  entityType: string,
  entityId: string,
  ctx: AgentContext
): Promise<DispatchResult> {
  const config = ENTITY_CONFIG[entityType];
  if (!config) return { message: "Unknown entity type.", success: false };

  const { table, nameField, label } = config;

  const [deleted] = await db.delete(table).where(
    and(eq(table.id, entityId), eq(table.organizationId, ctx.orgId))
  ).returning();

  if (!deleted) {
    return { message: `${label} not found or already deleted.`, success: false };
  }

  return { message: `Deleted **${(deleted as any)[nameField]}**.`, success: true };
}

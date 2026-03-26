import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, and, sql, getTableColumns, SQL } from "drizzle-orm";
import { ilikeFn as ilike } from "@/db/dialect";
import { AgentIntent, DispatchResult, DrizzleTable, col } from "./types";
import { AgentContext } from "./dispatcher";
import { notify } from "@/lib/notify";

// ─── Manage Handler ──────────────────────────────────
//
//  Creates, updates, and deletes entities via natural language.
//  All mutations go through org scoping + field validation.
//
//  Uses Drizzle's getTableColumns() for dynamic schema introspection
//  so required-field defaults stay in sync with schema changes.

// Table + config map — allowedFields derived from schema at init time
const ENTITY_CONFIG: Record<string, {
  table: DrizzleTable;
  nameField: string;
  label: string;
}> = {
  speaker:   { table: schema.speakerApplications, nameField: "name",        label: "speaker" },
  sponsor:   { table: schema.sponsorApplications, nameField: "companyName", label: "sponsor" },
  venue:     { table: schema.venues,              nameField: "name",        label: "venue" },
  booth:     { table: schema.booths,              nameField: "name",        label: "booth" },
  volunteer: { table: schema.volunteerApplications, nameField: "name",      label: "volunteer" },
  media:     { table: schema.mediaPartners,       nameField: "companyName", label: "media partner" },
  task:      { table: schema.tasks,               nameField: "title",       label: "task" },
  campaign:  { table: schema.campaigns,           nameField: "title",       label: "campaign" },
};

// ─── Dynamic schema introspection ─────────────────────
//
//  Instead of hardcoding allowedFields and required-field defaults,
//  we read the Drizzle table definition at startup. This means:
//  - New columns auto-appear in allowed fields
//  - NOT NULL columns without defaults auto-get safe defaults
//  - Schema changes don't require manage-handler updates

// System-managed fields that the agent must NEVER accept from user input
const SYSTEM_FIELDS = new Set([
  "id", "editionId", "organizationId", "contactId", "assigneeId",
  "version", "createdAt", "updatedAt", "reviewScore", "reviewNotes",
  "publishedDate", "approvedBy", "approvedAt", "submittedAt",
]);

type ColumnMeta = { name: string; notNull: boolean; hasDefault: boolean; dataType: string };

// Cache per table: { userFields: string[], requiredNoDefault: string[] }
const _schemaCache = new Map<string, { userFields: string[]; requiredNoDefault: string[] }>();

function getSchemaInfo(table: DrizzleTable): { userFields: string[]; requiredNoDefault: string[] } {
  // Use the table's SQL name as cache key (unique per table)
  // Access Drizzle's internal table name via symbol key (no typed API for this)
  const drizzleName = (table as unknown as Record<symbol, string>)[Symbol.for("drizzle:Name")];
  const tableName = drizzleName || (table._.name as string) || "";
  const key = tableName || JSON.stringify(Object.keys(getTableColumns(table)));
  if (_schemaCache.has(key)) return _schemaCache.get(key)!;

  const cols = getTableColumns(table);
  const userFields: string[] = [];
  const requiredNoDefault: string[] = [];

  for (const [name, colDef] of Object.entries(cols)) {
    if (SYSTEM_FIELDS.has(name)) continue;
    userFields.push(name);
    const c = colDef as ColumnMeta;
    if (c.notNull && !c.hasDefault && (c as Record<string, unknown>).default === undefined) {
      requiredNoDefault.push(name);
    }
  }

  const result = { userFields, requiredNoDefault };
  _schemaCache.set(key, result);
  return result;
}

// Safe defaults for common NOT NULL string fields
function safeDefault(fieldName: string, entityType: string, values: Record<string, unknown>): string {
  // Name-like fields
  if (fieldName === "contactName") return String(values.companyName || values.name || "TBD");
  if (fieldName === "talkTitle") return "TBD";
  if (fieldName === "title" && entityType === "task") return "Untitled task";
  // Email fields
  if (fieldName.toLowerCase().includes("email")) return "";
  // Type/enum fields
  if (fieldName === "type" && entityType === "campaign") return "event_update";
  if (fieldName === "type") return "other";
  if (fieldName === "status" && entityType === "task") return "todo";
  if (fieldName === "priority") return "medium";
  // Generic string
  return "";
}

// ─── Stage/status value validation ────────────────────
//
// The LLM often confuses stage and status (e.g. sets status="confirmed"
// when it should be stage="confirmed"). This layer auto-corrects
// misclassified values before they hit the DB and cause enum errors.

const STAGE_VALUES = new Set(["lead", "engaged", "confirmed", "declined"]);
const STATUS_VALUES: Record<string, Set<string>> = {
  speaker: new Set(["pending", "accepted", "rejected", "waitlisted"]),
  task: new Set(["todo", "in_progress", "done", "blocked"]),
  campaign: new Set(["draft", "scheduled", "published", "cancelled"]),
};

function fixStageStatusConfusion(values: Record<string, unknown>, entityType: string): void {
  const statusSet = STATUS_VALUES[entityType];

  // If status has a stage value, move it to stage
  if (values.status && STAGE_VALUES.has(values.status as string)) {
    if (!values.stage) {
      values.stage = values.status;
    }
    delete values.status;
  }

  // If stage has a status value, move it to status
  if (values.stage && statusSet?.has(values.stage as string)) {
    if (!values.status) {
      values.status = values.stage;
    }
    delete values.stage;
  }

  // Remove invalid enum values entirely rather than crashing
  if (values.status && statusSet && !statusSet.has(values.status as string)) {
    delete values.status;
  }
  if (values.stage && !STAGE_VALUES.has(values.stage as string)) {
    delete values.stage;
  }
}

// ─── Date coercion ────────────────────────────────────
//
// The LLM returns dates as strings ("04/01", "2026-04-01", "April 1st").
// Drizzle timestamp columns need Date objects.

const DATE_FIELDS = new Set(["dueDate", "scheduledDate", "publishedDate"]);

function coerceDateFields(values: Record<string, unknown>): void {
  for (const field of DATE_FIELDS) {
    if (field in values && typeof values[field] === "string") {
      const raw = values[field] as string;
      let parsed = new Date(raw);

      // Handle partial dates like "04/01" (no year) → assume current year
      if (isNaN(parsed.getTime()) || raw.match(/^\d{1,2}\/\d{1,2}$/)) {
        const year = new Date().getFullYear();
        parsed = new Date(`${year}-${raw.replace("/", "-")}`);
      }

      if (!isNaN(parsed.getTime())) {
        values[field] = parsed;
      } else {
        // Can't parse — remove rather than crash
        delete values[field];
      }
    }
  }
}

// Field aliases — maps LLM terms to actual DB column names
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
  const { table, nameField, label } = config;
  const params = intent.params || {};
  const { userFields, requiredNoDefault } = getSchemaInfo(table);

  // Filter to allowed fields + resolve aliases
  const values: Record<string, unknown> = {
    editionId: ctx.editionId,
    organizationId: ctx.orgId,
  };

  for (const [key, value] of Object.entries(params)) {
    const resolved = resolveField(key);
    if (userFields.includes(resolved) && value) {
      values[resolved] = value;
    } else if (userFields.includes(key) && value) {
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

  // Set common defaults
  if (!values.source && userFields.includes("source")) values.source = "intake";
  if (!values.stage && userFields.includes("stage")) values.stage = "lead";

  // Auto-fill required NOT NULL fields that have no DB default
  for (const field of requiredNoDefault) {
    if (!(field in values)) {
      values[field] = safeDefault(field, intent.entityType!, values);
    }
  }

  // Fix stage/status confusion (e.g. status="confirmed" → stage="confirmed")
  fixStageStatusConfusion(values, intent.entityType!);

  // Coerce date-like strings to Date objects for timestamp columns
  coerceDateFields(values);

  // Truncate string values to avoid DB varchar overflow (text fields exempt)
  const TEXT_FIELDS = new Set(["bio", "content", "description", "talkAbstract", "notes", "message", "experience", "availability", "requirements", "requirementsNotes"]);
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === "string" && v.length > 255 && !TEXT_FIELDS.has(k)) {
      values[k] = v.slice(0, 255);
    }
  }

  const [created] = await db.insert(table).values(values).returning();

  const createdName = (created as Record<string, unknown>)[nameField] || "New record";
  const details: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v && k !== nameField && k !== "name") details.push(`${k}: ${v}`);
  }

  return {
    message: `Created ${label} **${createdName}**${details.length > 0 ? ` (${details.join(", ")})` : ""} — stage: ${(created as Record<string, unknown>).stage || (created as Record<string, unknown>).status || "created"}.`,
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
  const { table, nameField, label } = config;
  const { userFields } = getSchemaInfo(table);
  const rawSearch = intent.searchValue || (intent.params as Record<string, unknown>)?.name || (intent.params as Record<string, unknown>)?.[nameField];
  const searchValue = typeof rawSearch === "string" ? rawSearch : null;

  if (!searchValue) {
    return { message: `Which ${label} do you want to update? Give me a name.`, success: false };
  }

  // Find entity by name (ILIKE, org-scoped)
  const conditions: SQL[] = [];
  if ("editionId" in table) conditions.push(eq(table.editionId, ctx.editionId));
  if ("organizationId" in table) conditions.push(eq(table.organizationId, ctx.orgId));
  conditions.push(ilike(col(table, nameField), `%${searchValue}%`));

  const matches = await db.select().from(table).where(and(...conditions)).limit(5);

  if (matches.length === 0) {
    // Retry with shorter search
    const shortSearch = searchValue.split(" ")[0];
    conditions.pop();
    conditions.push(ilike(col(table, nameField), `%${shortSearch}%`));
    const retryMatches = await db.select().from(table).where(and(...conditions)).limit(5);

    if (retryMatches.length === 0) {
      return { message: `No ${label} found matching "${searchValue}". Check the name and try again.`, success: false };
    }
    if (retryMatches.length > 1) {
      const list = retryMatches.map((r: Record<string, unknown>, i: number) => `${i + 1}. **${r[nameField]}**`).join("\n");
      return { message: `Multiple matches for "${searchValue}":\n${list}\nWhich one? Reply with the number or full name.`, success: false };
    }
    return applyUpdate(retryMatches[0], intent, ctx, config, userFields);
  }

  if (matches.length > 1) {
    const list = matches.map((r: Record<string, unknown>, i: number) => {
      const extra = r.company || r.companyName || r.email || r.contactEmail || "";
      return `${i + 1}. **${r[nameField]}**${extra ? ` — ${extra}` : ""}`;
    }).join("\n");
    return { message: `Multiple ${label}s match "${searchValue}":\n${list}\nWhich one did you mean?`, success: false };
  }

  return applyUpdate(matches[0], intent, ctx, config, userFields);
}

async function applyUpdate(
  entity: Record<string, unknown>,
  intent: AgentIntent,
  ctx: AgentContext,
  config: typeof ENTITY_CONFIG[string],
  userFields: string[]
): Promise<DispatchResult> {
  const { table, nameField, label } = config;
  const params = intent.params || {};

  // Filter to allowed fields + resolve aliases, exclude search-related keys
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key === "name" && config.nameField !== "name") continue;
    if (key === nameField) continue;
    const resolved = resolveField(key);
    if (userFields.includes(resolved) && value !== undefined) {
      updates[resolved] = value;
    } else if (userFields.includes(key) && value !== undefined) {
      updates[key] = value;
    }
  }

  // Fix stage/status confusion before checking if empty
  fixStageStatusConfusion(updates, intent.entityType!);
  coerceDateFields(updates);

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
  const rawSearch = intent.searchValue || (intent.params as Record<string, unknown>)?.name || (intent.params as Record<string, unknown>)?.[nameField];
  const searchValue = typeof rawSearch === "string" ? rawSearch : null;

  if (!searchValue) {
    return { message: `Which ${label} do you want to delete? Give me a name.`, success: false };
  }

  // Find the entity
  const conditions: SQL[] = [];
  if ("editionId" in table) conditions.push(eq(table.editionId, ctx.editionId));
  if ("organizationId" in table) conditions.push(eq(table.organizationId, ctx.orgId));
  conditions.push(ilike(col(table, nameField), `%${searchValue}%`));

  const matches = await db.select().from(table).where(and(...conditions)).limit(5);
  if (matches.length === 0) {
    return { message: `No ${label} found matching "${searchValue}".`, success: false };
  }

  if (matches.length > 1) {
    const list = matches.map((r: Record<string, unknown>, i: number) => `${i + 1}. **${r[nameField]}**`).join("\n");
    return { message: `Multiple ${label}s match "${searchValue}":\n${list}\nWhich one did you mean?`, success: false };
  }

  const entity = matches[0] as Record<string, unknown>;

  // Stage protection: confirmed entities can't be deleted by non-admins
  if (entity.stage === "confirmed" && ctx.userRole !== "owner" && ctx.userRole !== "admin") {
    return {
      message: `**${entity[nameField]}** is confirmed and has active checklists. Only admins can delete confirmed records.`,
      success: false,
    };
  }

  // When confirmation flag is set, execute directly.
  // The two-step prompt doesn't work via API/Telegram (OpenClaw LLM can't relay confirmations).
  if (intent.confirmation) {
    const [deleted] = await db.delete(table).where(
      and(eq(table.id, entity.id), eq(table.organizationId, ctx.orgId))
    ).returning();

    if (!deleted) {
      return { message: `${label} not found or already deleted.`, success: false };
    }
    return { message: `Deleted **${(deleted as Record<string, unknown>)[nameField]}**.`, success: true };
  }

  // No confirmation flag — ask user to confirm
  return {
    message: `Are you sure you want to delete **${entity[nameField]}**? Say "delete ${entity[nameField]}" to confirm.`,
    success: true,
    requiresConfirmation: true,
    pendingAction: { ...intent, searchValue: entity.id as string },
  };
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

  return { message: `Deleted **${(deleted as Record<string, unknown>)[nameField]}**.`, success: true };
}

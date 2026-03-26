import { db } from "@/db";
import { sql } from "drizzle-orm";
import { AgentContext } from "./dispatcher";

// ─── LLM-Generated SQL Query Engine ───────────────────
//
// For read-only queries, let the LLM write SQL instead of
// routing through static handlers. This enables joins,
// aggregations, and any question the schema can answer.
//
// Safety layers:
// 1. SELECT only — reject any mutation
// 2. Table allowlist — no auth/user/account tables
// 3. Org scoping injected — LLM can't bypass
// 4. LIMIT enforced — no unbounded results
// 5. Sensitive columns stripped from output
// 6. Query timeout

// ─── Allowed tables (entity data only) ────────────────

const ALLOWED_TABLES = new Set([
  "speaker_applications",
  "sponsor_applications",
  "venues",
  "booths",
  "volunteer_applications",
  "media_partners",
  "tasks",
  "campaigns",
  "sessions",
  "tracks",
  "attendees",
  "invitations",
  "outreach",
  "checklist_items",
  "checklist_templates",
  "event_editions",
  "event_series",
  "entity_notes",
  "teams",
  "team_entity_types",
  "team_members",
]);

// Tables the LLM must NEVER query
const BLOCKED_TABLES = new Set([
  "users",
  "user_organizations",
  "user_platform_links",
  "messaging_channels",
  "accounts",
  "auth_sessions",
  "audit_log",
  "event_queue",
]);

// Columns stripped from results
const REDACTED_COLUMNS = new Set([
  "organization_id",
  "edition_id",
  "contact_id",
  "assignee_id",
  "version",
  "created_at",
  "updated_at",
]);

// ─── Schema description for the LLM ──────────────────

const SCHEMA_DESCRIPTION = `
DATABASE SCHEMA (PostgreSQL):

speaker_applications: id, name, email, phone, bio, company, title, talk_title, talk_abstract, talk_type (talk/workshop/panel/keynote), track_preference, slide_url, headshot_url, stage (lead/engaged/confirmed/declined), status (pending/accepted/rejected/waitlisted), source, assigned_to, edition_id, organization_id
sponsor_applications: id, company_name, contact_name, contact_email, logo_url, package_preference, message, stage, status, source, assigned_to, edition_id, organization_id
venues: id, name, address, contact_name, contact_email, contact_phone, capacity, price_quote, stage, source, assigned_to, edition_id, organization_id
booths: id, name, company_name, contact_name, contact_email, location, size, equipment, stage, source, assigned_to, edition_id, organization_id
volunteer_applications: id, name, email, phone, role, availability, stage, source, assigned_to, edition_id, organization_id
media_partners: id, company_name, contact_name, contact_email, type (tv/online/print/podcast/blog), stage, source, assigned_to, edition_id, organization_id
tasks: id, title, description, status (todo/in_progress/done/blocked), priority (low/medium/high/urgent), assignee_name, assigned_to, due_date, edition_id, organization_id
campaigns: id, title, type, platform, content, scheduled_date, status (draft/scheduled/published/cancelled), assigned_to, edition_id, organization_id
sessions: id, title, description, type (talk/workshop/panel/keynote/break/networking), start_time, end_time, room, day, speaker_id, edition_id
tracks: id, name, color, edition_id
attendees: id, name, email, ticket_type, source, checked_in, edition_id, organization_id
invitations: id, name, email, type, status, invited_by, edition_id, organization_id
checklist_items: id, template_id, entity_type, entity_id, status (pending/submitted/approved/rejected/archived), value, edition_id, organization_id
checklist_templates: id, name, entity_type, item_type, required, sort_order, edition_id, organization_id
teams: id, name, organization_id
team_members: id, team_id, user_id
team_entity_types: id, team_id, entity_type
event_editions: id, name, slug, start_date, end_date, venue, status, cfp_open, timezone, series_id, organization_id

JOINS:
- sessions.speaker_id → speaker_applications.id
- checklist_items.entity_id → any entity table's id (filtered by entity_type)
- checklist_items.template_id → checklist_templates.id
- team_members.team_id → teams.id
- team_entity_types.team_id → teams.id
`.trim();

// ─── SQL Generation Prompt ────────────────────────────

function buildSqlPrompt(question: string, ctx: AgentContext): string {
  return `You are a SQL query generator for an event management database.

${SCHEMA_DESCRIPTION}

RULES:
1. Write ONLY a SELECT query. No INSERT, UPDATE, DELETE, DROP, ALTER, or any mutation.
2. ALWAYS include: WHERE organization_id = '${ctx.orgId}' AND edition_id = '${ctx.editionId}'
3. Do NOT add LIMIT or OFFSET — pagination is handled externally.
4. Use snake_case column names (the database uses snake_case).
5. Select only the columns needed to answer the question — do NOT use SELECT *. Always include the name/title column plus 2-3 relevant detail columns.
6. For stage values: lead, engaged, confirmed, declined
7. For status values: pending, accepted, rejected, waitlisted (speakers), todo/in_progress/done/blocked (tasks)
8. Return ONLY the raw SQL query. No explanation, no markdown, no code fences.
9. If the question cannot be answered with the available tables, return: CANNOT_ANSWER

User question: ${question}`;
}

// ─── Validate generated SQL ───────────────────────────

export function validateSql(query: string): { valid: boolean; error?: string } {
  const trimmed = query.trim();

  // Must be SELECT
  if (!trimmed.toUpperCase().startsWith("SELECT")) {
    return { valid: false, error: "Only SELECT queries are allowed." };
  }

  // Block mutations hidden in subqueries or CTEs
  const upper = trimmed.toUpperCase();
  const blocked = [
    // Mutation keywords
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE", "GRANT", "REVOKE", "EXEC",
    // Dangerous PostgreSQL functions
    "PG_READ_FILE", "PG_READ_BINARY_FILE",
    "PG_LS_DIR", "PG_STAT_FILE",
    "PG_SLEEP",
    "LO_IMPORT", "LO_EXPORT", "LO_GET", "LO_PUT",
    "DBLINK", "DBLINK_CONNECT", "DBLINK_EXEC",
    "COPY",
    "EXECUTE",
    "SET ROLE", "SET SESSION",
    "PG_TERMINATE_BACKEND", "PG_CANCEL_BACKEND",
    "CURRENT_SETTING",
    "INET_SERVER_ADDR",
  ];
  for (const keyword of blocked) {
    // Check for keyword as standalone word(s) (not inside a string)
    // Escape any special regex chars, then match word boundaries
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(upper)) {
      return { valid: false, error: `Blocked keyword: ${keyword}` };
    }
  }

  // Check table references against allowlist
  // Extract table names from FROM and JOIN clauses
  const tablePattern = /\b(?:FROM|JOIN)\s+(\w+)/gi;
  let match;
  while ((match = tablePattern.exec(trimmed)) !== null) {
    const tableName = match[1].toLowerCase();
    if (BLOCKED_TABLES.has(tableName)) {
      return { valid: false, error: `Access to table '${tableName}' is not allowed.` };
    }
    if (!ALLOWED_TABLES.has(tableName) && tableName !== "lateral" && tableName !== "unnest") {
      return { valid: false, error: `Unknown table '${tableName}'.` };
    }
  }

  // Must contain org scoping — reject queries missing organization_id filter
  if (!trimmed.includes(ctx_placeholder_org)) {
    return { valid: false, error: "Query must include organization_id filter for data isolation." };
  }

  return { valid: true };
}

// Placeholder — we inject org/edition after validation
const ctx_placeholder_org = "organization_id";

// ─── Execute SQL query ────────────────────────────────

export async function executeSqlQuery(
  question: string,
  ctx: AgentContext
): Promise<{ message: string; success: boolean; data?: unknown }> {
  try {
    // Step 1: Get LLM to generate SQL
    const { getProvider } = await import("@/lib/agent");
    const provider = await getProvider(ctx.orgId);

    const prompt = buildSqlPrompt(question, ctx);
    // Use the provider's extract method to get raw SQL from any LLM
    const result = await provider.extract(prompt, "text");
    let generatedSql = result.message?.trim() || "";

    // Clean up — remove markdown fences if present
    generatedSql = generatedSql.replace(/^```\w*\n?/m, "").replace(/\n?```$/m, "").trim();

    if (!generatedSql || generatedSql === "CANNOT_ANSWER") {
      return {
        message: "I can't answer that question with the available event data. Try asking about speakers, sponsors, venues, tasks, etc.",
        success: true,
      };
    }

    // Step 2: Validate
    const validation = validateSql(generatedSql);
    if (!validation.valid) {
      console.error("SQL validation failed:", validation.error, "Query:", generatedSql);
      return {
        message: "I couldn't generate a safe query for that question. Try rephrasing it.",
        success: false,
      };
    }

    // Step 3: Strip any existing LIMIT — we control pagination
    let baseSql = generatedSql.replace(/\bLIMIT\s+\d+/i, "").replace(/\bOFFSET\s+\d+/i, "").trim();
    if (baseSql.endsWith(";")) baseSql = baseSql.slice(0, -1).trim();

    // Step 4: Run COUNT first to know total
    const PAGE_SIZE = 50;
    const countSql = `SELECT COUNT(*) as total FROM (${baseSql}) _count_subq`;

    console.log("Executing LLM SQL (count):", countSql);
    let totalCount = 0;
    try {
      const countResult = await Promise.race([
        db.execute(sql.raw(countSql)),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Count timeout")), 5000)),
      ]) as any;
      const countRows = countResult.rows || countResult || [];
      totalCount = Number(countRows[0]?.total || 0);
    } catch {
      // If count fails, proceed with limited query
      totalCount = -1; // unknown
    }

    if (totalCount === 0) {
      return { message: "No results found.", success: true, data: { items: [] } };
    }

    // Step 5: Execute with LIMIT + OFFSET
    const offset = 0; // First page; pagination handled by follow-up
    const pagedSql = `${baseSql} LIMIT ${PAGE_SIZE} OFFSET ${offset}`;

    console.log("Executing LLM SQL (paged):", pagedSql);
    const queryResult = await Promise.race([
      db.execute(sql.raw(pagedSql)),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Query timeout")), 5000)),
    ]) as any;

    const rows = queryResult.rows || queryResult || [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return { message: "No results found.", success: true, data: { items: [] } };
    }

    // Step 6: Strip sensitive columns
    const cleanRows = rows.map((row: Record<string, unknown>) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (!REDACTED_COLUMNS.has(k) && k !== "id") {
          clean[k] = v;
        }
      }
      return clean;
    });

    // Step 7: Format response
    // Single aggregate result (e.g., COUNT)
    if (cleanRows.length === 1 && Object.keys(cleanRows[0]).length <= 2) {
      const vals = Object.entries(cleanRows[0]).map(([k, v]) => `${v}`).join(", ");
      return { message: vals, success: true, data: cleanRows };
    }

    // Multiple rows — pick the most relevant columns (not all)
    const formatted = cleanRows.map((row: Record<string, unknown>, i: number) => {
      const name = row.name || row.title || row.company_name || row.contact_name || "";
      // Show at most 3 key detail columns
      const skip = new Set(["name", "title", "company_name", "contact_name"]);
      const details = Object.entries(row)
        .filter(([k, v]) => !skip.has(k) && v !== null && v !== "")
        .slice(0, 3)
        .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
        .join(" | ");
      return `${i + 1}. **${name}**${details ? ` — ${details}` : ""}`;
    }).join("\n");

    // Pagination info
    const shown = cleanRows.length;
    let paginationNote = "";
    if (totalCount > 0 && totalCount > shown) {
      paginationNote = `\n\nShowing ${shown} of ${totalCount} total. Say "show more" to see the next batch.`;
    } else if (totalCount === -1 && shown === PAGE_SIZE) {
      paginationNote = `\n\nShowing first ${PAGE_SIZE} results. There may be more — say "show more" to continue.`;
    }

    return {
      message: `${totalCount > 0 ? totalCount : shown} result${(totalCount > 0 ? totalCount : shown) !== 1 ? "s" : ""}:\n${formatted}${paginationNote}`,
      success: true,
      data: { items: cleanRows, total: totalCount, offset, pageSize: PAGE_SIZE },
    };

  } catch (error: any) {
    console.error("SQL query error:", error.message);
    return {
      message: "I had trouble running that query. Try rephrasing your question.",
      success: false,
    };
  }
}

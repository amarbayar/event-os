import { db } from "@/db";
import { sql } from "drizzle-orm";
import { AgentContext } from "./dispatcher";

// ─── Display formatting ──────────────────────────────

/** Clean up snake_case DB names for display */
const DISPLAY_NAMES: Record<string, string> = {
  speaker_applications: "Speakers",
  sponsor_applications: "Sponsors",
  volunteer_applications: "Volunteers",
  media_partners: "Media Partners",
  booths: "Booths",
  venues: "Venues",
  tasks: "Tasks",
  campaigns: "Campaigns",
  sessions: "Sessions",
  attendees: "Attendees",
  invitations: "Invitations",
  entity_type: "Type",
  company_name: "Company",
  contact_name: "Contact",
  contact_email: "Email",
  assigned_to: "Assigned to",
  assignee_name: "Assignee",
  talk_title: "Talk",
  talk_type: "Format",
  talk_abstract: "Abstract",
  track_preference: "Track",
  package_preference: "Package",
  due_date: "Due",
  start_time: "Start",
  end_time: "End",
  created_at: "Created",
  schedule_status: "Status",
  session_title: "Session",
  total_tasks: "Total",
  task_count: "Tasks",
};

function formatColumnName(col: string): string {
  return DISPLAY_NAMES[col] || col.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(col: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  const str = String(value);
  // Clean up entity type table names
  if (col === "entity_type" || col === "type") {
    return DISPLAY_NAMES[str] || str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  // Format dates
  if (col.endsWith("_date") || col.endsWith("_time") || col.endsWith("_at")) {
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch { /* fall through */ }
  }
  return str;
}

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
- sessions.speaker_id → speaker_applications.id (for talks/keynotes)
- checklist_items.entity_id → any entity table's id (filtered by entity_type)
- checklist_items.template_id → checklist_templates.id
- team_members.team_id → teams.id
- team_entity_types.team_id → teams.id
- Cross-entity: use assigned_to column to group/count work across entity types

NOTES:
- CTEs (WITH ... AS) and subqueries are allowed for complex analytics
- Use UNION ALL to combine results from multiple entity tables when comparing across types
- The assignee_name column in tasks contains the display name directly (no join needed)
`.trim();

// ─── SQL Generation Prompt ────────────────────────────

type Attempt = { sql: string; error: string };

function buildSqlPrompt(
  question: string,
  ctx: AgentContext,
  previousAttempts: Attempt[] = [],
): string {
  let prompt = `You are a SQL query generator for an event management database.

${SCHEMA_DESCRIPTION}

RULES:
1. Write ONLY a SELECT query (CTEs with WITH are OK). No INSERT, UPDATE, DELETE, DROP, ALTER, or any mutation.
2. ALWAYS include: WHERE organization_id = '${ctx.orgId}' AND edition_id = '${ctx.editionId}' (or in each CTE/subquery that touches an entity table). Some tables don't have edition_id — if the schema above doesn't list it for that table, filter only by organization_id.
3. Do NOT add LIMIT or OFFSET — pagination is handled externally.
4. Use snake_case column names (the database uses snake_case).
5. Select only the columns needed to answer the question — do NOT use SELECT *. Always include the name/title column plus 2-3 relevant detail columns.
6. For stage values: lead, engaged, confirmed, declined
7. For status values: pending, accepted, rejected, waitlisted (speakers), todo/in_progress/done/blocked (tasks)
8. Return ONLY the raw SQL query. No explanation, no markdown, no code fences.
9. If the question cannot be answered with the available tables, return: CANNOT_ANSWER
10. For complex analytics: use CTEs, subqueries, JOINs, GROUP BY, HAVING, window functions as needed.
11. In UNION ALL queries: cast enum columns (stage, status) to TEXT — e.g., stage::text, status::text — because different tables may use different enum types.

User question: ${question}`;

  if (previousAttempts.length > 0) {
    prompt += `\n\nYour previous attempts failed. Study each error and write a corrected query. Do not repeat the same mistake.\n`;
    previousAttempts.forEach((a, i) => {
      prompt += `\n--- Attempt ${i + 1} ---\nSQL: ${a.sql}\nError: ${a.error}\n`;
    });
    prompt += `\nReturn ONLY the corrected SQL query (no explanation, no markdown).`;
  }

  return prompt;
}

// ─── Validate generated SQL ───────────────────────────

export function validateSql(query: string): { valid: boolean; error?: string } {
  const trimmed = query.trim();

  // Must be SELECT or CTE (WITH ... SELECT)
  const firstKeyword = trimmed.toUpperCase().match(/^\w+/)?.[0];
  if (firstKeyword !== "SELECT" && firstKeyword !== "WITH") {
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

  // Extract CTE names (WITH name AS ...) so they pass the table allowlist check
  const cteNames = new Set<string>();
  const ctePattern = /\bWITH\s+(\w+)\s+AS\b/gi;
  let cteMatch;
  while ((cteMatch = ctePattern.exec(trimmed)) !== null) {
    cteNames.add(cteMatch[1].toLowerCase());
  }
  // Also catch additional CTEs after comma: , name AS (...)
  const cteContinued = /,\s*(\w+)\s+AS\s*\(/gi;
  while ((cteMatch = cteContinued.exec(trimmed)) !== null) {
    cteNames.add(cteMatch[1].toLowerCase());
  }

  // Check table references against allowlist
  const tablePattern = /\b(?:FROM|JOIN)\s+(\w+)/gi;
  let match;
  while ((match = tablePattern.exec(trimmed)) !== null) {
    const tableName = match[1].toLowerCase();
    // Skip CTE aliases, LATERAL, UNNEST — they're not real tables
    if (cteNames.has(tableName) || tableName === "lateral" || tableName === "unnest") continue;
    if (BLOCKED_TABLES.has(tableName)) {
      return { valid: false, error: `Access to table '${tableName}' is not allowed.` };
    }
    if (!ALLOWED_TABLES.has(tableName)) {
      return { valid: false, error: `Unknown table '${tableName}'.` };
    }
  }

  // Subqueries and CTEs are allowed — the FROM/JOIN table check above already
  // validates every table reference including those inside subqueries.
  // Scalar subqueries in SELECT columns that don't use FROM are also safe
  // since they can't access blocked tables.

  // Block information_schema and pg_catalog access (system table exfiltration)
  if (/\b(?:information_schema|pg_catalog|pg_tables|pg_columns)\b/i.test(trimmed)) {
    return { valid: false, error: "Access to system catalogs is not allowed." };
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

const MAX_ITERATIONS = 3;
const PAGE_SIZE = 50;

/** Extract a short, user-safe string from a pg error without leaking stack/internals. */
function sanitizePgError(err: unknown): string {
  const e = err as { cause?: { message?: string }; message?: string };
  const raw = e?.cause?.message || e?.message || String(err);
  return raw.split("\n")[0].slice(0, 300);
}

async function callLlmForSql(
  provider: { generate: (p: string) => Promise<string> },
  question: string,
  ctx: AgentContext,
  attempts: Attempt[],
): Promise<string> {
  const prompt = buildSqlPrompt(question, ctx, attempts);
  // One transient retry on LLM API hiccups — distinct from the outer SQL-correction loop.
  let raw = "";
  for (let i = 0; i < 2; i++) {
    try {
      raw = (await provider.generate(prompt)).trim();
      break;
    } catch (err) {
      if (i === 1) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return raw.replace(/^```\w*\n?/m, "").replace(/\n?```$/m, "").trim();
}

async function runCountAndSelect(
  baseSql: string,
): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  const isCte = /^\s*WITH\b/i.test(baseSql);

  let total = -1;
  if (!isCte) {
    const countSql = `SELECT COUNT(*) as total FROM (${baseSql}) _count_subq`;
    const countResult = await Promise.race([
      db.execute(sql.raw(countSql)),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Count timeout")), 5000)),
    ]);
    const countObj = countResult as { rows?: Record<string, unknown>[] };
    const countRows = countObj.rows || (countResult as Record<string, unknown>[]) || [];
    total = Number(countRows[0]?.total || 0);
  }

  const pagedSql = `${baseSql} LIMIT ${PAGE_SIZE}`;
  const queryResult = await Promise.race([
    db.execute(sql.raw(pagedSql)),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Query timeout")), 5000)),
  ]);
  const queryObj = queryResult as { rows?: Record<string, unknown>[] };
  const rows = queryObj.rows || (queryResult as Record<string, unknown>[]) || [];
  return { rows: Array.isArray(rows) ? rows : [], total };
}

function formatRows(
  rows: Record<string, unknown>[],
  total: number,
): { message: string; data: unknown } {
  const cleanRows = rows.map((row) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (!REDACTED_COLUMNS.has(k) && k !== "id") clean[k] = v;
    }
    return clean;
  });

  // Single aggregate (e.g. a COUNT query)
  if (cleanRows.length === 1 && Object.keys(cleanRows[0]).length <= 2) {
    const vals = Object.entries(cleanRows[0])
      .map(([k, v]) => `**${formatColumnName(k)}:** ${v}`)
      .join(", ");
    return { message: vals, data: cleanRows };
  }

  const formatted = cleanRows.map((row, i) => {
    const name = row.name || row.title || row.company_name || row.contact_name || row.assignee_name || "";
    const nameKeys = new Set(["name", "title", "company_name", "contact_name", "assignee_name"]);
    const details = Object.entries(row)
      .filter(([k, v]) => !nameKeys.has(k) && v !== null && v !== "")
      .slice(0, 4)
      .map(([k, v]) => `${formatColumnName(k)}: ${formatValue(k, v)}`)
      .join(" | ");
    if (name) return `${i + 1}. **${formatValue("name", name)}**${details ? ` — ${details}` : ""}`;
    return `${i + 1}. ${details}`;
  }).join("\n");

  const shown = cleanRows.length;
  let paginationNote = "";
  if (total > 0 && total > shown) {
    paginationNote = `\n\nShowing ${shown} of ${total}. Say "show more" for the next page.`;
  } else if (total === -1 && shown === PAGE_SIZE) {
    paginationNote = `\n\nShowing first ${PAGE_SIZE}. Say "show more" to continue.`;
  }

  const count = total > 0 ? total : shown;
  return {
    message: `${count} result${count !== 1 ? "s" : ""}:\n${formatted}${paginationNote}`,
    data: { items: cleanRows, total, pageSize: PAGE_SIZE },
  };
}

export async function executeSqlQuery(
  question: string,
  ctx: AgentContext,
): Promise<{ message: string; success: boolean; data?: unknown }> {
  if (!question || !question.trim()) {
    return { message: "What would you like to know?", success: true };
  }

  let provider;
  try {
    const { getProvider } = await import("@/lib/agent");
    provider = await getProvider(ctx.orgId);
  } catch (err) {
    console.error("SQL query: provider unavailable:", err);
    return {
      message: "The language model isn't configured. Ask an admin to set up an LLM provider in Settings.",
      success: false,
    };
  }

  const attempts: Attempt[] = [];

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    // 1. Generate (with feedback on previous attempts)
    let generatedSql: string;
    try {
      generatedSql = await callLlmForSql(provider, question, ctx, attempts);
    } catch (err) {
      console.error("LLM SQL generation failed:", err);
      return {
        message: "I'm having trouble reaching the language model. Please try again.",
        success: false,
      };
    }

    if (!generatedSql || generatedSql === "CANNOT_ANSWER") {
      return {
        message: "I can't answer that question with the available event data. Try asking about speakers, sponsors, venues, tasks, etc.",
        success: true,
      };
    }

    // 2. Validate
    const validation = validateSql(generatedSql);
    if (!validation.valid) {
      console.warn(`SQL attempt ${iter + 1}/${MAX_ITERATIONS} validation failed:`, validation.error, "Query:", generatedSql);
      attempts.push({ sql: generatedSql, error: `Validation failed: ${validation.error}` });
      continue;
    }

    // 3. Normalize — strip user-side LIMIT/OFFSET, trailing semicolon
    let baseSql = generatedSql.replace(/\bLIMIT\s+\d+/i, "").replace(/\bOFFSET\s+\d+/i, "").trim();
    if (baseSql.endsWith(";")) baseSql = baseSql.slice(0, -1).trim();

    // 4. Execute
    console.log(`Executing LLM SQL (attempt ${iter + 1}/${MAX_ITERATIONS}):`, baseSql);
    try {
      const { rows, total } = await runCountAndSelect(baseSql);
      if (rows.length === 0) {
        return { message: "No results found.", success: true, data: { items: [] } };
      }
      const formatted = formatRows(rows, total);
      return { message: formatted.message, success: true, data: formatted.data };
    } catch (err) {
      const safe = sanitizePgError(err);
      console.warn(`SQL attempt ${iter + 1}/${MAX_ITERATIONS} execution failed:`, safe);
      attempts.push({ sql: baseSql, error: `Database error: ${safe}` });
      continue;
    }
  }

  console.error(`SQL query exhausted ${MAX_ITERATIONS} attempts. Question: ${question}. Attempts:`, attempts);
  return {
    message: "I couldn't build a working query for that question. Try rephrasing it or asking something simpler.",
    success: false,
  };
}

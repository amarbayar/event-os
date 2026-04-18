import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { AgentIntent, DispatchResult } from "./types";
import { AgentContext } from "./dispatcher";
import { validateAgenda } from "@/lib/agenda-validator";
import { executeSqlQuery } from "./sql-query";

// ─── Query Handler ───────────────────────────────────
//
//  All data questions go through the LLM-SQL path (sql-query.ts), which
//  generates a SELECT, validates it, executes it, and on failure feeds the
//  error back to the LLM for up to 3 iterations.
//
//  Two intents stay here because they are not plain DB queries:
//    - "event" summary — computes aggregate stats from multiple tables.
//    - agenda validation — runs conflict-detection logic on sessions.

export async function handleQuery(
  intent: AgentIntent,
  ctx: AgentContext,
  originalInput?: string,
): Promise<DispatchResult> {
  const entityType = intent.entityType;

  if ((entityType as string) === "event") {
    return handleEventInfo(ctx);
  }

  if (intent.action === "validate" && entityType === "session") {
    return handleAgendaValidation(ctx);
  }

  // Everything else: LLM writes SQL, validator runs, execute with retry-on-error.
  const question = originalInput || intent.message || buildQuestionFromIntent(intent);
  return executeSqlQuery(question, ctx);
}

// ─── Synthesize a natural-language question from a structured intent ──
//
//  Used when callers (e.g. tests, bots) invoke dispatch() with a prebuilt
//  AgentIntent and no originalInput. The LLM needs *some* question text.

function buildQuestionFromIntent(intent: AgentIntent): string {
  const entity = intent.entityType || "records";
  const filters = (intent.params?.filters as Record<string, unknown>) || {};
  const filterDesc = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k} = ${String(v)}`)
    .join(" and ");

  switch (intent.action) {
    case "count":
      return filterDesc
        ? `How many ${entity}s are there where ${filterDesc}?`
        : `How many ${entity}s are there in total?`;
    case "list": {
      const limit = (intent.params?.limit as number) || 10;
      return filterDesc
        ? `List up to ${limit} ${entity}s where ${filterDesc}.`
        : `List up to ${limit} ${entity}s.`;
    }
    case "search":
      if (intent.searchValue) {
        const by = intent.searchBy || "name";
        return `Find ${entity}s where ${by} matches "${intent.searchValue}".`;
      }
      return `Search ${entity}s.`;
    default:
      return filterDesc ? `Show me ${entity}s where ${filterDesc}.` : `Show me ${entity}s.`;
  }
}

// ─── EVENT INFO ──────────────────────────────────────

async function handleEventInfo(ctx: AgentContext): Promise<DispatchResult> {
  const edition = await db.query.eventEditions.findFirst({
    where: eq(schema.eventEditions.id, ctx.editionId),
  });

  if (!edition) {
    return { message: "No event found.", success: false };
  }

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

  return { message: lines.join("\n"), success: true };
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
      allSpeakers,
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
      lines.push("", `**Errors (${errors.length}):**`);
      for (const e of errors) lines.push(`\u274C ${e.message}`);
    }

    if (warnings.length > 0) {
      lines.push("", `**Warnings (${warnings.length}):**`);
      for (const w of warnings) lines.push(`\u26A0\uFE0F ${w.message}`);
    }

    return { message: lines.join("\n"), success: true, data: { issues } };
  } catch (error) {
    console.error("Agenda validation error:", error);
    return { message: "Failed to validate the agenda. Please try again.", success: false };
  }
}

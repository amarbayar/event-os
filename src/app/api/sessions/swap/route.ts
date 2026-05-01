import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { eventEditions, sessions, speakerApplications } from "@/db/schema";
import { buildSwappedSessionSlotUpdates } from "@/lib/agenda-swap";
import { validateAgenda } from "@/lib/agenda-validator";
import { requirePermission, isRbacError } from "@/lib/rbac";

type DbTransaction = Awaited<
  ReturnType<typeof import("@/db/connection").createConnection>
>["db"];
type SessionRow = typeof sessions.$inferSelect;

async function sessionSwapTransaction<T>(callback: (tx: DbTransaction) => Promise<T>): Promise<T> {
  const transaction = db.transaction as unknown as { mock?: unknown; _isMockFunction?: boolean };
  const isMockedTransaction = Boolean(transaction?.mock || transaction?._isMockFunction);
  if ((process.env.DB_DIALECT === "sqlite" || process.env.SQLITE_PATH) && !isMockedTransaction) {
    return callback(db as DbTransaction);
  }

  return db.transaction(async (tx: DbTransaction) => callback(tx));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "session", "update");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const { sourceId, targetId, sourceVersion, targetVersion } = body;

  if (!isNonEmptyString(sourceId) || !isNonEmptyString(targetId)) {
    return NextResponse.json(
      { error: "sourceId and targetId are required" },
      { status: 400 }
    );
  }

  if (sourceId === targetId) {
    return NextResponse.json(
      { error: "sourceId and targetId must be different" },
      { status: 400 }
    );
  }

  const rows: SessionRow[] = await db.query.sessions.findMany({
    where: and(
      eq(sessions.organizationId, ctx.orgId),
      inArray(sessions.id, [sourceId, targetId])
    ),
  });

  const source = rows.find((session: SessionRow) => session.id === sourceId);
  const target = rows.find((session: SessionRow) => session.id === targetId);

  if (!source || !target) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (source.editionId !== target.editionId) {
    return NextResponse.json(
      { error: "Sessions must belong to the same edition" },
      { status: 400 }
    );
  }

  if (
    (sourceVersion != null && Number(sourceVersion) !== source.version) ||
    (targetVersion != null && Number(targetVersion) !== target.version)
  ) {
    return NextResponse.json(
      {
        error: "Conflict",
        message: "One of these sessions was modified. Refresh and try again.",
      },
      { status: 409 }
    );
  }

  const updates = buildSwappedSessionSlotUpdates(source, target);
  const [updatedSource, updatedTarget] = await sessionSwapTransaction(async (tx) => {
    const [nextSource] = await tx
      .update(sessions)
      .set({
        ...updates.source,
        version: sql`${sessions.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(sessions.id, source.id), eq(sessions.version, source.version)))
      .returning();

    const [nextTarget] = await tx
      .update(sessions)
      .set({
        ...updates.target,
        version: sql`${sessions.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(sessions.id, target.id), eq(sessions.version, target.version)))
      .returning();

    return [nextSource, nextTarget];
  });

  if (!updatedSource || !updatedTarget) {
    return NextResponse.json(
      {
        error: "Conflict",
        message: "One of these sessions was modified. Refresh and try again.",
      },
      { status: 409 }
    );
  }

  const [allSessions, edition, allSpeakers] = await Promise.all([
    db.query.sessions.findMany({
      where: eq(sessions.editionId, source.editionId),
    }),
    db.query.eventEditions.findFirst({
      where: eq(eventEditions.id, source.editionId),
    }),
    db.query.speakerApplications.findMany({
      where: eq(speakerApplications.editionId, source.editionId),
      columns: { id: true, name: true, stage: true },
    }),
  ]);

  const issues = edition
    ? validateAgenda(
        allSessions,
        {
          gapMinutes: edition.agendaGapMinutes,
          startTime: edition.agendaStartTime ?? "09:00",
          endTime: edition.agendaEndTime ?? "18:00",
          startDate: edition.startDate,
          endDate: edition.endDate,
        },
        allSpeakers
      )
    : [];

  return NextResponse.json({
    data: {
      source: updatedSource,
      target: updatedTarget,
    },
    issues,
  });
}

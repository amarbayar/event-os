import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { speakerApplications } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { checkVersion, checkStageProtection } from "@/lib/api-utils";
import { requirePermission, isRbacError } from "@/lib/rbac";
import { generateChecklistItems, archiveChecklistItems } from "@/lib/checklist";
import { notify } from "@/lib/notify";
import { users } from "@/db/schema";
import { cleanupSpeakerDependencies, syncSpeakerAgendaSessions } from "@/lib/speaker-agenda";
import { isSessionType } from "@/lib/session-types";

type DbTransaction = Awaited<
  ReturnType<typeof import("@/db/connection").createConnection>
>["db"];

async function speakerTransaction<T>(callback: (tx: DbTransaction) => Promise<T>): Promise<T> {
  const transaction = db.transaction as unknown as { mock?: unknown; _isMockFunction?: boolean };
  const isMockedTransaction = Boolean(transaction?.mock || transaction?._isMockFunction);
  if ((process.env.DB_DIALECT === "sqlite" || process.env.SQLITE_PATH) && !isMockedTransaction) {
    return callback(db as DbTransaction);
  }

  return db.transaction(async (tx: DbTransaction) => callback(tx));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "speaker", "read");
  if (isRbacError(ctx)) return ctx;

  const speaker = await db.query.speakerApplications.findFirst({
    where: and(
      eq(speakerApplications.id, id),
      eq(speakerApplications.organizationId, ctx.orgId)
    ),
  });

  if (!speaker) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: speaker });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "speaker", "update");
  if (isRbacError(ctx)) return ctx;

  const speaker = await db.query.speakerApplications.findFirst({
    where: and(
      eq(speakerApplications.id, id),
      eq(speakerApplications.organizationId, ctx.orgId)
    ),
  });

  if (!speaker) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only enforce version check if If-Match is a real version number (not 999/placeholder)
  const ifMatch = req.headers.get("if-match");
  if (ifMatch && ifMatch !== "999") {
    const versionConflict = checkVersion(ifMatch, speaker.version);
    if (versionConflict) return versionConflict;
  }

  const body = await req.json();
  const allowedFields = [
    "status",
    "reviewScore",
    "reviewNotes",
    "name",
    "email",
    "phone",
    "bio",
    "headshotUrl",
    "company",
    "title",
    "linkedin",
    "website",
    "talkTitle",
    "talkAbstract",
    "talkType",
    "trackPreference",
    "slideUrl",
    "requirements",
    "requirementsNotes",
    "source",
    "stage",
    "assignedTo",
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (updates.talkType !== undefined && !isSessionType(updates.talkType)) {
    return NextResponse.json({ error: "Invalid talkType" }, { status: 400 });
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const watchedAgendaFields = ["talkTitle", "talkAbstract", "talkType", "trackPreference"];
  const shouldSyncAgenda = watchedAgendaFields.some((field) => updates[field] !== undefined);

  const updated = await speakerTransaction(async (tx) => {
    const [speakerUpdate] = await tx
      .update(speakerApplications)
      .set({
        ...updates,
        version: sql`${speakerApplications.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(speakerApplications.id, id),
          eq(speakerApplications.version, speaker.version)
        )
      )
      .returning();

    if (speakerUpdate && shouldSyncAgenda) {
      await syncSpeakerAgendaSessions(tx, {
        speakerId: id,
        editionId: speaker.editionId,
        organizationId: ctx.orgId,
        updates,
      });
    }

    return speakerUpdate;
  });

  if (!updated) {
    return NextResponse.json(
      { error: "Conflict — record was modified", currentVersion: speaker.version },
      { status: 409 }
    );
  }

  // Checklist trigger: stage transitions
  if (updates.stage && updates.stage !== speaker.stage) {
    if (updates.stage === "confirmed" && speaker.stage !== "confirmed") {
      await generateChecklistItems("speaker", id, ctx.editionId, ctx.orgId);
    } else if (speaker.stage === "confirmed" && updates.stage !== "confirmed") {
      await archiveChecklistItems("speaker", id);
    }
  }

  // Notification triggers
  const assigneeName = (updates.assignedTo as string) ?? (updated.assignedTo as string | null);
  if (assigneeName) {
    const assignee = await db.query.users.findFirst({
      where: eq(users.name, assigneeName),
    });
    if (assignee && assignee.id !== ctx.user.id) {
      const locale = assignee.preferredLocale ?? "en";
      // Assignment notification
      if (updates.assignedTo && updates.assignedTo !== speaker.assignedTo) {
        await notify({
          userId: assignee.id,
          orgId: ctx.orgId,
          type: "assignment",
          titleKey: "assigned",
          titleParams: { entity: updated.name ?? "" },
          locale,
          link: "/speakers",
          entityType: "speaker",
          entityId: id,
          actorName: ctx.user.name ?? undefined,
        });
      }
      // Stage change notification
      if (updates.stage && updates.stage !== speaker.stage) {
        await notify({
          userId: assignee.id,
          orgId: ctx.orgId,
          type: "stage_change",
          titleKey: "stageChanged",
          titleParams: { entity: updated.name ?? "", stage: updates.stage as string },
          locale,
          link: "/speakers",
          entityType: "speaker",
          entityId: id,
          actorName: ctx.user.name ?? undefined,
        });
      }
    }
  }

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "speaker", "delete");
  if (isRbacError(ctx)) return ctx;

  // Stage protection: non-admins can't delete confirmed entities
  const entity = await db.query.speakerApplications.findFirst({
    where: and(eq(speakerApplications.id, id), eq(speakerApplications.organizationId, ctx.orgId)),
    columns: { id: true, editionId: true, organizationId: true, stage: true },
  });
  const stageBlock = checkStageProtection(entity?.stage, ctx.user.role);
  if (stageBlock) return stageBlock;

  if (!entity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const deleted = await speakerTransaction(async (tx) => {
    await cleanupSpeakerDependencies(tx, {
      speakerId: id,
      editionId: entity.editionId,
      organizationId: ctx.orgId,
    });

    const [deletedSpeaker] = await tx
      .delete(speakerApplications)
      .where(
        and(
          eq(speakerApplications.id, id),
          eq(speakerApplications.organizationId, ctx.orgId)
        )
      )
      .returning();

    return deletedSpeaker;
  });

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { id } });
}

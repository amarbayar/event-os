import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { entityNotes, users, speakerApplications, sponsorApplications, venues, booths, volunteerApplications, mediaPartners, tasks } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";
import { notify } from "@/lib/notify";

// GET notes for an entity
export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "note", "read");
  if (isRbacError(ctx)) return ctx;

  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entityType and entityId required" }, { status: 400 });
  }

  const notes = await db.query.entityNotes.findMany({
    where: and(
      eq(entityNotes.entityType, entityType),
      eq(entityNotes.entityId, entityId)
    ),
    orderBy: asc(entityNotes.createdAt),
  });

  return NextResponse.json({ data: notes });
}

// POST a new note
export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "note", "create");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const { entityType, entityId, content, authorName, authorEmail } = body;

  if (!entityType || !entityId || !content) {
    return NextResponse.json({ error: "entityType, entityId, and content required" }, { status: 400 });
  }

  const [note] = await db
    .insert(entityNotes)
    .values({
      entityType,
      entityId,
      organizationId: ctx.orgId,
      authorName: authorName || ctx.user.name || "Organizer",
      authorEmail: authorEmail || ctx.user.email || null,
      content,
    })
    .returning();

  // Notification trigger: notify the entity's assignee about the new comment
  let noteAssigneeName: string | null = null;
  let noteEntityName: string | null = null;
  if (entityType === "speaker") {
    const e = await db.query.speakerApplications.findFirst({ where: eq(speakerApplications.id, entityId) });
    if (e) { noteAssigneeName = e.assignedTo; noteEntityName = e.name; }
  } else if (entityType === "sponsor") {
    const e = await db.query.sponsorApplications.findFirst({ where: eq(sponsorApplications.id, entityId) });
    if (e) { noteAssigneeName = e.assignedTo; noteEntityName = e.companyName; }
  } else if (entityType === "venue") {
    const e = await db.query.venues.findFirst({ where: eq(venues.id, entityId) });
    if (e) { noteAssigneeName = e.assignedTo; noteEntityName = e.name; }
  } else if (entityType === "booth") {
    const e = await db.query.booths.findFirst({ where: eq(booths.id, entityId) });
    if (e) { noteAssigneeName = e.assignedTo; noteEntityName = e.name; }
  } else if (entityType === "volunteer") {
    const e = await db.query.volunteerApplications.findFirst({ where: eq(volunteerApplications.id, entityId) });
    if (e) { noteAssigneeName = e.assignedTo; noteEntityName = e.name; }
  } else if (entityType === "media") {
    const e = await db.query.mediaPartners.findFirst({ where: eq(mediaPartners.id, entityId) });
    if (e) { noteAssigneeName = e.assignedTo; noteEntityName = e.companyName; }
  } else if (entityType === "task") {
    const e = await db.query.tasks.findFirst({ where: eq(tasks.id, entityId) });
    if (e) { noteAssigneeName = e.assignedTo ?? e.assigneeName; noteEntityName = e.title; }
  }
  if (noteAssigneeName && noteEntityName) {
    const assignee = await db.query.users.findFirst({
      where: eq(users.name, noteAssigneeName),
    });
    if (assignee && assignee.id !== ctx.user.id) {
      await notify({
        userId: assignee.id,
        orgId: ctx.orgId,
        type: "comment",
        title: `New comment on ${entityType} ${noteEntityName}`,
        link: `/${entityType === "media" ? "media-partners" : entityType === "task" ? "tasks" : entityType + "s"}`,
        entityType,
        entityId,
        actorName: ctx.user.name ?? undefined,
      });
    }
  }

  return NextResponse.json({ data: note }, { status: 201 });
}

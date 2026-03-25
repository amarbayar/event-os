import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { checkVersion } from "@/lib/api-utils";
import { requirePermission, isRbacError } from "@/lib/rbac";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "session", "update");
  if (isRbacError(ctx)) return ctx;

  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.id, id),
      eq(sessions.organizationId, ctx.orgId)
    ),
  });

  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const versionConflict = checkVersion(
    req.headers.get("if-match"),
    session.version
  );
  if (versionConflict) return versionConflict;

  const body = await req.json();
  const allowedFields = [
    "trackId", "speakerId", "title", "description", "type",
    "startTime", "endTime", "room", "day", "sortOrder",
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === "startTime" || field === "endTime") {
        updates[field] = body[field] ? new Date(body[field]) : null;
      } else {
        updates[field] = body[field];
      }
    }
  }

  const [updated] = await db
    .update(sessions)
    .set({
      ...updates,
      version: sql`${sessions.version} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(eq(sessions.id, id), eq(sessions.version, session.version))
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Conflict" }, { status: 409 });
  }

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "session", "delete");
  if (isRbacError(ctx)) return ctx;

  const [deleted] = await db
    .delete(sessions)
    .where(
      and(
        eq(sessions.id, id),
        eq(sessions.organizationId, ctx.orgId)
      )
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { id } });
}

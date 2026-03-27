import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orgInvites } from "@/db/schema";
import { requirePermission, isRbacError } from "@/lib/rbac";
import { eq, and } from "drizzle-orm";

// ─── DELETE /api/org/invites/[id] — Revoke invite ───────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requirePermission(req, "user", "delete");
  if (isRbacError(ctx)) return ctx;
  const { id } = await params;

  const invite = await db.query.orgInvites.findFirst({
    where: and(
      eq(orgInvites.id, id),
      eq(orgInvites.organizationId, ctx.orgId)
    ),
  });

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.claimedAt) {
    return NextResponse.json(
      { error: "Cannot revoke a claimed invite" },
      { status: 400 }
    );
  }

  await db
    .update(orgInvites)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(
      and(eq(orgInvites.id, id), eq(orgInvites.organizationId, ctx.orgId))
    );

  return NextResponse.json({ success: true });
}

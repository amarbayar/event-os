import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orgInvites } from "@/db/schema";
import { requirePermission, isRbacError } from "@/lib/rbac";
import { eq, and } from "drizzle-orm";
import { hash } from "@/lib/password";
import { randomInt } from "crypto";

// ─── POST /api/org/invites/[id]/regenerate — New code ───

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requirePermission(req, "user", "create");
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
      { error: "Cannot regenerate a claimed invite" },
      { status: 400 }
    );
  }

  // Generate new 8-digit code
  const code = String(randomInt(10000000, 99999999));
  const codeHash = await hash(code);

  await db
    .update(orgInvites)
    .set({
      codeHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      attemptCount: 0,
      revokedAt: null, // clear revoked status if regenerating
      updatedAt: new Date(),
    })
    .where(
      and(eq(orgInvites.id, id), eq(orgInvites.organizationId, ctx.orgId))
    );

  return NextResponse.json({
    invite: {
      id: invite.id,
      email: invite.email,
      name: invite.name,
      role: invite.role,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
    code, // plaintext code — returned ONCE
  });
}

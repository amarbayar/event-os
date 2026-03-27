import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, userOrganizations } from "@/db/schema";
import { requirePermission, isRbacError } from "@/lib/rbac";
import { eq, and } from "drizzle-orm";
import { hash } from "@/lib/password";
import crypto from "crypto";

// ─── POST /api/users/[userId]/reset-password ────────────
// Admin generates a temp password for a user in their org.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const ctx = await requirePermission(req, "user", "update");
  if (isRbacError(ctx)) return ctx;
  const { userId } = await params;

  // Verify user belongs to this org
  const membership = await db.query.userOrganizations.findFirst({
    where: and(
      eq(userOrganizations.userId, userId),
      eq(userOrganizations.organizationId, ctx.orgId)
    ),
  });

  if (!membership) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Google-only users can't have their password reset
  if (!user.passwordHash) {
    return NextResponse.json(
      { error: "This user signs in with Google. Password reset is not available." },
      { status: 400 }
    );
  }

  // Generate temp password
  const tempPassword = crypto.randomBytes(8).toString("base64url");
  const passwordHash = await hash(tempPassword);

  await db
    .update(users)
    .set({
      passwordHash,
      forcePasswordChange: true,
    })
    .where(eq(users.id, userId));

  return NextResponse.json({
    tempPassword, // plaintext — returned ONCE, communicate verbally/Telegram
  });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, userOrganizations } from "@/db/schema";
import { requirePermission, isRbacError } from "@/lib/rbac";
import { eq, and } from "drizzle-orm";
import { hash } from "@/lib/password";
import { randomBytes } from "crypto";

// ─── POST /api/users/[id]/reset-password ────────────────
// Admin generates a temp password for a user in their org.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requirePermission(req, "user", "update");
  if (isRbacError(ctx)) return ctx;
  const { id } = await params;

  // Verify user belongs to this org
  const membership = await db.query.userOrganizations.findFirst({
    where: and(
      eq(userOrganizations.userId, id),
      eq(userOrganizations.organizationId, ctx.orgId)
    ),
  });

  if (!membership) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
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
  const tempPassword = randomBytes(8).toString("base64url");
  const passwordHash = await hash(tempPassword);

  await db
    .update(users)
    .set({
      passwordHash,
      forcePasswordChange: true,
    })
    .where(eq(users.id, id));

  return NextResponse.json({
    tempPassword, // plaintext — returned ONCE, communicate verbally/Telegram
  });
}

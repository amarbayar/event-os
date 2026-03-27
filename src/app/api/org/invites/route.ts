import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orgInvites, userOrganizations, users } from "@/db/schema";
import { requirePermission, isRbacError } from "@/lib/rbac";
import { eq, and, isNull, desc } from "drizzle-orm";
import { hash } from "@/lib/password";
import { randomInt } from "crypto";

const VALID_INVITE_ROLES = ["admin", "organizer", "coordinator", "viewer"];

// ─── POST /api/org/invites — Create invite (seat) ───────

export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "user", "create");
  if (isRbacError(ctx)) return ctx;
  const body = await req.json();

  const { email, name, phone, role } = body;

  if (!email || !name || !role) {
    return NextResponse.json(
      { error: "Email, name, and role are required" },
      { status: 400 }
    );
  }

  if (!VALID_INVITE_ROLES.includes(role)) {
    return NextResponse.json(
      { error: `Invalid role. Must be one of: ${VALID_INVITE_ROLES.join(", ")}` },
      { status: 400 }
    );
  }

  // Check for existing pending invite for this email in this org
  const existing = await db.query.orgInvites.findFirst({
    where: and(
      eq(orgInvites.email, email),
      eq(orgInvites.organizationId, ctx.orgId),
      isNull(orgInvites.claimedAt),
      isNull(orgInvites.revokedAt)
    ),
  });

  if (existing) {
    return NextResponse.json(
      { error: "A pending invite already exists for this email" },
      { status: 409 }
    );
  }

  // Check if user is already a member of this org
  const existingMember = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(userOrganizations, eq(users.id, userOrganizations.userId))
    .where(
      and(
        eq(users.email, email),
        eq(userOrganizations.organizationId, ctx.orgId)
      )
    )
    .limit(1);

  if (existingMember.length > 0) {
    return NextResponse.json(
      { error: "User already belongs to this organization" },
      { status: 409 }
    );
  }

  // Generate 8-digit code
  const code = String(randomInt(10000000, 99999999));
  const codeHash = await hash(code);

  const [invite] = await db
    .insert(orgInvites)
    .values({
      organizationId: ctx.orgId,
      email,
      name,
      phone: phone || null,
      role,
      codeHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      invitedByUserId: ctx.user.id === "service" ? null : ctx.user.id,
    })
    .returning();

  return NextResponse.json(
    {
      invite: {
        id: invite.id,
        email: invite.email,
        name: invite.name,
        phone: invite.phone,
        role: invite.role,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      },
      code, // plaintext code — returned ONCE, never stored
    },
    { status: 201 }
  );
}

// ─── GET /api/org/invites — List invites ────────────────

export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "user", "read");
  if (isRbacError(ctx)) return ctx;

  const invites = await db
    .select()
    .from(orgInvites)
    .where(eq(orgInvites.organizationId, ctx.orgId))
    .orderBy(desc(orgInvites.createdAt));

  const result = invites.map((inv: typeof orgInvites.$inferSelect) => {
    let status: "pending" | "claimed" | "expired" | "revoked" = "pending";
    if (inv.claimedAt) status = "claimed";
    else if (inv.revokedAt) status = "revoked";
    else if (new Date(inv.expiresAt) < new Date()) status = "expired";

    return {
      id: inv.id,
      email: inv.email,
      name: inv.name,
      phone: inv.phone,
      role: inv.role,
      status,
      expiresAt: inv.expiresAt,
      claimedAt: inv.claimedAt,
      revokedAt: inv.revokedAt,
      attemptCount: inv.attemptCount,
      createdAt: inv.createdAt,
    };
  });

  return NextResponse.json(result);
}

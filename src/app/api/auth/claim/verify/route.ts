import { NextResponse } from "next/server";
import { db } from "@/db";
import { orgInvites } from "@/db/schema";
import { eq, and, isNull, gt } from "drizzle-orm";
import { compare } from "@/lib/password";
import { SignJWT } from "jose";

const MAX_ATTEMPTS = 5;

// ─── POST /api/auth/claim/verify ────────────────────────
// Verify an 8-digit invite code. No auth required.
// Returns a claim token (signed JWT) on success.

export async function POST(req: Request) {
  const body = await req.json();
  const { email, code } = body;

  if (!email || !code) {
    return NextResponse.json(
      { error: "Email and code are required" },
      { status: 400 }
    );
  }

  const invite = await db.query.orgInvites.findFirst({
    where: and(
      eq(orgInvites.email, email),
      isNull(orgInvites.claimedAt),
      isNull(orgInvites.revokedAt)
    ),
  });

  if (!invite) {
    return NextResponse.json(
      { error: "No pending invite found for this email" },
      { status: 404 }
    );
  }

  // Check expiry
  if (new Date(invite.expiresAt) < new Date()) {
    return NextResponse.json(
      { error: "Code expired. Ask your admin for a new one." },
      { status: 410 }
    );
  }

  // Check attempt limit
  if (invite.attemptCount >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Too many attempts. Ask your admin to regenerate the code." },
      { status: 429 }
    );
  }

  // Verify code
  const valid = await compare(code, invite.codeHash);

  if (!valid) {
    // Increment attempt count
    await db
      .update(orgInvites)
      .set({
        attemptCount: invite.attemptCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(orgInvites.id, invite.id));

    const remaining = MAX_ATTEMPTS - invite.attemptCount - 1;
    return NextResponse.json(
      {
        error: `Invalid code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
      },
      { status: 401 }
    );
  }

  // Code is valid — issue a claim token (15 min expiry)
  const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
  const claimToken = await new SignJWT({
    inviteId: invite.id,
    email: invite.email,
    orgId: invite.organizationId,
    name: invite.name,
    phone: invite.phone,
    role: invite.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(secret);

  return NextResponse.json({
    claimToken,
    invite: {
      name: invite.name,
      phone: invite.phone,
      role: invite.role,
      organizationName: null, // Populated by the client if needed
    },
  });
}

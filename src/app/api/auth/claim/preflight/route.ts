import { NextResponse } from "next/server";
import { db } from "@/db";
import { orgInvites } from "@/db/schema";
import { eq, and, isNull, gt } from "drizzle-orm";

// ─── POST /api/auth/claim/preflight ─────────────────────
// Check if an email has a pending invite. No auth required.

export async function POST(req: Request) {
  const body = await req.json();
  const { email } = body;

  if (!email) {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 }
    );
  }

  const invite = await db.query.orgInvites.findFirst({
    where: and(
      eq(orgInvites.email, email),
      isNull(orgInvites.claimedAt),
      isNull(orgInvites.revokedAt),
      gt(orgInvites.expiresAt, new Date())
    ),
  });

  return NextResponse.json({
    hasPendingInvite: !!invite,
  });
}

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, userOrganizations, orgInvites } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hash } from "@/lib/password";
import { jwtVerify } from "jose";

// ─── POST /api/auth/claim/complete ──────────────────────
// Complete the invite claim. Creates user + membership atomically.
// For credentials flow. Google OAuth is handled via signIn callback.

export async function POST(req: Request) {
  const body = await req.json();
  const { claimToken, password, name, phone } = body;

  if (!claimToken) {
    return NextResponse.json(
      { error: "Claim token is required" },
      { status: 400 }
    );
  }

  // Verify claim token
  const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
  let payload;
  try {
    const result = await jwtVerify(claimToken, secret);
    payload = result.payload as {
      inviteId: string;
      email: string;
      orgId: string;
      name: string;
      phone: string | null;
      role: string;
    };
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired claim token. Please re-enter your code." },
      { status: 401 }
    );
  }

  // Verify invite is still valid (not claimed/revoked since token was issued)
  const invite = await db.query.orgInvites.findFirst({
    where: eq(orgInvites.id, payload.inviteId),
  });

  if (!invite || invite.claimedAt || invite.revokedAt) {
    return NextResponse.json(
      { error: "Invite is no longer valid" },
      { status: 410 }
    );
  }

  const authProvider = process.env.AUTH_PROVIDER || "credentials";
  const finalName = name || payload.name;
  const finalPhone = phone || payload.phone;

  // Check if user already exists (cross-org invite)
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, payload.email),
  });

  if (existingUser) {
    // Cross-org: existing user claiming a seat in a new org
    // Verify password for credentials users
    if (existingUser.passwordHash && password) {
      const { compare } = await import("@/lib/password");
      const valid = await compare(password, existingUser.passwordHash);
      if (!valid) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 401 }
        );
      }
    }

    // Create membership + mark invite claimed in a transaction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.transaction(async (tx: any) => {
      await tx.insert(userOrganizations).values({
        userId: existingUser.id,
        organizationId: payload.orgId,
        role: payload.role,
      });

      await tx
        .update(orgInvites)
        .set({
          claimedAt: new Date(),
          acceptedByUserId: existingUser.id,
          updatedAt: new Date(),
        })
        .where(eq(orgInvites.id, payload.inviteId));

      // Update phone if provided and not set
      if (finalPhone && !existingUser.phone) {
        await tx
          .update(users)
          .set({ phone: finalPhone })
          .where(eq(users.id, existingUser.id));
      }
    });

    return NextResponse.json({
      userId: existingUser.id,
      email: existingUser.email,
      isExistingUser: true,
    });
  }

  // New user — create user + membership atomically
  if (authProvider !== "google" && !password) {
    return NextResponse.json(
      { error: "Password is required" },
      { status: 400 }
    );
  }

  if (password && password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const passwordHash = password ? await hash(password) : null;

  let newUserId: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.transaction(async (tx: any) => {
    const [newUser] = await tx
      .insert(users)
      .values({
        email: payload.email,
        name: finalName,
        phone: finalPhone,
        passwordHash,
      })
      .returning({ id: users.id });

    newUserId = newUser.id;

    await tx.insert(userOrganizations).values({
      userId: newUser.id,
      organizationId: payload.orgId,
      role: payload.role,
    });

    await tx
      .update(orgInvites)
      .set({
        claimedAt: new Date(),
        acceptedByUserId: newUser.id,
        updatedAt: new Date(),
      })
      .where(eq(orgInvites.id, payload.inviteId));
  });

  return NextResponse.json(
    {
      userId: newUserId!,
      email: payload.email,
      isExistingUser: false,
    },
    { status: 201 }
  );
}

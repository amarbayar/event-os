import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hash, compare } from "@/lib/password";

// ─── POST /api/auth/change-password ─────────────────────
// Change password for authenticated user. Clears forcePasswordChange.

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { oldPassword, newPassword } = body;

  if (!oldPassword || !newPassword) {
    return NextResponse.json(
      { error: "Old and new passwords are required" },
      { status: 400 }
    );
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user || !user.passwordHash) {
    return NextResponse.json(
      { error: "Password change not available for this account" },
      { status: 400 }
    );
  }

  const valid = await compare(oldPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 401 }
    );
  }

  const newHash = await hash(newPassword);

  await db
    .update(users)
    .set({
      passwordHash: newHash,
      forcePasswordChange: false,
    })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ success: true });
}

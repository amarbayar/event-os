import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users, userOrganizations } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// GET — return current logged-in user info
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionUser = session.user as Record<string, unknown>;
  const userId = sessionUser.id as string;
  const orgId = sessionUser.organizationId as string;

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, name: true, email: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const membership = await db.query.userOrganizations.findFirst({
    where: and(
      eq(userOrganizations.userId, userId),
      eq(userOrganizations.organizationId, orgId)
    ),
  });

  return NextResponse.json({
    data: { ...user, role: membership?.role || "viewer" },
  });
}

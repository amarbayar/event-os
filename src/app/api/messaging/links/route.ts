import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { userPlatformLinks, users, userOrganizations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

// GET — list all platform links for this org
export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "settings", "read");
  if (isRbacError(ctx)) return ctx;

  const links = await db
    .select({
      id: userPlatformLinks.id,
      platform: userPlatformLinks.platform,
      platformUserId: userPlatformLinks.platformUserId,
      displayName: userPlatformLinks.displayName,
      userName: users.name,
      userEmail: users.email,
    })
    .from(userPlatformLinks)
    .innerJoin(users, eq(userPlatformLinks.userId, users.id))
    .where(eq(userPlatformLinks.organizationId, ctx.orgId))
    .orderBy(users.name);

  // Also get org members for the dropdown
  const members = await db
    .select({
      userId: userOrganizations.userId,
      name: users.name,
      email: users.email,
      role: userOrganizations.role,
    })
    .from(userOrganizations)
    .innerJoin(users, eq(userOrganizations.userId, users.id))
    .where(eq(userOrganizations.organizationId, ctx.orgId))
    .orderBy(users.name);

  return NextResponse.json({ data: { links, members } });
}

// POST — create a new platform link
export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "settings", "update");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const { userId, platform, platformUserId, displayName } = body as {
    userId: string;
    platform: string;
    platformUserId: string;
    displayName?: string;
  };

  if (!userId || !platform || !platformUserId) {
    return NextResponse.json({ error: "userId, platform, and platformUserId are required" }, { status: 400 });
  }

  if (!["telegram", "discord", "whatsapp", "slack"].includes(platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  try {
    await db.insert(userPlatformLinks).values({
      userId,
      organizationId: ctx.orgId,
      platform,
      platformUserId: platformUserId.trim(),
      displayName: displayName || null,
    });

    return NextResponse.json({ data: { linked: true } }, { status: 201 });
  } catch (error: unknown) {
    const dbError = error as Error & { code?: string };
    if (dbError.message?.includes("unique") || dbError.code === "23505") {
      return NextResponse.json({ error: "This platform account is already linked." }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create link." }, { status: 500 });
  }
}

// DELETE — remove a platform link
export async function DELETE(req: NextRequest) {
  const ctx = await requirePermission(req, "settings", "delete");
  if (isRbacError(ctx)) return ctx;

  const { searchParams } = new URL(req.url);
  const linkId = searchParams.get("id");

  if (!linkId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await db.delete(userPlatformLinks).where(
    and(
      eq(userPlatformLinks.id, linkId),
      eq(userPlatformLinks.organizationId, ctx.orgId)
    )
  );

  return NextResponse.json({ data: { deleted: true } });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { userPlatformLinks, users, userOrganizations, teamMembers, teams } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { validateServiceToken } from "@/lib/service-token";

// POST /api/agent/identify
//
// Resolves a platform user (Telegram, Discord, etc.) to their Event OS
// identity + role + team memberships. Called by bot relay before any operation.
//
// Requires service token auth + x-organization-id header.

const VALID_PLATFORMS = new Set(["telegram", "discord", "whatsapp", "slack", "signal"]);

export async function POST(req: NextRequest) {
  // Service token auth only
  if (!validateServiceToken(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = req.headers.get("x-organization-id");
  if (!orgId) {
    return NextResponse.json({ error: "x-organization-id header required" }, { status: 400 });
  }

  const body = await req.json();
  const { platform, platformUserId, displayName } = body as {
    platform?: string;
    platformUserId?: string;
    displayName?: string;
  };

  if (!platform || !platformUserId) {
    return NextResponse.json({ error: "platform and platformUserId are required" }, { status: 400 });
  }

  if (!VALID_PLATFORMS.has(platform)) {
    return NextResponse.json({ error: `Invalid platform. Supported: ${[...VALID_PLATFORMS].join(", ")}` }, { status: 400 });
  }

  // Look up platform link → user → org membership
  const link = await db
    .select({
      userId: userPlatformLinks.userId,
      userName: users.name,
      userEmail: users.email,
      role: userOrganizations.role,
    })
    .from(userPlatformLinks)
    .innerJoin(users, eq(userPlatformLinks.userId, users.id))
    .innerJoin(userOrganizations, and(
      eq(userOrganizations.userId, users.id),
      eq(userOrganizations.organizationId, orgId)
    ))
    .where(and(
      eq(userPlatformLinks.platform, platform),
      eq(userPlatformLinks.platformUserId, platformUserId),
      eq(userPlatformLinks.organizationId, orgId)
    ))
    .limit(1);

  if (link.length === 0) {
    return NextResponse.json({
      data: {
        userId: null,
        linked: false,
        message: "Unknown user. Send /link your@email.com to connect your Event OS account.",
      },
    });
  }

  const user = link[0];

  // Fetch team names for this user in this org
  const userTeams = await db
    .select({ teamName: teams.name })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(and(
      eq(teamMembers.userId, user.userId),
      eq(teams.organizationId, orgId)
    ));

  // Update display name if changed (fire-and-forget)
  if (displayName) {
    db.update(userPlatformLinks)
      .set({ displayName })
      .where(and(
        eq(userPlatformLinks.platform, platform),
        eq(userPlatformLinks.platformUserId, platformUserId)
      ))
      .catch(() => {}); // fire-and-forget
  }

  return NextResponse.json({
    data: {
      userId: user.userId,
      name: user.userName,
      email: user.userEmail,
      role: user.role,
      teams: userTeams.map((t: typeof userTeams[number]) => t.teamName),
      linked: true,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateServiceToken } from "@/lib/service-token";
import { db } from "@/db";
import { users, teamMembers, teamEntityTypes, teams } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getActiveIds } from "@/lib/queries";

// ─── Types ─────────────────────────────────────────────

export type RbacContext = {
  user: { id: string; role: string; name: string | null; email: string };
  orgId: string;
  editionId: string;
  source: "web" | "api";
};

type Action = "read" | "create" | "update" | "delete";

const ROLE_HIERARCHY: Record<string, number> = {
  owner: 100,
  admin: 80,
  organizer: 60,
  coordinator: 40,
  viewer: 20,
};

// ─── Permission Check ──────────────────────────────────
//
//  API REQUEST FLOW
//  ═══════════════════════════════════════════════
//  Web UI ──→ NextAuth JWT ──┐
//                            ├──→ requirePermission() ──→ Route Handler
//  Service Token ──→ API ────┘         │
//                               ┌──────┴──────┐
//                               │ 1. Auth user │
//                               │ 2. Check role│
//                               │ 3. Check team│
//                               │    scope     │
//                               │ 4. Allow/deny│
//                               └──────────────┘

export async function requirePermission(
  req: NextRequest,
  entityType: string,
  action: Action
): Promise<RbacContext | NextResponse> {
  try {
    // Service token auth (for agent/bot) — full access
    if (validateServiceToken(req)) {
      const orgId = req.headers.get("x-organization-id");
      if (!orgId) {
        return NextResponse.json(
          { error: "x-organization-id header required" },
          { status: 400 }
        );
      }
      const ids = await getActiveIds();
      return {
        user: { id: "service", role: "admin", name: "Service", email: "service@system" },
        orgId,
        editionId: ids?.editionId || "",
        source: "api",
      };
    }

    // Session auth (web app)
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionUser = session.user as Record<string, unknown>;
    const userId = sessionUser.id as string;
    const orgId = sessionUser.organizationId as string;
    const role = (sessionUser.role as string) || "viewer";

    if (!orgId) {
      return NextResponse.json({ error: "No organization associated" }, { status: 403 });
    }

    // Get active edition
    const ids = await getActiveIds();
    const editionId = ids?.editionId || "";

    // Look up full user record for name/email
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, name: true, email: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const ctx: RbacContext = {
      user: { id: user.id, role: user.role, name: user.name, email: user.email },
      orgId,
      editionId,
      source: "web",
    };

    // Owner/admin bypass — full access
    if (ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.admin) {
      return ctx;
    }

    // Everyone can read
    if (action === "read") {
      return ctx;
    }

    // Viewer cannot write
    if (role === "viewer") {
      return forbidden("You don't have permission to modify this resource. Contact an admin.");
    }

    // Organizer/coordinator — check team scope
    const hasScope = await userOwnsEntityType(userId, entityType, orgId);
    if (!hasScope) {
      return forbidden(
        `You don't have permission to edit ${entityType}s. Ask an admin to add you to a team that manages ${entityType}s.`
      );
    }

    // Coordinator cannot delete
    if (action === "delete" && role === "coordinator") {
      return forbidden("Coordinators cannot delete records. Ask an organizer or admin.");
    }

    // Organizer can only delete lead/engaged (checked at route level for stage)
    return ctx;
  } catch (error) {
    console.error("RBAC error:", error);
    return NextResponse.json(
      { error: "Permission check failed. Please try again." },
      { status: 500 }
    );
  }
}

// ─── Helper: check team membership for entity type ─────

async function userOwnsEntityType(
  userId: string,
  entityType: string,
  orgId: string
): Promise<boolean> {
  // Join: user → team_members → teams (org-wide) → team_entity_types
  const result = await db
    .select({ entityType: teamEntityTypes.entityType })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .innerJoin(teamEntityTypes, eq(teams.id, teamEntityTypes.teamId))
    .where(
      and(
        eq(teamMembers.userId, userId),
        eq(teams.organizationId, orgId),
        isNull(teams.editionId), // org-wide teams only
        eq(teamEntityTypes.entityType, entityType)
      )
    )
    .limit(1);

  return result.length > 0;
}

// ─── Helper: 403 response ──────────────────────────────

function forbidden(message: string): NextResponse {
  return NextResponse.json({ error: "Forbidden", message }, { status: 403 });
}

// ─── Helper: check if context is an error response ─────

export function isRbacError(ctx: RbacContext | NextResponse): ctx is NextResponse {
  return ctx instanceof NextResponse;
}

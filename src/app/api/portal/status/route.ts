import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, userOrganizations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

// GET — check if an entity has been invited to the portal (read-only, no side effects)
export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "checklist", "read");
  if (isRbacError(ctx)) return ctx;

  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entityType and entityId required" }, { status: 400 });
  }

  const membership = await db.query.userOrganizations.findFirst({
    where: and(
      eq(userOrganizations.organizationId, ctx.orgId),
      eq(userOrganizations.role, "stakeholder"),
      eq(userOrganizations.linkedEntityType, entityType),
      eq(userOrganizations.linkedEntityId, entityId),
    ),
    with: { user: true },
  });

  return NextResponse.json({
    data: {
      invited: !!membership,
      user: membership ? { id: membership.user.id, email: membership.user.email, name: membership.user.name } : null,
    },
  });
}

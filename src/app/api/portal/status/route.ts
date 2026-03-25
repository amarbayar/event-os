import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
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

  const stakeholder = await db.query.users.findFirst({
    where: and(
      eq(users.role, "stakeholder"),
      eq(users.linkedEntityType, entityType),
      eq(users.linkedEntityId, entityId),
    ),
    columns: { id: true, email: true, name: true },
  });

  return NextResponse.json({
    data: {
      invited: !!stakeholder,
      user: stakeholder || null,
    },
  });
}

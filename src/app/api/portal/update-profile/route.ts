import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { userOrganizations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  sanitizeStakeholderUpdates,
  updateStakeholderEntity,
} from "@/lib/stakeholder-entities";

// PATCH — stakeholder updates their own entity profile fields
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const orgId = session.user.organizationId as string;

  const membership = await db.query.userOrganizations.findFirst({
    where: and(
      eq(userOrganizations.userId, userId),
      eq(userOrganizations.organizationId, orgId),
      eq(userOrganizations.role, "stakeholder"),
    ),
  });

  if (!membership || !membership.linkedEntityType || !membership.linkedEntityId) {
    return NextResponse.json({ error: "Not a stakeholder account" }, { status: 403 });
  }

  const body = await req.json();
  const updates = sanitizeStakeholderUpdates(
    membership.linkedEntityType,
    body as Record<string, unknown>
  );

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await updateStakeholderEntity(
    membership.linkedEntityType,
    membership.linkedEntityId,
    updates
  );

  return NextResponse.json({ data: updated });
}

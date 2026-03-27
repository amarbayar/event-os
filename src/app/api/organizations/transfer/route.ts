import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { userOrganizations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

// POST — transfer organization ownership (owner only)
export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "organization", "update");
  if (isRbacError(ctx)) return ctx;

  if (ctx.user.role !== "owner") {
    return NextResponse.json({ error: "Only the organization owner can transfer ownership" }, { status: 403 });
  }

  const { newOwnerId } = await req.json();
  if (!newOwnerId) {
    return NextResponse.json({ error: "newOwnerId is required" }, { status: 400 });
  }

  if (newOwnerId === ctx.user.id) {
    return NextResponse.json({ error: "You are already the owner" }, { status: 400 });
  }

  // Verify the new owner is a member of this org
  const newOwnerMembership = await db.query.userOrganizations.findFirst({
    where: and(
      eq(userOrganizations.userId, newOwnerId),
      eq(userOrganizations.organizationId, ctx.orgId)
    ),
  });

  if (!newOwnerMembership) {
    return NextResponse.json({ error: "User is not a member of this organization" }, { status: 404 });
  }

  // Swap roles atomically: current owner → admin, new owner → owner
  await db.transaction(async (tx: any) => {
    await tx
      .update(userOrganizations)
      .set({ role: "admin" })
      .where(and(
        eq(userOrganizations.userId, ctx.user.id),
        eq(userOrganizations.organizationId, ctx.orgId)
      ));

    await tx
      .update(userOrganizations)
      .set({ role: "owner" })
      .where(and(
        eq(userOrganizations.userId, newOwnerId),
        eq(userOrganizations.organizationId, ctx.orgId)
      ));
  });

  return NextResponse.json({ data: { transferred: true } });
}

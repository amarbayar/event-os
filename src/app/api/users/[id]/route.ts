import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, userOrganizations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

// PATCH — update user role or name
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "user", "update");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();

  const validRoles = ["owner", "admin", "organizer", "coordinator", "viewer"];

  // Split updates: name/image go to users table, role goes to user_organizations
  const userUpdates: Record<string, string> = {};
  if (body.name !== undefined) userUpdates.name = body.name;
  if (body.image !== undefined) userUpdates.image = body.image;

  let roleUpdate: string | undefined;
  if (body.role !== undefined) {
    if (!validRoles.includes(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    roleUpdate = body.role;
  }

  if (Object.keys(userUpdates).length === 0 && !roleUpdate) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Verify membership exists
  const membership = await db.query.userOrganizations.findFirst({
    where: and(
      eq(userOrganizations.userId, id),
      eq(userOrganizations.organizationId, ctx.orgId)
    ),
    with: { user: true },
  });

  if (!membership) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Update user profile fields
  if (Object.keys(userUpdates).length > 0) {
    await db.update(users).set(userUpdates).where(eq(users.id, id));
  }

  // Update role on membership
  if (roleUpdate) {
    await db
      .update(userOrganizations)
      .set({ role: roleUpdate })
      .where(and(
        eq(userOrganizations.userId, id),
        eq(userOrganizations.organizationId, ctx.orgId)
      ));
  }

  return NextResponse.json({
    data: {
      id: membership.user.id,
      name: body.name ?? membership.user.name,
      email: membership.user.email,
      role: roleUpdate ?? membership.role,
    },
  });
}

// DELETE — remove user from organization
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "user", "delete");
  if (isRbacError(ctx)) return ctx;

  const [deleted] = await db
    .delete(userOrganizations)
    .where(and(
      eq(userOrganizations.userId, id),
      eq(userOrganizations.organizationId, ctx.orgId)
    ))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

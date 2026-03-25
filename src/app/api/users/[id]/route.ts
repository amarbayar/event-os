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

  const allowedFields = ["name", "role", "image"] as const;
  const updates: Record<string, string> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const validRoles = ["owner", "admin", "organizer", "coordinator", "viewer"];
  if (updates.role && !validRoles.includes(updates.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(and(eq(users.id, id), eq(users.organizationId, ctx.orgId)))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    });

  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Keep user_organizations.role in sync
  if (updates.role) {
    await db
      .update(userOrganizations)
      .set({ role: updates.role })
      .where(and(
        eq(userOrganizations.userId, id),
        eq(userOrganizations.organizationId, ctx.orgId)
      ));
  }

  return NextResponse.json({ data: updated });
}

// DELETE — remove user from organization
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "user", "delete");
  if (isRbacError(ctx)) return ctx;

  // Remove membership (user record stays for other orgs)
  await db
    .delete(userOrganizations)
    .where(and(
      eq(userOrganizations.userId, id),
      eq(userOrganizations.organizationId, ctx.orgId)
    ));

  // Also clean up legacy field
  const [deleted] = await db
    .delete(users)
    .where(and(eq(users.id, id), eq(users.organizationId, ctx.orgId)))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

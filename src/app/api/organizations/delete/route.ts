import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

// POST — delete organization (owner only, requires name confirmation)
export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "organization", "delete");
  if (isRbacError(ctx)) return ctx;

  if (ctx.user.role !== "owner") {
    return NextResponse.json({ error: "Only the organization owner can delete it" }, { status: 403 });
  }

  const { confirmName } = await req.json();
  if (!confirmName) {
    return NextResponse.json({ error: "confirmName is required" }, { status: 400 });
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, ctx.orgId),
  });

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  if (confirmName !== org.name) {
    return NextResponse.json({ error: "Organization name does not match" }, { status: 400 });
  }

  await db.delete(organizations).where(eq(organizations.id, ctx.orgId));

  return NextResponse.json({ data: { deleted: true } });
}

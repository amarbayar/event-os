import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";
import { isValidEmail } from "@/lib/validation";

// GET — fetch current organization
export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "organization", "read");
  if (isRbacError(ctx)) return ctx;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, ctx.orgId),
  });

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Strip sensitive fields
  const safeOrg = { ...org };
  delete safeOrg.llmApiKey;
  return NextResponse.json({ data: safeOrg });
}

// PATCH — update organization settings (owner/admin only)
export async function PATCH(req: NextRequest) {
  const ctx = await requirePermission(req, "organization", "update");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    updates.name = body.name.trim();
  }

  if (body.slug !== undefined) {
    const slug = body.slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ error: "Slug must contain only lowercase letters, numbers, and hyphens" }, { status: 400 });
    }
    // Check uniqueness (excluding self)
    const existing = await db.query.organizations.findFirst({
      where: and(eq(organizations.slug, slug), ne(organizations.id, ctx.orgId)),
    });
    if (existing) {
      return NextResponse.json({ error: "This slug is already taken" }, { status: 409 });
    }
    updates.slug = slug;
  }

  if (body.contactEmail !== undefined) {
    if (body.contactEmail && !isValidEmail(body.contactEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
    updates.contactEmail = body.contactEmail || null;
  }

  if (body.website !== undefined) updates.website = body.website || null;

  if (body.brandColor !== undefined) {
    if (body.brandColor && !/^#[0-9a-fA-F]{6}$/.test(body.brandColor)) {
      return NextResponse.json({ error: "Brand color must be a valid hex color (e.g. #eab308)" }, { status: 400 });
    }
    updates.brandColor = body.brandColor || null;
  }

  if (body.logoUrl !== undefined) updates.logoUrl = body.logoUrl || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  updates.updatedAt = new Date();

  const [updated] = await db
    .update(organizations)
    .set(updates)
    .where(eq(organizations.id, ctx.orgId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Strip sensitive fields
  const safeUpdated = { ...updated };
  delete safeUpdated.llmApiKey;
  return NextResponse.json({ data: safeUpdated });
}

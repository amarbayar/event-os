import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users, userOrganizations, speakerApplications, sponsorApplications, venues, booths, volunteerApplications, mediaPartners } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

// PATCH — stakeholder updates their own entity profile fields
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionUser = session.user as Record<string, unknown>;
  const userId = sessionUser.id as string;
  const orgId = sessionUser.organizationId as string;

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

  // Allowed fields per entity type — only fields the stakeholder should edit
  const allowedFieldsByType: Record<string, string[]> = {
    speaker: ["name", "bio", "headshotUrl", "talkTitle", "talkAbstract", "slideUrl", "phone", "linkedin", "website"],
    sponsor: ["contactName", "contactEmail", "logoUrl", "message"],
    venue: ["contactName", "contactEmail", "mainImageUrl"],
    booth: ["contactName", "contactEmail", "companyLogoUrl"],
    volunteer: ["name", "headshotUrl", "phone"],
    media: ["contactName", "contactEmail", "logoUrl"],
  };

  const allowed = allowedFieldsByType[membership.linkedEntityType] || [];
  const updates: Record<string, unknown> = {};

  for (const field of allowed) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Update the entity
  const entityId = membership.linkedEntityId;
  let updated: unknown;

  if (membership.linkedEntityType === "speaker") {
    [updated] = await db.update(speakerApplications).set({ ...updates, updatedAt: new Date(), version: sql`${speakerApplications.version} + 1` }).where(eq(speakerApplications.id, entityId)).returning();
  } else if (membership.linkedEntityType === "sponsor") {
    [updated] = await db.update(sponsorApplications).set({ ...updates, updatedAt: new Date(), version: sql`${sponsorApplications.version} + 1` }).where(eq(sponsorApplications.id, entityId)).returning();
  } else if (membership.linkedEntityType === "venue") {
    [updated] = await db.update(venues).set({ ...updates, updatedAt: new Date() }).where(eq(venues.id, entityId)).returning();
  } else if (membership.linkedEntityType === "booth") {
    [updated] = await db.update(booths).set({ ...updates, updatedAt: new Date() }).where(eq(booths.id, entityId)).returning();
  } else if (membership.linkedEntityType === "volunteer") {
    [updated] = await db.update(volunteerApplications).set({ ...updates, updatedAt: new Date(), version: sql`${volunteerApplications.version} + 1` }).where(eq(volunteerApplications.id, entityId)).returning();
  } else if (membership.linkedEntityType === "media") {
    [updated] = await db.update(mediaPartners).set({ ...updates, updatedAt: new Date() }).where(eq(mediaPartners.id, entityId)).returning();
  }

  return NextResponse.json({ data: updated });
}

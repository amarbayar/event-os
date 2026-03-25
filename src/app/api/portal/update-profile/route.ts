import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users, speakerApplications, sponsorApplications, venues, booths, volunteerApplications, mediaPartners } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

// PATCH — stakeholder updates their own entity profile fields
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionUser = session.user as Record<string, unknown>;
  const userId = sessionUser.id as string;

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user || user.role !== "stakeholder" || !user.linkedEntityType || !user.linkedEntityId) {
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

  const allowed = allowedFieldsByType[user.linkedEntityType] || [];
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
  const entityId = user.linkedEntityId;
  let updated: unknown;

  if (user.linkedEntityType === "speaker") {
    [updated] = await db.update(speakerApplications).set({ ...updates, updatedAt: new Date(), version: sql`${speakerApplications.version} + 1` }).where(eq(speakerApplications.id, entityId)).returning();
  } else if (user.linkedEntityType === "sponsor") {
    [updated] = await db.update(sponsorApplications).set({ ...updates, updatedAt: new Date(), version: sql`${sponsorApplications.version} + 1` }).where(eq(sponsorApplications.id, entityId)).returning();
  } else if (user.linkedEntityType === "venue") {
    [updated] = await db.update(venues).set({ ...updates, updatedAt: new Date() }).where(eq(venues.id, entityId)).returning();
  } else if (user.linkedEntityType === "booth") {
    [updated] = await db.update(booths).set({ ...updates, updatedAt: new Date() }).where(eq(booths.id, entityId)).returning();
  } else if (user.linkedEntityType === "volunteer") {
    [updated] = await db.update(volunteerApplications).set({ ...updates, updatedAt: new Date(), version: sql`${volunteerApplications.version} + 1` }).where(eq(volunteerApplications.id, entityId)).returning();
  } else if (user.linkedEntityType === "media") {
    [updated] = await db.update(mediaPartners).set({ ...updates, updatedAt: new Date() }).where(eq(mediaPartners.id, entityId)).returning();
  }

  return NextResponse.json({ data: updated });
}

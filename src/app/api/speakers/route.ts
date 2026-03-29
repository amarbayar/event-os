import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { speakerApplications, eventQueue } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { paginationParams } from "@/lib/api-utils";
import { requirePermission, isRbacError } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "speaker", "read");
  if (isRbacError(ctx)) return ctx;

  const url = new URL(req.url);
  const editionId = url.searchParams.get("editionId") || ctx.editionId;
  const status = url.searchParams.get("status");
  const { limit } = paginationParams(req);

  if (!editionId) {
    return NextResponse.json({ error: "editionId is required" }, { status: 400 });
  }

  const conditions = [
    eq(speakerApplications.editionId, editionId),
    eq(speakerApplications.organizationId, ctx.orgId),
  ];

  if (status) {
    conditions.push(
      eq(speakerApplications.status, status as "pending" | "accepted" | "rejected" | "waitlisted")
    );
  }

  const speakers = await db.query.speakerApplications.findMany({
    where: and(...conditions),
    orderBy: desc(speakerApplications.createdAt),
    limit,
  });

  return NextResponse.json({ data: speakers });
}

export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "speaker", "create");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const { name, email, bio, company, title, talkTitle, talkAbstract, talkType, trackPreference, source, assignedTo } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const [speaker] = await db
    .insert(speakerApplications)
    .values({
      editionId: ctx.editionId,
      organizationId: ctx.orgId,
      name,
      email: email || "",
      bio: bio || null,
      company: company || null,
      title: title || null,
      talkTitle: talkTitle || "TBD",
      talkAbstract: talkAbstract || null,
      talkType: ["talk", "workshop", "panel", "keynote", "break", "networking"].includes(talkType) ? talkType : "talk",
      trackPreference: trackPreference || null,
      source: source || "intake",
      assignedTo: assignedTo || null,
    })
    .returning();

  // Queue event for bot notifications
  await db.insert(eventQueue).values({
    organizationId: ctx.orgId,
    eventType: "speaker_application_submitted",
    payload: { speakerId: speaker.id, editionId: ctx.editionId },
  });

  return NextResponse.json({ data: speaker }, { status: 201 });
}

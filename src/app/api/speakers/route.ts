import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { speakerApplications, eventQueue } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getApiContext, paginationParams } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  const ctx = await getApiContext(req);
  if (ctx instanceof NextResponse) return ctx;

  const url = new URL(req.url);
  const editionId = url.searchParams.get("editionId");
  const status = url.searchParams.get("status");
  const { limit } = paginationParams(req);

  if (!editionId) {
    return NextResponse.json(
      { error: "editionId is required" },
      { status: 400 }
    );
  }

  const conditions = [
    eq(speakerApplications.editionId, editionId),
    eq(speakerApplications.organizationId, ctx.organizationId),
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
  const body = await req.json();
  const { name, email, bio, company, title, talkTitle, talkAbstract, talkType, trackPreference, source, assignedTo } = body;

  // Resolve editionId/organizationId — use provided values or fall back to active edition
  let editionId = body.editionId;
  let organizationId = body.organizationId;

  if (!editionId || !organizationId || editionId === "active" || organizationId === "dev") {
    const { getActiveIds } = await import("@/lib/queries");
    const ids = await getActiveIds();
    if (ids) {
      editionId = editionId && editionId !== "active" ? editionId : ids.editionId;
      organizationId = organizationId && organizationId !== "dev" ? organizationId : ids.orgId;
    }
  }

  if (!editionId || !organizationId || !name) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }

  const [speaker] = await db
    .insert(speakerApplications)
    .values({
      editionId,
      organizationId,
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

  // Queue event for OpenClaw agent
  await db.insert(eventQueue).values({
    organizationId,
    eventType: "speaker_application_submitted",
    payload: { speakerId: speaker.id, editionId },
  });

  return NextResponse.json({ data: speaker }, { status: 201 });
}

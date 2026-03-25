import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { eventEditions, eventSeries, tracks } from "@/db/schema";
import { requirePermission, isRbacError } from "@/lib/rbac";

export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "edition", "create");
  if (isRbacError(ctx)) return ctx;
  const ids = { orgId: ctx.orgId, editionId: ctx.editionId };

  const body = await req.json();
  const { name, startDate, endDate, venue } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Find or create series for this org
  let series = await db.query.eventSeries.findFirst({
    where: (s, { eq }) => eq(s.organizationId, ids.orgId),
  });

  if (!series) {
    const [newSeries] = await db
      .insert(eventSeries)
      .values({
        organizationId: ids.orgId,
        name: name.replace(/\s*\d{4}$/, ""),
        slug: slug.replace(/-\d{4}$/, ""),
      })
      .returning();
    series = newSeries;
  }

  // Create the edition
  const [edition] = await db
    .insert(eventEditions)
    .values({
      seriesId: series.id,
      organizationId: ids.orgId,
      name,
      slug,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      venue: venue || null,
      status: "draft",
      agendaStatus: "draft",
      cfpOpen: false,
    })
    .returning();

  // Create default tracks
  await db.insert(tracks).values([
    { editionId: edition.id, name: "Main Stage", color: "#eab308", sortOrder: 0 },
    { editionId: edition.id, name: "Workshop Room", color: "#047857", sortOrder: 1 },
  ]);

  return NextResponse.json({ data: edition }, { status: 201 });
}

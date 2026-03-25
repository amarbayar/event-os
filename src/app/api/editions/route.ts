import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { eventEditions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "edition", "read");
  if (isRbacError(ctx)) return ctx;

  const editions = await db.query.eventEditions.findMany({
    where: eq(eventEditions.organizationId, ctx.orgId),
    orderBy: desc(eventEditions.createdAt),
    with: { series: true, organization: true },
  });

  return NextResponse.json({
    data: editions.map((e) => ({
      id: e.id,
      name: e.name,
      slug: e.slug,
      startDate: e.startDate,
      endDate: e.endDate,
      venue: e.venue,
      status: e.status,
      organizationName: e.organization?.name,
      seriesName: e.series?.name,
    })),
    activeEditionId: ctx.editionId || null,
  });
}

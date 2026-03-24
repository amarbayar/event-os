import { NextResponse } from "next/server";
import { db } from "@/db";
import { eventEditions } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const editions = await db.query.eventEditions.findMany({
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
  });
}

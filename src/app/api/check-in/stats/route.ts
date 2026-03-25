import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attendees } from "@/db/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "attendee", "read");
  if (isRbacError(ctx)) return ctx;

  const url = new URL(req.url);
  const editionId = url.searchParams.get("editionId");

  if (!editionId) {
    return NextResponse.json({ error: "editionId required" }, { status: 400 });
  }

  const [stats] = await db
    .select({
      total: count(),
      checkedIn: count(
        sql`CASE WHEN ${attendees.checkedIn} = true THEN 1 END`
      ),
    })
    .from(attendees)
    .where(
      and(
        eq(attendees.editionId, editionId),
        eq(attendees.organizationId, ctx.orgId)
      )
    );

  const total = Number(stats.total);
  const checkedIn = Number(stats.checkedIn);

  return NextResponse.json({
    data: {
      total,
      checkedIn,
      remaining: total - checkedIn,
      percentage: total > 0 ? Math.round((checkedIn / total) * 100) : 0,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teams } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

// GET — list teams for the current edition
export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "task", "read");
  if (isRbacError(ctx)) return ctx;

  const rows = await db.query.teams.findMany({
    where: eq(teams.editionId, ctx.editionId),
    orderBy: asc(teams.sortOrder),
  });

  return NextResponse.json({ data: rows });
}

// POST — create a new team for the current edition
export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "task", "create");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const { name, color } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const [team] = await db
    .insert(teams)
    .values({
      editionId: ctx.editionId,
      organizationId: ctx.orgId,
      name,
      color: color || "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0"),
      sortOrder: 0,
    })
    .returning();

  return NextResponse.json({ data: team }, { status: 201 });
}

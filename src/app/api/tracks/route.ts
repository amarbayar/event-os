import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { isRbacError, requirePermission } from "@/lib/rbac";

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function integerValue(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function colorValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return "__invalid__";
  const color = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "__invalid__";
}

export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "session", "read");
  if (isRbacError(ctx)) return ctx;

  const rows = await db.query.tracks.findMany({
    where: eq(tracks.editionId, ctx.editionId),
    orderBy: [asc(tracks.sortOrder), asc(tracks.name)],
  });

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "session", "create");
  if (isRbacError(ctx)) return ctx;

  const body = (await req.json()) as Record<string, unknown>;
  const name = stringValue(body.name);
  const color = colorValue(body.color);
  const sortOrder = integerValue(body.sortOrder) ?? 0;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (color === "__invalid__") {
    return NextResponse.json(
      { error: "color must be a hex value like #0ea5e9" },
      { status: 400 },
    );
  }

  const [track] = await db
    .insert(tracks)
    .values({
      editionId: ctx.editionId,
      name,
      color,
      sortOrder,
    })
    .returning();

  return NextResponse.json({ data: track }, { status: 201 });
}

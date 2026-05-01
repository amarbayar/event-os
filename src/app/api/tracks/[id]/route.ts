import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "session", "update");
  if (isRbacError(ctx)) return ctx;

  const existing = await db.query.tracks.findFirst({
    where: and(eq(tracks.id, id), eq(tracks.editionId, ctx.editionId)),
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = stringValue(body.name);
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    updates.name = name;
  }

  if (body.color !== undefined) {
    const color = colorValue(body.color);
    if (color === "__invalid__") {
      return NextResponse.json(
        { error: "color must be a hex value like #0ea5e9" },
        { status: 400 },
      );
    }
    updates.color = color;
  }

  if (body.sortOrder !== undefined) {
    const sortOrder = integerValue(body.sortOrder);
    if (sortOrder === null) {
      return NextResponse.json({ error: "sortOrder must be an integer" }, { status: 400 });
    }
    updates.sortOrder = sortOrder;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(tracks)
    .set(updates)
    .where(and(eq(tracks.id, id), eq(tracks.editionId, ctx.editionId)))
    .returning();

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "session", "delete");
  if (isRbacError(ctx)) return ctx;

  const existing = await db.query.tracks.findFirst({
    where: and(eq(tracks.id, id), eq(tracks.editionId, ctx.editionId)),
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [deleted] = await db
    .delete(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.editionId, ctx.editionId)))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { id } });
}

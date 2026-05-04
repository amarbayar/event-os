import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { ticketTypes } from "@/db/schema";
import { isRbacError, requirePermission } from "@/lib/rbac";

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function integerValue(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function dateValue(value: unknown): Date | null | "__invalid__" {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return "__invalid__";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "__invalid__" : date;
}

function validateSlug(slug: string) {
  return /^[a-z0-9-]{1,100}$/.test(slug);
}

async function findTicket(id: string, editionId: string, organizationId: string) {
  return db.query.ticketTypes.findFirst({
    where: and(
      eq(ticketTypes.id, id),
      eq(ticketTypes.editionId, editionId),
      eq(ticketTypes.organizationId, organizationId),
    ),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "ticket", "update");
  if (isRbacError(ctx)) return ctx;

  const existing = await findTicket(id, ctx.editionId, ctx.orgId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = stringValue(body.name);
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    updates.name = name;
  }

  if (body.slug !== undefined) {
    const slug = stringValue(body.slug)?.toLowerCase();
    if (!slug || !validateSlug(slug)) {
      return NextResponse.json(
        { error: "slug must contain only lowercase letters, numbers, and hyphens" },
        { status: 400 },
      );
    }
    updates.slug = slug;
  }

  if (body.description !== undefined) {
    updates.description = stringValue(body.description);
  }

  if (body.price !== undefined) {
    const price = integerValue(body.price);
    if (price === null || price < 0) {
      return NextResponse.json(
        { error: "price must be a non-negative integer" },
        { status: 400 },
      );
    }
    updates.price = price;
  }

  if (body.currency !== undefined) {
    const currency = stringValue(body.currency)?.toUpperCase();
    if (!currency || !/^[A-Z]{3,8}$/.test(currency)) {
      return NextResponse.json({ error: "currency is invalid" }, { status: 400 });
    }
    updates.currency = currency;
  }

  if (body.capacity !== undefined) {
    const capacity = integerValue(body.capacity);
    if (body.capacity !== null && (capacity === null || capacity < 0)) {
      return NextResponse.json({ error: "capacity must be a whole number" }, { status: 400 });
    }
    const nextCapacity = body.capacity === null ? null : capacity;
    const committed = existing.soldCount + existing.reservedCount;
    if (nextCapacity !== null && nextCapacity < committed) {
      return NextResponse.json(
        { error: "capacity cannot be below already sold or reserved tickets" },
        { status: 400 },
      );
    }
    updates.capacity = nextCapacity;
  }

  if (body.maxPerOrder !== undefined) {
    const maxPerOrder = integerValue(body.maxPerOrder);
    if (maxPerOrder === null || maxPerOrder < 1 || maxPerOrder > 50) {
      return NextResponse.json(
        { error: "maxPerOrder must be between 1 and 50" },
        { status: 400 },
      );
    }
    updates.maxPerOrder = maxPerOrder;
  }

  for (const key of ["saleStartsAt", "saleEndsAt"] as const) {
    if (body[key] !== undefined) {
      const date = dateValue(body[key]);
      if (date === "__invalid__") {
        return NextResponse.json({ error: `${key} is invalid` }, { status: 400 });
      }
      updates[key] = date;
    }
  }

  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") {
      return NextResponse.json({ error: "active must be true or false" }, { status: 400 });
    }
    updates.active = body.active;
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

  updates.updatedAt = new Date();

  const [updated] = await db
    .update(ticketTypes)
    .set(updates)
    .where(
      and(
        eq(ticketTypes.id, id),
        eq(ticketTypes.editionId, ctx.editionId),
        eq(ticketTypes.organizationId, ctx.orgId),
      ),
    )
    .returning();

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "ticket", "delete");
  if (isRbacError(ctx)) return ctx;

  const existing = await findTicket(id, ctx.editionId, ctx.orgId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.soldCount > 0 || existing.reservedCount > 0) {
    return NextResponse.json(
      { error: "Ticket type has sales or reservations. Deactivate it instead." },
      { status: 409 },
    );
  }

  const [deleted] = await db
    .delete(ticketTypes)
    .where(
      and(
        eq(ticketTypes.id, id),
        eq(ticketTypes.editionId, ctx.editionId),
        eq(ticketTypes.organizationId, ctx.orgId),
      ),
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { id } });
}

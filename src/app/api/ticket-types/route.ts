import { NextRequest, NextResponse } from "next/server";
import { asc, and, eq } from "drizzle-orm";
import { db } from "@/db";
import { ticketTypes } from "@/db/schema";
import { isRbacError, requirePermission } from "@/lib/rbac";

const FORBIDDEN_CREATE_FIELDS = new Set([
  "id",
  "editionId",
  "organizationId",
  "soldCount",
  "reservedCount",
]);

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function integerValue(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function dateValue(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "ticket", "read");
  if (isRbacError(ctx)) return ctx;

  const rows = await db.query.ticketTypes.findMany({
    where: and(
      eq(ticketTypes.editionId, ctx.editionId),
      eq(ticketTypes.organizationId, ctx.orgId),
    ),
    orderBy: [asc(ticketTypes.sortOrder), asc(ticketTypes.price)],
  });

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "ticket", "create");
  if (isRbacError(ctx)) return ctx;

  const body = (await req.json()) as Record<string, unknown>;
  for (const field of FORBIDDEN_CREATE_FIELDS) {
    if (body[field] !== undefined) {
      return NextResponse.json(
        { error: "Ticket identity and sales counters are server-controlled" },
        { status: 400 },
      );
    }
  }

  const name = stringValue(body.name);
  const slug = stringValue(body.slug)?.toLowerCase();
  const price = integerValue(body.price);
  const currency = (stringValue(body.currency) || "MNT").toUpperCase();

  if (!name || !slug || price === null || price < 0) {
    return NextResponse.json(
      { error: "name, slug, and non-negative integer price are required" },
      { status: 400 },
    );
  }

  if (!/^[a-z0-9-]{1,100}$/.test(slug)) {
    return NextResponse.json(
      { error: "slug must contain only lowercase letters, numbers, and hyphens" },
      { status: 400 },
    );
  }

  const capacity = integerValue(body.capacity);
  const maxPerOrder = integerValue(body.maxPerOrder) ?? 10;
  if ((capacity !== null && capacity < 0) || maxPerOrder < 1 || maxPerOrder > 50) {
    return NextResponse.json(
      { error: "capacity and maxPerOrder are invalid" },
      { status: 400 },
    );
  }

  const [ticket] = await db
    .insert(ticketTypes)
    .values({
      editionId: ctx.editionId,
      organizationId: ctx.orgId,
      name,
      slug,
      description: stringValue(body.description),
      price,
      currency,
      capacity,
      soldCount: 0,
      reservedCount: 0,
      maxPerOrder,
      saleStartsAt: dateValue(body.saleStartsAt),
      saleEndsAt: dateValue(body.saleEndsAt),
      active: typeof body.active === "boolean" ? body.active : true,
      sortOrder: integerValue(body.sortOrder) ?? 0,
    })
    .returning();

  return NextResponse.json({ data: ticket }, { status: 201 });
}

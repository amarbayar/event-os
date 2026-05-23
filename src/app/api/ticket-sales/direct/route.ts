import { NextRequest, NextResponse } from "next/server";
import { isRbacError, requirePermission } from "@/lib/rbac";
import { createDirectTicketSale } from "@/lib/ticketing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORBIDDEN_FIELDS = new Set(["amount", "price", "total", "totalAmount", "currency"]);
const ALLOWED_FIELDS = new Set([
  "ticketTypeId",
  "quantity",
  "purchaser",
  "paymentMethod",
  "paymentReference",
  "notes",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "ticket", "create");
  if (isRbacError(ctx)) return ctx;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isPlainObject(body)) {
    return NextResponse.json({ error: "Invalid direct sale body" }, { status: 400 });
  }

  for (const field of Object.keys(body)) {
    if (FORBIDDEN_FIELDS.has(field)) {
      return NextResponse.json(
        { error: `${field} is calculated by the server and cannot be supplied` },
        { status: 400 },
      );
    }
    if (!ALLOWED_FIELDS.has(field)) {
      return NextResponse.json(
        { error: `Unexpected direct sale field: ${field}` },
        { status: 400 },
      );
    }
  }

  if (!isPlainObject(body.purchaser)) {
    return NextResponse.json({ error: "purchaser is required" }, { status: 400 });
  }

  const purchaser = body.purchaser;
  const result = await createDirectTicketSale({
    editionId: ctx.editionId,
    organizationId: ctx.orgId,
    ticketTypeId: stringValue(body.ticketTypeId) || "",
    quantity: Number(body.quantity),
    purchaser: {
      name: stringValue(purchaser.name) || "",
      email: stringValue(purchaser.email) || "",
      phone: stringValue(purchaser.phone),
      company: stringValue(purchaser.company),
      purchaserType: purchaser.purchaserType === "company" ? "company" : "individual",
      companyRegistrationNumber: stringValue(purchaser.companyRegistrationNumber),
    },
    paymentMethod: stringValue(body.paymentMethod) as Parameters<typeof createDirectTicketSale>[0]["paymentMethod"],
    paymentReference: stringValue(body.paymentReference),
    notes: stringValue(body.notes),
    createdBy: {
      id: ctx.user.id,
      name: ctx.user.name,
      email: ctx.user.email,
    },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      data: {
        order: {
          id: result.order.id,
          status: result.order.status,
          totalAmount: result.order.totalAmount,
          currency: result.order.currency,
          paidAt: result.order.paidAt,
          fulfilledAt: result.order.fulfilledAt,
        },
        attendees: result.attendees.map((attendee) => ({
          id: attendee.id,
          name: attendee.name,
          email: attendee.email,
          ticketType: attendee.ticketType,
          qrHash: attendee.qrHash,
          checkedIn: attendee.checkedIn,
        })),
      },
    },
    { status: 201 },
  );
}

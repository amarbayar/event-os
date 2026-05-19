import { NextRequest } from "next/server";
import {
  checkPublicRateLimit,
  corsJson,
  corsOptions,
} from "@/lib/public-api";
import { isBonumEnabled } from "@/lib/payments/bonum";
import { createBonumTicketCheckout } from "@/lib/ticketing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORBIDDEN_CLIENT_FIELDS = ["amount", "price", "total", "totalAmount", "currency"];
const ALLOWED_FIELDS = new Set(["ticketTypeId", "ticketTypeSlug", "quantity", "purchaser"]);
const ALLOWED_PURCHASER_FIELDS = new Set([
  "name",
  "email",
  "phone",
  "company",
  "purchaserType",
  "companyRegistrationNumber",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasUnsafeText(value: string): boolean {
  return /[\u0000-\u001f<>]/.test(value);
}

function validatePublicCheckoutBody(body: Record<string, unknown>): string | null {
  for (const field of Object.keys(body)) {
    if (FORBIDDEN_CLIENT_FIELDS.includes(field)) {
      return `${field} is calculated by the server and cannot be supplied`;
    }
    if (!ALLOWED_FIELDS.has(field)) {
      return `Unexpected checkout field: ${field}`;
    }
  }

  if (body.ticketTypeId !== undefined && typeof body.ticketTypeId !== "string") {
    return "ticketTypeId is invalid";
  }
  if (typeof body.ticketTypeId === "string" && !/^[0-9a-f-]{36}$/i.test(body.ticketTypeId)) {
    return "ticketTypeId is invalid";
  }
  if (body.ticketTypeSlug !== undefined && typeof body.ticketTypeSlug !== "string") {
    return "ticketTypeSlug is invalid";
  }
  if (typeof body.ticketTypeSlug === "string" && !/^[a-z0-9][a-z0-9-]{0,99}$/.test(body.ticketTypeSlug)) {
    return "ticketTypeSlug is invalid";
  }

  if (!Number.isInteger(Number(body.quantity))) return "quantity is invalid";
  if (!isPlainObject(body.purchaser)) return "purchaser is required";

  for (const field of Object.keys(body.purchaser)) {
    if (!ALLOWED_PURCHASER_FIELDS.has(field)) {
      return `purchaser.${field} is not allowed`;
    }
  }

  const purchaser = body.purchaser;
  const name = typeof purchaser.name === "string" ? purchaser.name.trim() : "";
  const email = typeof purchaser.email === "string" ? purchaser.email.trim() : "";
  const phone = typeof purchaser.phone === "string" ? purchaser.phone.trim() : "";
  const company = typeof purchaser.company === "string" ? purchaser.company.trim() : "";
  const purchaserType = purchaser.purchaserType === "company" ? "company" : "individual";
  const companyRegistrationNumber =
    typeof purchaser.companyRegistrationNumber === "string"
      ? purchaser.companyRegistrationNumber.trim()
      : "";

  if (name.length < 2 || name.length > 120 || hasUnsafeText(name)) return "purchaser.name is invalid";
  if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || hasUnsafeText(email)) {
    return "purchaser.email is invalid";
  }
  if (phone && (phone.length > 30 || !/^[0-9+\-() ]+$/.test(phone))) return "purchaser.phone is invalid";
  if (company && (company.length > 120 || hasUnsafeText(company))) return "purchaser.company is invalid";
  if (
    purchaser.purchaserType !== undefined &&
    purchaser.purchaserType !== "individual" &&
    purchaser.purchaserType !== "company"
  ) {
    return "purchaser.purchaserType is invalid";
  }
  if (purchaserType === "company" && companyRegistrationNumber.length < 2) {
    return "purchaser.companyRegistrationNumber is required";
  }
  if (
    companyRegistrationNumber &&
    (companyRegistrationNumber.length > 50 || hasUnsafeText(companyRegistrationNumber))
  ) {
    return "purchaser.companyRegistrationNumber is invalid";
  }

  return null;
}

export async function OPTIONS(req: NextRequest) {
  return corsOptions(req);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const rate = checkPublicRateLimit(req, {
    keyPrefix: "ticket-checkout",
    limit: 10,
    windowMs: 60_000,
  });

  if (!rate.allowed) {
    return corsJson(
      req,
      { error: "Too many checkout attempts", resetAt: rate.resetAt },
      { status: 429 },
    );
  }

  if (!isBonumEnabled()) {
    return corsJson(req, { error: "Bonum is not configured" }, { status: 503 });
  }

  const { slug } = await params;
  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return corsJson(req, { error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isPlainObject(body)) {
    return corsJson(req, { error: "Invalid checkout body" }, { status: 400 });
  }

  const validationError = validatePublicCheckoutBody(body);
  if (validationError) {
    return corsJson(req, { error: validationError }, { status: 400 });
  }

  const purchaser = body.purchaser as
    | {
        name?: string;
        email?: string;
        phone?: string;
        company?: string;
        purchaserType?: "individual" | "company";
        companyRegistrationNumber?: string;
      }
    | undefined;

  try {
    const result = await createBonumTicketCheckout({
      eventSlug: slug,
      ticketTypeId:
        typeof body.ticketTypeId === "string" ? body.ticketTypeId : undefined,
      ticketTypeSlug:
        typeof body.ticketTypeSlug === "string" ? body.ticketTypeSlug : undefined,
      quantity: Number(body.quantity),
      purchaser: {
        name: purchaser?.name || "",
        email: purchaser?.email || "",
        phone: purchaser?.phone,
        company: purchaser?.company,
        purchaserType: purchaser?.purchaserType === "company" ? "company" : "individual",
        companyRegistrationNumber: purchaser?.companyRegistrationNumber,
      },
      request: req,
      idempotencyKey: req.headers.get("idempotency-key"),
    });

    if (!result.ok) {
      return corsJson(req, { error: result.error }, { status: result.status });
    }

    return corsJson(
      req,
      {
        data: {
          orderId: result.order.id,
          status: result.order.status,
          checkoutUrl: result.checkoutUrl,
          expiresAt: result.order.expiresAt,
          customerAccessToken: result.customerAccessToken,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Ticket checkout failed:", error);
    return corsJson(req, { error: "Checkout failed" }, { status: 502 });
  }
}

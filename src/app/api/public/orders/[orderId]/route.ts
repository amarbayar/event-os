import { NextRequest } from "next/server";
import {
  checkPublicRateLimit,
  corsJson,
  corsOptions,
} from "@/lib/public-api";
import { getPublicTicketOrder } from "@/lib/ticketing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return corsOptions(req);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const rate = checkPublicRateLimit(req, {
    keyPrefix: "ticket-order-status",
    limit: 60,
    windowMs: 60_000,
  });

  if (!rate.allowed) {
    return corsJson(
      req,
      { error: "Too many order status requests", resetAt: rate.resetAt },
      { status: 429 },
    );
  }

  const { orderId } = await params;
  const order = await getPublicTicketOrder(
    orderId,
    req.nextUrl.searchParams.get("accessToken"),
  );

  if (!order) {
    return corsJson(req, { error: "Order not found" }, { status: 404 });
  }

  return corsJson(req, { data: order });
}

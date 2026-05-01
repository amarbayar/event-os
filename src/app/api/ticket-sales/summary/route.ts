import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { ticketOrderItems, ticketOrders, ticketTypes } from "@/db/schema";
import { isRbacError, requirePermission } from "@/lib/rbac";

type TicketTypeRow = typeof ticketTypes.$inferSelect;
type TicketOrderRow = typeof ticketOrders.$inferSelect;
type TicketOrderItemRow = typeof ticketOrderItems.$inferSelect;

function incrementStatus(counts: Record<string, number>, status: string) {
  counts[status] = (counts[status] || 0) + 1;
}

export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "ticket", "read");
  if (isRbacError(ctx)) return ctx;

  const [types, orders] = await Promise.all([
    db.query.ticketTypes.findMany({
      where: and(
        eq(ticketTypes.editionId, ctx.editionId),
        eq(ticketTypes.organizationId, ctx.orgId),
      ),
      orderBy: [asc(ticketTypes.sortOrder), asc(ticketTypes.price)],
    }),
    db.query.ticketOrders.findMany({
      where: and(
        eq(ticketOrders.editionId, ctx.editionId),
        eq(ticketOrders.organizationId, ctx.orgId),
      ),
    }),
  ]);

  const typedOrders = orders as TicketOrderRow[];
  const orderIds = typedOrders.map((order) => order.id);
  const items = orderIds.length
    ? ((await db.query.ticketOrderItems.findMany({
        where: inArray(ticketOrderItems.orderId, orderIds),
      })) as TicketOrderItemRow[])
    : [];

  const paidOrderIds = new Set(
    typedOrders.filter((order) => order.status === "paid").map((order) => order.id),
  );
  const statusCounts: Record<string, number> = {};
  for (const order of typedOrders) {
    incrementStatus(statusCounts, order.status);
  }

  const grossPaidAmount = typedOrders
    .filter((order) => order.status === "paid")
    .reduce((total, order) => total + order.totalAmount, 0);
  const currency =
    typedOrders.find((order) => order.currency)?.currency ||
    (types as TicketTypeRow[]).find((ticket) => ticket.currency)?.currency ||
    "MNT";

  const paidByTicketType = new Map<
    string,
    { paidQuantity: number; paidAmount: number }
  >();
  for (const item of items) {
    if (!paidOrderIds.has(item.orderId)) continue;
    const current = paidByTicketType.get(item.ticketTypeId) || {
      paidQuantity: 0,
      paidAmount: 0,
    };
    current.paidQuantity += item.quantity;
    current.paidAmount += item.totalAmount;
    paidByTicketType.set(item.ticketTypeId, current);
  }

  const byTicketType = (types as TicketTypeRow[]).map((ticket) => {
    const paid = paidByTicketType.get(ticket.id) || {
      paidQuantity: 0,
      paidAmount: 0,
    };
    return {
      ticketTypeId: ticket.id,
      name: ticket.name,
      slug: ticket.slug,
      capacity: ticket.capacity,
      soldCount: ticket.soldCount,
      reservedCount: ticket.reservedCount,
      remaining:
        ticket.capacity === null
          ? null
          : Math.max(ticket.capacity - ticket.soldCount - ticket.reservedCount, 0),
      paidQuantity: paid.paidQuantity,
      paidAmount: paid.paidAmount,
    };
  });

  return NextResponse.json({
    data: {
      currency,
      grossPaidAmount,
      paidOrders: statusCounts.paid || 0,
      pendingOrders: statusCounts.pending || 0,
      failedOrders: statusCounts.failed || 0,
      expiredOrders: statusCounts.expired || 0,
      cancelledOrders: statusCounts.cancelled || 0,
      ticketsSold: (types as TicketTypeRow[]).reduce(
        (total, ticket) => total + ticket.soldCount,
        0,
      ),
      ticketsReserved: (types as TicketTypeRow[]).reduce(
        (total, ticket) => total + ticket.reservedCount,
        0,
      ),
      byTicketType,
    },
  });
}

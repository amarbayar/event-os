import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { and, asc, eq, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  attendees,
  ticketOrderItems,
  ticketOrders,
  ticketTypes,
} from "@/db/schema";
import { absoluteAppUrl } from "@/lib/app-url";
import {
  BonumWebhookPayload,
  createBonumInvoice,
  getBonumInvoiceStatus,
  getBonumTerminalId,
} from "@/lib/payments/bonum";
import { resolveEvent } from "@/lib/resolve-event";
import { postTicketSaleDiscordMessage } from "@/lib/ticket-sales-discord";

const DEFAULT_INVOICE_EXPIRY_SECONDS = 20 * 60;

type TicketTypeRow = typeof ticketTypes.$inferSelect;
type TicketOrderItemRow = typeof ticketOrderItems.$inferSelect;
type DbLike = typeof db;

export type CheckoutInput = {
  eventSlug: string;
  ticketTypeId?: string;
  ticketTypeSlug?: string;
  quantity: number;
  purchaser: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    purchaserType?: "individual" | "company";
    companyRegistrationNumber?: string;
  };
  request: Request;
  idempotencyKey?: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateTransactionId(): string {
  return `eos_${randomBytes(16).toString("hex")}`;
}

function generateCustomerAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashCustomerAccessToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function verifyCustomerAccessToken(token: string | null | undefined, hash: string | null): boolean {
  if (!token || !hash) return false;
  const candidate = hashCustomerAccessToken(token);
  if (candidate.length !== hash.length) return false;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}

async function ticketingTransaction<T>(callback: (tx: DbLike) => Promise<T>): Promise<T> {
  const transaction = db.transaction as unknown as { mock?: unknown; _isMockFunction?: boolean };
  const isMockedTransaction = Boolean(transaction?.mock || transaction?._isMockFunction);
  if ((process.env.DB_DIALECT === "sqlite" || process.env.SQLITE_PATH) && !isMockedTransaction) {
    return callback(db);
  }

  return db.transaction(async (tx: DbLike) => callback(tx));
}

function generateQrHash(input: string): string {
  return createHash("sha256")
    .update(`${input}-${randomBytes(16).toString("hex")}`)
    .digest("hex")
    .slice(0, 32);
}

function parseProviderList(value: string | undefined): string[] | undefined {
  const providers = value
    ?.split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return providers?.length ? providers : undefined;
}

function bonumCallbackUrl(request: Request, orderId: string, transactionId: string): string {
  const url = new URL(absoluteAppUrl("/api/payments/bonum/webhook", request));
  url.searchParams.set("orderId", orderId);
  url.searchParams.set("txn", transactionId);
  return url.toString();
}

function validateCheckoutInput(input: CheckoutInput): string | null {
  if (!input.ticketTypeId && !input.ticketTypeSlug) return "ticketTypeId or ticketTypeSlug is required";
  if (!Number.isInteger(input.quantity) || input.quantity < 1) return "quantity must be a positive integer";
  if (input.quantity > 10) return "quantity cannot exceed 10";

  const name = input.purchaser.name?.trim();
  const email = input.purchaser.email?.trim();
  if (!name || name.length < 2 || name.length > 255) return "purchaser.name is invalid";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "purchaser.email is invalid";
  if (input.purchaser.phone && input.purchaser.phone.length > 50) return "purchaser.phone is too long";
  if (input.purchaser.company && input.purchaser.company.length > 255) {
    return "purchaser.company is too long";
  }
  if (
    input.purchaser.purchaserType &&
    input.purchaser.purchaserType !== "individual" &&
    input.purchaser.purchaserType !== "company"
  ) {
    return "purchaser.purchaserType is invalid";
  }
  const purchaserType = input.purchaser.purchaserType || "individual";
  const companyRegistrationNumber = input.purchaser.companyRegistrationNumber?.trim() || "";
  if (purchaserType === "company" && companyRegistrationNumber.length < 2) {
    return "purchaser.companyRegistrationNumber is required";
  }
  if (companyRegistrationNumber.length > 50) {
    return "purchaser.companyRegistrationNumber is too long";
  }
  return null;
}

function checkoutFingerprint(input: CheckoutInput, ticketTypeId: string): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        ticketTypeId,
        ticketTypeSlug: input.ticketTypeSlug || null,
        quantity: input.quantity,
        purchaserName: input.purchaser.name.trim(),
        purchaserEmail: normalizeEmail(input.purchaser.email),
        purchaserPhone: input.purchaser.phone?.trim() || null,
        purchaserCompany: input.purchaser.company?.trim() || null,
        purchaserType: input.purchaser.purchaserType || "individual",
        companyRegistrationNumber: input.purchaser.companyRegistrationNumber?.trim() || null,
      }),
    )
    .digest("hex");
}

async function releaseOrderReservation(tx: typeof db, orderId: string) {
  const items = await tx.query.ticketOrderItems.findMany({
    where: eq(ticketOrderItems.orderId, orderId),
  });

  for (const item of items) {
    await tx
      .update(ticketTypes)
      .set({
        reservedCount: sql`case when ${ticketTypes.reservedCount} >= ${item.quantity} then ${ticketTypes.reservedCount} - ${item.quantity} else 0 end`,
        updatedAt: new Date(),
      })
      .where(eq(ticketTypes.id, item.ticketTypeId));
  }
}

export async function releaseExpiredTicketReservations() {
  const expired = await db.query.ticketOrders.findMany({
    where: and(
      eq(ticketOrders.status, "pending"),
      lt(ticketOrders.expiresAt, new Date()),
    ),
  });

  for (const order of expired) {
    await ticketingTransaction(async (tx) => {
      const current = await tx.query.ticketOrders.findFirst({
        where: and(
          eq(ticketOrders.id, order.id),
          eq(ticketOrders.status, "pending"),
          lt(ticketOrders.expiresAt, new Date()),
        ),
      });
      if (!current) return;

      await releaseOrderReservation(tx, current.id);
      await tx
        .update(ticketOrders)
        .set({
          status: "expired",
          updatedAt: new Date(),
        })
        .where(eq(ticketOrders.id, current.id));
    });
  }
}

export async function listPublicTicketTypes(eventSlug: string) {
  await releaseExpiredTicketReservations();

  const event = await resolveEvent(eventSlug);
  if (!event) return null;

  const now = new Date();
  const rows = await db.query.ticketTypes.findMany({
    where: and(eq(ticketTypes.editionId, event.editionId), eq(ticketTypes.active, true)),
    orderBy: [asc(ticketTypes.sortOrder), asc(ticketTypes.price)],
  });

  return {
    event,
    ticketTypes: rows
      .filter((ticket: TicketTypeRow) => {
        if (ticket.saleStartsAt && ticket.saleStartsAt > now) return false;
        if (ticket.saleEndsAt && ticket.saleEndsAt < now) return false;
        return true;
      })
      .map((ticket: TicketTypeRow) => ({
        id: ticket.id,
        name: ticket.name,
        slug: ticket.slug,
        description: ticket.description,
        price: ticket.price,
        currency: ticket.currency,
        capacity: ticket.capacity,
        soldCount: ticket.soldCount,
        reservedCount: ticket.reservedCount,
        available:
          ticket.capacity === null
            ? null
            : Math.max(ticket.capacity - ticket.soldCount - ticket.reservedCount, 0),
        maxPerOrder: ticket.maxPerOrder,
      })),
  };
}

export async function createBonumTicketCheckout(input: CheckoutInput) {
  const validationError = validateCheckoutInput(input);
  if (validationError) {
    return { ok: false as const, status: 400, error: validationError };
  }

  await releaseExpiredTicketReservations();

  const event = await resolveEvent(input.eventSlug);
  if (!event) {
    return { ok: false as const, status: 404, error: "Event not found" };
  }

  const purchaserEmail = normalizeEmail(input.purchaser.email);
  const transactionId = generateTransactionId();
  const expiresIn = Number(process.env.BONUM_INVOICE_EXPIRES_IN || DEFAULT_INVOICE_EXPIRY_SECONDS);
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  const orderData = await ticketingTransaction(async (tx) => {
    const ticket = await tx.query.ticketTypes.findFirst({
      where: and(
        eq(ticketTypes.editionId, event.editionId),
        input.ticketTypeId
          ? eq(ticketTypes.id, input.ticketTypeId)
          : eq(ticketTypes.slug, input.ticketTypeSlug!),
        eq(ticketTypes.active, true),
      ),
    });

    if (!ticket) {
      return { ok: false as const, status: 404, error: "Ticket type not found" };
    }

    const now = new Date();
    if (ticket.saleStartsAt && ticket.saleStartsAt > now) {
      return { ok: false as const, status: 409, error: "Ticket sales have not started" };
    }
    if (ticket.saleEndsAt && ticket.saleEndsAt < now) {
      return { ok: false as const, status: 409, error: "Ticket sales have ended" };
    }
    if (input.quantity > ticket.maxPerOrder) {
      return {
        ok: false as const,
        status: 400,
        error: `quantity cannot exceed ${ticket.maxPerOrder} for this ticket type`,
      };
    }

    const fingerprint = checkoutFingerprint(input, ticket.id);
    if (input.idempotencyKey) {
      const existing = await tx.query.ticketOrders.findFirst({
        where: and(
          eq(ticketOrders.editionId, event.editionId),
          eq(ticketOrders.idempotencyKey, input.idempotencyKey),
        ),
      });

      if (existing) {
        if (existing.status !== "pending" || (existing.expiresAt && existing.expiresAt < new Date())) {
          return { ok: false as const, status: 409, error: "Checkout attempt is no longer active" };
        }
        if (existing.metadata?.checkoutFingerprint !== fingerprint) {
          return { ok: false as const, status: 409, error: "Idempotency key was already used for a different checkout" };
        }
        return {
          ok: true as const,
          existing: true as const,
          order: existing,
          item: null,
          ticket,
          totalAmount: existing.totalAmount,
        };
      }
    }

    const [reservedTicket] = await tx
      .update(ticketTypes)
      .set({
        reservedCount: sql`${ticketTypes.reservedCount} + ${input.quantity}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(ticketTypes.id, ticket.id),
          eq(ticketTypes.active, true),
          or(
            sql`${ticketTypes.capacity} is null`,
            sql`${ticketTypes.capacity} - ${ticketTypes.soldCount} - ${ticketTypes.reservedCount} >= ${input.quantity}`,
          ),
        ),
      )
      .returning();

    if (!reservedTicket) {
      return { ok: false as const, status: 409, error: "Ticket type is sold out" };
    }

    const totalAmount = ticket.price * input.quantity;
    const customerAccessToken = generateCustomerAccessToken();
    const purchaserType = input.purchaser.purchaserType || "individual";
    const companyRegistrationNumber =
      purchaserType === "company"
        ? input.purchaser.companyRegistrationNumber?.trim() || null
        : null;
    const [order] = await tx
      .insert(ticketOrders)
      .values({
        editionId: event.editionId,
        organizationId: event.orgId,
        purchaserName: input.purchaser.name.trim(),
        purchaserEmail,
        purchaserPhone: input.purchaser.phone?.trim() || null,
        purchaserCompany: input.purchaser.company?.trim() || null,
        status: "pending",
        totalAmount,
        currency: ticket.currency,
        provider: "bonum",
        providerTransactionId: transactionId,
        quantity: input.quantity,
        idempotencyKey: input.idempotencyKey || null,
        customerAccessTokenHash: hashCustomerAccessToken(customerAccessToken),
        metadata: {
          checkoutFingerprint: fingerprint,
          purchaserType,
          companyRegistrationNumber,
        },
        expiresAt,
      })
      .returning();

    const [item] = await tx
      .insert(ticketOrderItems)
      .values({
        orderId: order.id,
        ticketTypeId: ticket.id,
        ticketTypeName: ticket.name,
        ticketTypeSlug: ticket.slug,
        unitAmount: ticket.price,
        totalAmount,
        currency: ticket.currency,
        quantity: input.quantity,
      })
      .returning();

    return { ok: true as const, existing: false as const, order, item, ticket, totalAmount, customerAccessToken };
  });

  if (!orderData.ok) return orderData;
  if (orderData.existing) {
    return {
      ok: true as const,
      order: orderData.order,
      checkoutUrl: orderData.order.checkoutUrl!,
    };
  }

  try {
    const invoice = await createBonumInvoice({
      amount: orderData.totalAmount,
      transactionId,
      callback: bonumCallbackUrl(input.request, orderData.order.id, transactionId),
      expiresIn,
      providers: parseProviderList(process.env.BONUM_DEFAULT_PROVIDERS),
      items: [
        {
          title: orderData.ticket.name,
          remark: `${event.name} ticket`,
          amount: orderData.ticket.price,
          count: input.quantity,
        },
      ],
    });

    const [updated] = await db
      .update(ticketOrders)
      .set({
        providerInvoiceId: invoice.invoiceId,
        checkoutUrl: invoice.followUpLink,
        updatedAt: new Date(),
      })
      .where(eq(ticketOrders.id, orderData.order.id))
      .returning();

    return {
      ok: true as const,
      order: updated,
      checkoutUrl: invoice.followUpLink,
      customerAccessToken: orderData.customerAccessToken,
    };
  } catch (error) {
    await ticketingTransaction(async (tx) => {
      await releaseOrderReservation(tx, orderData.order.id);
      await tx
        .update(ticketOrders)
        .set({
          status: "failed",
          metadata: {
            failure: error instanceof Error ? error.message : "Bonum invoice failed",
          },
          updatedAt: new Date(),
        })
        .where(eq(ticketOrders.id, orderData.order.id));
    });
    throw error;
  }
}

export async function getPublicTicketOrder(
  orderId: string,
  customerAccessToken?: string | null,
) {
  await releaseExpiredTicketReservations();

  const order = await db.query.ticketOrders.findFirst({
    where: eq(ticketOrders.id, orderId),
  });

  if (!order) return null;

  const items = await db.query.ticketOrderItems.findMany({
    where: eq(ticketOrderItems.orderId, order.id),
  });
  const canExposeTickets =
    order.status === "paid" &&
    verifyCustomerAccessToken(customerAccessToken, order.customerAccessTokenHash);
  const ticketRows = canExposeTickets
    ? await db.query.attendees.findMany({
        where: eq(attendees.ticketOrderId, order.id),
      })
    : [];

  return {
    id: order.id,
    status: order.status,
    totalAmount: order.totalAmount,
    currency: order.currency,
    checkoutUrl: order.checkoutUrl,
    expiresAt: order.expiresAt,
    paidAt: order.paidAt,
    fulfilledAt: order.fulfilledAt,
    items: (items as TicketOrderItemRow[]).map((item: TicketOrderItemRow) => ({
      ticketTypeName: item.ticketTypeName,
      ticketTypeSlug: item.ticketTypeSlug,
      quantity: item.quantity,
      unitAmount: item.unitAmount,
      totalAmount: item.totalAmount,
      currency: item.currency,
    })),
    ...(canExposeTickets
      ? {
          tickets: ticketRows.map((ticket: typeof attendees.$inferSelect) => ({
            id: ticket.id,
            name: ticket.name,
            email: ticket.email,
            ticketType: ticket.ticketType,
            qrHash: ticket.qrHash,
            checkedIn: ticket.checkedIn,
          })),
        }
      : {}),
  };
}

async function fulfillPaidOrder(orderId: string, paidAt: Date) {
  const fulfilled = await ticketingTransaction(async (tx) => {
    const order = await tx.query.ticketOrders.findFirst({
      where: eq(ticketOrders.id, orderId),
    });

    if (!order || order.fulfilledAt) return null;
    if (order.status !== "pending" && order.status !== "paid") return null;

    const items = await tx.query.ticketOrderItems.findMany({
      where: eq(ticketOrderItems.orderId, order.id),
    });

    for (const item of items) {
      await tx
        .update(ticketTypes)
        .set({
          soldCount: sql`${ticketTypes.soldCount} + ${item.quantity}`,
          reservedCount: sql`case when ${ticketTypes.reservedCount} >= ${item.quantity} then ${ticketTypes.reservedCount} - ${item.quantity} else 0 end`,
          updatedAt: new Date(),
        })
        .where(eq(ticketTypes.id, item.ticketTypeId));

      for (let i = 0; i < item.quantity; i++) {
        await tx.insert(attendees).values({
          editionId: order.editionId,
          organizationId: order.organizationId,
          ticketOrderId: order.id,
          ticketOrderItemId: item.id,
          name: order.purchaserName,
          email: order.purchaserEmail,
          ticketType: item.ticketTypeSlug,
          qrHash: generateQrHash(`${order.id}-${item.id}-${i}`),
          source: "ticket",
          stage: "confirmed",
        });
      }
    }

    await tx
      .update(ticketOrders)
      .set({
        status: "paid",
        paidAt,
        fulfilledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(ticketOrders.id, order.id));

    return { order, items: items as TicketOrderItemRow[] };
  });

  if (fulfilled) {
    await postTicketSaleDiscordMessage({
      orderId: fulfilled.order.id,
      purchaserName: fulfilled.order.purchaserName,
      purchaserEmail: fulfilled.order.purchaserEmail,
      totalAmount: fulfilled.order.totalAmount,
      currency: fulfilled.order.currency,
      paidAt,
      items: fulfilled.items.map((item) => ({
        ticketTypeName: item.ticketTypeName,
        quantity: item.quantity,
        totalAmount: item.totalAmount,
        currency: item.currency,
      })),
    });
  }
}

async function failPendingOrder(orderId: string, status: "failed" | "expired") {
  await ticketingTransaction(async (tx) => {
    const order = await tx.query.ticketOrders.findFirst({
      where: and(eq(ticketOrders.id, orderId), eq(ticketOrders.status, "pending")),
    });
    if (!order) return;

    await releaseOrderReservation(tx, order.id);
    await tx
      .update(ticketOrders)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(ticketOrders.id, order.id));
  });
}

export async function handleBonumTicketWebhook(payload: BonumWebhookPayload) {
  if (payload.type !== "PAYMENT") {
    return { ignored: true, reason: "Unsupported webhook type" };
  }

  const body = payload.body || {};
  const invoiceId = body.invoiceId;
  const transactionId = body.transactionId;
  if (!invoiceId && !transactionId) {
    return { ignored: true, reason: "Missing invoiceId and transactionId" };
  }

  const order = await db.query.ticketOrders.findFirst({
    where: and(
      eq(ticketOrders.provider, "bonum"),
      invoiceId
        ? eq(ticketOrders.providerInvoiceId, invoiceId)
        : eq(ticketOrders.providerTransactionId, transactionId!),
    ),
  });

  if (!order) {
    return { ignored: true, reason: "Order not found" };
  }

  const terminalId = getBonumTerminalId();
  if (terminalId && body.terminalId && body.terminalId !== terminalId) {
    return { ignored: true, reason: "Terminal mismatch" };
  }

  if (payload.status === "SUCCESS" && body.status === "PAID") {
    const paidAmount = Math.round(Number(body.amount));
    const currency = body.currency || order.currency;
    if (paidAmount !== order.totalAmount || currency !== order.currency) {
      await db
        .update(ticketOrders)
        .set({
          status: "failed",
          metadata: {
            failure: "Bonum paid amount or currency did not match order",
            receivedAmount: body.amount,
            receivedCurrency: body.currency,
          },
          updatedAt: new Date(),
        })
        .where(and(eq(ticketOrders.id, order.id), eq(ticketOrders.status, "pending")));
      return { ignored: true, reason: "Amount or currency mismatch" };
    }

    await fulfillPaidOrder(
      order.id,
      body.completedAt ? new Date(body.completedAt.replace(" ", "T")) : new Date(),
    );
    return { ok: true, orderId: order.id };
  }

  if (payload.status === "FAILED") {
    await failPendingOrder(
      order.id,
      body.invoiceStatus === "EXPIRED" ? "expired" : "failed",
    );
    return { ok: true, orderId: order.id };
  }

  return { ignored: true, reason: "Unhandled payment status" };
}

function statusToPaymentWebhook(
  order: typeof ticketOrders.$inferSelect,
  status: Record<string, unknown>,
): BonumWebhookPayload {
  const invoiceStatus = String(status.status || "");
  return {
    type: "PAYMENT",
    status: invoiceStatus === "PAID" ? "SUCCESS" : "FAILED",
    body: {
      amount: Number(status.amount),
      currency: typeof status.currency === "string" ? status.currency : order.currency,
      completedAt:
        typeof status.updatedAt === "string"
          ? status.updatedAt
          : typeof status.createdAt === "string"
            ? status.createdAt
            : undefined,
      invoiceId: order.providerInvoiceId || undefined,
      paymentVendor:
        typeof status.paymentVendor === "string" ? status.paymentVendor : undefined,
      status: invoiceStatus,
      transactionId:
        typeof status.transactionId === "string"
          ? status.transactionId
          : order.providerTransactionId || undefined,
      invoiceStatus,
    },
  };
}

export async function syncBonumTicketOrderFromProvider(input: {
  orderId?: string | null;
  transactionId?: string | null;
}) {
  if (!input.orderId && !input.transactionId) {
    return { ignored: true, reason: "Missing orderId and transactionId" };
  }

  const order = await db.query.ticketOrders.findFirst({
    where: and(
      eq(ticketOrders.provider, "bonum"),
      input.orderId
        ? eq(ticketOrders.id, input.orderId)
        : eq(ticketOrders.providerTransactionId, input.transactionId!),
    ),
  });

  if (!order) {
    return { ignored: true, reason: "Order not found" };
  }
  if (!order.providerInvoiceId) {
    return { ignored: true, reason: "Order is missing Bonum invoice id" };
  }
  if (
    input.transactionId &&
    order.providerTransactionId &&
    input.transactionId !== order.providerTransactionId
  ) {
    return { ignored: true, reason: "Transaction mismatch" };
  }
  if (order.status !== "pending") {
    return { ok: true, orderId: order.id };
  }

  const status = await getBonumInvoiceStatus(order.providerInvoiceId);
  return handleBonumTicketWebhook(statusToPaymentWebhook(order, status));
}

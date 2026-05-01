import { NextResponse } from "next/server";
import {
  BonumWebhookPayload,
  verifyBonumWebhookChecksum,
} from "@/lib/payments/bonum";
import {
  handleBonumTicketWebhook,
  syncBonumTicketOrderFromProvider,
} from "@/lib/ticketing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const returnUrl =
    process.env.PUBLIC_TICKET_RETURN_URL ||
    process.env.NEXT_PUBLIC_TICKET_RETURN_URL ||
    "http://localhost:5173/tickets";
  const requestUrl = new URL(req.url);
  const url = new URL(returnUrl);
  url.searchParams.set("payment", "return");
  const orderId = requestUrl.searchParams.get("orderId");
  if (orderId) url.searchParams.set("orderId", orderId);
  const transactionId = requestUrl.searchParams.get("txn");
  if (orderId || transactionId) {
    try {
      const result = await syncBonumTicketOrderFromProvider({ orderId, transactionId });
      if ("ok" in result && result.ok) {
        url.searchParams.set("payment", "paid");
      }
    } catch (error) {
      console.error("Bonum return reconciliation failed:", error);
    }
  }
  return NextResponse.redirect(url, 303);
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const checksum = req.headers.get("x-checksum-v2");

  if (!verifyBonumWebhookChecksum(rawBody, checksum)) {
    return NextResponse.json({ error: "Invalid checksum" }, { status: 401 });
  }

  let payload: BonumWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as BonumWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await handleBonumTicketWebhook(payload);
    return NextResponse.json({ received: true, result });
  } catch (error) {
    console.error("Bonum webhook failed:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}

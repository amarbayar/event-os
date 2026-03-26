import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

const SERVICE_TOKEN = process.env.SERVICE_TOKEN;

const ALLOWED_ROUTES = [
  "/api/speakers",
  "/api/sessions",
  "/api/check-in",
  "/api/event-queue",
];

export function validateServiceToken(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  if (!SERVICE_TOKEN) return false;
  const token = authHeader.slice(7);
  if (token.length !== SERVICE_TOKEN.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(SERVICE_TOKEN));
}

export function isServiceTokenRoute(pathname: string): boolean {
  return ALLOWED_ROUTES.some((route) => pathname.startsWith(route));
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

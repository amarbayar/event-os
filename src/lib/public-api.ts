import { NextRequest, NextResponse } from "next/server";

const buckets = new Map<string, { count: number; resetAt: number }>();
const DEVSUMMIT_PUBLIC_ORIGINS = [
  "https://devsummit.dev",
  "https://www.devsummit.dev",
  "https://devsummit-mn-conference.web.app",
  "https://devsummit-mn-conference.firebaseapp.com",
];

function allowedOrigins(): string[] {
  const configured = (process.env.PUBLIC_API_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (process.env.NODE_ENV === "production") {
    return [...configured, ...DEVSUMMIT_PUBLIC_ORIGINS];
  }
  return [
    ...configured,
    ...DEVSUMMIT_PUBLIC_ORIGINS,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ];
}

export function corsHeaders(req: NextRequest): HeadersInit {
  const origin = req.headers.get("origin");
  const allowed = allowedOrigins();
  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Idempotency-Key",
  };

  if (origin && (allowed.includes(origin) || allowed.includes("*"))) {
    headers["Access-Control-Allow-Origin"] = allowed.includes("*") ? "*" : origin;
  }

  return headers;
}

export function corsJson(
  req: NextRequest,
  body: unknown,
  init?: ResponseInit,
): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...corsHeaders(req),
      ...(init?.headers || {}),
    },
  });
}

export function corsOptions(req: NextRequest): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req),
  });
}

export function checkPublicRateLimit(
  req: NextRequest,
  options: { limit: number; windowMs: number; keyPrefix: string },
) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anonymous";
  const key = `${options.keyPrefix}:${ip}`;
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: options.limit - 1, resetAt: now + options.windowMs };
  }

  if (entry.count >= options.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { allowed: true, remaining: options.limit - entry.count, resetAt: entry.resetAt };
}

import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-utils";
import { getProvider, InputType } from "@/lib/agent";

// Simple in-memory rate limiter (per-process, resets on restart)
const rateLimiter = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30; // requests per minute
const RATE_WINDOW = 60_000; // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimiter.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimiter.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  // In development, allow unauthenticated access to the agent
  const isDev = process.env.NODE_ENV === "development";
  let orgId = "dev";

  if (!isDev) {
    const ctx = await getApiContext(req);
    if (ctx instanceof NextResponse) return ctx;
    orgId = ctx.organizationId;
  }

  const userId = orgId;
  if (!checkRateLimit(userId)) {
    return NextResponse.json(
      { error: "Rate limited. Please wait a moment." },
      { status: 429 }
    );
  }

  const body = await req.json();
  const { input, inputType, editionId, context } = body as {
    input: string;
    inputType: InputType;
    editionId: string;
    context?: string;
  };

  if (!input || !editionId) {
    return NextResponse.json(
      { error: "input and editionId are required" },
      { status: 400 }
    );
  }

  if (input.length > 50_000) {
    return NextResponse.json(
      { error: "Input too long. Maximum 50,000 characters." },
      { status: 400 }
    );
  }

  try {
    const provider = getProvider();
    const result = await provider.extract(
      input,
      inputType || "text",
      context
    );

    // Resolve real org/edition IDs for action payloads
    const { getActiveIds } = await import("@/lib/queries");
    const ids = await getActiveIds();
    const realOrgId = ids?.orgId || orgId;
    const realEditionId = ids?.editionId || editionId;

    // Inject organizationId and editionId into all action payloads
    const enrichedActions = result.actions.map((action) => ({
      ...action,
      payload: {
        ...action.payload,
        organizationId: realOrgId,
        editionId: realEditionId,
      },
    }));

    return NextResponse.json({
      data: {
        ...result,
        actions: enrichedActions,
      },
      provider: provider.name,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Agent processing failed";

    return NextResponse.json(
      {
        data: {
          message: "Agent temporarily unavailable. Try again or use manual add.",
          entities: [],
          actions: [],
          questions: [],
        },
        error: message,
      },
      { status: 502 }
    );
  }
}

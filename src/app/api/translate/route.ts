import { NextRequest, NextResponse } from "next/server";
import { translateText } from "@/lib/i18n/translate";
import { ratelimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "anonymous";

    const { success, limit, remaining, reset } = await ratelimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        {
          error: "Too many requests",
          limit,
          remaining,
          reset,
        },
        { status: 429 },
      );
    }

    const body = await req.json();
    const { text, target, source } = body;

    if (!text || !target) {
      return NextResponse.json(
        { error: "Missing text or target" },
        { status: 400 },
      );
    }

    if (typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "Invalid text" }, { status: 400 });
    }

    if (text.length > 500) {
      return NextResponse.json(
        { error: "Text too long (max 500 chars)" },
        { status: 400 },
      );
    }

    const translated = await translateText(text, {
      target,
      source,
    });

    return NextResponse.json({ translated });
  } catch (err) {
    console.error("API translate error:", err);

    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}

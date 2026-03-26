import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

const VALID_LANGUAGES = ["auto", "en", "mn", "ko", "ja", "zh", "ru"];
const VALID_MOODS = ["professional", "friendly", "sarcastic", "nerdy", "funny"];

// GET — current bot settings
export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "settings", "read");
  if (isRbacError(ctx)) return ctx;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, ctx.orgId),
    columns: { botLanguage: true, botMood: true },
  });

  return NextResponse.json({
    data: {
      language: org?.botLanguage || "auto",
      mood: org?.botMood || "professional",
    },
  });
}

// PATCH — update bot settings
export async function PATCH(req: NextRequest) {
  const ctx = await requirePermission(req, "settings", "update");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const updates: Record<string, string> = {};

  if (body.language !== undefined) {
    if (!VALID_LANGUAGES.includes(body.language)) {
      return NextResponse.json({ error: "Invalid language" }, { status: 400 });
    }
    updates.botLanguage = body.language;
  }

  if (body.mood !== undefined) {
    if (!VALID_MOODS.includes(body.mood)) {
      return NextResponse.json({ error: "Invalid mood" }, { status: 400 });
    }
    updates.botMood = body.mood;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.update(organizations).set(updates).where(eq(organizations.id, ctx.orgId));

  // Update OpenClaw SOUL.md with new personality
  try {
    const { updateBotPersonality } = await import("@/lib/openclaw");
    updateBotPersonality(
      body.language || updates.botLanguage,
      body.mood || updates.botMood
    );
  } catch {} // non-critical if OpenClaw isn't installed

  return NextResponse.json({ data: { ...updates } });
}

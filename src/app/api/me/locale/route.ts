import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const SUPPORTED_LOCALES = ["en", "mn"];

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const locale = body.locale;

    if (!locale || !SUPPORTED_LOCALES.includes(locale)) {
      return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
    }

    await db
      .update(users)
      .set({ preferredLocale: locale })
      .where(eq(users.id, session.user.id));

    const response = NextResponse.json({ data: { locale } });
    response.cookies.set("locale", locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    console.error("Failed to update locale:", error);
    return NextResponse.json(
      { error: "Failed to update locale" },
      { status: 500 }
    );
  }
}

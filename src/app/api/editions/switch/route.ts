import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "event-os-edition";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { editionId } = body;

  if (!editionId) {
    return NextResponse.json({ error: "editionId required" }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, editionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  return NextResponse.json({ data: { editionId } });
}

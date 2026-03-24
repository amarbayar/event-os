import { cookies } from "next/headers";

const COOKIE_NAME = "event-os-edition";

export async function getEditionFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

export async function setEditionCookie(editionId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, editionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  });
}

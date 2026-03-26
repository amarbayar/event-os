import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";

// GET — list notifications for current user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "true";
  const countOnly = url.searchParams.get("count") === "true";

  if (countOnly) {
    const unread = await db.query.notifications.findMany({
      where: and(eq(notifications.userId, userId), eq(notifications.read, false)),
      columns: { id: true },
    });
    return NextResponse.json({ data: { unreadCount: unread.length } });
  }

  const conditions = [eq(notifications.userId, userId)];
  if (unreadOnly) conditions.push(eq(notifications.read, false));

  const rows = await db.query.notifications.findMany({
    where: and(...conditions),
    orderBy: desc(notifications.createdAt),
    limit: 50,
  });

  return NextResponse.json({ data: rows });
}

// PATCH — bulk operations (mark all read, delete all read)
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const body = await req.json();

  if (body.action === "mark_all_read") {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    return NextResponse.json({ data: { success: true } });
  }

  if (body.action === "delete_all_read") {
    await db
      .delete(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, true)));
    return NextResponse.json({ data: { success: true } });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

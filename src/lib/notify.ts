import { db } from "@/db";
import { notifications } from "@/db/schema";

type NotifyParams = {
  userId: string;
  orgId: string;
  type: string;
  title: string;
  message?: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  actorName?: string;
};

/**
 * Create a notification for a user.
 * Call this from any API route or handler — it's a simple DB insert.
 * Never throws — logs errors and returns silently.
 */
export async function notify(params: NotifyParams): Promise<void> {
  try {
    // Don't notify yourself
    // (caller should check this if needed — we don't have actor ID here)
    await db.insert(notifications).values({
      userId: params.userId,
      organizationId: params.orgId,
      type: params.type,
      title: params.title,
      message: params.message || null,
      link: params.link || null,
      entityType: params.entityType || null,
      entityId: params.entityId || null,
      actorName: params.actorName || null,
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}

/**
 * Notify multiple users at once.
 */
export async function notifyMany(userIds: string[], params: Omit<NotifyParams, "userId">): Promise<void> {
  for (const userId of userIds) {
    await notify({ ...params, userId });
  }
}

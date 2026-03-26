import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getTranslations } from "next-intl/server";

type BaseNotifyParams = {
  userId: string;
  orgId: string;
  type: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  actorName?: string;
};

type RawNotifyParams = BaseNotifyParams & {
  title: string;
  message?: string;
};

type I18nNotifyParams = BaseNotifyParams & {
  titleKey: string;
  titleParams?: Record<string, string>;
  messageKey?: string;
  messageParams?: Record<string, string>;
  locale: string;
};

export type NotifyParams = RawNotifyParams | I18nNotifyParams;

function isI18n(params: NotifyParams): params is I18nNotifyParams {
  return "titleKey" in params;
}

/**
 * Resolve the title and message from a NotifyParams.
 * For i18n params, uses next-intl's getTranslations with the recipient's locale.
 */
async function resolveContent(params: NotifyParams): Promise<{ title: string; message: string | null }> {
  if (!isI18n(params)) {
    return { title: params.title, message: params.message || null };
  }

  const t = await getTranslations({
    locale: params.locale,
    namespace: "Notifications",
  });

  const title = t(params.titleKey as never, params.titleParams as never);
  const message = params.messageKey
    ? t(params.messageKey as never, params.messageParams as never)
    : null;

  return { title, message };
}

/**
 * Create a notification for a user.
 * Call this from any API route or handler — it's a simple DB insert.
 * Never throws — logs errors and returns silently.
 *
 * When QUEUE_ENABLED=true, dispatches to the job queue instead
 * of inserting directly. Same signature, same fire-and-forget semantics.
 *
 * Supports two calling patterns:
 * - Raw: { title: "Hello" } — stores as-is
 * - I18n: { titleKey: "assigned", titleParams: { entity: "John" }, locale: "mn" }
 *         — resolves translation before storing
 */
export async function notify(params: NotifyParams): Promise<void> {
  try {
    if (process.env.QUEUE_ENABLED === "true") {
      const { dispatch, sendNotificationJob } = await import("@/lib/queue");
      await dispatch(sendNotificationJob, params, {
        organizationId: params.orgId,
      });
      return;
    }

    const { title, message } = await resolveContent(params);

    await db.insert(notifications).values({
      userId: params.userId,
      organizationId: params.orgId,
      type: params.type,
      title,
      message,
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
 *
 * When QUEUE_ENABLED=true, uses dispatchMany() for a single
 * bulk INSERT instead of N individual inserts.
 */
export async function notifyMany(
  userIds: string[],
  params: Omit<NotifyParams, "userId">
): Promise<void> {
  try {
    if (process.env.QUEUE_ENABLED === "true") {
      const { dispatchMany, sendNotificationJob } = await import(
        "@/lib/queue"
      );
      await dispatchMany(
        sendNotificationJob,
        userIds.map((userId) => ({
          payload: { ...params, userId },
          organizationId: params.orgId,
        }))
      );
      return;
    }

    for (const userId of userIds) {
      await notify({ ...params, userId } as NotifyParams);
    }
  } catch (error) {
    console.error("Failed to create notifications:", error);
  }
}

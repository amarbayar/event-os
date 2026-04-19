import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getTranslations } from "next-intl/server";

type BaseNotifyParams = {
  userId: string;
  orgId: string;
  editionId?: string;
  type: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  actorName?: string;
};

export type RawNotifyParams = BaseNotifyParams & {
  title: string;
  message?: string | null;
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

  try {
    const t = await getTranslations({
      locale: params.locale,
      namespace: "Notifications",
    });
    const translate = t as (key: string, values?: Record<string, string>) => string;

    const title = translate(params.titleKey, params.titleParams);
    const message = params.messageKey
      ? translate(params.messageKey, params.messageParams)
      : null;

    return { title, message };
  } catch {
    // Fallback if translation resolution fails (missing key, bad locale, etc.)
    return { title: params.titleKey, message: params.messageKey || null };
  }
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
    const { title, message } = await resolveContent(params);

    if (process.env.QUEUE_ENABLED === "true") {
      const { dispatch, sendNotificationJob } = await import("@/lib/queue");
      // Resolve i18n before dispatching — worker may not have next-intl
      await dispatch(sendNotificationJob, {
        userId: params.userId,
        orgId: params.orgId,
        type: params.type,
        title,
        message,
        link: params.link,
        entityType: params.entityType,
        entityId: params.entityId,
        actorName: params.actorName,
      }, {
        organizationId: params.orgId,
      });
      return;
    }

    await db.insert(notifications).values({
      userId: params.userId,
      organizationId: params.orgId,
      editionId: params.editionId || null,
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
    // Resolve i18n once for all recipients (same content, different userId)
    const { title, message } = await resolveContent(params as NotifyParams);

    if (process.env.QUEUE_ENABLED === "true") {
      const { dispatchMany, sendNotificationJob } = await import(
        "@/lib/queue"
      );
      await dispatchMany(
        sendNotificationJob,
        userIds.map((userId) => ({
          payload: {
            userId,
            orgId: params.orgId,
            type: params.type,
            title,
            message,
            link: params.link,
            entityType: params.entityType,
            entityId: params.entityId,
            actorName: params.actorName,
          },
          organizationId: params.orgId,
        }))
      );
      return;
    }

    for (const userId of userIds) {
      await db.insert(notifications).values({
        userId,
        organizationId: params.orgId,
        type: params.type,
        title,
        message,
        link: params.link || null,
        entityType: params.entityType || null,
        entityId: params.entityId || null,
        actorName: params.actorName || null,
      });
    }
  } catch (error) {
    console.error("Failed to create notifications:", error);
  }
}

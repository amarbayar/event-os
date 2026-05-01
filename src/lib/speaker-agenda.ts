import { and, eq, sql } from "drizzle-orm";
import {
  checklistItems,
  entityNotes,
  notifications,
  sessions,
  tasks,
  tracks,
  userOrganizations,
} from "@/db/schema";
import { isSessionType } from "@/lib/session-types";

type DbLike = {
  query: {
    tracks: {
      findFirst: (args: unknown) => Promise<{ id: string } | undefined>;
    };
    sessions: {
      findMany: (args: unknown) => Promise<Array<{ id: string; panelSpeakerIds: string[] | null }>>;
    };
  };
  update: (table: unknown) => {
    set: (values: Record<string, unknown>) => {
      where: (condition: unknown) => unknown;
    };
  };
  delete: (table: unknown) => {
    where: (condition: unknown) => unknown;
  };
};

type SpeakerSyncUpdates = {
  talkTitle?: unknown;
  talkAbstract?: unknown;
  talkType?: unknown;
  trackPreference?: unknown;
};

type SpeakerDependencyArgs = {
  speakerId: string;
  editionId: string;
  organizationId: string;
};

export async function syncSpeakerAgendaSessions(
  dbOrTx: DbLike,
  args: SpeakerDependencyArgs & { updates: SpeakerSyncUpdates },
) {
  const sessionUpdates: Record<string, unknown> = {};

  if (typeof args.updates.talkTitle === "string") {
    sessionUpdates.title = args.updates.talkTitle.trim() || "TBD";
  }

  if (args.updates.talkAbstract !== undefined) {
    sessionUpdates.description =
      typeof args.updates.talkAbstract === "string" && args.updates.talkAbstract.trim()
        ? args.updates.talkAbstract.trim()
        : null;
  }

  if (isSessionType(args.updates.talkType)) {
    sessionUpdates.type = args.updates.talkType;
  }

  if (args.updates.trackPreference !== undefined) {
    const trackName =
      typeof args.updates.trackPreference === "string"
        ? args.updates.trackPreference.trim()
        : "";
    if (trackName) {
      const track = await dbOrTx.query.tracks.findFirst({
        where: and(
          eq(tracks.editionId, args.editionId),
          eq(tracks.name, trackName),
        ),
      });
      sessionUpdates.trackId = track?.id ?? null;
    } else {
      sessionUpdates.trackId = null;
    }
  }

  if (Object.keys(sessionUpdates).length === 0) return;

  await dbOrTx
    .update(sessions)
    .set({
      ...sessionUpdates,
      version: sql`${sessions.version} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sessions.speakerId, args.speakerId),
        eq(sessions.editionId, args.editionId),
        eq(sessions.organizationId, args.organizationId),
      ),
    );
}

export async function cleanupSpeakerDependencies(
  dbOrTx: DbLike,
  args: SpeakerDependencyArgs,
) {
  const panelSessions = await dbOrTx.query.sessions.findMany({
    where: and(
      eq(sessions.editionId, args.editionId),
      eq(sessions.organizationId, args.organizationId),
    ),
  });

  await dbOrTx
    .delete(sessions)
    .where(
      and(
        eq(sessions.speakerId, args.speakerId),
        eq(sessions.editionId, args.editionId),
        eq(sessions.organizationId, args.organizationId),
      ),
    );

  for (const session of panelSessions) {
    if (!session.panelSpeakerIds?.includes(args.speakerId)) continue;
    const remaining = session.panelSpeakerIds.filter((id) => id !== args.speakerId);
    if (remaining.length === 0) {
      await dbOrTx.delete(sessions).where(eq(sessions.id, session.id));
    } else {
      await dbOrTx
        .update(sessions)
        .set({
          panelSpeakerIds: remaining,
          version: sql`${sessions.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(sessions.id, session.id));
    }
  }

  await dbOrTx
    .delete(checklistItems)
    .where(
      and(
        eq(checklistItems.entityType, "speaker"),
        eq(checklistItems.entityId, args.speakerId),
        eq(checklistItems.organizationId, args.organizationId),
      ),
    );
  await dbOrTx
    .delete(entityNotes)
    .where(
      and(
        eq(entityNotes.entityType, "speaker"),
        eq(entityNotes.entityId, args.speakerId),
        eq(entityNotes.organizationId, args.organizationId),
      ),
    );
  await dbOrTx
    .delete(notifications)
    .where(
      and(
        eq(notifications.entityType, "speaker"),
        eq(notifications.entityId, args.speakerId),
        eq(notifications.organizationId, args.organizationId),
      ),
    );
  await dbOrTx
    .delete(tasks)
    .where(
      and(
        eq(tasks.linkedEntityType, "speaker"),
        eq(tasks.linkedEntityId, args.speakerId),
        eq(tasks.organizationId, args.organizationId),
      ),
    );
  await dbOrTx
    .update(userOrganizations)
    .set({
      linkedEntityType: null,
      linkedEntityId: null,
    })
    .where(
      and(
        eq(userOrganizations.linkedEntityType, "speaker"),
        eq(userOrganizations.linkedEntityId, args.speakerId),
        eq(userOrganizations.organizationId, args.organizationId),
      ),
    );
}

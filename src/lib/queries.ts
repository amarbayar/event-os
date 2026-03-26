import { db } from "@/db";
import { eq, and, desc, asc, count, sql } from "drizzle-orm";
import * as schema from "@/db/schema";

export async function getActiveIds(userOrgId?: string) {
  // 1. Resolve user's org — use passed value (from requirePermission) or fetch from session
  if (!userOrgId) {
    try {
      const { auth } = await import("@/lib/auth");
      const session = await auth();
      userOrgId = session?.user?.organizationId ?? undefined;
    } catch {
      // Session may not be available in all contexts
    }
  }

  // 2. Try cookie — but only if edition belongs to user's org
  try {
    const { getEditionFromCookie } = await import("@/lib/edition-cookie");
    const cookieEditionId = await getEditionFromCookie();
    if (cookieEditionId) {
      const edition = await db.query.eventEditions.findFirst({
        where: eq(schema.eventEditions.id, cookieEditionId),
      });
      if (edition && (!userOrgId || edition.organizationId === userOrgId)) {
        return { orgId: edition.organizationId, editionId: edition.id };
      }
      // Cookie points to a different org — ignore it
    }
  } catch {
    // Cookie reading may fail in API routes — that's fine, fall through
  }

  // 3. Try env vars (for service token / non-session contexts only)
  if (!userOrgId) {
    const envOrg = process.env.DEFAULT_ORG_ID || "";
    const envEdition = process.env.DEFAULT_EDITION_ID || "";
    if (envOrg && envEdition) {
      return { orgId: envOrg, editionId: envEdition };
    }
  }

  // 4. Fall back to user's org's most recent edition
  if (userOrgId) {
    const edition = await db.query.eventEditions.findFirst({
      where: eq(schema.eventEditions.organizationId, userOrgId),
      orderBy: desc(schema.eventEditions.createdAt),
    });
    if (edition) {
      return { orgId: userOrgId, editionId: edition.id };
    }
  }

  return null;
}

export async function getEdition() {
  const ids = await getActiveIds();
  if (!ids) return null;

  return db.query.eventEditions.findFirst({
    where: eq(schema.eventEditions.id, ids.editionId),
    with: { series: true, organization: true },
  });
}

export async function getSpeakers(status?: string) {
  const ids = await getActiveIds();
  if (!ids) return [];

  const conditions = [eq(schema.speakerApplications.editionId, ids.editionId)];
  if (status && status !== "all") {
    conditions.push(eq(schema.speakerApplications.status, status as "pending" | "accepted" | "rejected" | "waitlisted"));
  }

  return db.query.speakerApplications.findMany({
    where: and(...conditions),
    orderBy: desc(schema.speakerApplications.createdAt),
  });
}

export async function getSessions(day?: number) {
  const ids = await getActiveIds();
  if (!ids) return [];

  const conditions = [eq(schema.sessions.editionId, ids.editionId)];
  if (day) conditions.push(eq(schema.sessions.day, day));

  return db.query.sessions.findMany({
    where: and(...conditions),
    with: { speaker: true, track: true },
    orderBy: [asc(schema.sessions.day), asc(schema.sessions.startTime), asc(schema.sessions.sortOrder)],
  });
}

export async function getCheckInStats() {
  const ids = await getActiveIds();
  if (!ids) return { total: 0, checkedIn: 0, remaining: 0, percentage: 0 };

  const [stats] = await db
    .select({
      total: count(),
      checkedIn: count(sql`CASE WHEN ${schema.attendees.checkedIn} = true THEN 1 END`),
    })
    .from(schema.attendees)
    .where(eq(schema.attendees.editionId, ids.editionId));

  const total = Number(stats.total);
  const checkedIn = Number(stats.checkedIn);

  return {
    total,
    checkedIn,
    remaining: total - checkedIn,
    percentage: total > 0 ? Math.round((checkedIn / total) * 100) : 0,
  };
}

export async function getAttendees() {
  const ids = await getActiveIds();
  if (!ids) return [];

  return db.query.attendees.findMany({
    where: eq(schema.attendees.editionId, ids.editionId),
    orderBy: [asc(schema.attendees.name)],
  });
}

export async function getDashboardStats() {
  const ids = await getActiveIds();
  if (!ids) return { sessions: 0, speakers: 0, attendees: 0, checkedIn: 0, messagingConnected: 0 };

  const [sessionCount] = await db.select({ count: count() }).from(schema.sessions).where(eq(schema.sessions.editionId, ids.editionId));
  const [speakerCount] = await db.select({ count: count() }).from(schema.speakerApplications).where(eq(schema.speakerApplications.editionId, ids.editionId));
  const [attendeeCount] = await db.select({ count: count() }).from(schema.attendees).where(eq(schema.attendees.editionId, ids.editionId));
  const [channelCount] = await db.select({ count: count() }).from(schema.messagingChannels).where(eq(schema.messagingChannels.organizationId, ids.orgId));
  const checkIn = await getCheckInStats();

  return {
    sessions: Number(sessionCount.count),
    speakers: Number(speakerCount.count),
    attendees: Number(attendeeCount.count),
    checkedIn: checkIn.checkedIn,
    messagingConnected: Number(channelCount.count),
  };
}

type StageCounts = { lead: number; engaged: number; confirmed: number; declined: number };

function countStages(rows: { stage: string }[]): StageCounts {
  const counts: StageCounts = { lead: 0, engaged: 0, confirmed: 0, declined: 0 };
  for (const r of rows) {
    if (r.stage in counts) counts[r.stage as keyof StageCounts]++;
  }
  return counts;
}

export async function getDashboardData() {
  const ids = await getActiveIds();
  if (!ids) return null;

  const edId = ids.editionId;
  const orgId = ids.orgId;

  // All queries in parallel
  const [
    edition,
    speakers,
    sponsors,
    venueRows,
    booths,
    attendeeStats,
    sessions,
    tracks,
    tasks,
    overdueTasks,
    recentNotifications,
    channelCount,
    pendingChecklist,
  ] = await Promise.all([
    // Edition
    db.query.eventEditions.findFirst({
      where: eq(schema.eventEditions.id, edId),
      with: { series: true },
    }),
    // Speakers with stage
    db.select({ stage: schema.speakerApplications.stage })
      .from(schema.speakerApplications)
      .where(eq(schema.speakerApplications.editionId, edId)),
    // Sponsors with stage
    db.select({ stage: schema.sponsorApplications.stage })
      .from(schema.sponsorApplications)
      .where(eq(schema.sponsorApplications.editionId, edId)),
    // Venues with stage
    db.select({ stage: schema.venues.stage })
      .from(schema.venues)
      .where(eq(schema.venues.editionId, edId)),
    // Booths with stage
    db.select({ stage: schema.booths.stage })
      .from(schema.booths)
      .where(eq(schema.booths.editionId, edId)),
    // Attendee check-in stats
    db.select({
      total: count(),
      checkedIn: count(sql`CASE WHEN ${schema.attendees.checkedIn} = true THEN 1 END`),
    }).from(schema.attendees).where(eq(schema.attendees.editionId, edId)),
    // Sessions
    db.select({ id: schema.sessions.id, type: schema.sessions.type })
      .from(schema.sessions)
      .where(eq(schema.sessions.editionId, edId)),
    // Tracks
    db.select({ id: schema.tracks.id, name: schema.tracks.name })
      .from(schema.tracks)
      .where(eq(schema.tracks.editionId, edId)),
    // All tasks for status counts
    db.select({ status: schema.tasks.status, priority: schema.tasks.priority })
      .from(schema.tasks)
      .where(eq(schema.tasks.editionId, edId)),
    // Overdue tasks
    db.select({ id: schema.tasks.id, title: schema.tasks.title, dueDate: schema.tasks.dueDate, assigneeName: schema.tasks.assigneeName })
      .from(schema.tasks)
      .where(and(
        eq(schema.tasks.editionId, edId),
        sql`${schema.tasks.dueDate} < NOW()`,
        sql`${schema.tasks.status} != 'done'`,
      ))
      .orderBy(asc(schema.tasks.dueDate))
      .limit(5),
    // Recent notifications (activity feed)
    db.query.notifications.findMany({
      where: eq(schema.notifications.organizationId, orgId),
      orderBy: desc(schema.notifications.createdAt),
      limit: 8,
    }),
    // Messaging channels
    db.select({ count: count() }).from(schema.messagingChannels)
      .where(eq(schema.messagingChannels.organizationId, orgId)),
    // Pending checklist items (stakeholder submissions needed)
    db.select({ count: count() }).from(schema.checklistItems)
      .where(and(
        eq(schema.checklistItems.organizationId, orgId),
        eq(schema.checklistItems.status, "pending"),
      )),
  ]);

  const attendeeTotal = Number(attendeeStats[0]?.total || 0);
  const attendeeCheckedIn = Number(attendeeStats[0]?.checkedIn || 0);

  // Task status breakdown
  const taskCounts = { todo: 0, in_progress: 0, blocked: 0, done: 0 };
  for (const t of tasks) {
    if (t.status && t.status in taskCounts) taskCounts[t.status as keyof typeof taskCounts]++;
  }

  // Days until event
  const daysUntil = edition?.startDate
    ? Math.ceil((new Date(edition.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    edition,
    daysUntil,
    speakers: { total: speakers.length, stages: countStages(speakers) },
    sponsors: { total: sponsors.length, stages: countStages(sponsors) },
    venues: { total: venueRows.length, stages: countStages(venueRows) },
    booths: { total: booths.length, stages: countStages(booths) },
    attendees: { total: attendeeTotal, checkedIn: attendeeCheckedIn },
    sessions: { total: sessions.length, tracks: tracks.length },
    tasks: { total: tasks.length, ...taskCounts, overdue: overdueTasks },
    pendingChecklist: Number(pendingChecklist[0]?.count || 0),
    messagingConnected: Number(channelCount[0]?.count || 0),
    recentActivity: recentNotifications,
  };
}

export async function getSponsors() {
  const ids = await getActiveIds();
  if (!ids) return [];

  return db.query.sponsorApplications.findMany({
    where: eq(schema.sponsorApplications.editionId, ids.editionId),
    orderBy: desc(schema.sponsorApplications.createdAt),
  });
}

export async function getVenues() {
  const ids = await getActiveIds();
  if (!ids) return [];

  return db.query.venues.findMany({
    where: eq(schema.venues.editionId, ids.editionId),
    orderBy: desc(schema.venues.createdAt),
  });
}

export async function getTasks() {
  const ids = await getActiveIds();
  if (!ids) return [];

  return db.query.tasks.findMany({
    where: eq(schema.tasks.editionId, ids.editionId),
    orderBy: [asc(schema.tasks.dueDate)],
  });
}

export async function getTeams() {
  const ids = await getActiveIds();
  if (!ids) return [];

  return db.query.teams.findMany({
    where: eq(schema.teams.editionId, ids.editionId),
    orderBy: [asc(schema.teams.sortOrder)],
  });
}

export async function getBooths() {
  const ids = await getActiveIds();
  if (!ids) return [];

  return db.query.booths.findMany({
    where: eq(schema.booths.editionId, ids.editionId),
    orderBy: [asc(schema.booths.name)],
  });
}

export async function getVolunteers() {
  const ids = await getActiveIds();
  if (!ids) return [];

  return db.query.volunteerApplications.findMany({
    where: eq(schema.volunteerApplications.editionId, ids.editionId),
    orderBy: desc(schema.volunteerApplications.createdAt),
  });
}

export async function getOutreach() {
  const ids = await getActiveIds();
  if (!ids) return [];

  return db.query.outreach.findMany({
    where: eq(schema.outreach.editionId, ids.editionId),
    orderBy: desc(schema.outreach.createdAt),
  });
}

export async function getMediaPartners() {
  const ids = await getActiveIds();
  if (!ids) return [];

  return db.query.mediaPartners.findMany({
    where: eq(schema.mediaPartners.editionId, ids.editionId),
    orderBy: desc(schema.mediaPartners.createdAt),
  });
}

export async function getCampaigns() {
  const ids = await getActiveIds();
  if (!ids) return [];

  return db.query.campaigns.findMany({
    where: eq(schema.campaigns.editionId, ids.editionId),
    orderBy: desc(schema.campaigns.createdAt),
  });
}

export async function getInvitations() {
  const ids = await getActiveIds();
  if (!ids) return [];

  return db.query.invitations.findMany({
    where: eq(schema.invitations.editionId, ids.editionId),
    orderBy: desc(schema.invitations.createdAt),
  });
}

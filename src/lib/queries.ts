import { db } from "@/db";
import { eq, and, desc, asc, count, sql } from "drizzle-orm";
import * as schema from "@/db/schema";

export async function getActiveIds(userOrgId?: string) {
  // 1. Resolve user's org — use passed value (from requirePermission) or fetch from session
  if (!userOrgId) {
    try {
      const { auth } = await import("@/lib/auth");
      const session = await auth();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userOrgId = (session?.user as any)?.organizationId;
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
  if (!ids) return { sessions: 0, speakers: 0, attendees: 0, checkedIn: 0 };

  const [sessionCount] = await db.select({ count: count() }).from(schema.sessions).where(eq(schema.sessions.editionId, ids.editionId));
  const [speakerCount] = await db.select({ count: count() }).from(schema.speakerApplications).where(eq(schema.speakerApplications.editionId, ids.editionId));
  const [attendeeCount] = await db.select({ count: count() }).from(schema.attendees).where(eq(schema.attendees.editionId, ids.editionId));
  const checkIn = await getCheckInStats();

  return {
    sessions: Number(sessionCount.count),
    speakers: Number(speakerCount.count),
    attendees: Number(attendeeCount.count),
    checkedIn: checkIn.checkedIn,
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

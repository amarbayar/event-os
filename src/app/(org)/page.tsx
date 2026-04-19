import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  eventEditions,
  userOrganizations,
  speakerApplications,
  sponsorApplications,
  attendees,
  sessions,
} from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  MapPin,
  Mic2,
  DollarSign,
  Users,
  Presentation,
  ArrowRight,
} from "lucide-react";
import { CreateEventButton } from "./create-event-button";

export const dynamic = "force-dynamic";

type EditionWithStats = {
  id: string;
  name: string;
  slug: string;
  startDate: Date | null;
  endDate: Date | null;
  venue: string | null;
  status: string;
  speakerCount: number;
  sponsorCount: number;
  attendeeCount: number;
  sessionCount: number;
};

function formatDates(startDate: Date | null, endDate: Date | null): string {
  if (!startDate) return "Dates TBD";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  if (!endDate) return startDate.toLocaleDateString("en-US", opts);
  if (startDate.getFullYear() === endDate.getFullYear() && startDate.getMonth() === endDate.getMonth()) {
    return `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${endDate.getDate()}, ${endDate.getFullYear()}`;
  }
  return `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${endDate.toLocaleDateString("en-US", opts)}`;
}

function statusBadge(status: string) {
  switch (status) {
    case "published":
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Published</Badge>;
    case "archived":
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Archived</Badge>;
    default:
      return <Badge variant="secondary">Draft</Badge>;
  }
}

function daysUntil(startDate: Date | null): number | null {
  if (!startDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(startDate);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function OrgHomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Resolve user's org
  const membership = await db.query.userOrganizations.findFirst({
    where: eq(userOrganizations.userId, session.user.id),
    orderBy: (uo: Record<string, unknown>, { desc: d }: { desc: (col: unknown) => unknown }) => [d(uo.createdAt)],
  });

  if (!membership) redirect("/onboarding");
  const orgId = membership.organizationId;

  // Fetch all editions for this org
  const editions = await db.query.eventEditions.findMany({
    where: eq(eventEditions.organizationId, orgId),
    orderBy: desc(eventEditions.startDate),
  });

  // Fetch stats for all editions in parallel
  const editionsWithStats: EditionWithStats[] = await Promise.all(
    editions.map(async (edition: typeof editions[number]) => {
      const [speakers, sponsors, attendeeRows, sessionRows] = await Promise.all([
        db
          .select({ count: count() })
          .from(speakerApplications)
          .where(eq(speakerApplications.editionId, edition.id)),
        db
          .select({ count: count() })
          .from(sponsorApplications)
          .where(eq(sponsorApplications.editionId, edition.id)),
        db
          .select({ count: count() })
          .from(attendees)
          .where(eq(attendees.editionId, edition.id)),
        db
          .select({ count: count() })
          .from(sessions)
          .where(eq(sessions.editionId, edition.id)),
      ]);

      return {
        id: edition.id,
        name: edition.name,
        slug: edition.slug,
        startDate: edition.startDate,
        endDate: edition.endDate,
        venue: edition.venue,
        status: edition.status,
        speakerCount: Number(speakers[0].count),
        sponsorCount: Number(sponsors[0].count),
        attendeeCount: Number(attendeeRows[0].count),
        sessionCount: Number(sessionRows[0].count),
      };
    })
  );

  // Split: active events first, archived at the bottom
  const activeEvents = editionsWithStats.filter((e) => e.status !== "archived");
  const archivedEvents = editionsWithStats.filter((e) => e.status === "archived");
  const sortedEvents = [...activeEvents, ...archivedEvents];

  // Empty state
  if (sortedEvents.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">Your Events</h1>
            <p className="text-sm text-muted-foreground">Manage all your events in one place</p>
          </div>
        </div>

        <Card className="border-dashed border-2 border-stone-300">
          <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="rounded-full bg-yellow-50 p-4 mb-4">
              <Calendar className="h-8 w-8 text-yellow-600" />
            </div>
            <h2 className="text-lg font-semibold text-stone-900 mb-1">
              Create your first event
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Get started by creating an event. You can set up your agenda, invite speakers,
              manage sponsors, and track attendees all from one place.
            </p>
            <CreateEventButton />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Your Events</h1>
          <p className="text-sm text-muted-foreground">
            {sortedEvents.length} event{sortedEvents.length !== 1 ? "s" : ""}
          </p>
        </div>
        <CreateEventButton />
      </div>

      {/* Event cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sortedEvents.map((event) => {
          const days = daysUntil(event.startDate);
          const isArchived = event.status === "archived";

          return (
            <Link
              key={event.id}
              href={`/events/${event.slug}`}
              className="block group"
            >
              <Card
                className={`h-full transition-all hover:border-primary/30 hover:shadow-sm ${
                  isArchived ? "opacity-70" : ""
                }`}
              >
                <CardContent className="p-5 space-y-3">
                  {/* Name + status */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-stone-900 group-hover:text-primary transition-colors truncate">
                      {event.name}
                    </h3>
                    {statusBadge(event.status)}
                  </div>

                  {/* Date + venue */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>{formatDates(event.startDate, event.endDate)}</span>
                      {days !== null && days > 0 && !isArchived && (
                        <span className="ml-auto text-xs font-medium text-primary tabular-nums">
                          {days}d
                        </span>
                      )}
                    </div>
                    {event.venue && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{event.venue}</span>
                      </div>
                    )}
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mic2 className="h-3 w-3 shrink-0" />
                      <span>{event.speakerCount} speaker{event.speakerCount !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <DollarSign className="h-3 w-3 shrink-0" />
                      <span>{event.sponsorCount} sponsor{event.sponsorCount !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="h-3 w-3 shrink-0" />
                      <span>{event.attendeeCount} attendee{event.attendeeCount !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Presentation className="h-3 w-3 shrink-0" />
                      <span>{event.sessionCount} session{event.sessionCount !== 1 ? "s" : ""}</span>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="pt-1">
                    <span className="text-xs font-medium text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                      Open <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

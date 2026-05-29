import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { resolveEvent } from "@/lib/resolve-event";
import { db } from "@/db";
import { userOrganizations } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { EventWorkspaceShell } from "./event-workspace-shell";

export default async function EventWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // 1. Auth check
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // 2. Resolve event from slug
  const event = await resolveEvent(slug);
  if (!event) {
    notFound();
  }

  // 3. Verify user belongs to this event's org
  const membership = await db.query.userOrganizations.findFirst({
    where: and(
      eq(userOrganizations.userId, session.user.id),
      eq(userOrganizations.organizationId, event.orgId)
    ),
  });

  if (!membership) {
    redirect("/");
  }

  // 4. Serialize dates for the client component
  const eventValue = {
    editionId: event.editionId,
    orgId: event.orgId,
    slug: event.slug,
    name: event.name,
    startDate: event.startDate ? event.startDate.toISOString() : null,
    endDate: event.endDate ? event.endDate.toISOString() : null,
    venue: event.venue,
    status: event.status,
  };

  return (
    <EventWorkspaceShell event={eventValue} userRole={membership.role}>
      {children}
    </EventWorkspaceShell>
  );
}

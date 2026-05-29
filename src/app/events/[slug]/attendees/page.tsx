import { getAttendees, getCheckInStats } from "@/lib/queries";
import { AttendeesClient } from "./client";
import { redirectCoordinatorFromSensitiveEventPage } from "@/lib/coordinator-access";

export const dynamic = "force-dynamic";

export default async function AttendeesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await redirectCoordinatorFromSensitiveEventPage(slug);

  const [attendees, stats] = await Promise.all([getAttendees(), getCheckInStats()]);

  return <AttendeesClient initialAttendees={attendees} stats={stats} />;
}

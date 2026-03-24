import { getAttendees, getCheckInStats } from "@/lib/queries";
import { AttendeesClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AttendeesPage() {
  const [attendees, stats] = await Promise.all([getAttendees(), getCheckInStats()]);

  return <AttendeesClient initialAttendees={attendees} stats={stats} />;
}

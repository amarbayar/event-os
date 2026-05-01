import { getActiveIds, getCheckInStats, getAttendees } from "@/lib/queries";
import { CheckInClient } from "./client";

export const dynamic = "force-dynamic";

export default async function CheckInPage() {
  const [ids, stats, attendees] = await Promise.all([
    getActiveIds(),
    getCheckInStats(),
    getAttendees(),
  ]);

  return <CheckInClient editionId={ids?.editionId ?? null} initialStats={stats} initialAttendees={attendees} />;
}

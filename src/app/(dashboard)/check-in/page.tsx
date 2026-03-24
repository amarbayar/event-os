import { getCheckInStats, getAttendees } from "@/lib/queries";
import { CheckInClient } from "./client";

export const dynamic = "force-dynamic";

export default async function CheckInPage() {
  const [stats, attendees] = await Promise.all([getCheckInStats(), getAttendees()]);

  return <CheckInClient initialStats={stats} initialAttendees={attendees} />;
}

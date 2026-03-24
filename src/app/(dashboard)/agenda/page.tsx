import { getSessions } from "@/lib/queries";
import { AgendaClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const sessions = await getSessions();

  return <AgendaClient initialSessions={sessions} />;
}

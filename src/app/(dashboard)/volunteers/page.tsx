import { getVolunteers } from "@/lib/queries";
import { VolunteersClient } from "./client";

export const dynamic = "force-dynamic";

export default async function VolunteersPage() {
  const volunteers = await getVolunteers();

  return <VolunteersClient initialVolunteers={volunteers} />;
}

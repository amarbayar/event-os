import { getSpeakers } from "@/lib/queries";
import { SpeakersClient } from "./client";

export const dynamic = "force-dynamic";

export default async function SpeakersPage() {
  const speakers = await getSpeakers();

  return <SpeakersClient initialSpeakers={speakers} />;
}

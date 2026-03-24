import { getVenues } from "@/lib/queries";
import { VenueClient } from "./client";

export const dynamic = "force-dynamic";

export default async function VenuePage() {
  const venues = await getVenues();

  return <VenueClient initialVenues={venues} />;
}

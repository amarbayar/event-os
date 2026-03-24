import { getSponsors } from "@/lib/queries";
import { SponsorsClient } from "./client";

export const dynamic = "force-dynamic";

export default async function SponsorsPage() {
  const sponsors = await getSponsors();

  return <SponsorsClient initialSponsors={sponsors} />;
}

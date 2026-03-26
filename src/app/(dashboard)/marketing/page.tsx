import { getCampaigns } from "@/lib/queries";
import { MarketingClient } from "./client";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const campaigns = await getCampaigns();

  // Serialize dates for client component
  const serialized = campaigns.map((c: typeof campaigns[number]) => ({
    ...c,
    scheduledDate: c.scheduledDate ? c.scheduledDate.toISOString() : null,
  }));

  return <MarketingClient initialCampaigns={serialized} />;
}

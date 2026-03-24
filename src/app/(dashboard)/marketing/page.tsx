import { getCampaigns } from "@/lib/queries";
import { MarketingClient } from "./client";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const campaigns = await getCampaigns();

  return <MarketingClient initialCampaigns={campaigns} />;
}

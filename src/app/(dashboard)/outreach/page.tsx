import { getOutreach } from "@/lib/queries";
import { OutreachClient } from "./client";

export const dynamic = "force-dynamic";

export default async function OutreachPage() {
  const outreach = await getOutreach();

  return <OutreachClient initialOutreach={outreach} />;
}

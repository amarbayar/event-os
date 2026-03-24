import { getBooths } from "@/lib/queries";
import { BoothsClient } from "./client";

export const dynamic = "force-dynamic";

export default async function BoothsPage() {
  const booths = await getBooths();

  return <BoothsClient initialBooths={booths} />;
}

import { getMediaPartners } from "@/lib/queries";
import { MediaClient } from "./client";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const partners = await getMediaPartners();

  return <MediaClient initialPartners={partners} />;
}

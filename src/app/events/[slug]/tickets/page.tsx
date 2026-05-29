import { TicketsClient } from "./client";
import { redirectCoordinatorFromSensitiveEventPage } from "@/lib/coordinator-access";

export default async function TicketsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await redirectCoordinatorFromSensitiveEventPage(slug);

  return <TicketsClient />;
}

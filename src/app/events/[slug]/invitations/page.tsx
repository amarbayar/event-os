import { getInvitations } from "@/lib/queries";
import { InvitationsClient } from "./client";
import { redirectCoordinatorFromSensitiveEventPage } from "@/lib/coordinator-access";

export const dynamic = "force-dynamic";

export default async function InvitationsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await redirectCoordinatorFromSensitiveEventPage(slug);

  const invitations = await getInvitations();

  return <InvitationsClient initialInvitations={invitations} />;
}

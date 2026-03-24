import { getInvitations } from "@/lib/queries";
import { InvitationsClient } from "./client";

export const dynamic = "force-dynamic";

export default async function InvitationsPage() {
  const invitations = await getInvitations();

  return <InvitationsClient initialInvitations={invitations} />;
}

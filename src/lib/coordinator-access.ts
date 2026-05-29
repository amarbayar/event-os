import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { userOrganizations } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function redirectCoordinatorFromSensitiveEventPage(eventSlug: string) {
  const session = await auth();
  if (!session?.user?.id) return;

  const organizationId = session.user.organizationId as string | undefined;
  const membership = organizationId
    ? await db.query.userOrganizations.findFirst({
        where: and(
          eq(userOrganizations.userId, session.user.id),
          eq(userOrganizations.organizationId, organizationId),
        ),
      })
    : null;

  const role = membership?.role || session.user.role;
  if (role === "coordinator") {
    redirect(`/events/${eventSlug}/check-in`);
  }
}

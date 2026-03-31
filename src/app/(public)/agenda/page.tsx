import { db } from "@/db";
import { eventEditions } from "@/db/schema";
import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Bare /agenda → redirect to the latest edition's public agenda.
 */
export default async function AgendaRedirect() {
  const edition = await db.query.eventEditions.findFirst({
    orderBy: desc(eventEditions.startDate),
    columns: { slug: true },
  });

  if (edition?.slug) {
    redirect(`/agenda/${edition.slug}`);
  }

  return (
    <div className="flex items-center justify-center min-h-screen text-muted-foreground">
      No events found.
    </div>
  );
}

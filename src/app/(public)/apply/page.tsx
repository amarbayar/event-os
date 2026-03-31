import { db } from "@/db";
import { eventEditions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Bare /apply → redirect to the latest edition with CFP open.
 */
export default async function ApplyRedirect() {
  // Try to find an edition with CFP open first
  const cfpOpen = await db.query.eventEditions.findFirst({
    where: eq(eventEditions.cfpOpen, true),
    orderBy: desc(eventEditions.startDate),
    columns: { slug: true },
  });

  if (cfpOpen?.slug) {
    redirect(`/apply/${cfpOpen.slug}`);
  }

  // Fall back to latest edition
  const latest = await db.query.eventEditions.findFirst({
    orderBy: desc(eventEditions.startDate),
    columns: { slug: true },
  });

  if (latest?.slug) {
    redirect(`/apply/${latest.slug}`);
  }

  return (
    <div className="flex items-center justify-center min-h-screen text-muted-foreground">
      No events found.
    </div>
  );
}

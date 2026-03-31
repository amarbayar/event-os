import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { userOrganizations } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Settings layout — admin/owner only.
 * Non-admin roles are redirected to the org home page.
 */
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await db.query.userOrganizations.findFirst({
    where: eq(userOrganizations.userId, session.user.id),
    orderBy: (uo: Record<string, unknown>, { desc }: { desc: (col: unknown) => unknown }) => [desc(uo.createdAt)],
  });

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    redirect("/");
  }

  return <>{children}</>;
}

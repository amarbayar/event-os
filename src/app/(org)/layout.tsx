import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { organizations, userOrganizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { OrgShell } from "./org-shell";
import { ConfirmProvider } from "@/components/confirm-dialog";

export default async function OrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth check
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Resolve user's org
  const membership = await db.query.userOrganizations.findFirst({
    where: eq(userOrganizations.userId, session.user.id),
    orderBy: (uo: Record<string, unknown>, { desc }: { desc: (col: unknown) => unknown }) => [desc(uo.createdAt)],
  });

  if (!membership) {
    redirect("/onboarding");
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, membership.organizationId),
  });

  if (!org) {
    redirect("/onboarding");
  }

  const orgData = {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logoUrl: org.logoUrl,
    brandColor: org.brandColor,
  };

  return (
    <ConfirmProvider>
      <OrgShell
        org={orgData}
        userName={session.user.name || session.user.email || "User"}
        userEmail={session.user.email || ""}
        userRole={membership.role}
      >
        {children}
      </OrgShell>
    </ConfirmProvider>
  );
}

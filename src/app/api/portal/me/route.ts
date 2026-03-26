import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users, userOrganizations, checklistItems, checklistTemplates, eventEditions } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

// GET — stakeholder portal data (their entity + checklist + event info)
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const orgId = session.user.organizationId as string;

  // Look up stakeholder membership for this org
  const membership = await db.query.userOrganizations.findFirst({
    where: and(
      eq(userOrganizations.userId, userId),
      eq(userOrganizations.organizationId, orgId),
      eq(userOrganizations.role, "stakeholder"),
    ),
  });

  if (!membership || !membership.linkedEntityType || !membership.linkedEntityId) {
    return NextResponse.json({ error: "Not a stakeholder account" }, { status: 403 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { name: true, email: true },
  });

  // Look up the linked entity
  const entityQueryMap: Record<string, string> = {
    speaker: "speakerApplications",
    sponsor: "sponsorApplications",
    venue: "venues",
    booth: "booths",
    volunteer: "volunteerApplications",
    media: "mediaPartners",
  };

  const queryName = entityQueryMap[membership.linkedEntityType];
  if (!queryName) {
    return NextResponse.json({ error: "Unknown entity type" }, { status: 400 });
  }

  // Dynamic query by entity type name — Drizzle's query API doesn't support string-based table lookup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queryFn = (db.query as Record<string, any>)[queryName];
  const entity = await queryFn.findFirst({
    where: (t: Record<string, unknown>, { eq: eqFn }: { eq: typeof eq }) => eqFn(t.id as Parameters<typeof eq>[0], membership.linkedEntityId!),
  }) as Record<string, unknown> | undefined;

  if (!entity) {
    return NextResponse.json({ error: "Linked entity not found" }, { status: 404 });
  }

  // Get edition info
  const edition = await db.query.eventEditions.findFirst({
    where: eq(eventEditions.id, entity.editionId as string),
  });

  // Get checklist items with template info
  const items = await db
    .select({
      id: checklistItems.id,
      name: checklistTemplates.name,
      description: checklistTemplates.description,
      itemType: checklistTemplates.itemType,
      required: checklistTemplates.required,
      fieldKey: checklistTemplates.fieldKey,
      status: checklistItems.status,
      value: checklistItems.value,
      notes: checklistItems.notes,
    })
    .from(checklistItems)
    .innerJoin(checklistTemplates, eq(checklistItems.templateId, checklistTemplates.id))
    .where(
      and(
        eq(checklistItems.entityType, membership.linkedEntityType),
        eq(checklistItems.entityId, membership.linkedEntityId)
      )
    )
    .orderBy(asc(checklistTemplates.sortOrder));

  return NextResponse.json({
    data: {
      user: {
        name: user?.name,
        email: user?.email,
        role: membership.role,
        linkedEntityType: membership.linkedEntityType,
        linkedEntityId: membership.linkedEntityId,
      },
      entity,
      edition: edition ? {
        name: edition.name,
        startDate: edition.startDate,
        endDate: edition.endDate,
        venue: edition.venue,
      } : null,
      checklistItems: items,
    },
  });
}

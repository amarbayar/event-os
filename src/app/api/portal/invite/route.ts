import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, userOrganizations, speakerApplications, sponsorApplications, venues, booths, volunteerApplications, mediaPartners } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";
import { hash } from "@/lib/password";

// POST — invite a confirmed entity to the stakeholder portal
// Creates a user with role="stakeholder" linked to the entity
export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "checklist", "create");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const { entityType, entityId } = body;

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entityType and entityId required" }, { status: 400 });
  }

  // Look up the entity to get name + email
  const entityTables: Record<string, { table: any; nameField: string; emailField: string }> = {
    speaker: { table: speakerApplications, nameField: "name", emailField: "email" },
    sponsor: { table: sponsorApplications, nameField: "contactName", emailField: "contactEmail" },
    venue: { table: venues, nameField: "contactName", emailField: "contactEmail" },
    booth: { table: booths, nameField: "companyName", emailField: "contactEmail" },
    volunteer: { table: volunteerApplications, nameField: "name", emailField: "email" },
    media: { table: mediaPartners, nameField: "contactName", emailField: "contactEmail" },
  };

  const config = entityTables[entityType];
  if (!config) {
    return NextResponse.json({ error: `Unsupported entity type: ${entityType}` }, { status: 400 });
  }

  // Look up entity by type
  let entity: Record<string, unknown> | undefined;
  if (entityType === "speaker") {
    entity = await db.query.speakerApplications.findFirst({ where: eq(speakerApplications.id, entityId) }) as Record<string, unknown> | undefined;
  } else if (entityType === "sponsor") {
    entity = await db.query.sponsorApplications.findFirst({ where: eq(sponsorApplications.id, entityId) }) as Record<string, unknown> | undefined;
  } else if (entityType === "venue") {
    entity = await db.query.venues.findFirst({ where: eq(venues.id, entityId) }) as Record<string, unknown> | undefined;
  } else if (entityType === "booth") {
    entity = await db.query.booths.findFirst({ where: eq(booths.id, entityId) }) as Record<string, unknown> | undefined;
  } else if (entityType === "volunteer") {
    entity = await db.query.volunteerApplications.findFirst({ where: eq(volunteerApplications.id, entityId) }) as Record<string, unknown> | undefined;
  } else if (entityType === "media") {
    entity = await db.query.mediaPartners.findFirst({ where: eq(mediaPartners.id, entityId) }) as Record<string, unknown> | undefined;
  }

  if (!entity) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  const entityName = (entity[config.nameField] as string) || "";
  const entityEmail = (entity[config.emailField] as string) || "";

  if (!entityEmail) {
    return NextResponse.json({ error: "Entity has no email address — cannot create portal account" }, { status: 400 });
  }

  // Check if user already exists
  const existing = await db.query.users.findFirst({
    where: eq(users.email, entityEmail),
  });

  if (existing) {
    // Check if already a stakeholder for this entity in this org
    const existingMembership = await db.query.userOrganizations.findFirst({
      where: and(
        eq(userOrganizations.userId, existing.id),
        eq(userOrganizations.organizationId, ctx.orgId),
        eq(userOrganizations.role, "stakeholder"),
        eq(userOrganizations.linkedEntityId, entityId),
      ),
    });

    if (existingMembership) {
      return NextResponse.json({ data: { id: existing.id, email: existing.email, alreadyInvited: true } });
    }

    // Add stakeholder membership to this org
    await db.insert(userOrganizations).values({
      userId: existing.id,
      organizationId: ctx.orgId,
      role: "stakeholder",
      linkedEntityType: entityType,
      linkedEntityId: entityId,
    });

    return NextResponse.json({
      data: { id: existing.id, name: existing.name, email: existing.email, role: "stakeholder", portalUrl: `/portal` },
    }, { status: 201 });
  }

  // Create new user + stakeholder membership
  const { randomBytes } = await import("crypto");
  const rawPassword = randomBytes(8).toString("base64url");
  const tempPassword = await hash(rawPassword);

  const [user] = await db
    .insert(users)
    .values({
      name: entityName,
      email: entityEmail,
      passwordHash: tempPassword,
    })
    .returning({ id: users.id, name: users.name, email: users.email });

  await db.insert(userOrganizations).values({
    userId: user.id,
    organizationId: ctx.orgId,
    role: "stakeholder",
    linkedEntityType: entityType,
    linkedEntityId: entityId,
  });

  return NextResponse.json({
    data: {
      ...user,
      role: "stakeholder",
      tempPassword: rawPassword,
      portalUrl: `/portal`,
    },
  }, { status: 201 });
}

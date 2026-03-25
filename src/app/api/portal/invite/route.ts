import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, speakerApplications, sponsorApplications, venues, booths, volunteerApplications, mediaPartners } from "@/db/schema";
import { eq } from "drizzle-orm";
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
  let entityName = "";
  let entityEmail = "";

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

  entityName = (entity[config.nameField] as string) || "";
  entityEmail = (entity[config.emailField] as string) || "";

  if (!entityEmail) {
    return NextResponse.json({ error: "Entity has no email address — cannot create portal account" }, { status: 400 });
  }

  // Check if a stakeholder user already exists for this email
  const existing = await db.query.users.findFirst({
    where: eq(users.email, entityEmail),
  });

  if (existing) {
    // If already a stakeholder for this entity, return success
    if (existing.role === "stakeholder" && existing.linkedEntityId === entityId) {
      return NextResponse.json({ data: { id: existing.id, email: existing.email, alreadyInvited: true } });
    }
    return NextResponse.json({ error: `User with email ${entityEmail} already exists` }, { status: 409 });
  }

  // Create stakeholder user with random temp password
  const { randomBytes } = await import("crypto");
  const rawPassword = randomBytes(8).toString("base64url");
  const tempPassword = await hash(rawPassword);

  const [user] = await db
    .insert(users)
    .values({
      name: entityName,
      email: entityEmail,
      passwordHash: tempPassword,
      organizationId: ctx.orgId,
      role: "stakeholder",
      linkedEntityType: entityType,
      linkedEntityId: entityId,
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    });

  return NextResponse.json({
    data: {
      ...user,
      tempPassword: rawPassword, // Show once to organizer so they can share it
      portalUrl: `/portal`,
    },
  }, { status: 201 });
}

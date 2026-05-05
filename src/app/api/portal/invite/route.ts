import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, userOrganizations, organizations } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";
import { hash } from "@/lib/password";
import { mail } from "@/lib/mail";
import { portalInvite } from "@/lib/mail/mailables/portal-invite";
import { portalAdded } from "@/lib/mail/mailables/portal-added";
import { absoluteAppUrl } from "@/lib/app-url";
import { normalizeEmail } from "@/lib/email";
import {
  findStakeholderEntity,
  getStakeholderEntityConfig,
} from "@/lib/stakeholder-entities";

async function sendPortalMail(
  to: Parameters<typeof mail>[0],
  mailable: Parameters<typeof mail>[1],
  options: Parameters<typeof mail>[2],
  errorMessage: string
) {
  try {
    const mailResult = await mail(to, mailable, options);
    if (mailResult.success) return null;
  } catch (error) {
    console.error("Portal invite email failed:", error);
  }

  return NextResponse.json({ error: errorMessage }, { status: 502 });
}

// POST — invite a confirmed entity to the stakeholder portal
// Creates a user with role="stakeholder" linked to the entity
export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission(req, "checklist", "create");
    if (isRbacError(ctx)) return ctx;

    const body = await req.json();
    const { entityType, entityId, resend } = body;

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "entityType and entityId required" }, { status: 400 });
    }

    const config = getStakeholderEntityConfig(entityType);
    if (!config) {
      return NextResponse.json({ error: `Unsupported entity type: ${entityType}` }, { status: 400 });
    }

    const entity = await findStakeholderEntity(entityType, entityId);

    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    const entityName = (entity[config.nameField] as string) || "";
    const entityEmail = normalizeEmail(entity[config.emailField]);
    const entityStage = (entity.stage as string | undefined) || null;
    const portalUrl = absoluteAppUrl("/login?callbackUrl=%2Fportal", req);
    const shouldExposeTempPassword = (process.env.MAIL_DRIVER || "log") === "log";

    if (!entityEmail) {
      return NextResponse.json({ error: "Entity has no email address — cannot create portal account" }, { status: 400 });
    }

    if (entityStage && entityStage !== "confirmed") {
      return NextResponse.json(
        { error: "Entity must be confirmed before portal access can be granted" },
        { status: 400 }
      );
    }

  // Get org name (for email templates) and check for existing user in parallel
    const [org, existing] = await Promise.all([
      db.query.organizations.findFirst({
        where: eq(organizations.id, ctx.orgId),
        columns: { name: true },
      }),
      db.query.users.findFirst({
        where: sql`lower(trim(${users.email})) = ${entityEmail}`,
      }),
    ]);
    const orgName = org?.name || "your organization";

  if (existing) {
    // user_organizations is unique per user/org. A user cannot also be invited
    // as a different stakeholder assignment without changing the membership.
    const existingMembership = await db.query.userOrganizations.findFirst({
      where: and(
        eq(userOrganizations.userId, existing.id),
        eq(userOrganizations.organizationId, ctx.orgId)
      ),
    });

    if (existingMembership) {
      const isSameStakeholderAssignment =
        existingMembership.role === "stakeholder" &&
        existingMembership.linkedEntityType === entityType &&
        existingMembership.linkedEntityId === entityId;

      if (!isSameStakeholderAssignment) {
        return NextResponse.json(
          { error: "This email already belongs to an organization member with another role or portal assignment." },
          { status: 409 }
        );
      }

      if (!resend) {
        return NextResponse.json({
          data: {
            id: existing.id,
            email: existing.email,
            alreadyInvited: true,
            portalUrl,
          },
        });
      }

      if (existing.forcePasswordChange) {
        const { randomBytes } = await import("crypto");
        const rawPassword = randomBytes(8).toString("base64url");
        const passwordHash = await hash(rawPassword);

        await db
          .update(users)
          .set({
            passwordHash,
            forcePasswordChange: true,
          })
          .where(eq(users.id, existing.id));

        const mailError = await sendPortalMail(
          { email: existing.email, name: existing.name || entityName || undefined },
          portalInvite({
            name: existing.name || entityName,
            tempPassword: rawPassword,
            portalUrl,
            organizationName: orgName,
          }),
          {
            orgId: ctx.orgId,
            entityType,
            entityId,
            disableDeduplication: true,
          },
          "Failed to send portal invite email"
        );

        if (mailError) return mailError;

        return NextResponse.json({
          data: {
            id: existing.id,
            email: existing.email,
            alreadyInvited: true,
            resent: true,
            portalUrl,
            ...(shouldExposeTempPassword ? { tempPassword: rawPassword } : {}),
          },
        });
      }

      const mailError = await sendPortalMail(
        { email: existing.email, name: existing.name || entityName || undefined },
        portalAdded({ name: existing.name || entityName, portalUrl, organizationName: orgName }),
        {
          orgId: ctx.orgId,
          entityType,
          entityId,
          disableDeduplication: true,
        },
        "Failed to send portal access email"
      );

      if (mailError) return mailError;

      return NextResponse.json({
        data: {
          id: existing.id,
          email: existing.email,
          alreadyInvited: true,
          resent: true,
          portalUrl,
        },
      });
    }

    // Add stakeholder membership to this org
    await db.insert(userOrganizations).values({
      userId: existing.id,
      organizationId: ctx.orgId,
      role: "stakeholder",
      linkedEntityType: entityType,
      linkedEntityId: entityId,
    });

    // Notify existing user they've been added to a new org
    const mailError = await sendPortalMail(
      { email: existing.email, name: existing.name || undefined },
      portalAdded({ name: existing.name || entityName, portalUrl, organizationName: orgName }),
      { orgId: ctx.orgId, entityType, entityId },
      "Failed to send portal access email"
    );

    if (mailError) return mailError;

    return NextResponse.json({
      data: { id: existing.id, name: existing.name, email: existing.email, role: "stakeholder", portalUrl },
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
      forcePasswordChange: true,
    })
    .returning({ id: users.id, name: users.name, email: users.email });

  await db.insert(userOrganizations).values({
    userId: user.id,
    organizationId: ctx.orgId,
    role: "stakeholder",
    linkedEntityType: entityType,
    linkedEntityId: entityId,
  });

  // Send portal invite email with temp password
  const mailError = await sendPortalMail(
    { email: entityEmail, name: entityName },
    portalInvite({ name: entityName, tempPassword: rawPassword, portalUrl, organizationName: orgName }),
    { orgId: ctx.orgId, entityType, entityId },
    "Failed to send portal invite email"
  );

  if (mailError) return mailError;

    return NextResponse.json({
      data: {
        ...user,
        role: "stakeholder",
        ...(shouldExposeTempPassword ? { tempPassword: rawPassword } : {}),
        portalUrl,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Portal invite failed:", error);
    return NextResponse.json({ error: "Failed to create portal invite" }, { status: 500 });
  }
}

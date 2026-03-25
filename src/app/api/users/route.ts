import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, userOrganizations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getActiveIds } from "@/lib/queries";
import { hash } from "@/lib/password";

// GET — list all users in the current organization
export async function GET() {
  const ids = await getActiveIds();
  if (!ids) return NextResponse.json({ error: "No active organization" }, { status: 400 });

  const orgUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: userOrganizations.role,
      image: users.image,
      createdAt: users.createdAt,
    })
    .from(userOrganizations)
    .innerJoin(users, eq(userOrganizations.userId, users.id))
    .where(eq(userOrganizations.organizationId, ids.orgId));

  return NextResponse.json({ data: orgUsers });
}

// POST — invite a new user to the organization
export async function POST(req: NextRequest) {
  const ids = await getActiveIds();
  if (!ids) return NextResponse.json({ error: "No active organization" }, { status: 400 });

  const body = await req.json();
  const { name, email, role } = body;

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const validRoles = ["owner", "admin", "organizer", "coordinator", "viewer", "stakeholder"];
  const userRole = validRoles.includes(role) ? role : "organizer";

  // Check if user already exists
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existing) {
    // Check if they're already a member of this org
    const existingMembership = await db.query.userOrganizations.findFirst({
      where: and(
        eq(userOrganizations.userId, existing.id),
        eq(userOrganizations.organizationId, ids.orgId)
      ),
    });

    if (existingMembership) {
      return NextResponse.json({ error: "User is already a member of this organization" }, { status: 409 });
    }

    // Add existing user to this org
    await db.insert(userOrganizations).values({
      userId: existing.id,
      organizationId: ids.orgId,
      role: userRole,
      linkedEntityType: body.linkedEntityType || null,
      linkedEntityId: body.linkedEntityId || null,
    });

    return NextResponse.json({
      data: { id: existing.id, name: existing.name, email: existing.email, role: userRole, createdAt: existing.createdAt },
    }, { status: 201 });
  }

  // Create new user + membership
  const tempPassword = await hash("changeme123");

  const [user] = await db
    .insert(users)
    .values({
      name: name || email.split("@")[0],
      email,
      passwordHash: tempPassword,
      organizationId: ids.orgId,
      role: userRole,
      linkedEntityType: body.linkedEntityType || null,
      linkedEntityId: body.linkedEntityId || null,
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    });

  await db.insert(userOrganizations).values({
    userId: user.id,
    organizationId: ids.orgId,
    role: userRole,
    linkedEntityType: body.linkedEntityType || null,
    linkedEntityId: body.linkedEntityId || null,
  });

  return NextResponse.json({ data: user }, { status: 201 });
}

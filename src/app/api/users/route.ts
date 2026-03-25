import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getActiveIds } from "@/lib/queries";
import { hash } from "@/lib/password";

// GET — list all users in the current organization
export async function GET() {
  const ids = await getActiveIds();
  if (!ids) return NextResponse.json({ error: "No active organization" }, { status: 400 });

  const orgUsers = await db.query.users.findMany({
    where: eq(users.organizationId, ids.orgId),
    columns: {
      id: true,
      name: true,
      email: true,
      role: true,
      image: true,
      createdAt: true,
    },
  });

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

  // Check if email already exists in this org
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  const validRoles = ["owner", "admin", "organizer", "coordinator", "viewer"];
  const userRole = validRoles.includes(role) ? role : "organizer";

  // Create with a temporary password — user should reset on first login
  const tempPassword = await hash("changeme123");

  const [user] = await db
    .insert(users)
    .values({
      name: name || email.split("@")[0],
      email,
      passwordHash: tempPassword,
      organizationId: ids.orgId,
      role: userRole,
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    });

  return NextResponse.json({ data: user }, { status: 201 });
}

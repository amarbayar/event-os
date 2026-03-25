import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { organizations, eventSeries, eventEditions, tracks, users, userOrganizations } from "@/db/schema";
import { hash } from "@/lib/password";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    orgName,
    eventName,
    startDate,
    endDate,
    venue,
    timezone,
    userName,
    userEmail,
    userPassword,
  } = body;

  if (!orgName || !eventName || !userEmail || !userPassword) {
    return NextResponse.json(
      { error: "orgName, eventName, userEmail, and userPassword are required" },
      { status: 400 }
    );
  }

  const slug = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const eventSlug = eventName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Create organization
  const [org] = await db
    .insert(organizations)
    .values({ name: orgName, slug })
    .returning();

  // Create event series
  const [series] = await db
    .insert(eventSeries)
    .values({
      organizationId: org.id,
      name: eventName.replace(/\s*\d{4}$/, ""), // strip year if present
      slug: eventSlug.replace(/-\d{4}$/, ""),
      description: `${eventName} event series`,
    })
    .returning();

  // Create event edition
  const [edition] = await db
    .insert(eventEditions)
    .values({
      seriesId: series.id,
      organizationId: org.id,
      name: eventName,
      slug: eventSlug,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      venue: venue || null,
      status: "draft",
      agendaStatus: "draft",
      cfpOpen: false,
      timezone: timezone || "Asia/Ulaanbaatar",
    })
    .returning();

  // Create default tracks
  await db.insert(tracks).values([
    { editionId: edition.id, name: "Main Stage", color: "#eab308", sortOrder: 0 },
    { editionId: edition.id, name: "Workshop Room", color: "#047857", sortOrder: 1 },
  ]);

  // Create admin user
  const passwordHash = await hash(userPassword);
  const [user] = await db
    .insert(users)
    .values({
      name: userName || userEmail.split("@")[0],
      email: userEmail,
      passwordHash,
      organizationId: org.id,
      role: "owner",
    })
    .returning();

  // Create membership in user_organizations
  await db.insert(userOrganizations).values({
    userId: user.id,
    organizationId: org.id,
    role: "owner",
  });

  return NextResponse.json(
    {
      data: {
        organization: { id: org.id, name: org.name, slug: org.slug },
        edition: { id: edition.id, name: edition.name, slug: edition.slug },
        user: { id: user.id, email: user.email, name: user.name },
      },
    },
    { status: 201 }
  );
}

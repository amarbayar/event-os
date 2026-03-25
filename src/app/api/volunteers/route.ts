import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { volunteerApplications } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "volunteer", "read");
  if (isRbacError(ctx)) return ctx;

  const rows = await db.query.volunteerApplications.findMany({
    where: eq(volunteerApplications.editionId, ctx.editionId),
    orderBy: desc(volunteerApplications.createdAt),
  });

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "volunteer", "create");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const { name, email, phone, role, availability, tshirtSize, experience, source, stage, assignedTo } = body;

  if (!name || !email) {
    return NextResponse.json(
      { error: "name and email are required" },
      { status: 400 }
    );
  }

  const [volunteer] = await db
    .insert(volunteerApplications)
    .values({
      editionId: ctx.editionId,
      organizationId: ctx.orgId,
      name,
      email,
      phone: phone || null,
      role: role || null,
      availability: availability || null,
      tshirtSize: tshirtSize || null,
      experience: experience || null,
      source: source || "intake",
      stage: stage || "lead",
      assignedTo: assignedTo || null,
    })
    .returning();

  return NextResponse.json({ data: volunteer }, { status: 201 });
}

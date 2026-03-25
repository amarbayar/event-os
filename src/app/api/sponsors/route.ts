import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sponsorApplications } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "sponsor", "read");
  if (isRbacError(ctx)) return ctx;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  const conditions = [eq(sponsorApplications.editionId, ctx.editionId)];
  if (status && status !== "all") {
    conditions.push(eq(sponsorApplications.status, status));
  }

  const sponsors = await db.query.sponsorApplications.findMany({
    where: and(...conditions),
    orderBy: desc(sponsorApplications.createdAt),
  });

  return NextResponse.json({ data: sponsors });
}

export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "sponsor", "create");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const { companyName, contactName, contactEmail, packagePreference, message, source, stage, assignedTo } = body;

  if (!companyName) {
    return NextResponse.json(
      { error: "companyName is required" },
      { status: 400 }
    );
  }

  const [sponsor] = await db
    .insert(sponsorApplications)
    .values({
      editionId: ctx.editionId,
      organizationId: ctx.orgId,
      companyName,
      contactName: contactName || "",
      contactEmail: contactEmail || "",
      packagePreference: packagePreference || null,
      message: message || null,
      status: "pending",
      source: source || "intake",
      stage: stage || "lead",
      assignedTo: assignedTo || null,
    })
    .returning();

  return NextResponse.json({ data: sponsor }, { status: 201 });
}

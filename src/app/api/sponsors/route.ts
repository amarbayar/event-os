import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sponsorApplications } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getActiveIds } from "@/lib/queries";

export async function GET(req: NextRequest) {
  const ids = await getActiveIds();
  if (!ids) return NextResponse.json({ data: [] });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  const conditions = [eq(sponsorApplications.editionId, ids.editionId)];
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
  const ids = await getActiveIds();
  if (!ids) return NextResponse.json({ error: "No active edition" }, { status: 400 });

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
      editionId: ids.editionId,
      organizationId: ids.orgId,
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

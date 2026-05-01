import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attendees, invitations } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import { requirePermission, isRbacError } from "@/lib/rbac";

type DbTransaction = Awaited<
  ReturnType<typeof import("@/db/connection").createConnection>
>["db"];

function generateQrHash(input: string): string {
  const salt = randomBytes(8).toString("hex");
  return createHash("sha256").update(`${input}-${salt}`).digest("hex").slice(0, 32);
}

export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "invitation", "read");
  if (isRbacError(ctx)) return ctx;

  const rows = await db.query.invitations.findMany({
    where: eq(invitations.editionId, ctx.editionId),
    orderBy: desc(invitations.createdAt),
  });

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "invitation", "create");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const { name, type, email, invitedBy, sourceType, sourceId, notes, source, stage, assignedTo } = body;

  if (!name || !type) {
    return NextResponse.json(
      { error: "name and type are required" },
      { status: 400 }
    );
  }

  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const qrHash = generateQrHash(`${ctx.editionId}-${normalizedEmail || name}`);

  const invitation = await db.transaction(async (tx: DbTransaction) => {
    const [createdInvitation] = await tx
      .insert(invitations)
      .values({
        editionId: ctx.editionId,
        organizationId: ctx.orgId,
        name,
        type,
        email: normalizedEmail || null,
        invitedBy: invitedBy || null,
        sourceType: sourceType || null,
        sourceId: sourceId || null,
        notes: notes || null,
        source: source || "intake",
        stage: stage || "lead",
        assignedTo: assignedTo || null,
        qrHash,
      })
      .returning();

    await tx.insert(attendees).values({
      editionId: ctx.editionId,
      organizationId: ctx.orgId,
      name,
      email: normalizedEmail,
      ticketType: type,
      qrHash,
      source: "internal",
      stage: "confirmed",
      assignedTo: assignedTo || null,
    });

    return createdInvitation;
  });

  return NextResponse.json({ data: invitation }, { status: 201 });
}

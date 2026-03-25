import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { checklistTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

// DELETE — remove a checklist template
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "checklist", "delete");
  if (isRbacError(ctx)) return ctx;

  const [deleted] = await db
    .delete(checklistTemplates)
    .where(eq(checklistTemplates.id, id))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { id } });
}

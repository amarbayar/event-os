import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isRbacError } from "@/lib/rbac";
import { detectConflicts } from "@/lib/conflicts";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ editionId: string }> }
) {
  const { editionId } = await params;
  const ctx = await requirePermission(req, "session", "read");
  if (isRbacError(ctx)) return ctx;

  const conflicts = await detectConflicts(editionId);

  return NextResponse.json({ data: conflicts });
}

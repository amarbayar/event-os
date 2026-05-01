import { NextRequest } from "next/server";
import { corsJson, corsOptions } from "@/lib/public-api";
import { listPublicTicketTypes } from "@/lib/ticketing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return corsOptions(req);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const result = await listPublicTicketTypes(slug);

  if (!result) {
    return corsJson(req, { error: "Event not found" }, { status: 404 });
  }

  return corsJson(req, { data: result });
}

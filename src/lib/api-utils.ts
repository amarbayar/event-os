import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateServiceToken } from "@/lib/service-token";

export type ApiContext = {
  organizationId: string;
  userId?: string;
  source: "web" | "api";
};

export async function getApiContext(
  req: NextRequest
): Promise<ApiContext | NextResponse> {
  // Check service token first (for OpenClaw/Telegram agent)
  if (validateServiceToken(req)) {
    const orgId = req.headers.get("x-organization-id");
    if (!orgId) {
      return NextResponse.json(
        { error: "x-organization-id header required for service token auth" },
        { status: 400 }
      );
    }
    return { organizationId: orgId, source: "api" };
  }

  // Session auth (for web app)
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.user.organizationId) {
    return NextResponse.json(
      { error: "No organization associated" },
      { status: 403 }
    );
  }

  return {
    organizationId: session.user.organizationId,
    userId: session.user.id,
    source: "web",
  };
}

export function checkVersion(
  ifMatch: string | null,
  currentVersion: number
): NextResponse | null {
  if (ifMatch !== null) {
    const requestedVersion = parseInt(ifMatch, 10);
    if (isNaN(requestedVersion) || requestedVersion !== currentVersion) {
      return NextResponse.json(
        {
          error: "Conflict",
          message:
            "This record was modified by someone else. Please refresh and try again.",
          currentVersion,
        },
        { status: 409 }
      );
    }
  }
  return null;
}

// Stage protection: non-admins can't delete confirmed entities
// Confirmed entities have checklists, portal users, and downstream dependencies.
export function checkStageProtection(
  stage: string | null | undefined,
  role: string
): NextResponse | null {
  if (stage === "confirmed" && role !== "owner" && role !== "admin") {
    return NextResponse.json(
      { error: "Confirmed records can't be deleted. Only admins can delete confirmed records." },
      { status: 403 }
    );
  }
  return null;
}

export function paginationParams(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || "50", 10),
    200
  );
  const cursor = url.searchParams.get("cursor") || undefined;
  return { limit, cursor };
}

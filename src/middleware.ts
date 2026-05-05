import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Routes that don't require authentication
const publicPaths = [
  "/login",
  "/onboarding",
  "/claim",
  "/change-password",
  "/api/auth",
  "/api/onboarding",
  "/api/public",
  "/api/payments/bonum/webhook",
  "/api/payments/stripe/webhook",
  "/apply",
  "/agenda",
  "/_next",
  "/favicon.ico",
  "/site.webmanifest",
];

const stakeholderAllowedApiPaths = [
  "/api/auth",
  "/api/checklist-items",
  "/api/portal/me",
  "/api/portal/update-profile",
  "/api/upload",
];

function isStakeholderAllowedPath(pathname: string): boolean {
  return (
    pathname === "/portal" ||
    pathname.startsWith("/portal/") ||
    pathname === "/change-password" ||
    stakeholderAllowedApiPaths.some((path) => pathname.startsWith(path))
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Allow API routes with Bearer token — downstream requirePermission() validates the actual token.
  // The middleware does NOT validate the token itself; it lets Bearer requests through to the
  // route handler which calls requirePermission() with timing-safe service token comparison.
  if (
    pathname.startsWith("/api/") &&
    request.headers.get("authorization")?.startsWith("Bearer ")
  ) {
    return NextResponse.next();
  }

  // Check for session token (NextAuth stores it as a cookie)
  const sessionToken =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value ||
    request.cookies.get("next-auth.session-token")?.value ||
    request.cookies.get("__Secure-next-auth.session-token")?.value;

  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check forcePasswordChange flag in JWT
  let token: Awaited<ReturnType<typeof getToken>> | null = null;
  try {
    token = await getToken({ req: request });
    if (token?.forcePasswordChange && pathname !== "/change-password") {
      const changePasswordUrl = new URL("/change-password", request.url);
      changePasswordUrl.searchParams.set(
        "callbackUrl",
        `${pathname}${request.nextUrl.search}`
      );
      return NextResponse.redirect(changePasswordUrl);
    }
  } catch {
    // JWT decode failed — let the request through, auth() will handle it
  }

  if (token?.role === "stakeholder" && !isStakeholderAllowedPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Forbidden", message: "Stakeholder accounts can only access the portal." },
        { status: 403 }
      );
    }

    return NextResponse.redirect(new URL("/portal", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

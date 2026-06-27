import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { verifySessionTokenEdge } from "@/lib/auth/edge-session";

/**
 * Private-beta gate. Protects app routes; lets through the access page, its API, static
 * assets, and the public privacy page. Disabled when BETA_GATE_ENABLED is not "true".
 */

const PUBLIC_PATHS = ["/access", "/privacy", "/api/access"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  // Next internals + static assets.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname === "/manifest.webmanifest" ||
    /\.(png|jpg|jpeg|svg|ico|webmanifest|txt|woff2?)$/.test(pathname)
  ) {
    return true;
  }
  return false;
}

export async function middleware(req: NextRequest) {
  const gateEnabled = (process.env.BETA_GATE_ENABLED ?? "true") === "true";
  if (!gateEnabled) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const secret = process.env.BETA_SESSION_SECRET ?? "";
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const valid = await verifySessionTokenEdge(token, secret);

  if (valid) return NextResponse.next();

  // Redirect humans to the access page; reject API calls with 401.
  if (pathname.startsWith("/api/")) {
    return new NextResponse(JSON.stringify({ error: "Private beta access required." }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/access";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

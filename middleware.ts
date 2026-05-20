import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE   = "admin_token";
const ALLOWED_IP       = process.env.ADMIN_ALLOWED_IP ?? "";
const ADMIN_LOGIN_PATH = process.env.ADMIN_LOGIN_PATH ?? "/admin/login";

function getSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

function getClientIP(req: NextRequest): string {
  // Try Vercel's dedicated header first
  const vercelIP = req.headers.get("x-vercel-forwarded-for");
  if (vercelIP) return vercelIP.split(",")[0].trim();

  // Fallback: x-forwarded-for first entry
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // DEBUG endpoint — visit /admin/debug-ip to see your real IP
  if (pathname === "/admin/debug-ip") {
    const ip = getClientIP(req);
    return new NextResponse(
      [
        `Your IP: ${ip}`,
        `x-vercel-forwarded-for: ${req.headers.get("x-vercel-forwarded-for") ?? "none"}`,
        `x-forwarded-for: ${req.headers.get("x-forwarded-for") ?? "none"}`,
        `x-real-ip: ${req.headers.get("x-real-ip") ?? "none"}`,
      ].join("\n"),
      { status: 200, headers: { "content-type": "text/plain" } }
    );
  }

  const ip = getClientIP(req);

  // 1. Block everyone except allowed IP
  if (ALLOWED_IP && ip !== ALLOWED_IP) {
    return new NextResponse("404 Not Found", { status: 404 });
  }

  // 2. Always allow auth API
  if (pathname.startsWith("/api/admin/auth")) {
    return NextResponse.next();
  }

  // 3. Allow login page (only reachable if IP passed step 1)
  if (pathname === ADMIN_LOGIN_PATH) {
    return NextResponse.next();
  }

  // 4. Hide default /admin/login if custom path is set
  if (ADMIN_LOGIN_PATH !== "/admin/login" && pathname === "/admin/login") {
    return new NextResponse("404 Not Found", { status: 404 });
  }

  // 5. Verify JWT
  const token  = req.cookies.get(SESSION_COOKIE)?.value;
  const secret = getSecret();

  if (!token || !secret) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, req.url));
  }

  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, req.url));
  }
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
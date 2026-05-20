import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE   = "admin_token";
const ADMIN_LOGIN_PATH = process.env.ADMIN_LOGIN_PATH ?? "/admin/login";

function getSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Always allow auth API
  if (pathname.startsWith("/api/admin/auth")) {
    return NextResponse.next();
  }

  // 2. Allow login page
  if (pathname === ADMIN_LOGIN_PATH) {
    return NextResponse.next();
  }

  // 3. Hide default /admin/login if custom path is set
  if (ADMIN_LOGIN_PATH !== "/admin/login" && pathname === "/admin/login") {
    return new NextResponse("404 Not Found", { status: 404 });
  }

  // 4. Verify JWT
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
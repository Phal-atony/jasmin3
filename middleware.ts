import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "admin_token";

const ADMIN_HOME_PATH = "/admin";
const ADMIN_LOGIN_PATH = process.env.ADMIN_LOGIN_PATH || "/admin/sophallogin";
const HONEY_PATH = "/admin/login";

const LOGIN_PATHS = new Set([
  ADMIN_LOGIN_PATH,
  "/admin/login",
  "/admin/sophallogin",
]);

// ✅ Valid admin routes — unknown paths will NOT reveal the real login URL
const VALID_ADMIN_PREFIXES = [
  "/admin/audit-logs",
  "/admin/banlist",
  "/admin/banners",
  "/admin/blog",
  "/admin/customers",
  "/admin/faqs",
  "/admin/games",
  "/admin/orders",
  "/admin/products",
  "/admin/promo-codes",
  "/admin/settings",
  "/admin/login",
  "/admin/sophallogin",
];

function isValidAdminPath(pathname: string): boolean {
  if (pathname === ADMIN_HOME_PATH) return true;

  return VALID_ADMIN_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

function isAdminArea(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin");
}

function getSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;

  if (!secret) {
    return null;
  }

  return new TextEncoder().encode(secret);
}

async function isValidAdminToken(token?: string) {
  const secret = getSecret();

  if (!token || !secret) {
    return false;
  }

  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

function generateNonce(): string {
  return btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))
  );
}

function buildCspHeader(nonce: string, isProduction: boolean): string {
  const turnstile = "https://challenges.cloudflare.com";

  const scriptSrc = isProduction
    ? `'self' 'nonce-${nonce}' ${turnstile}`
    : `'self' 'unsafe-inline' 'unsafe-eval' ${turnstile}`;

  const styleSrc = isProduction
    ? `'self' 'nonce-${nonce}' https://fonts.googleapis.com`
    : `'self' 'unsafe-inline' https://fonts.googleapis.com`;

  const connectSrc = isProduction
    ? `'self' https: ${turnstile}`
    : `'self' http://localhost:* ws://localhost:* wss: https: ${turnstile}`;

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    `connect-src ${connectSrc}`,

    // ✅ Required for Cloudflare Turnstile iframe
    `frame-src 'self' ${turnstile}`,

    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    isProduction ? "upgrade-insecure-requests" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function addSecurityHeaders(
  response: NextResponse,
  cspHeader: string,
  nonce: string,
  isProduction: boolean
): NextResponse {
  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("x-nonce", nonce);

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  if (isProduction) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  return response;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const nonce = generateNonce();
  const isProduction = process.env.NODE_ENV === "production";
  const cspHeader = buildCspHeader(nonce, isProduction);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  function nextResponse(): NextResponse {
    return addSecurityHeaders(
      NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      }),
      cspHeader,
      nonce,
      isProduction
    );
  }

  function redirectResponse(url: URL): NextResponse {
    return addSecurityHeaders(
      NextResponse.redirect(url),
      cspHeader,
      nonce,
      isProduction
    );
  }

  function jsonUnauthorized(): NextResponse {
    return addSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      cspHeader,
      nonce,
      isProduction
    );
  }

  // ✅ For normal pages like homepage, only apply CSP/security headers.
  // Do not waste time verifying admin JWT.
  if (!isAdminArea(pathname)) {
    return nextResponse();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const isLoggedIn = await isValidAdminToken(token);

  // ✅ Allow admin auth APIs
  if (pathname.startsWith("/api/admin/auth")) {
    return nextResponse();
  }

  // ✅ Login pages
  if (LOGIN_PATHS.has(pathname)) {
    if (isLoggedIn) {
      return redirectResponse(new URL(ADMIN_HOME_PATH, req.url));
    }

    return nextResponse();
  }

  // ✅ Honeypot page
  if (pathname === HONEY_PATH) {
    if (isLoggedIn) {
      return redirectResponse(new URL(ADMIN_HOME_PATH, req.url));
    }

    return nextResponse();
  }

  // ✅ Not logged in + exact /admin → redirect to honeypot
  if (!isLoggedIn && pathname === ADMIN_HOME_PATH) {
    return redirectResponse(new URL(HONEY_PATH, req.url));
  }

  // ✅ Not logged in + protected admin API → 401
  if (!isLoggedIn && pathname.startsWith("/api/admin")) {
    return jsonUnauthorized();
  }

  // ✅ Not logged in + valid protected admin page → real login
  if (!isLoggedIn && isValidAdminPath(pathname)) {
    return redirectResponse(new URL(ADMIN_LOGIN_PATH, req.url));
  }

  // ✅ Not logged in + UNKNOWN admin path → honeypot, not real login
  if (!isLoggedIn && pathname.startsWith("/admin")) {
    return redirectResponse(new URL(HONEY_PATH, req.url));
  }

  // ✅ Logged in → allow
  return nextResponse();
}

export const config = {
  matcher: [
    /*
      Apply CSP/security headers to normal pages and API routes,
      but skip Next.js static/image assets and common static files.
    */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml)$).*)",
  ],
};
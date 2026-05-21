<<<<<<< HEAD
=======
/**
 * lib/auth.ts — Admin authentication helpers (Issue #7)
 *
 * Changes:
 * - Session lifetime reduced from 7d → 8h
 * - getCurrentAdmin now verifies admin is active + role is ADMIN/SUPERADMIN
 * - Secure cookie cleared properly on logout
 */

>>>>>>> 13d2b43 (first commit)
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const ADMIN_COOKIE_NAME = "admin_token";
<<<<<<< HEAD

function getAdminJwtSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;

  if (!secret) {
    throw new Error("ADMIN_JWT_SECRET is not set");
  }

=======
// Reduced from 7 days to 8 hours (Issue #7)
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

function getAdminJwtSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error("ADMIN_JWT_SECRET is not set");
  }
>>>>>>> 13d2b43 (first commit)
  return secret;
}

export function signAdminToken(adminId: string) {
<<<<<<< HEAD
  return jwt.sign(
    {
      adminId,
    },
    getAdminJwtSecret(),
    {
      expiresIn: "7d",
    }
  );
=======
  return jwt.sign({ adminId }, getAdminJwtSecret(), {
    expiresIn: SESSION_MAX_AGE_SECONDS,
  });
>>>>>>> 13d2b43 (first commit)
}

export function verifyAdminToken(token: string) {
  try {
    return jwt.verify(token, getAdminJwtSecret()) as {
      adminId: string;
      iat: number;
      exp: number;
    };
  } catch {
    return null;
  }
}

export function buildAuthCookie(token: string) {
  const isProduction = process.env.NODE_ENV === "production";

  return [
    `${ADMIN_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
<<<<<<< HEAD
    "Max-Age=604800",
=======
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
>>>>>>> 13d2b43 (first commit)
    isProduction ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function buildClearCookie() {
<<<<<<< HEAD
=======
  const isProduction = process.env.NODE_ENV === "production";
>>>>>>> 13d2b43 (first commit)
  return [
    `${ADMIN_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
<<<<<<< HEAD
  ].join("; ");
}

=======
    isProduction ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

/**
 * Returns the current admin if:
 * 1. A valid, unexpired JWT cookie exists
 * 2. The admin exists in the database
 * 3. The admin is active
 * 4. The admin role is ADMIN or SUPERADMIN
 *
 * Returns null for any failure — callers must treat null as unauthorized.
 */
>>>>>>> 13d2b43 (first commit)
export async function getCurrentAdmin() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = verifyAdminToken(token);
    if (!payload) return null;

<<<<<<< HEAD
    return await prisma.admin.findUnique({
      where: { id: payload.adminId },
    });
=======
    const admin = await prisma.admin.findUnique({
      where: { id: payload.adminId },
    });

    if (!admin) return null;
    if (!admin.active) return null;
    if (admin.role !== "ADMIN" && admin.role !== "SUPERADMIN") return null;

    return admin;
>>>>>>> 13d2b43 (first commit)
  } catch {
    return null;
  }
}

<<<<<<< HEAD
export { ADMIN_COOKIE_NAME };
=======
export { ADMIN_COOKIE_NAME, SESSION_MAX_AGE_SECONDS };
>>>>>>> 13d2b43 (first commit)

<<<<<<< HEAD
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { timingSafeEqual } from "crypto";

import { prisma } from "@/lib/prisma";
import { signAdminToken } from "@/lib/auth";
=======
/**
 * /api/admin/auth/2fa — TOTP-based 2FA (Issue #1)
 *
 * Replaces static ADMIN_2FA_CODE with TOTP via otplib.
 * The admin's TOTP secret is stored in Admin.totpSecret (encrypted at rest
 * via the DATABASE_URL connection — ensure SSL in production).
 *
 * Setup flow  : GET /api/admin/auth/2fa/setup  → returns QR + secret
 * Verify flow : POST /api/admin/auth/2fa        → verifies 6-digit TOTP code
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";

import { prisma } from "@/lib/prisma";
import { signAdminToken, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/secureLogger";
>>>>>>> 13d2b43 (first commit)

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

<<<<<<< HEAD
=======
// TOTP window: accept 1 step before/after (handles ~60s clock drift)
authenticator.options = { window: 1 };

>>>>>>> 13d2b43 (first commit)
const PENDING_2FA_COOKIE = "admin_2fa_pending";
const ADMIN_COOKIE_NAME = "admin_token";

const verifySchema = z.object({
<<<<<<< HEAD
  code: z.string().min(1),
});

type Pending2FAPayload = {
  type?: string;
  adminId?: string;
  email?: string;
};

=======
  code: z.string().length(6).regex(/^\d{6}$/),
});

>>>>>>> 13d2b43 (first commit)
function getAdminJwtSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("ADMIN_JWT_SECRET is not set");
  return secret;
}

<<<<<<< HEAD
function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}
=======
type Pending2FAPayload = {
  type?: string;
  adminId?: string;
  email?: string;
};
>>>>>>> 13d2b43 (first commit)

function decodePendingToken(token: string): Pending2FAPayload | null {
  try {
    return jwt.verify(token, getAdminJwtSecret()) as Pending2FAPayload;
  } catch {
    return null;
  }
}

<<<<<<< HEAD
// ✅ GET — check 2FA lock + session status (used by frontend on page refresh)
=======
// ── GET: check 2FA lock / session status ────────────────────────────────────
>>>>>>> 13d2b43 (first commit)
export async function GET(req: NextRequest) {
  const pendingToken = req.cookies.get(PENDING_2FA_COOKIE)?.value;

  if (!pendingToken) {
    return NextResponse.json({ step: "login", locked: false });
  }

  const payload = decodePendingToken(pendingToken);
<<<<<<< HEAD

=======
>>>>>>> 13d2b43 (first commit)
  if (!payload?.adminId || payload.type !== "admin-2fa-pending") {
    return NextResponse.json({ step: "login", locked: false });
  }

  const identifier = `admin-2fa:${payload.adminId}`;
  const lock = await prisma.adminAuthLock.findUnique({ where: { identifier } });

  if (lock?.forever) {
    return NextResponse.json({ step: "2fa", locked: true, forever: true });
  }
<<<<<<< HEAD

=======
>>>>>>> 13d2b43 (first commit)
  if (lock?.lockedUntil && lock.lockedUntil > new Date()) {
    return NextResponse.json({
      step: "2fa",
      locked: true,
      forever: false,
      lockedUntil: lock.lockedUntil,
    });
  }

<<<<<<< HEAD
  return NextResponse.json({ step: "2fa", locked: false, email: payload.email });
}

export async function POST(req: NextRequest) {
=======
  // Tell frontend whether TOTP is already configured
  const admin = await prisma.admin.findUnique({ where: { id: payload.adminId } });
  const totpConfigured = !!admin?.totpSecret;

  return NextResponse.json({
    step: "2fa",
    locked: false,
    email: payload.email,
    totpConfigured,
  });
}

// ── POST: verify TOTP code ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Rate limit: 10 attempts per IP per 15 minutes
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await applyRateLimit(`2fa-verify:${ip}`, 10, 15 * 60 * 1000, ip);
  if (rl) return rl;

>>>>>>> 13d2b43 (first commit)
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid 2FA code" }, { status: 400 });
    }

<<<<<<< HEAD
    const correctCode = process.env.ADMIN_2FA_CODE;
    if (!correctCode) {
      return NextResponse.json({ error: "ADMIN_2FA_CODE is not set" }, { status: 500 });
    }

=======
>>>>>>> 13d2b43 (first commit)
    const pendingToken = req.cookies.get(PENDING_2FA_COOKIE)?.value;
    if (!pendingToken) {
      return NextResponse.json(
        { error: "2FA session expired. Please login again." },
        { status: 401 }
      );
    }

    const payload = decodePendingToken(pendingToken);
<<<<<<< HEAD

    if (!payload || payload.type !== "admin-2fa-pending" || !payload.adminId || !payload.email) {
=======
    if (
      !payload ||
      payload.type !== "admin-2fa-pending" ||
      !payload.adminId ||
      !payload.email
    ) {
>>>>>>> 13d2b43 (first commit)
      return NextResponse.json(
        { error: "2FA session expired. Please login again." },
        { status: 401 }
      );
    }

    const identifier = `admin-2fa:${payload.adminId}`;
<<<<<<< HEAD
    const lock = await prisma.adminAuthLock.findUnique({ where: { identifier } });

    // ✅ Check lock មុន
    if (lock?.forever) {
      return NextResponse.json(
        { error: "កូដ 2FA ខុស ២ លើក Lock ជាអចិន្ត្រៃយ៍ សូមទាក់ទង owner។" },
        { status: 403 }
      );
    }

    if (lock?.lockedUntil && lock.lockedUntil > new Date()) {
      return NextResponse.json(
        {
          error: "កូដ 2FA ខុស លើកទី១ Lock 5 នាទី សូមរង់ចាំ។",
          lockedUntil: lock.lockedUntil,
        },
=======
    const lock = await prisma.adminAuthLock.findUnique({
      where: { identifier },
    });

    if (lock?.forever) {
      return NextResponse.json(
        { error: "Account locked permanently. Contact the site owner." },
        { status: 403 }
      );
    }
    if (lock?.lockedUntil && lock.lockedUntil > new Date()) {
      return NextResponse.json(
        { error: "Too many failed attempts. Please wait 5 minutes.", lockedUntil: lock.lockedUntil },
>>>>>>> 13d2b43 (first commit)
        { status: 429 }
      );
    }

<<<<<<< HEAD
    const inputCode = parsed.data.code.trim();

    if (!safeEqual(inputCode, correctCode)) {
      const nextFail = (lock?.failCount || 0) + 1;

      // ✅ លើកទី១ → 5 នាទី | លើកទី២+ → forever
=======
    // Fetch admin and their TOTP secret
    const admin = await prisma.admin.findUnique({
      where: { id: payload.adminId },
    });

    if (!admin || !admin.active) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // If TOTP not configured yet, reject — admin must set it up first
    if (!admin.totpSecret) {
      return NextResponse.json(
        {
          error:
            "TOTP not configured. Please complete 2FA setup before logging in.",
          needsSetup: true,
        },
        { status: 403 }
      );
    }

    const inputCode = parsed.data.code.trim();
    const isValid = authenticator.verify({
      token: inputCode,
      secret: admin.totpSecret,
    });

    if (!isValid) {
      const nextFail = (lock?.failCount || 0) + 1;

      logSecurityEvent({
        event: "admin_2fa_fail",
        adminId: payload.adminId,
        ip,
        failCount: nextFail,
      });

>>>>>>> 13d2b43 (first commit)
      if (nextFail >= 2) {
        await prisma.adminAuthLock.upsert({
          where: { identifier },
          update: { failCount: nextFail, lockedUntil: null, forever: true },
<<<<<<< HEAD
          create: { identifier, failCount: nextFail, lockedUntil: null, forever: true },
        });
        return NextResponse.json(
          { error: "កូដ 2FA ខុស ២ លើក Lock ជាអចិន្ត្រៃយ៍ សូមទាក់ទង owner។" },
=======
          create: {
            identifier,
            failCount: nextFail,
            lockedUntil: null,
            forever: true,
          },
        });
        logSecurityEvent({
          event: "admin_locked_forever",
          adminId: payload.adminId,
          ip,
          reason: "2fa_fail",
        });
        return NextResponse.json(
          { error: "Account locked permanently. Contact the site owner." },
>>>>>>> 13d2b43 (first commit)
          { status: 403 }
        );
      }

      const lockedUntil = new Date(Date.now() + 5 * 60 * 1000);
      await prisma.adminAuthLock.upsert({
        where: { identifier },
        update: { failCount: nextFail, lockedUntil, forever: false },
<<<<<<< HEAD
        create: { identifier, failCount: nextFail, lockedUntil, forever: false },
      });
      return NextResponse.json(
        {
          error: "កូដ 2FA ខុស លើកទី១ Lock 5 នាទី សូមរង់ចាំ។",
          lockedUntil,
        },
=======
        create: {
          identifier,
          failCount: nextFail,
          lockedUntil,
          forever: false,
        },
      });
      return NextResponse.json(
        { error: "Invalid 2FA code. Account locked for 5 minutes.", lockedUntil },
>>>>>>> 13d2b43 (first commit)
        { status: 429 }
      );
    }

<<<<<<< HEAD
    // ✅ Code ត្រូវ → Clear lock + Login
    await prisma.adminAuthLock.deleteMany({ where: { identifier } });

=======
    // ✅ TOTP correct — clear lock, issue session
    await prisma.adminAuthLock.deleteMany({ where: { identifier } });
>>>>>>> 13d2b43 (first commit)
    await prisma.admin.update({
      where: { id: payload.adminId },
      data: { lastLoginAt: new Date() },
    });

<<<<<<< HEAD
=======
    logSecurityEvent({
      event: "admin_2fa_success",
      adminId: payload.adminId,
      ip,
    });

>>>>>>> 13d2b43 (first commit)
    const adminToken = signAdminToken(payload.adminId);
    const isProduction = process.env.NODE_ENV === "production";

    const res = NextResponse.json({
      ok: true,
      email: payload.email,
      message: "2FA confirmed",
    });

    res.cookies.set(ADMIN_COOKIE_NAME, adminToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
<<<<<<< HEAD
      maxAge: 60 * 60 * 24 * 7,
    });

=======
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
>>>>>>> 13d2b43 (first commit)
    res.cookies.delete(PENDING_2FA_COOKIE);

    return res;
  } catch (error) {
    console.error("Admin 2FA error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
<<<<<<< HEAD
}
=======
}
>>>>>>> 13d2b43 (first commit)

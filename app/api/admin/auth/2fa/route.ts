/**
 * /api/admin/auth/2fa — TOTP-based 2FA
 *
 * Verify flow : POST /api/admin/auth/2fa  → verifies 6-digit TOTP code
 * Status check: GET  /api/admin/auth/2fa  → returns lock / step info
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";
import { getClientIp } from "@/lib/getIp";
import { prisma } from "@/lib/prisma";
import { signAdminToken, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/secureLogger";
import { getLockDurationMs, formatLockDuration } from "@/lib/lockPolicy";
import { notifyTelegram, escapeHtml } from "@/lib/telegram";
import { getRequestInfo, detectProvider } from "@/lib/requestInfo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// TOTP window: accept 1 step before/after (handles ~60s clock drift)
authenticator.options = { window: 1 };

const PENDING_2FA_COOKIE = "admin_2fa_pending";
const ADMIN_COOKIE_NAME  = "admin_token";

const verifySchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/),
});

type Pending2FAPayload = {
  type?: string;
  adminId?: string;
  email?: string;
};

function getAdminJwtSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("ADMIN_JWT_SECRET is not set");
  return secret;
}

function decodePendingToken(token: string): Pending2FAPayload | null {
  try {
    return jwt.verify(token, getAdminJwtSecret()) as Pending2FAPayload;
  } catch {
    return null;
  }
}

// ── GET: check 2FA lock / session status ────────────────────────────────────
export async function GET(req: NextRequest) {
  const pendingToken = req.cookies.get(PENDING_2FA_COOKIE)?.value;

  if (!pendingToken) {
    return NextResponse.json({ step: "login", locked: false });
  }

  const payload = decodePendingToken(pendingToken);

  if (!payload?.adminId || payload.type !== "admin-2fa-pending") {
    return NextResponse.json({ step: "login", locked: false });
  }

  const identifier = `admin-2fa:${payload.adminId}`;
  const lock = await prisma.adminAuthLock.findUnique({ where: { identifier } });

  // Backward-compat: respect legacy forever locks already in DB.
  if (lock?.forever) {
    return NextResponse.json({ step: "2fa", locked: true, forever: true });
  }

  if (lock?.lockedUntil && lock.lockedUntil > new Date()) {
    const remainingMs = lock.lockedUntil.getTime() - Date.now();
    return NextResponse.json({
      step: "2fa",
      locked: true,
      forever: false,
      lockedUntil: lock.lockedUntil,
      retryAfter: formatLockDuration(remainingMs),
    });
  }

  // Tell frontend whether TOTP is already configured
  const admin = await prisma.admin.findUnique({
    where: { id: payload.adminId },
  });
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
    getClientIp(req);
  const rl = await applyRateLimit(`2fa-verify:${ip}`, 10, 15 * 60 * 1000, ip);
  if (rl) return rl;

  try {
    const body   = await req.json().catch(() => ({}));
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid 2FA code" }, { status: 400 });
    }

    const pendingToken = req.cookies.get(PENDING_2FA_COOKIE)?.value;
    if (!pendingToken) {
      return NextResponse.json(
        { error: "2FA session expired. Please login again." },
        { status: 401 }
      );
    }

    const payload = decodePendingToken(pendingToken);
    if (
      !payload ||
      payload.type !== "admin-2fa-pending" ||
      !payload.adminId ||
      !payload.email
    ) {
      return NextResponse.json(
        { error: "2FA session expired. Please login again." },
        { status: 401 }
      );
    }

    const identifier = `admin-2fa:${payload.adminId}`;
    const lock = await prisma.adminAuthLock.findUnique({
      where: { identifier },
    });

    // Backward-compat: respect legacy forever locks already in DB.
    if (lock?.forever) {
      return NextResponse.json(
        { error: "Account is disabled. Contact the site owner." },
        { status: 403 }
      );
    }

    if (lock?.lockedUntil && lock.lockedUntil > new Date()) {
      const remainingMs = lock.lockedUntil.getTime() - Date.now();
      return NextResponse.json(
        {
          error: `Too many failed attempts. Please try again in ${formatLockDuration(remainingMs)}.`,
          lockedUntil: lock.lockedUntil,
          retryAfter: formatLockDuration(remainingMs),
        },
        { status: 429 }
      );
    }

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

    // Replay-attack guard: reject codes already consumed within the acceptance window
    const usedToken = await prisma.usedTotpToken.findUnique({
      where: { adminId_token: { adminId: payload.adminId, token: inputCode } },
    });
    if (usedToken) {
      return NextResponse.json(
        { error: "Code already used. Please wait for a new code." },
        { status: 401 }
      );
    }

    const isValid   = authenticator.verify({
      token:  inputCode,
      secret: admin.totpSecret,
    });

    if (!isValid) {
      const nextFail    = (lock?.failCount ?? 0) + 1;
      const durationMs  = getLockDurationMs(nextFail);
      const lockedUntil = new Date(Date.now() + durationMs);

      logSecurityEvent({
        event: "admin_2fa_fail",
        adminId: payload.adminId,
        ip,
        failCount: nextFail,
        lockDuration: formatLockDuration(durationMs),
      });

      await prisma.adminAuthLock.upsert({
        where: { identifier },
        update: { failCount: nextFail, lockedUntil, forever: false },
        create: { identifier, failCount: nextFail, lockedUntil, forever: false },
      });

      const remainingMs = lockedUntil.getTime() - Date.now();
      return NextResponse.json(
        {
          error: `Invalid 2FA code. Please try again in ${formatLockDuration(remainingMs)}.`,
          lockedUntil,
          retryAfter: formatLockDuration(remainingMs),
        },
        { status: 429 }
      );
    }

    // ✅ TOTP correct — clear lock, issue session
    await prisma.adminAuthLock.deleteMany({ where: { identifier } });
    await prisma.admin.update({
      where: { id: payload.adminId },
      data:  { lastLoginAt: new Date() },
    });
    const info = getRequestInfo(req);
    const provider = detectProvider(null);

    await prisma.adminLoginLog.create({
  data: {
    adminEmail: payload.email,
    ip: info.ip,
    country: info.country,
    isp: null,
    provider,
    device: info.device,
    os: info.os,
    browser: info.browser,
    userAgent: info.userAgent,
  },
});

await notifyTelegram(
  [
    "🚨 <b>have someone login admin page</b>",
    "",
    `<b>Admin:</b> ${escapeHtml(payload.email)}`,
    `<b>IP:</b> ${escapeHtml(info.ip)}`,
    `<b>Country:</b> ${escapeHtml(info.country || "Unknown")}`,
    `<b>Provider:</b> ${escapeHtml(provider)}`,
    `<b>Device:</b> ${escapeHtml(info.device)}`,
    `<b>OS:</b> ${escapeHtml(info.os)}`,
    `<b>Browser:</b> ${escapeHtml(info.browser)}`,
    `<b>Time:</b> ${escapeHtml(new Date().toLocaleString("en-US", { timeZone: "Asia/Phnom_Penh" }))}`,
  ].join("\n")
);

    // Record the used token so it cannot be replayed within the 90-second window
    const tokenExpiresAt = new Date(Date.now() + 90 * 1000);
    await prisma.usedTotpToken.create({
      data: { adminId: payload.adminId, token: inputCode, expiresAt: tokenExpiresAt },
    });

    // Fire-and-forget: purge expired tokens (older than 90s)
    prisma.usedTotpToken
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch(() => {});

    logSecurityEvent({
      event:   "admin_2fa_success",
      adminId: payload.adminId,
      ip,
    });

    const adminToken     = signAdminToken(payload.adminId);
    const isProduction   = process.env.NODE_ENV === "production";

    const res = NextResponse.json({
      ok:      true,
      email:   payload.email,
      message: "2FA confirmed",
    });

    res.cookies.set(ADMIN_COOKIE_NAME, adminToken, {
      httpOnly: true,
      secure:   isProduction,
      sameSite: "strict",
      path:     "/",
      maxAge:   SESSION_MAX_AGE_SECONDS,
    });

    res.cookies.delete(PENDING_2FA_COOKIE);

    return res;
  } catch (error) {
    console.error("Admin 2FA error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

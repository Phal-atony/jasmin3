import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { signAdminToken, buildAuthCookie, buildClearCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type AttemptRecord = {
  failCount: number;
  lockedUntil: number | null;
  bannedForever: boolean;
};

const attemptStore = new Map<string, AttemptRecord>();
const LOCKOUT_MS = 5 * 60 * 1000;

function getAttempt(email: string): AttemptRecord {
  return attemptStore.get(email) ?? {
    failCount: 0,
    lockedUntil: null,
    bannedForever: false,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase();
    const attempt = getAttempt(email);

    // 1. Permanently banned
    if (attempt.bannedForever) {
      return NextResponse.json(
        { error: "Account locked permanently. Contact support." },
        { status: 403 }
      );
    }

    // 2. Tried again during lockout → ban forever immediately
    if (attempt.lockedUntil && Date.now() < attempt.lockedUntil) {
      attemptStore.set(email, {
        failCount: 2,
        lockedUntil: null,
        bannedForever: true,
      });
      return NextResponse.json(
        { error: "Account locked permanently due to multiple failed attempts." },
        { status: 403 }
      );
    }

    // 3. Validate credentials
    const admin = await prisma.admin.findUnique({
      where: { email },
    });

    const passwordMatch =
      admin &&
      (await bcrypt.compare(parsed.data.password, admin.passwordHash));

    if (!admin || !passwordMatch) {
      if (attempt.failCount === 0) {
        // 1st failure → lock for 5 minutes
        attemptStore.set(email, {
          failCount: 1,
          lockedUntil: Date.now() + LOCKOUT_MS,
          bannedForever: false,
        });
        return NextResponse.json(
          { error: "Invalid email or password. Account locked for 5 minutes." },
          { status: 401 }
        );
      } else {
        // Tried after lockout expired and wrong again → ban forever
        attemptStore.set(email, {
          failCount: 2,
          lockedUntil: null,
          bannedForever: true,
        });
        return NextResponse.json(
          { error: "Account locked permanently due to multiple failed attempts." },
          { status: 403 }
        );
      }
    }

    // 4. Success — clear attempt record
    attemptStore.delete(email);

    const token = signAdminToken(String(admin.id));
    const cookie = buildAuthCookie(token);

    return NextResponse.json(
      { ok: true, email: admin.email },
      { headers: { "Set-Cookie": cookie } }
    );
  } catch (error) {
    console.error("Admin login error:", error);

    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const cookie = buildClearCookie();

  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": cookie } }
  );
}
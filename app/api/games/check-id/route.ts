import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { z } from "zod";

const CHECK_ID_RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const CHECK_ID_RATE_LIMIT_MAX = 5; // 5 checks per minute per IP

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const checkIdRateLimitStore = new Map<string, RateLimitRecord>();

function getClientIp(req: NextRequest): string {
  const cfIp = req.headers.get("cf-connecting-ip");
  const realIp = req.headers.get("x-real-ip");
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (cfIp) return cfIp;
  if (realIp) return realIp;
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";

  return "unknown";
}

function checkIdRateLimit(ip: string) {
  const now = Date.now();
  const key = `games-check-id:${ip}`;
  const record = checkIdRateLimitStore.get(key);

  if (!record || record.resetAt <= now) {
    checkIdRateLimitStore.set(key, {
      count: 1,
      resetAt: now + CHECK_ID_RATE_LIMIT_WINDOW_MS,
    });

    return {
      allowed: true,
      remaining: CHECK_ID_RATE_LIMIT_MAX - 1,
      retryAfter: 0,
    };
  }

  if (record.count >= CHECK_ID_RATE_LIMIT_MAX) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  record.count += 1;
  checkIdRateLimitStore.set(key, record);

  return {
    allowed: true,
    remaining: CHECK_ID_RATE_LIMIT_MAX - record.count,
    retryAfter: 0,
  };
}

const schema = z.object({
  slug: z.enum([
    "mobile-legends",
    "honor-of-kings",
    "free-fire",
    "pubg-mobile",
    "ro-blox",
  ]),
  uid: z.string().trim().min(1).max(30),
  serverId: z.string().trim().max(10).optional(),
});

function getRapidApiKey(): string {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY is not set");
  return key;
}

const RAPIDAPI_HOST = "id-game-checker.p.rapidapi.com";
const BASE = `https://${RAPIDAPI_HOST}`;

function buildUrl(slug: string, uid: string, serverId?: string): string | null {
  switch (slug) {
    case "free-fire":
      return `${BASE}/dfm-garena/${encodeURIComponent(uid)}`;

    case "mobile-legends":
      if (!serverId) return null;
      return `${BASE}/mobile-legends/${encodeURIComponent(uid)}/${encodeURIComponent(serverId)}`;

    case "pubg-mobile":
      return `${BASE}/pubgm-global/${encodeURIComponent(uid)}`;

    case "honor-of-kings":
      return `${BASE}/honor-of-kings/${encodeURIComponent(uid)}`;

    case "ro-blox":
      return `${BASE}/roblox/${encodeURIComponent(uid)}`;

    default:
      return null;
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = checkIdRateLimit(ip);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Too many requests",
        message: "You can check ID only 5 times per minute.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfter),
          "X-RateLimit-Limit": String(CHECK_ID_RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const rateLimitHeaders = {
    "X-RateLimit-Limit": String(CHECK_ID_RATE_LIMIT_MAX),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
  };

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      {
        status: 400,
        headers: rateLimitHeaders,
      }
    );
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid input",
      },
      {
        status: 400,
        headers: rateLimitHeaders,
      }
    );
  }

  const { slug, uid, serverId } = parsed.data;

  if (slug === "mobile-legends" && !serverId) {
    return NextResponse.json(
      {
        success: false,
        error: "Zone ID is required for Mobile Legends",
      },
      {
        status: 400,
        headers: rateLimitHeaders,
      }
    );
  }

  const url = buildUrl(slug, uid, serverId);

  if (!url) {
    return NextResponse.json(
      {
        success: false,
        error: "Unsupported game",
      },
      {
        status: 400,
        headers: rateLimitHeaders,
      }
    );
  }

  let rapidApiKey: string;

  try {
    rapidApiKey = getRapidApiKey();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Service unavailable",
      },
      {
        status: 503,
        headers: rateLimitHeaders,
      }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-host": RAPIDAPI_HOST,
        "x-rapidapi-key": rapidApiKey,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const data: unknown = await res.json().catch(() => null);

    if (!res.ok || !data || typeof data !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "Player not found — check your ID",
        },
        {
          status: res.status === 404 ? 404 : 502,
          headers: rateLimitHeaders,
        }
      );
    }

    const d = data as Record<string, unknown>;

    const nickname =
      (typeof d.nickname === "string" && d.nickname) ||
      (typeof d.name === "string" && d.name) ||
      (typeof d.username === "string" && d.username) ||
      (typeof d.playerName === "string" && d.playerName) ||
      null;

    if (!nickname) {
      return NextResponse.json(
        {
          success: false,
          error: "Player not found — check your ID",
        },
        {
          status: 404,
          headers: rateLimitHeaders,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        name: nickname,
        uid,
        serverId: serverId ?? null,
      },
      {
        headers: rateLimitHeaders,
      }
    );
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";

    return NextResponse.json(
      {
        success: false,
        error: aborted ? "Lookup timed out" : "Network error",
      },
      {
        status: 504,
        headers: rateLimitHeaders,
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}
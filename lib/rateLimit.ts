/**
<<<<<<< HEAD
 * Simple in-memory rate limiter using a sliding window.
 * Stores timestamps per key, prunes expired entries on every call.
 *
 * NOT suitable for multi-process/serverless — good enough for a single
 * Node process (which is what SQLite + `next dev` / `next start` gives us).
 */

const store = new Map<string, number[]>();

/**
 * Returns `true` if the request is allowed, `false` if rate-limited.
 *
 * @param key      Unique identifier (e.g. IP address)
 * @param max      Maximum requests allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

  // Get or create the timestamp list for this key
  let timestamps = store.get(key);

  if (timestamps) {
    // Prune entries older than the window
    timestamps = timestamps.filter((t) => t > cutoff);
  } else {
    timestamps = [];
  }

  if (timestamps.length >= max) {
    // Over limit — store the pruned list and reject
    store.set(key, timestamps);
    return false;
  }

  // Under limit — record this request
  timestamps.push(now);
  store.set(key, timestamps);
  return true;
}
=======
 * lib/rateLimit.ts — Database-backed rate limiter (Issue #4)
 *
 * Uses the AdminAuthLock table (already in schema) for auth endpoints,
 * and a dedicated RateLimit model for other routes.
 * This works across serverless restarts unlike the old in-memory Map.
 *
 * For endpoints NOT covered by the DB-backed limiter (e.g. public APIs),
 * falls back to in-memory for simplicity — with a clear warning.
 */

import { prisma } from "@/lib/prisma";
import { logSecurityEvent } from "@/lib/secureLogger";

// ---- In-memory fallback (single process / dev only) ----
const memStore = new Map<string, number[]>();

export function checkRateLimitMemory(
  key: string,
  max: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  let timestamps = (memStore.get(key) ?? []).filter((t) => t > cutoff);

  if (timestamps.length >= max) {
    memStore.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  memStore.set(key, timestamps);
  return true;
}

// ---- DB-backed rate limiter ----
/**
 * Returns true if request is ALLOWED, false if rate-limited.
 * Persists counters in the DB so serverless cold-starts don't reset counts.
 */
export async function checkRateLimitDb(
  key: string,
  max: number,
  windowMs: number,
  ip?: string
): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  try {
    // Count recent hits for this key
    const count = await prisma.rateLimitEntry.count({
      where: {
        key,
        createdAt: { gte: windowStart },
      },
    });

    if (count >= max) {
      logSecurityEvent({
        event: "rate_limit_exceeded",
        detail: key,
        ip,
        count,
        max,
      });
      // Clean up old entries lazily (don't block response)
      prisma.rateLimitEntry
        .deleteMany({ where: { key, createdAt: { lt: windowStart } } })
        .catch(() => {});
      return false;
    }

    // Record this hit
    await prisma.rateLimitEntry.create({ data: { key, ip: ip ?? null } });

    // Lazily prune old entries for this key
    prisma.rateLimitEntry
      .deleteMany({ where: { key, createdAt: { lt: windowStart } } })
      .catch(() => {});

    return true;
  } catch (err) {
    // If DB is unavailable, fail open (log but allow) to prevent total outage
    console.error("[rateLimit] DB error, failing open:", err);
    return true;
  }
}

/** Convenience: apply DB rate limit and return a 429 Response or null */
export async function applyRateLimit(
  key: string,
  max: number,
  windowMs: number,
  ip?: string
): Promise<Response | null> {
  const allowed = await checkRateLimitDb(key, max, windowMs, ip);
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(windowMs / 1000)),
          "Cache-Control": "no-store",
        },
      }
    );
  }
  return null;
}
>>>>>>> 13d2b43 (first commit)

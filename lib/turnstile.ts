import type { NextRequest } from "next/server";

type TurnstileKind = "public" | "admin";

type TurnstileResponse = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
  "error-codes"?: string[];
};

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const TEST_SECRET_KEYS = new Set([
  "1x0000000000000000000000000000000AA",
  "2x0000000000000000000000000000000AA",
  "3x0000000000000000000000000000000AA",
]);

function getSecret(kind: TurnstileKind): string | undefined {
  if (kind === "admin") {
    return process.env.TURNSTILE_SECRET_KEY_ADMIN;
  }

  return process.env.TURNSTILE_SECRET_KEY_PUBLIC;
}

function getAllowedHostnames(): string[] {
  return (process.env.TURNSTILE_ALLOWED_HOSTNAMES || "")
    .split(",")
    .map((hostname) => hostname.trim())
    .filter(Boolean);
}

function getClientIp(req: Request | NextRequest): string | null {
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return null;
}

function isLocalOrPrivateIp(ip: string | null): boolean {
  if (!ip) return true;

  return (
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip === "localhost" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("172.17.") ||
    ip.startsWith("172.18.") ||
    ip.startsWith("172.19.") ||
    ip.startsWith("172.20.") ||
    ip.startsWith("172.21.") ||
    ip.startsWith("172.22.") ||
    ip.startsWith("172.23.") ||
    ip.startsWith("172.24.") ||
    ip.startsWith("172.25.") ||
    ip.startsWith("172.26.") ||
    ip.startsWith("172.27.") ||
    ip.startsWith("172.28.") ||
    ip.startsWith("172.29.") ||
    ip.startsWith("172.30.") ||
    ip.startsWith("172.31.")
  );
}

export async function verifyTurnstileToken({
  req,
  token,
  kind,
  expectedAction,
}: {
  req: NextRequest | Request;
  token: string;
  kind: TurnstileKind;
  expectedAction: string;
}): Promise<boolean> {
  const secret = getSecret(kind);

  if (!secret) {
    console.error(
      kind === "admin"
        ? "Missing TURNSTILE_SECRET_KEY_ADMIN"
        : "Missing TURNSTILE_SECRET_KEY_PUBLIC"
    );
    return false;
  }

  if (!token) {
    console.error("Missing Turnstile token");
    return false;
  }

  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);

  const ip = getClientIp(req);

  // remoteip is optional. Skip localhost/private IPs to avoid local test issues.
  if (ip && !isLocalOrPrivateIp(ip)) {
    formData.append("remoteip", ip);
  }

  let data: TurnstileResponse;

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: formData,
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Turnstile siteverify HTTP error:", res.status);
      return false;
    }

    data = (await res.json()) as TurnstileResponse;
  } catch (error) {
    console.error("Turnstile siteverify request failed:", error);
    return false;
  }

  if (!data.success) {
    console.error("Turnstile failed:", {
      errors: data["error-codes"],
      hostname: data.hostname,
      action: data.action,
    });

    return false;
  }

  const isTestSecret = TEST_SECRET_KEYS.has(secret);

  // ✅ Localhost test keys can return action="test".
  // So for dummy test secret keys, success=true is enough.
  if (isTestSecret) {
    return true;
  }

  // ✅ Production strict action check
  if (data.action && data.action !== expectedAction) {
    console.error("Turnstile action mismatch:", {
      expectedAction,
      receivedAction: data.action,
    });

    return false;
  }

  // ✅ Production strict hostname check
  const allowedHostnames = getAllowedHostnames();

  if (
    allowedHostnames.length > 0 &&
    data.hostname &&
    !allowedHostnames.includes(data.hostname)
  ) {
    console.error("Turnstile hostname mismatch:", {
      hostname: data.hostname,
      allowedHostnames,
    });

    return false;
  }

  return true;
}
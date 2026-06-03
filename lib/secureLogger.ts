/**
 * lib/secureLogger.ts — Safe security event logging (Issue #11)
 * Never logs passwords, tokens, secrets, or full cookies.
 */

type SecurityEvent =
  | "admin_login_fail"
  | "admin_login_success"
  | "admin_2fa_fail"
  | "admin_2fa_success"
  | "admin_locked_forever"
  | "admin_settings_changed"
  | "webhook_invalid_signature"
  | "webhook_amount_mismatch"
  | "webhook_replay_blocked"
  | "webhook_order_mismatch"
  | "payment_transaction_mismatch"
  | "payment_amount_mismatch"
  | "payment_currency_mismatch"
  | "payment_missing_ref"
  | "payment_simulation_production"
  | "payment_config_error"
  | "payment_public_sync_blocked"
  | "payment_validation_failed"
  | "rate_limit_exceeded"
  | "upload_rejected"
  | "admin_logout";

interface LogPayload {
  event: SecurityEvent;
  ip?: string;
  email?: string;
  adminId?: string;
  detail?: string;
  [key: string]: unknown;
}

// Fields that must NEVER appear in logs
const REDACTED_FIELDS = new Set([
  "password",
  "passwordHash",
  "token",
  "secret",
  "apiKey",
  "webhookSecret",
  "telegramBotToken",
  "cookie",
  "authorization",
  "ADMIN_JWT_SECRET",
  "KHPAY_API_KEY",
  "KHPAY_WEBHOOK_SECRET",
]);

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (REDACTED_FIELDS.has(k.toLowerCase()) || REDACTED_FIELDS.has(k)) {
      out[k] = "[REDACTED]";
    } else if (typeof v === "string" && v.length > 200) {
      out[k] = v.slice(0, 200) + "…";
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function logSecurityEvent(payload: LogPayload): void {
  const safe = sanitize(payload as unknown as Record<string, unknown>);
  console.warn(
    JSON.stringify({
      level: "SECURITY",
      timestamp: new Date().toISOString(),
      ...safe,
    })
  );
}

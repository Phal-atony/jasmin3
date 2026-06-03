import crypto from "crypto";
import nodeFetch from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";
import {
  assertProductionPaymentConfig,
  assertRealKhpayConfig,
} from "@/lib/payment-validation";

export type PaymentMethod = "KHPAY" | "MANUAL" | "ABA" | "ACLEDA" | "WING";

export interface InitiatePaymentArgs {
  orderNumber: string;
  amountUsd: number;
  method: PaymentMethod;
  returnUrl: string;
  cancelUrl: string;
  callbackUrl: string;
  note?: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
}

export interface PaymentInitResult {
  paymentRef: string;
  redirectUrl: string;
  qrString?: string;
  expiresAt: Date;
}

export type KhpayStatusResult = {
  status: string;
  paid: boolean;
  transactionId?: string;
  amount?: string;
  currency?: string;
};

function cleanEnv(value?: string): string {
  return (value || "").trim().replace(/^['\"]|['\"]$/g, "");
}

function cleanBaseUrl(value?: string): string {
  return cleanEnv(value).replace(/\/+$/, "");
}

const KHPAY_BASE = cleanBaseUrl(process.env.KHPAY_BASE_URL) || "https://khpay.site/api/v1";
const KHPAY_KEY = cleanEnv(process.env.KHPAY_API_KEY);
const FIXIE_URL = process.env.FIXIE_URL;
const proxyAgent = FIXIE_URL ? new HttpsProxyAgent(FIXIE_URL) : undefined;

// Browser-like headers to bypass Cloudflare bot protection
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Connection": "keep-alive",
};

// Use node-fetch with proxy + browser headers
const khpayFetch = (url: string, options: any): Promise<Response> =>
  nodeFetch(url, {
    ...options,
    agent: proxyAgent,
    headers: {
      ...BROWSER_HEADERS,
      ...(options.headers || {}),
    },
  }) as unknown as Promise<Response>;

export function isPaymentSimulationMode(): boolean {
  assertProductionPaymentConfig();
  return cleanEnv(process.env.PAYMENT_SIMULATION_MODE).toLowerCase() === "true";
}

export function isPaymentSimulationAllowed(): boolean {
  assertProductionPaymentConfig();
  return process.env.NODE_ENV !== "production" && isPaymentSimulationMode();
}

export async function initiatePayment(
  args: InitiatePaymentArgs
): Promise<PaymentInitResult> {
  assertProductionPaymentConfig();

  if (isPaymentSimulationMode()) return simulatePayment(args);

  if (args.method !== "KHPAY") {
    throw new Error(
      `Payment method ${args.method} is not supported for real payments yet. Use KHPAY or enable PAYMENT_SIMULATION_MODE=true only in local development.`
    );
  }

  return initiateKhpay(args);
}

function getAppBaseUrl(): string {
  const configured = cleanBaseUrl(process.env.NEXT_PUBLIC_BASE_URL || process.env.PUBLIC_APP_URL);
  if (configured) return configured;

  const vercelUrl = cleanBaseUrl(process.env.VERCEL_URL);
  if (vercelUrl) return `https://${vercelUrl}`;

  return "http://localhost:3000";
}

function simulatePayment(args: InitiatePaymentArgs): PaymentInitResult {
  const ref = `SIM-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  const base = getAppBaseUrl();
  return {
    paymentRef: ref,
    redirectUrl: `${base}/api/payment/simulate?order=${encodeURIComponent(args.orderNumber)}&ref=${encodeURIComponent(ref)}&method=${encodeURIComponent(args.method)}`,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  };
}

async function readJsonOrText(res: Response): Promise<any> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 300) };
  }
}

function formatKhpayError(status: number, payload: any): string {
  const remoteMessage = payload?.error || payload?.message || payload?.raw;

  if (status === 401 || status === 403) {
    return [
      `HTTP ${status}`,
      "KHPay refused this request.",
      "Check KHPAY_API_KEY, KHPAY_BASE_URL, merchant account/payment settings, and whether this domain is allowed.",
      remoteMessage ? `Remote: ${String(remoteMessage).slice(0, 180)}` : "",
    ].filter(Boolean).join(" ");
  }

  if (status === 402) {
    return [
      "HTTP 402",
      "KHPay says the PayWay link is not set. Add your PayWay link in the KHPay dashboard/settings.",
      remoteMessage ? `Remote: ${String(remoteMessage).slice(0, 180)}` : "",
    ].filter(Boolean).join(" ");
  }

  return remoteMessage || `HTTP ${status}`;
}

async function initiateKhpay(args: InitiatePaymentArgs): Promise<PaymentInitResult> {
  assertRealKhpayConfig();

  const isPublicUrl = (u?: string) =>
    !!u &&
    /^https?:\/\//i.test(u) &&
    !/^https?:\/\/(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u);

  const body: Record<string, unknown> = {
    amount: args.amountUsd.toFixed(2),
    currency: "USD",
    note: args.note || `JASMINTOPUP Order ${args.orderNumber}`,
    metadata: {
      order_number: args.orderNumber,
      ...(args.customerEmail ? { email: args.customerEmail } : {}),
      ...(args.metadata || {}),
    },
  };

  if (isPublicUrl(args.returnUrl)) body.success_url = args.returnUrl;
  if (isPublicUrl(args.cancelUrl)) body.cancel_url = args.cancelUrl;
  if (isPublicUrl(args.callbackUrl)) body.callback_url = args.callbackUrl;

  console.log("[khpay] initiating to:", KHPAY_BASE);
  console.log("[khpay] proxy:", FIXIE_URL ? "Fixie ON" : "Direct (no proxy)");

  const res = await khpayFetch(`${KHPAY_BASE}/qr/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KHPAY_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  console.log("[khpay] response status:", res.status);

  const json = await readJsonOrText(res);
  if (!res.ok || !json?.success) {
    throw new Error(`KHPay: ${formatKhpayError(res.status, json)}`);
  }

  const data = json.data;
  if (!data?.qr_string) {
    throw new Error("KHPay: response did not include qr_string");
  }

  if (!data?.transaction_id) {
    throw new Error("KHPay: response did not include transaction_id");
  }

  return {
    paymentRef: String(data.transaction_id),
    redirectUrl: data.payment_url || `/checkout/${args.orderNumber}`,
    qrString: data.qr_string,
    expiresAt: new Date(Date.now() + (Number(data.expires_in) || 180) * 1000),
  };
}

export async function fetchKhpayStatus(transactionId: string): Promise<KhpayStatusResult | null> {
  assertProductionPaymentConfig();

  if (!transactionId || transactionId.startsWith("SIM-")) return null;
  assertRealKhpayConfig();

  const res = await khpayFetch(`${KHPAY_BASE}/qr/check/${encodeURIComponent(transactionId)}`, {
    headers: {
      Authorization: `Bearer ${KHPAY_KEY}`,
      Accept: "application/json",
    },
  });

  const json = await readJsonOrText(res);
  if (!res.ok || !json?.success) {
    console.warn(`[khpay] check ${transactionId} failed:`, res.status, json);
    return null;
  }

  console.log(`[khpay] check ${transactionId}:`, JSON.stringify(json.data));
  return {
    status: String(json.data.status || "pending"),
    paid: Boolean(json.data.paid),
    transactionId: json.data.transaction_id ? String(json.data.transaction_id) : transactionId,
    amount: json.data.amount,
    currency: json.data.currency,
  };
}

export function verifyWebhook(
  _method: PaymentMethod,
  rawBody: string,
  headers: Record<string, string>
): boolean {
  // ⚠️  NEVER bypass signature verification based on simulation mode.
  const secret = cleanEnv(process.env.KHPAY_WEBHOOK_SECRET);
  if (!secret) {
    console.warn("[webhook] KHPAY_WEBHOOK_SECRET not set — rejecting.");
    return false;
  }

  const received = headers["x-webhook-signature"] || "";
  if (!received.startsWith("sha256=")) return false;

  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  // Use fixed-length Buffers so timingSafeEqual never throws.
  const a = Buffer.from(received.padEnd(expected.length, "\0"));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

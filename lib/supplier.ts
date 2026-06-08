// lib/supplier.ts

function cleanEnv(value?: string): string {
  return (value || "").trim().replace(/^[\'\"]|[\'\"]$/g, "");
}

function cleanBaseUrl(value?: string): string {
  return cleanEnv(value).replace(/\/+$/, "");
}

const CAMRAPID_BASE =
  cleanBaseUrl(process.env.CAMRAPID_BASE_URL) ||
  "https://partner.camrapidsecure.com/api";

const CAMRAPID_KEY = cleanEnv(process.env.CAMRAPID_API_KEY);

export interface TopupRequest {
  game: string;
  uid: string;
  serverId?: string;
  productCode: string;
  orderRef: string;
}

export interface TopupResult {
  success: boolean;
  transactionId?: string;
  status?: string;
  error?: string;
  raw?: unknown;
}

function parseMaybeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getTransactionId(payload: any, fallback: string): string {
  return String(
    payload?.transaction_id ||
      payload?.transactionId ||
      payload?.data?.transaction_id ||
      payload?.data?.transactionId ||
      payload?.order_id ||
      payload?.data?.order_id ||
      fallback
  );
}

function getRemoteMessage(payload: any, text: string): string {
  return String(
    payload?.message ||
      payload?.error ||
      payload?.data?.message ||
      payload?.data?.error ||
      text.slice(0, 500) ||
      "Unknown CamRapid response"
  );
}

function isCamRapidSuccess(payload: any, text: string): boolean {
  if (payload) {
    const status = String(
      payload.status ?? payload.data?.status ?? payload.result ?? payload.code ?? ""
    ).toLowerCase();

    if (payload.success === true || payload.ok === true) return true;
    if (["success", "created", "pending", "processing", "paid", "200", "0"].includes(status)) return true;
    if (payload.success === false || payload.ok === false) return false;
    if (["error", "failed", "fail", "invalid", "401", "403", "400"].includes(status)) return false;
  }

  const lower = text.toLowerCase();
  if (lower.includes("error") || lower.includes("invalid") || lower.includes("failed")) return false;

  return Boolean(text.trim());
}

export async function sendTopup(req: TopupRequest): Promise<TopupResult> {
  if (!CAMRAPID_KEY) {
    return { success: false, error: "CAMRAPID_API_KEY is not configured" };
  }

  if (!req.uid || !req.productCode || !req.orderRef) {
    return { success: false, error: "Missing uid, productCode, or orderRef" };
  }

  const body = new URLSearchParams({
    api_key: CAMRAPID_KEY,
    userid: req.uid,
    zoneid: req.serverId || "",
    product_code: req.productCode,
    reference: req.orderRef,
  });

  try {
    const res = await fetch(`${CAMRAPID_BASE}/Create_Orders.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json, text/plain, */*",
      },
      body,
    });

    const text = await res.text().catch(() => "");
    const payload = parseMaybeJson(text);

    if (!res.ok) {
      return {
        success: false,
        error: `CamRapid HTTP ${res.status}: ${getRemoteMessage(payload, text)}`,
        raw: payload ?? text,
      };
    }

    if (!isCamRapidSuccess(payload, text)) {
      return {
        success: false,
        error: getRemoteMessage(payload, text),
        raw: payload ?? text,
      };
    }

    return {
      success: true,
      transactionId: getTransactionId(payload, req.orderRef),
      status: String(payload?.status ?? payload?.data?.status ?? "created"),
      raw: payload ?? text,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
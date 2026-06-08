import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { verifyWebhook, PaymentMethod } from "@/lib/payment";
import { NextRequest, NextResponse } from "next/server";
import { logSecurityEvent } from "@/lib/secureLogger";
import { getClientIp } from "@/lib/getIp";
import {
  isRemotePaid,
  logPaymentValidationFailure,
  validatePaymentForOrder,
} from "@/lib/payment-validation";
import { notifyAndMaybeDeliverPaidOrder } from "@/lib/order-fulfillment";

function getPayloadData(payload: any): any {
  return payload?.data && typeof payload.data === "object" ? payload.data : payload;
}

function getWebhookOrderNumber(payload: any, data: any): string {
  return String(
    data?.metadata?.order_number ??
      data?.metadata?.orderNumber ??
      data?.order_number ??
      data?.orderNumber ??
      payload?.order_number ??
      payload?.orderNumber ??
      ""
  ).trim().toUpperCase();
}

function getWebhookTransactionId(payload: any, data: any): string {
  return String(
    data?.transaction_id ??
      data?.transactionId ??
      payload?.transaction_id ??
      payload?.transactionId ??
      ""
  ).trim();
}


function getKnownValue(obj: any, keys: string[], depth = 4): any {
  if (!obj || typeof obj !== "object" || depth < 0) return undefined;

  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const found = getKnownValue(value, keys, depth - 1);
      if (found !== undefined) return found;
    }
  }

  return undefined;
}

function getWebhookStatus(payload: any, data: any): string {
  return String(
    getKnownValue(data, [
      "payment_status",
      "paymentStatus",
      "transaction_status",
      "transactionStatus",
      "status",
      "state",
    ]) ??
      getKnownValue(payload, ["payment_status", "paymentStatus", "transaction_status", "transactionStatus", "status", "state"]) ??
      ""
  ).trim().toLowerCase();
}

function getWebhookAmount(payload: any, data: any): string | number | null {
  return (
    getKnownValue(data, ["amount", "amount_usd", "amountUsd", "total", "total_amount", "totalAmount"]) ??
    getKnownValue(payload, ["amount", "amount_usd", "amountUsd", "total", "total_amount", "totalAmount"]) ??
    null
  );
}

function getWebhookCurrency(payload: any, data: any): string | null {
  const value =
    getKnownValue(data, ["currency", "currency_code", "currencyCode"]) ??
    getKnownValue(payload, ["currency", "currency_code", "currencyCode"]);
  return value === undefined || value === null ? null : String(value).trim().toUpperCase();
}

function webhookPaidFlag(payload: any, data: any): boolean {
  const value =
    getKnownValue(data, ["paid", "is_paid", "isPaid", "approved", "success_paid"]) ??
    getKnownValue(payload, ["paid", "is_paid", "isPaid", "approved", "success_paid"]);

  if (value === true) return true;
  if (typeof value === "string") {
    return ["true", "1", "yes", "paid", "approved", "success"].includes(value.trim().toLowerCase());
  }
  if (typeof value === "number") return value === 1;
  return false;
}

function normalizeWebhookEvent(payload: any, data: any): "paid" | "expired" | "failed" | "ignored" {
  const declaredEvent = String(payload.event || payload.type || "").trim().toLowerCase();
  const providerStatus = getWebhookStatus(payload, data);

  if (["payment.paid", "payment.approved", "paid", "approved", "success", "completed"].includes(declaredEvent)) {
    return "paid";
  }
  if (["payment.expired", "expired"].includes(declaredEvent)) return "expired";
  if (["payment.failed", "failed", "declined", "rejected", "cancelled", "canceled"].includes(declaredEvent)) {
    return "failed";
  }

  if (isRemotePaid({ status: providerStatus, paid: webhookPaidFlag(payload, data) })) return "paid";
  if (["expired"].includes(providerStatus)) return "expired";
  if (["failed", "declined", "rejected", "cancelled", "canceled"].includes(providerStatus)) return "failed";

  return "ignored";
}

function isPrismaUniqueError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ method: string }> }
) {
  try {
    const { method: methodParam } = await params;
    const method = methodParam.toUpperCase() as PaymentMethod;

    if (method !== "KHPAY") {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
    }

    const rawBody = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });

    const valid = verifyWebhook(method, rawBody, headers);
    if (!valid) {
      logSecurityEvent({
        event: "webhook_invalid_signature",
        detail: method,
        ip: getClientIp(req),
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const data = getPayloadData(payload);
    const event = normalizeWebhookEvent(payload, data);
    const providerStatus = getWebhookStatus(payload, data);
    const transactionId = getWebhookTransactionId(payload, data);
    const orderNumber = getWebhookOrderNumber(payload, data);

    if (event === "ignored") {
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (!orderNumber || !transactionId) {
      logSecurityEvent({
        event: "payment_missing_ref",
        detail: `webhook missing orderNumber or transactionId; event=${event}`,
        ip: getClientIp(req),
      });
      return NextResponse.json({ error: "Missing payment reference" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { orderNumber } });
    if (!order) {
      logSecurityEvent({
        event: "webhook_order_mismatch",
        detail: `order not found; orderNumber=${orderNumber}; transactionId=${transactionId}`,
        ip: getClientIp(req),
      });
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (event === "paid") {
      const validation = validatePaymentForOrder(order, {
        orderNumber,
        transactionId,
        amount: getWebhookAmount(payload, data),
        currency: getWebhookCurrency(payload, data),
        status: providerStatus || "approved",
        paid: true,
      });

      if (!validation.ok) {
        logPaymentValidationFailure("webhook", validation);
        return NextResponse.json({ error: validation.message }, { status: 400 });
      }

      if (order.status !== "PENDING") {
        if (["PAID", "PROCESSING", "DELIVERED"].includes(order.status)) {
          return NextResponse.json({ ok: true, skipped: true, reason: "already_paid" });
        }

        return NextResponse.json(
          { error: "Order is not pending and cannot be marked paid" },
          { status: 409 }
        );
      }

      let fullOrder = null;
      try {
        fullOrder = await prisma.$transaction(async (tx: any) => {
          await tx.processedWebhookEvent.create({
            data: {
              transactionId: validation.transactionId,
              orderNumber: order.orderNumber,
              processedAt: new Date(),
            },
          });

          const updated = await tx.order.updateMany({
            where: {
              id: order.id,
              status: "PENDING",
              paymentRef: validation.transactionId,
            },
            data: {
              status: "PAID",
              paidAt: new Date(),
            },
          });

          if (updated.count !== 1) {
            throw new Error("Order payment update lost a race or no longer matches paymentRef.");
          }

          return tx.order.findUnique({
            where: { id: order.id },
            include: { game: true, product: true },
          });
        });
      } catch (error) {
        if (isPrismaUniqueError(error)) {
          logSecurityEvent({
            event: "webhook_replay_blocked",
            detail: `transactionId=${validation.transactionId}; order=${order.orderNumber}`,
          });
          return NextResponse.json({ ok: true, skipped: true, reason: "replay" });
        }
        throw error;
      }

      if (fullOrder) {
        await notifyAndMaybeDeliverPaidOrder(fullOrder.id);
      }
    } else {
      if (!order.paymentRef || order.paymentRef !== transactionId) {
        logSecurityEvent({
          event: "payment_transaction_mismatch",
          detail: `webhook ${event}: got=${transactionId}; expected=${order.paymentRef || "missing"}; order=${order.orderNumber}`,
        });
        return NextResponse.json({ error: "Payment transaction does not match order" }, { status: 400 });
      }

      if (order.status === "PENDING") {
        try {
          await prisma.$transaction(async (tx: any) => {
            await tx.processedWebhookEvent.create({
              data: {
                transactionId,
                orderNumber: order.orderNumber,
                processedAt: new Date(),
              },
            });

            await tx.order.update({
              where: { id: order.id },
              data: {
                status: event === "expired" ? "CANCELLED" : "FAILED",
                failureReason: `KHPay: ${event}`,
              },
            });
          });
        } catch (error) {
          if (isPrismaUniqueError(error)) {
            return NextResponse.json({ ok: true, skipped: true, reason: "replay" });
          }
          throw error;
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

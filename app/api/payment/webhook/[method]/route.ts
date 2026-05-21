<<<<<<< HEAD
=======
/**
 * /api/payment/webhook/[method] — KHPay webhook handler
 * (Issues #9: Replay protection, #11: Security logging)
 *
 * Changes:
 * - Stores processed transaction IDs to prevent replay attacks
 * - Verifies currency, amount, order ID, and provider transaction ID
 * - Logs invalid signatures and amount mismatches
 * - Simulation mode explicitly blocked in production at payment.ts level
 */

>>>>>>> 13d2b43 (first commit)
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { verifyWebhook, PaymentMethod } from "@/lib/payment";
import { notifyTelegram, escapeHtml } from "@/lib/telegram";
import { NextRequest, NextResponse } from "next/server";
<<<<<<< HEAD

// KHPay webhook receiver.
//   URL:     /api/payment/webhook/khpay
//   Events:  payment.paid | payment.expired | payment.failed
//   Signing: HMAC-SHA256 of raw body using your webhook secret
//            delivered in the `X-Webhook-Signature: sha256=<hex>` header.
//
// The route is parameterized so legacy paths still resolve; unknown methods
// are rejected with 400.
=======
import { logSecurityEvent } from "@/lib/secureLogger";
>>>>>>> 13d2b43 (first commit)

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ method: string }> }
) {
  const { method: methodParam } = await params;
  const method = methodParam.toUpperCase() as PaymentMethod;

  if (method !== "KHPAY") {
    return NextResponse.json({ error: "Invalid method" }, { status: 400 });
  }

  const rawBody = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });

  const valid = verifyWebhook(method, rawBody, headers);
  if (!valid) {
<<<<<<< HEAD
    console.warn(`[webhook] Invalid signature from ${method}`);
=======
    logSecurityEvent({
      event: "webhook_invalid_signature",
      detail: method,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });
>>>>>>> 13d2b43 (first commit)
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

<<<<<<< HEAD
  // KHPay payload shape:
  // { event: "payment.paid", data: { transaction_id, amount, currency, metadata, ... }, timestamp }
  const event: string = payload.event || "";
  const data = payload.data || {};
  const transactionId: string | undefined = data.transaction_id;
  // We set metadata.order_number when creating the QR (see lib/payment.ts)
=======
  const event: string = payload.event || "";
  const data = payload.data || {};
  const transactionId: string | undefined = data.transaction_id;
>>>>>>> 13d2b43 (first commit)
  const orderNumber: string | undefined =
    data.metadata?.order_number || data.metadata?.orderNumber;

  if (!orderNumber && !transactionId) {
    return NextResponse.json({ error: "Missing identifier" }, { status: 400 });
  }

<<<<<<< HEAD
=======
  // ── Replay protection (Issue #9) ───────────────────────────────────────────
  // If we already processed this exact transaction ID, return 200 (idempotent)
  // but do NOT process it again.
  if (transactionId) {
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: { transactionId },
    });
    if (alreadyProcessed) {
      logSecurityEvent({
        event: "webhook_replay_blocked",
        detail: `transactionId=${transactionId}`,
      });
      return NextResponse.json({ ok: true, skipped: true, reason: "replay" });
    }
  }

>>>>>>> 13d2b43 (first commit)
  const order = orderNumber
    ? await prisma.order.findUnique({ where: { orderNumber } })
    : await prisma.order.findFirst({ where: { paymentRef: transactionId! } });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

<<<<<<< HEAD
  // Idempotency: do nothing if already in a terminal state
=======
  // Idempotency: already in a terminal state
>>>>>>> 13d2b43 (first commit)
  if (order.status !== "PENDING") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (event === "payment.paid") {
<<<<<<< HEAD
    // Verify amount matches to prevent tampering
    const paidAmount = parseFloat(String(data.amount ?? "0"));
    if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - order.amountUsd) > 0.01) {
=======
    // Verify currency
    const currency: string = String(data.currency || "").toUpperCase();
    if (currency && currency !== "USD") {
      logSecurityEvent({
        event: "webhook_amount_mismatch",
        detail: `Currency mismatch: got ${currency}, expected USD`,
      });
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: "FAILED",
          failureReason: `Currency mismatch: got ${currency}, expected USD`,
        },
      });
      return NextResponse.json({ error: "Currency mismatch" }, { status: 400 });
    }

    // Verify amount
    const paidAmount = parseFloat(String(data.amount ?? "0"));
    if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - order.amountUsd) > 0.01) {
      logSecurityEvent({
        event: "webhook_amount_mismatch",
        detail: `Amount mismatch: got ${paidAmount}, expected ${order.amountUsd} for order ${order.orderNumber}`,
      });
>>>>>>> 13d2b43 (first commit)
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: "FAILED",
          failureReason: `Amount mismatch: got ${paidAmount}, expected ${order.amountUsd}`,
        },
      });
      return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
    }

<<<<<<< HEAD
=======
    // Record the processed transaction to prevent replay (Issue #9)
    if (transactionId) {
      await prisma.processedWebhookEvent.create({
        data: {
          transactionId,
          orderNumber: order.orderNumber,
          processedAt: new Date(),
        },
      });
    }

>>>>>>> 13d2b43 (first commit)
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paymentRef: transactionId || order.paymentRef,
      },
    });

<<<<<<< HEAD
    // Fire-and-forget Telegram notification to the operator.
=======
    // Fire-and-forget Telegram notification
>>>>>>> 13d2b43 (first commit)
    const fullOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { game: true, product: true },
    });
    if (fullOrder) {
<<<<<<< HEAD
      const baseUrl = process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
      const link = baseUrl ? `\n<a href="${baseUrl}/admin/orders/${fullOrder.orderNumber}">Open in admin</a>` : "";
      await notifyTelegram(
        `ðŸ’° <b>New paid order</b>\n` +
          `<b>#${escapeHtml(fullOrder.orderNumber)}</b>\n` +
          `${escapeHtml(fullOrder.game.name)} â€” ${escapeHtml(fullOrder.product.name)}\n` +
=======
      const baseUrl =
        process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
      const link = baseUrl
        ? `\n<a href="${baseUrl}/admin/orders/${fullOrder.orderNumber}">Open in admin</a>`
        : "";
      await notifyTelegram(
        `💰 <b>New paid order</b>\n` +
          `<b>#${escapeHtml(fullOrder.orderNumber)}</b>\n` +
          `${escapeHtml(fullOrder.game.name)} – ${escapeHtml(fullOrder.product.name)}\n` +
>>>>>>> 13d2b43 (first commit)
          `UID: <code>${escapeHtml(fullOrder.playerUid)}</code>\n` +
          `Amount: $${fullOrder.amountUsd.toFixed(2)}${link}`
      );
    }
<<<<<<< HEAD
    // TODO: enqueue fulfillment job (call game distributor API) here.
  } else if (event === "payment.expired" || event === "payment.failed") {
=======
  } else if (event === "payment.expired" || event === "payment.failed") {
    if (transactionId) {
      await prisma.processedWebhookEvent.create({
        data: {
          transactionId,
          orderNumber: order.orderNumber,
          processedAt: new Date(),
        },
      });
    }
>>>>>>> 13d2b43 (first commit)
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "FAILED",
        failureReason: `KHPay: ${event}`,
      },
    });
  }

  return NextResponse.json({ ok: true });
}

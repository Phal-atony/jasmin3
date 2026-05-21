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

import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { verifyWebhook, PaymentMethod } from "@/lib/payment";
import { notifyTelegram, escapeHtml } from "@/lib/telegram";
import { NextRequest, NextResponse } from "next/server";
import { logSecurityEvent } from "@/lib/secureLogger";

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
    logSecurityEvent({
      event: "webhook_invalid_signature",
      detail: method,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event: string = payload.event || "";
  const data = payload.data || {};
  const transactionId: string | undefined = data.transaction_id;
  const orderNumber: string | undefined =
    data.metadata?.order_number || data.metadata?.orderNumber;

  if (!orderNumber && !transactionId) {
    return NextResponse.json({ error: "Missing identifier" }, { status: 400 });
  }

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

  const order = orderNumber
    ? await prisma.order.findUnique({ where: { orderNumber } })
    : await prisma.order.findFirst({ where: { paymentRef: transactionId! } });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Idempotency: already in a terminal state
  if (order.status !== "PENDING") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (event === "payment.paid") {
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
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: "FAILED",
          failureReason: `Amount mismatch: got ${paidAmount}, expected ${order.amountUsd}`,
        },
      });
      return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
    }

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

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paymentRef: transactionId || order.paymentRef,
      },
    });

    // Fire-and-forget Telegram notification
    const fullOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { game: true, product: true },
    });
    if (fullOrder) {
      const baseUrl =
        process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
      const link = baseUrl
        ? `\n<a href="${baseUrl}/admin/orders/${fullOrder.orderNumber}">Open in admin</a>`
        : "";
      await notifyTelegram(
        `💰 <b>New paid order</b>\n` +
          `<b>#${escapeHtml(fullOrder.orderNumber)}</b>\n` +
          `${escapeHtml(fullOrder.game.name)} – ${escapeHtml(fullOrder.product.name)}\n` +
          `UID: <code>${escapeHtml(fullOrder.playerUid)}</code>\n` +
          `Amount: $${fullOrder.amountUsd.toFixed(2)}${link}`
      );
    }
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
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "FAILED",
        failureReason: `KHPay: ${event}`,
      },
    });
  }

  return NextResponse.json({ ok: true });.
}

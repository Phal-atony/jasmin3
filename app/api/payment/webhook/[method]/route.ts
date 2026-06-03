import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { verifyWebhook, PaymentMethod } from "@/lib/payment";
import { notifyTelegram, escapeHtml } from "@/lib/telegram";
import { NextRequest, NextResponse } from "next/server";
import { logSecurityEvent } from "@/lib/secureLogger";
import { sendTopup } from "@/lib/supplier";
import { getClientIp } from "@/lib/getIp";
import {
  logPaymentValidationFailure,
  validatePaymentForOrder,
} from "@/lib/payment-validation";

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
  ).trim();
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

function isPrismaUniqueError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

async function notifyAndMaybeDeliver(fullOrder: NonNullable<Awaited<ReturnType<typeof getPaidOrderForFulfillment>>>) {
  const baseUrl = process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
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

  if (fullOrder.product.supplierCode) {
    const topupResult = await sendTopup({
      game: fullOrder.game.slug,
      uid: fullOrder.playerUid,
      serverId: fullOrder.serverId ?? undefined,
      productCode: fullOrder.product.supplierCode,
      orderRef: fullOrder.orderNumber,
    });

    if (topupResult.success) {
      await prisma.order.update({
        where: { id: fullOrder.id },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          deliveryNote: `Auto-delivered via CamRapid. TXN: ${topupResult.transactionId ?? "N/A"}`,
        },
      });

      await notifyTelegram(
        `✅ <b>Auto topup DELIVERED</b>\n` +
          `#${escapeHtml(fullOrder.orderNumber)}\n` +
          `${escapeHtml(fullOrder.game.name)} – ${escapeHtml(fullOrder.product.name)}\n` +
          `UID: <code>${escapeHtml(fullOrder.playerUid)}</code>\n` +
          `CamRapid TXN: <code>${escapeHtml(topupResult.transactionId ?? "N/A")}</code>`
      );
    } else {
      await notifyTelegram(
        `⚠️ <b>Auto topup FAILED — process manually</b>\n` +
          `#${escapeHtml(fullOrder.orderNumber)}\n` +
          `${escapeHtml(fullOrder.game.name)} – ${escapeHtml(fullOrder.product.name)}\n` +
          `UID: <code>${escapeHtml(fullOrder.playerUid)}</code>\n` +
          `Error: ${escapeHtml(topupResult.error ?? "unknown")}${link}`
      );
    }
  } else {
    await notifyTelegram(
      `🔔 <b>Manual topup required</b>\n` +
        `#${escapeHtml(fullOrder.orderNumber)}\n` +
        `${escapeHtml(fullOrder.game.name)} – ${escapeHtml(fullOrder.product.name)}\n` +
        `UID: <code>${escapeHtml(fullOrder.playerUid)}</code>\n` +
        `(Product has no supplier code)${link}`
    );
  }
}

async function getPaidOrderForFulfillment(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { game: true, product: true },
  });
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

    const event = String(payload.event || payload.type || "").trim().toLowerCase();
    const data = getPayloadData(payload);
    const transactionId = getWebhookTransactionId(payload, data);
    const orderNumber = getWebhookOrderNumber(payload, data);

    if (!["payment.paid", "payment.expired", "payment.failed"].includes(event)) {
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

    if (event === "payment.paid") {
      const validation = validatePaymentForOrder(order, {
        orderNumber,
        transactionId,
        amount: data?.amount,
        currency: data?.currency,
        status: "paid",
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
        await notifyAndMaybeDeliver(fullOrder);
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
                status: event === "payment.expired" ? "CANCELLED" : "FAILED",
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

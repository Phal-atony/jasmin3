// lib/fulfillment.ts

import { prisma } from "@/lib/prisma";
import { sendTopup } from "@/lib/supplier";
import { notifyTelegram, escapeHtml } from "@/lib/telegram";

export interface FulfillmentResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
  transactionId?: string;
  status?: string;
}

export async function fulfillPaidOrder(orderNumber: string): Promise<FulfillmentResult> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { game: true, product: true },
  });

  if (!order) return { success: false, error: "Order not found" };

  if (order.status === "DELIVERED") {
    return { success: true, skipped: true, status: "already_delivered" };
  }

  if (order.status === "PROCESSING") {
    return { success: false, skipped: true, status: "already_processing" };
  }

  if (order.status !== "PAID") {
    return { success: false, skipped: true, status: `not_paid:${order.status}` };
  }

  const baseUrl = process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
  const link = baseUrl
    ? `\n<a href="${baseUrl}/admin/orders/${order.orderNumber}">Open in admin</a>`
    : "";

  if (!order.product.supplierCode) {
    await notifyTelegram(
      `🔔 <b>Manual topup required</b>\n` +
        `#${escapeHtml(order.orderNumber)}\n` +
        `${escapeHtml(order.game.name)} – ${escapeHtml(order.product.name)}\n` +
        `UID: <code>${escapeHtml(order.playerUid)}</code>\n` +
        `(Product has no supplier code)${link}`
    );

    return {
      success: false,
      skipped: true,
      error: "Product has no supplierCode",
    };
  }

  const claimed = await prisma.order.updateMany({
    where: { id: order.id, status: "PAID" },
    data: {
      status: "PROCESSING",
      deliveryNote: "Auto topup is being processed via CamRapidSecure.",
    },
  });

  if (claimed.count !== 1) {
    return { success: false, skipped: true, status: "not_claimed" };
  }

  const topupResult = await sendTopup({
    game: order.game.slug,
    uid: order.playerUid,
    serverId: order.serverId ?? undefined,
    productCode: order.product.supplierCode,
    orderRef: order.orderNumber,
  });

  if (topupResult.success) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
        deliveryNote: `Auto-delivered via CamRapidSecure. TXN: ${topupResult.transactionId ?? "N/A"}`,
        failureReason: null,
      },
    });

    await notifyTelegram(
      `✅ <b>Auto topup DELIVERED</b>\n` +
        `#${escapeHtml(order.orderNumber)}\n` +
        `${escapeHtml(order.game.name)} – ${escapeHtml(order.product.name)}\n` +
        `UID: <code>${escapeHtml(order.playerUid)}</code>\n` +
        `CamRapid TXN: <code>${escapeHtml(topupResult.transactionId ?? "N/A")}</code>`
    );

    return {
      success: true,
      transactionId: topupResult.transactionId,
      status: topupResult.status,
    };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "PAID",
      failureReason: `Auto topup failed: ${topupResult.error ?? "unknown"}`,
      deliveryNote: "Auto topup failed. Please process this order manually.",
    },
  });

  await notifyTelegram(
    `⚠️ <b>Auto topup FAILED — process manually</b>\n` +
      `#${escapeHtml(order.orderNumber)}\n` +
      `${escapeHtml(order.game.name)} – ${escapeHtml(order.product.name)}\n` +
      `UID: <code>${escapeHtml(order.playerUid)}</code>\n` +
      `Error: ${escapeHtml(topupResult.error ?? "unknown")}${link}`
  );

  return {
    success: false,
    error: topupResult.error ?? "unknown",
  };
}
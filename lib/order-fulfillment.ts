import { prisma } from "@/lib/prisma";
import { notifyTelegram, escapeHtml } from "@/lib/telegram";
import { sendTopup } from "@/lib/supplier";

/**
 * Runs post-payment work after an order safely transitions to PAID.
 * This function must only be called after strict provider verification has
 * already matched transaction reference, amount, currency, and order identity.
 */
export async function notifyAndMaybeDeliverPaidOrder(orderId: string) {
  const fullOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: { game: true, product: true },
  });

  if (!fullOrder) return null;

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

  return fullOrder;
}

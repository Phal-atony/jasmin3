import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { initiatePayment } from "@/lib/payment";
import { applyRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/getIp";
import { safeJson } from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params;
  const normalizedOrderNumber = orderNumber.trim().toUpperCase();
  const ip = getClientIp(req);

  const rl = await applyRateLimit(
    `refresh-payment:${normalizedOrderNumber}:${ip}`,
    5,
    10 * 60 * 1000,
    ip
  );
  if (rl) return rl;

  if (!/^[A-Z0-9-]{3,40}$/.test(normalizedOrderNumber)) {
    return safeJson({ error: "Order not found" }, { status: 404 });
  }

  const order = await prisma.order.findUnique({
    where: {
      orderNumber: normalizedOrderNumber,
    },
    include: {
      game: { select: { name: true, slug: true } },
      product: { select: { name: true } },
    },
  });

  if (!order) {
    return safeJson({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "PENDING") {
    return safeJson(
      { error: "This order cannot refresh payment QR" },
      { status: 409 }
    );
  }

  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    req.nextUrl.origin
  ).replace(/\/$/, "");

  const returnUrl = `${baseUrl}/checkout/${encodeURIComponent(order.orderNumber)}`;
  const cancelUrl = `${baseUrl}/games/${encodeURIComponent(order.game.slug)}`;
  const callbackUrl = `${baseUrl}/api/payment/webhook/khpay`;

  const payment = await initiatePayment({
    orderNumber: order.orderNumber,
    amountUsd: order.amountUsd,
    method: order.paymentMethod as "KHPAY",
    returnUrl,
    cancelUrl,
    callbackUrl,
  });

  const updated = await prisma.order.update({
    where: {
      id: order.id,
    },
    data: {
      paymentRef: payment.paymentRef,
      paymentUrl: payment.redirectUrl,
      qrString: payment.qrString,
      paymentExpiresAt: payment.expiresAt,
    },
    include: {
      game: { select: { name: true, slug: true } },
      product: { select: { name: true } },
    },
  });

  return safeJson({
    orderNumber: updated.orderNumber,
    status: updated.status,
    playerUid: updated.playerUid,
    serverId: updated.serverId,
    amountUsd: updated.amountUsd,
    amountKhr: updated.amountKhr,
    paymentMethod: updated.paymentMethod,

    gameName: updated.game.name,
    gameSlug: updated.game.slug,
    productName: updated.product.name,

    qrString: updated.qrString,
    paymentUrl: updated.paymentUrl,
    paymentExpiresAt: updated.paymentExpiresAt?.toISOString() ?? null,
    expiresAt: updated.paymentExpiresAt?.toISOString() ?? null,

    canPay: true,
    isExpired: false,
    serverTime: new Date().toISOString(),
  });
}

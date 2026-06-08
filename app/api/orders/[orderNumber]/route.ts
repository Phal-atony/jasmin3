import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
import { logSecurityEvent } from "@/lib/secureLogger"; 

import { NextRequest, NextResponse } from "next/server";
import { fetchKhpayStatus } from "@/lib/payment";
import {
  isRemotePaid,
  logPaymentValidationFailure,
  validatePaymentForOrder,
} from "@/lib/payment-validation";

/**
 * Public order lookup.
 *
 * Returns both nested fields (backward-compat) and flat frontend-friendly
 * fields so checkout/[orderNumber]/page.tsx can destructure directly.
 *
 * Security rules:
 *  - paymentRef is ONLY returned for SIM- prefixed orders (dev simulation).
 *  - qrString / paymentUrl are only returned when order is PENDING & not expired.
 *  - Customer data is masked.
 *  - No internal IDs, admin notes, webhook data, or failure reasons are exposed.
 */
function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return email.slice(0, 3) + "***";
  return local.slice(0, 2) + "***@" + domain;
}

function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  if (phone.length <= 4) return "****";
  return phone.slice(0, 3) + "****" + phone.slice(-2);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params;
  let order = await prisma.order.findUnique({
    where: { orderNumber: orderNumber.toUpperCase() },
    include: {
      game:    { select: { name: true, slug: true } },
      product: { select: { name: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Public order lookup is read-only in production.
  // Development-only sync is opt-in and still requires strict payment validation.
  const allowPublicPaymentSync =
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_PUBLIC_PAYMENT_SYNC === "true";

  if (
    allowPublicPaymentSync &&
    order.status === "PENDING" &&
    order.paymentRef &&
    !order.paymentRef.startsWith("SIM-")
  ) {
    try {
      const remote = await fetchKhpayStatus(order.paymentRef);

      if (isRemotePaid(remote)) {
        const validation = validatePaymentForOrder(order, {
          orderNumber: order.orderNumber,
          transactionId: remote?.transactionId ?? order.paymentRef,
          amount: remote?.amount,
          currency: remote?.currency,
          status: remote?.status,
          paid: remote?.paid,
        });

        if (validation.ok) {
          order = await prisma.order.update({
            where: { id: order.id },
            data: { status: "PAID", paidAt: new Date() },
            include: {
              game: { select: { name: true, slug: true } },
              product: { select: { name: true } },
            },
          });
        } else {
          logPaymentValidationFailure("public_sync", validation);
        }
      }
    } catch (error) {
      logSecurityEvent({
        event: "payment_public_sync_blocked",
        detail: error instanceof Error ? error.message : "public sync failed",
      });
    }
  }

  // Determine if payment info is safe to expose
  const isPending    = order.status === "PENDING";
  const paymentExpiry = order.paymentExpiresAt;
  const isExpired    = paymentExpiry ? paymentExpiry < new Date() : false;
  const canPay       = isPending && !isExpired;

  // Only expose paymentRef for simulation orders (SIM- prefix) in dev.
  // Real payment references are never sent to the client.
  const isSimulation = order.paymentRef?.startsWith("SIM-") ?? false;
  const safePaymentRef =
    canPay && isSimulation && process.env.NODE_ENV !== "production"
      ? order.paymentRef
      : null;

  const qrString   = canPay ? order.qrString   : null;
  const paymentUrl = canPay ? order.paymentUrl  : null;

  return NextResponse.json({
    // ── Core fields ────────────────────────────────────────────────────────
    orderNumber:   order.orderNumber,
    status:        order.status,
    playerUid:     order.playerUid,
    serverId:      order.serverId,
    amountUsd:     order.amountUsd,
    amountKhr:     order.amountKhr,
    paymentMethod: order.paymentMethod,
    createdAt:     order.createdAt.toISOString(),
    paidAt:        order.paidAt?.toISOString()       ?? null,
    deliveredAt:   order.deliveredAt?.toISOString()  ?? null,

    // ── Frontend-friendly flat fields (Task 2) ─────────────────────────────
    gameName:          order.game.name,
    gameSlug:          order.game.slug,
    productName:       order.product.name,
    qrString,
    paymentUrl,
    paymentRef:        safePaymentRef,   // null for real orders; SIM- only in dev
    paymentExpiresAt:  order.paymentExpiresAt?.toISOString() ?? null,

    // ── Masked customer data ───────────────────────────────────────────────
    customerEmail: maskEmail(order.customerEmail),
    customerPhone: maskPhone(order.customerPhone),

    // ── Nested payment object (backward-compat) ────────────────────────────
    payment: {
      canPay,
      paymentUrl,
      qrString,
      expiresAt: order.paymentExpiresAt?.toISOString() ?? null,
    },

    // ── Backward-compat legacy field aliases ───────────────────────────────
    game:    order.game.name,
    package: order.product.name,
    expiresAt: order.paymentExpiresAt?.toISOString() ?? null,

    // NEVER returned: raw paymentRef for real orders, internal transaction ID,
    // webhook data, admin notes, failureReason, or un-masked customer data.
  });
}

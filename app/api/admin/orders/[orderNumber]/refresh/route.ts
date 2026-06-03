import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { writeAudit } from "@/lib/audit";
import { fetchKhpayStatus } from "@/lib/payment";
import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/withAdminAuth";
import {
  isRemotePaid,
  logPaymentValidationFailure,
  validatePaymentForOrder,
} from "@/lib/payment-validation";

/**
 * Admin-only payment refresh.
 * This endpoint may update payment status, but only after strict provider data
 * validation against the existing order paymentRef, amount, and currency.
 */
export const POST = withAdminAuth(async (
  _req,
  { params }: { params: Promise<{ orderNumber: string }> }
) => {
  const { orderNumber } = await params;
  const order = await prisma.order.findUnique({
    where: { orderNumber },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (order.status !== "PENDING") {
    return NextResponse.json(
      { error: "Only pending orders can be refreshed into a paid state", order },
      { status: 409 }
    );
  }

  if (!order.paymentRef || order.paymentRef.startsWith("SIM-")) {
    return NextResponse.json({ error: "No real KHPay reference on order" }, { status: 400 });
  }

  const remote = await fetchKhpayStatus(order.paymentRef);
  if (!remote) {
    return NextResponse.json(
      { error: "Unable to fetch remote payment status", order },
      { status: 502 }
    );
  }

  let updated = order;
  if (isRemotePaid(remote)) {
    const validation = validatePaymentForOrder(order, {
      orderNumber: order.orderNumber,
      transactionId: remote.transactionId ?? order.paymentRef,
      amount: remote.amount,
      currency: remote.currency,
      status: remote.status,
      paid: remote.paid,
    });

    if (!validation.ok) {
      logPaymentValidationFailure("admin_refresh", validation);
      await writeAudit({
        action: "order.khpay_refresh.rejected",
        targetType: "order",
        targetId: order.id,
        details: { paymentRef: order.paymentRef, remote, reason: validation.code },
      });

      return NextResponse.json(
        { error: validation.message, code: validation.code, remote, order },
        { status: 400 }
      );
    }

    const updateResult = await prisma.order.updateMany({
      where: {
        id: order.id,
        status: "PENDING",
        paymentRef: validation.transactionId,
      },
      data: { status: "PAID", paidAt: new Date() },
    });

    if (updateResult.count !== 1) {
      return NextResponse.json(
        { error: "Order changed before refresh could complete", remote, order },
        { status: 409 }
      );
    }

    updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    await writeAudit({
      action: "order.khpay_refresh.auto_paid",
      targetType: "order",
      targetId: order.id,
      details: { paymentRef: order.paymentRef, remote },
    });
  } else if (remote.status === "expired" || remote.status === "failed") {
    updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: "FAILED", failureReason: `KHPay: ${remote.status}` },
    });
    await writeAudit({
      action: "order.khpay_refresh.auto_failed",
      targetType: "order",
      targetId: order.id,
      details: { paymentRef: order.paymentRef, remote },
    });
  }

  await writeAudit({
    action: "order.khpay_refresh",
    targetType: "order",
    targetId: order.id,
    details: { paymentRef: order.paymentRef, remote },
  });

  return NextResponse.json({ remote, order: updated });
});

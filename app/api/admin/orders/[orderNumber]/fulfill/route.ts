import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { fulfillPaidOrder } from "@/lib/fulfillment";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const POST = withAdminAuth(async (
  _req,
  { params }: { params: Promise<{ orderNumber: string }> }
) => {
  const { orderNumber } = await params;
  const normalizedOrderNumber = orderNumber.toUpperCase();

  const result = await fulfillPaidOrder(normalizedOrderNumber);

  const auditDetails: Record<string, unknown> = {
    ...result,
  };

  await writeAudit({
    action: "order.retry_auto_topup",
    targetType: "order",
    targetId: normalizedOrderNumber,
    details: auditDetails,
  });

  return NextResponse.json(result, {
    status: result.success ? 200 : 400,
  });
});
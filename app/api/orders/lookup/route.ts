import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rateLimit";

const lookupSchema = z.object({
  query: z.string().min(3).max(100),
});

export async function POST(req: NextRequest) {
  // ── Rate limit: 7 requests / 60 s / IP ──────────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip, 7, 60_000)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429 }
    );
  }
  // ────────────────────────────────────────────────────────────────────────

  try {
    const body = await req.json();
    const parsed = lookupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter at least 3 characters" },
        { status: 400 }
      );
    }

    const { query } = parsed.data;
    const trimmed = query.trim();

    const PAID_STATUSES = ["PAID", "PROCESSING", "DELIVERED"];

    const orders = await prisma.order.findMany({
      where: {
        status: { in: PAID_STATUSES },
        OR: [
          { customerEmail: trimmed.toLowerCase() },
          { customerEmail: trimmed },
          { customerPhone: trimmed },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        game: { select: { name: true } },
        product: { select: { name: true } },
      },
    });

    if (orders.length === 0) {
      return NextResponse.json(
        { error: "No paid orders found for this email or phone number" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      orders: orders.map((o) => ({
        orderNumber: o.orderNumber,
        status: o.status,
        gameName: o.game.name,
        productName: o.product.name,
        amountUsd: o.amountUsd,
        createdAt: o.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
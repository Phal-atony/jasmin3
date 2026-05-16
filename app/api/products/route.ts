import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const gameId = req.nextUrl.searchParams.get("gameId");
  const products = await prisma.product.findMany({
    where: {
      active: true,
      ...(gameId ? { gameId } : {}),
    },
    orderBy: [{ sortOrder: "asc" }],
    select: {
      id: true,
      gameId: true,
      name: true,
      amount: true,
      bonus: true,
      priceUsd: true,
      priceKhr: true,
      badge: true,
      imageUrl: true,
      sortOrder: true,
    },
  });
  return NextResponse.json(products);
}
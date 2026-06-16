import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import {
  API_CACHE_SHORT,
  publicRateLimit,
  rejectSuspiciousQuery,
  safeJson,
} from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";

function isSafeId(value: string): boolean {
  return /^[a-zA-Z0-9_-]{1,80}$/.test(value);
}

export async function GET(req: NextRequest) {
  const suspicious = rejectSuspiciousQuery(req);
  if (suspicious) return suspicious;

  const limited = publicRateLimit(req, "api-products", {
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const gameId = req.nextUrl.searchParams.get("gameId");

  if (gameId && !isSafeId(gameId)) {
    return safeJson({ error: "Invalid gameId" }, { status: 400 });
  }

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

  return safeJson(products, undefined, API_CACHE_SHORT);
}

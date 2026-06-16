import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import {
  API_CACHE_SHORT,
  publicRateLimit,
  rejectSuspiciousQuery,
  safeJson,
} from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const suspicious = rejectSuspiciousQuery(req);
  if (suspicious) return suspicious;

  const limited = publicRateLimit(req, "api-games", {
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const games = await prisma.game.findMany({
    where: { active: true },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      publisher: true,
      currencyName: true,
      imageUrl: true,
      featured: true,
    },
  });

  return safeJson(games, undefined, API_CACHE_SHORT);
}

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

  const limited = publicRateLimit(req, "api-banners", {
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const banners = await prisma.heroBanner.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return safeJson(banners, undefined, API_CACHE_SHORT);
}

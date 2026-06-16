import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
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

  const limited = publicRateLimit(req, "api-settings-public", {
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 1 },
      select: {
        maintenanceMode: true,
        maintenanceMessage: true,
      },
    });

    return safeJson(
      {
        maintenanceMode: settings?.maintenanceMode ?? false,
        maintenanceMessage:
          settings?.maintenanceMessage ??
          "Server កំពុងថែទាំបណ្តោះអាសន្ន។ សូមរង់ចាំប្រហែល 30 នាទី។",
      },
      undefined,
      API_CACHE_SHORT
    );
  } catch {
    return safeJson(
      {
        maintenanceMode: false,
        maintenanceMessage: "",
      },
      undefined,
      API_CACHE_SHORT
    );
  }
}

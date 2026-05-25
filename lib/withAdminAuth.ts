import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import type { Admin } from "@prisma/client";

type RouteContext = { params: Promise<Record<string, string>> };

type AuthedHandler = (
  req: NextRequest,
  ctx: RouteContext,
  admin: Admin
) => Promise<NextResponse> | NextResponse;

export function withAdminAuth(handler: AuthedHandler) {
  return async function (req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
    return handler(req, ctx, admin);
  };
}
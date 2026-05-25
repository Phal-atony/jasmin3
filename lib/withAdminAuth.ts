import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import type { Admin } from "@prisma/client";

type RouteParams = Record<string, string>;

export type AdminRouteContext<TParams extends RouteParams = RouteParams> = {
  params: Promise<TParams>;
};

type AuthedHandler<TParams extends RouteParams = RouteParams> = (
  req: NextRequest,
  ctx: AdminRouteContext<TParams>,
  admin: Admin
) => Promise<NextResponse> | NextResponse;

export function withAdminAuth<TParams extends RouteParams = RouteParams>(
  handler: AuthedHandler<TParams>
) {
  return async function (
    req: NextRequest,
    ctx: AdminRouteContext<TParams>
  ): Promise<NextResponse> {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    return handler(req, ctx, admin);
  };
}
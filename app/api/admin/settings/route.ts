<<<<<<< HEAD
﻿import { prisma } from "@/lib/prisma";
=======
/**
 * /api/admin/settings — Admin settings API (Issue #8)
 *
 * Changes:
 * - GET masks telegramBotToken (shows only last 4 chars)
 * - Auth check added to both GET and PATCH
 * - Audit log written on PATCH
 */

import { prisma } from "@/lib/prisma";
>>>>>>> 13d2b43 (first commit)
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
<<<<<<< HEAD
=======
import { getCurrentAdmin } from "@/lib/auth";
import { logSecurityEvent } from "@/lib/secureLogger";
>>>>>>> 13d2b43 (first commit)

const settingsSchema = z.object({
  siteName: z.string().min(1).optional(),
  exchangeRate: z.number().positive().optional(),
  supportTelegram: z.string().optional(),
  supportEmail: z.string().optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().nullable().optional(),
  announcement: z.string().nullable().optional(),
<<<<<<< HEAD
  announcementTone: z.enum(["info", "warning", "promo"]).nullable().optional(),
=======
  announcementTone: z
    .enum(["info", "warning", "promo"])
    .nullable()
    .optional(),
>>>>>>> 13d2b43 (first commit)
  telegramBotToken: z.string().nullable().optional(),
  telegramChatId: z.string().nullable().optional(),
});

<<<<<<< HEAD
export async function GET() {
=======
/** Mask a secret: "••••••••1234" — shows only last 4 chars */
function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return "••••";
  return "••••••••" + value.slice(-4);
}

export async function GET() {
  // Settings are admin-only (Issue #8)
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

>>>>>>> 13d2b43 (first commit)
  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
<<<<<<< HEAD
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
=======

  // Return masked version — never expose full token to client
  return NextResponse.json({
    ...settings,
    telegramBotToken: maskSecret(settings.telegramBotToken),
    // telegramChatId is not secret but also not useful to expose fully
  });
}

export async function PATCH(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

>>>>>>> 13d2b43 (first commit)
  const body = await req.json().catch(() => ({}));
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }
<<<<<<< HEAD
  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: parsed.data,
    create: { id: 1, ...parsed.data },
  });
  return NextResponse.json(settings);
=======

  const data = parsed.data;

  // If the client sends the masked placeholder back, don't overwrite the real token
  if (
    typeof data.telegramBotToken === "string" &&
    data.telegramBotToken.startsWith("••••")
  ) {
    delete data.telegramBotToken;
  }

  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });

  logSecurityEvent({
    event: "admin_settings_changed",
    adminId: admin.id,
    detail: Object.keys(data).join(", "),
  });

  return NextResponse.json({
    ...settings,
    telegramBotToken: maskSecret(settings.telegramBotToken),
  });
>>>>>>> 13d2b43 (first commit)
}

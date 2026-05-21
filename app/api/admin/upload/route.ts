<<<<<<< HEAD
﻿import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { v2 as cloudinary } from "cloudinary";

// ✅ Cloudinary config - យក values ពី .env
=======
/**
 * /api/admin/upload — Secure file upload (Issue #5)
 *
 * Changes:
 * - SVG removed (XSS risk)
 * - GIF removed (animated abuse / limited need)
 * - Only PNG, JPG/JPEG, WEBP allowed
 * - Magic-byte validation (not just MIME type)
 * - Auth check added (this route was unprotected!)
 * - Rate limited
 * - Cloudinary upload with safe public_id
 */

import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getCurrentAdmin } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/secureLogger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

>>>>>>> 13d2b43 (first commit)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

<<<<<<< HEAD
// Max upload size: 5 MB
const MAX_BYTES = 5 * 1024 * 1024;

// Strict whitelist of allowed image types
const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export async function POST(req: NextRequest) {
=======
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// Allowed MIME types (SVG and GIF removed)
const ALLOWED_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

// Magic bytes for each allowed type
const MAGIC: Record<string, (buf: Uint8Array) => boolean> = {
  "image/png": (b) =>
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) =>
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50,
};

function generateSafePublicId(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  return `jasmintopup/img_${ts}_${rand}`;
}

export async function POST(req: NextRequest) {
  // Auth check — upload endpoint must be admin-only
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 20 uploads per admin per hour
  const rl = await applyRateLimit(
    `upload:${admin.id}`,
    20,
    60 * 60 * 1000,
    admin.id
  );
  if (rl) return rl;

>>>>>>> 13d2b43 (first commit)
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
<<<<<<< HEAD

    if (file.size === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large. Max ${MAX_BYTES / 1024 / 1024}MB.` },
=======
    if (file.size === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_BYTES / 1024 / 1024} MB.` },
>>>>>>> 13d2b43 (first commit)
        { status: 413 }
      );
    }

<<<<<<< HEAD
    const ext = ALLOWED[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: `Unsupported type "${file.type}". Use PNG, JPG, WEBP, GIF, or SVG.` },
=======
    const ext = ALLOWED_MIME[file.type];
    if (!ext) {
      logSecurityEvent({
        event: "upload_rejected",
        adminId: admin.id,
        detail: `Rejected MIME: ${file.type}`,
      });
      return NextResponse.json(
        { error: "Unsupported file type. Only PNG, JPG, and WEBP are allowed." },
>>>>>>> 13d2b43 (first commit)
        { status: 415 }
      );
    }

<<<<<<< HEAD
    // ✅ Convert file to base64 ហើយ upload ទៅ Cloudinary
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(base64, {
      folder: "jasmintopup",   // folder នៅក្នុង Cloudinary
      resource_type: "image",
    });

    // ✅ Return Cloudinary URL (នៅអចិន្ត្រៃយ៍ ទោះ restart ប៉ុន្មានដង)
=======
    // Read first 12 bytes for magic byte check
    const buffer = Buffer.from(await file.arrayBuffer());
    const magicCheck = MAGIC[file.type];
    if (magicCheck && !magicCheck(new Uint8Array(buffer.slice(0, 12)))) {
      logSecurityEvent({
        event: "upload_rejected",
        adminId: admin.id,
        detail: `Magic byte mismatch for claimed MIME: ${file.type}`,
      });
      return NextResponse.json(
        { error: "File content does not match the declared file type." },
        { status: 415 }
      );
    }

    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;
    const publicId = generateSafePublicId();

    const result = await cloudinary.uploader.upload(base64, {
      public_id: publicId,
      resource_type: "image",
      // Explicitly deny SVG transformation to prevent stored XSS
      allowed_formats: ["png", "jpg", "webp"],
      // Strip EXIF metadata
      exif: false,
    });

>>>>>>> 13d2b43 (first commit)
    return NextResponse.json({
      url: result.secure_url,
      size: file.size,
      type: file.type,
    });
<<<<<<< HEAD

=======
>>>>>>> 13d2b43 (first commit)
  } catch (err) {
    console.error("[upload] error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
<<<<<<< HEAD
}
=======
}
>>>>>>> 13d2b43 (first commit)

<<<<<<< HEAD
import type { NextConfig } from "next";

const cspHeader = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://i.ibb.co https://api.qrserver.com https://img.freepik.com",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");
=======
/**
 * next.config.ts (Issue #6: Improved CSP)
 *
 * Changes:
 * - Removed 'unsafe-eval' from script-src in production
 * - Removed 'unsafe-inline' from script-src (use nonce approach for inline scripts)
 * - Added Cloudinary to img-src
 * - Added res.cloudinary.com to img-src
 * - Added nonce support (set via middleware for Next.js to consume)
 */

import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

function buildCspHeader(nonce?: string): string {
  const nonceAttr = nonce ? `'nonce-${nonce}'` : "";

  // In development allow unsafe-eval for HMR and fast-refresh
  const scriptSrc = isProduction
    ? ["'self'", nonceAttr, "'strict-dynamic'"].filter(Boolean).join(" ")
    : ["'self'", "'unsafe-inline'", "'unsafe-eval'"].join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    [
      "img-src 'self' data: blob:",
      "https://i.ibb.co",
      "https://api.qrserver.com",
      "https://img.freepik.com",
      "https://res.cloudinary.com",
      "https://*.cloudinary.com",
    ].join(" "),
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    isProduction ? "upgrade-insecure-requests" : "",
  ]
    .filter(Boolean)
    .join("; ");
}
>>>>>>> 13d2b43 (first commit)

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "fontkit"],

  poweredByHeader: false,

  images: {
    remotePatterns: [
<<<<<<< HEAD
      {
        protocol: "https",
        hostname: "i.ibb.co",
      },
      {
        protocol: "https",
        hostname: "api.qrserver.com",
      },
      {
        protocol: "https",
        hostname: "img.freepik.com",
      },
=======
      { protocol: "https", hostname: "i.ibb.co" },
      { protocol: "https", hostname: "api.qrserver.com" },
      { protocol: "https", hostname: "img.freepik.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
>>>>>>> 13d2b43 (first commit)
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
<<<<<<< HEAD
            value: cspHeader,
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
=======
            value: buildCspHeader(),
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
>>>>>>> 13d2b43 (first commit)
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

<<<<<<< HEAD
export default nextConfig;
=======
export default nextConfig;
>>>>>>> 13d2b43 (first commit)

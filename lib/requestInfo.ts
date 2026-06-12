// lib/requestInfo.ts
import { NextRequest } from "next/server";
import { getClientIp } from "@/lib/getIp";

export function getRequestInfo(req: NextRequest) {
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || "";
  const country = req.headers.get("cf-ipcountry") || null;

  const ua = userAgent.toLowerCase();

  const os =
    ua.includes("android") ? "Android" :
    ua.includes("iphone") || ua.includes("ios") ? "iOS" :
    ua.includes("windows") ? "Windows" :
    ua.includes("mac os") ? "macOS" :
    "Unknown";

  const browser =
    ua.includes("chrome") ? "Chrome" :
    ua.includes("safari") ? "Safari" :
    ua.includes("firefox") ? "Firefox" :
    ua.includes("edg") ? "Edge" :
    "Unknown";

  const device =
    ua.includes("mobile") ? "Mobile" :
    ua.includes("tablet") ? "Tablet" :
    "Desktop/Unknown";

  return { ip, userAgent, country, os, browser, device };
}

export function detectProvider(isp?: string | null) {
  const text = (isp || "").toLowerCase();

  if (text.includes("smart")) return "Smart";
  if (text.includes("metfone") || text.includes("viettel")) return "Metfone";
  if (text.includes("cellcard") || text.includes("camgsm")) return "Cellcard";
  if (text.includes("seatel")) return "Seatel";
  if (text.includes("ezecom")) return "Ezecom";

  return isp || "Unknown";
}
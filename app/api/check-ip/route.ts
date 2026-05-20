import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Check outbound IP via ipify
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();

    return NextResponse.json({
      outbound_ip: data.ip,
      message: "This is the IP that KHPay sees when your server makes requests.",
      fixie_enabled: !!process.env.FIXIE_URL,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch outbound IP", detail: String(err) },
      { status: 500 }
    );
  }
}
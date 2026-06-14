"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  helper: string;
};

const NAV: NavItem[] = [
  {
    href: "/",
    label: "ទំព័រដើម",
    helper: "Welcome page",
    icon: (
      <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5.5 9.5V20h13V9.5" />
        <path d="M9.5 20v-5h5v5" />
      </svg>
    ),
  },
  {
    href: "/#games",
    label: "ហ្គេម",
    helper: "Top up games",
    icon: (
      <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 9h11a3.5 3.5 0 0 1 3.23 4.84l-1.27 3.1A3.5 3.5 0 0 1 16.23 19H7.77a3.5 3.5 0 0 1-3.23-2.06l-1.27-3.1A3.5 3.5 0 0 1 6.5 9Z" />
        <path d="M8 12h3" />
        <path d="M9.5 10.5v3" />
        <path d="M15.5 11.5h.01" />
        <path d="M17.5 13.5h.01" />
      </svg>
    ),
  },
  {
    href: "/order",
    label: "តាមដានការបញ្ជាទិញ",
    helper: "Track order",
    icon: (
      <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-3.2-3.2" />
        <path d="M11 8.5v2.7l1.7 1.7" />
      </svg>
    ),
  },
  {
    href: "/#faq",
    label: "FAQ",
    helper: "Common questions",
    icon: (
      <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 9a4 4 0 1 1 7 2.65c-.72.73-1.5 1.12-2.11 1.67-.6.55-.89 1.05-.89 1.68" />
        <path d="M12 17h.01" />
        <path d="M5 5h14v14H5z" opacity="0.18" />
      </svg>
    ),
  },
];

function isNavActive(pathname: string | null, href: string) {
  if (href === "/") return pathname === "/";
  return pathname?.startsWith(href.replace(/#.*/, ""));
}

export default function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          scrolled
            ? "border-b border-pink-200/80 bg-white/90 shadow-lg shadow-pink-200/40 backdrop-blur-2xl"
            : "border-b border-transparent bg-white/75 backdrop-blur-xl"
        }`}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-pink-400 to-transparent opacity-90" />

        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-white via-pink-50 to-pink-100 p-1 shadow-md shadow-pink-200/60 ring-1 ring-pink-200/80 transition-all duration-300 group-hover:scale-105 group-hover:shadow-pink-300/70">
              <span className="absolute inset-0 rounded-2xl bg-pink-300/20 blur-md opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <Image
                src="/jasmintopup-logo.png"
                alt="JASMINTOPUP Logo"
                width={44}
                height={44}
                className="relative h-full w-full object-contain drop-shadow-sm"
                priority
              />
            </span>
            <div className="flex flex-col leading-none">
              <span className="font-display text-xl font-extrabold tracking-tight text-pink-800">
                JASMIN<span className="text-pink-500">TOPUP</span>
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-pink-400">
                Instant · Secure · 24/7
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 rounded-full border border-pink-200 bg-pink-50/80 px-2 py-1.5 shadow-inner shadow-white/60 backdrop-blur-md md:flex">
            {NAV.map((item) => {
              const active = isNavActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative overflow-hidden rounded-full px-4 py-1.5 text-sm font-bold transition-all duration-300 ${
                    active ? "text-white" : "text-pink-700 hover:text-pink-500"
                  }`}
                >
                  {active && (
                    <span
                      className="absolute inset-0 -z-0 rounded-full shadow-md shadow-pink-300/50"
                      style={{ background: "linear-gradient(135deg,#E91E8C,#FF6EB4)" }}
                    />
                  )}
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/order"
              className="hidden items-center gap-2 rounded-full border border-pink-300 bg-white px-4 py-2 text-sm font-bold text-pink-600 shadow-sm shadow-pink-100 transition-all duration-300 hover:-translate-y-0.5 hover:border-pink-500 hover:bg-pink-50 hover:shadow-md hover:shadow-pink-200/60 sm:inline-flex"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              តាមដានការបញ្ជាទិញ
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              className={`group relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border bg-white text-pink-600 shadow-md shadow-pink-200/50 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-95 md:hidden ${
                mobileOpen
                  ? "border-pink-400 bg-pink-50 shadow-pink-300/60"
                  : "border-pink-200 hover:border-pink-400 hover:bg-pink-50"
              }`}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              <span className="absolute inset-0 bg-gradient-to-br from-white via-pink-50 to-pink-100 opacity-90" />
              <span className="relative flex h-5 w-5 flex-col items-center justify-center gap-1.5">
                <span
                  className={`h-0.5 w-5 rounded-full bg-current transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    mobileOpen ? "translate-y-2 rotate-45" : ""
                  }`}
                />
                <span
                  className={`h-0.5 w-5 rounded-full bg-current transition-all duration-300 ${
                    mobileOpen ? "scale-x-0 opacity-0" : "opacity-100"
                  }`}
                />
                <span
                  className={`h-0.5 w-5 rounded-full bg-current transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    mobileOpen ? "-translate-y-2 -rotate-45" : ""
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      <div
        className={`mobile-drawer-overlay fixed inset-0 z-[55] md:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`mobile-drawer-shell fixed right-0 top-0 z-[60] h-dvh w-[88vw] max-w-[390px] md:hidden ${
          mobileOpen ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[108%] opacity-0"
        }`}
        aria-hidden={!mobileOpen}
      >
        <div className="mobile-drawer-bg absolute inset-0 overflow-hidden rounded-l-[2rem]" />

        <div className="relative flex h-full flex-col px-4 pb-4 pt-4">
          <div className="mobile-drawer-top mobile-drawer-fade rounded-[1.9rem] border border-white/80 bg-white/75 p-3 shadow-[0_20px_50px_rgba(236,72,153,0.13)] backdrop-blur-2xl">
            <div className="flex items-start justify-between gap-3">
              <Link href="/" onClick={() => setMobileOpen(false)} className="flex min-w-0 items-center gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] border border-pink-100 bg-white p-1.5 shadow-lg shadow-pink-200/50">
                  <Image
                    src="/jasmintopup-logo.png"
                    alt="JASMINTOPUP Logo"
                    width={56}
                    height={56}
                    className="h-full w-full object-contain"
                    priority
                  />
                </span>
                <span className="min-w-0 pt-1">
                  <span className="block truncate text-[1.02rem] font-black tracking-tight text-pink-900">
                    JASMINTOPUP
                  </span>
                  <span className="mt-1 block text-[10px] font-extrabold uppercase tracking-[0.28em] text-pink-400">
                    Instant · Secure · 24/7
                  </span>
                </span>
              </Link>

              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="group relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-pink-200 bg-white text-pink-600 shadow-md shadow-pink-200/50 transition-all duration-300 hover:-rotate-6 hover:border-pink-400 hover:bg-pink-50 active:scale-95"
                aria-label="Close menu"
              >
                <span className="absolute inset-0 bg-gradient-to-br from-white via-pink-50 to-pink-100 opacity-90" />
                <span className="relative text-xl font-black leading-none transition-transform duration-300 group-hover:scale-110">×</span>
              </button>
            </div>

            <div className="mt-3 overflow-hidden rounded-[1.55rem] border border-pink-100/80 bg-gradient-to-r from-pink-50/95 via-white to-pink-50/90 px-4 py-3 shadow-inner shadow-white/80">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.28em] text-pink-400">
                <span className="inline-flex h-2 w-2 rounded-full bg-pink-400 shadow-[0_0_10px_rgba(244,114,182,0.9)]" />
                Mobile Menu
              </div>
              <p className="text-sm font-black leading-relaxed text-pink-900">
                ម៉ឺនុយស្អាត សម្រាប់ចូលទៅកាន់ផ្នែកសំខាន់ៗរបស់ JASMINTOPUP
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {NAV.map((item, index) => {
              const active = isNavActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`mobile-drawer-nav-item mobile-drawer-fade group flex items-center justify-between overflow-hidden rounded-[1.55rem] border px-4 py-4 ${
                    active
                      ? "border-pink-300/80 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-pink-500 text-white shadow-[0_18px_40px_rgba(236,72,153,0.28)]"
                      : "border-pink-100/90 bg-white/78 text-pink-800 shadow-[0_12px_30px_rgba(244,114,182,0.10)] backdrop-blur-md"
                  }`}
                  style={{ transitionDelay: mobileOpen ? `${80 + index * 45}ms` : "0ms" }}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-all duration-500 ${
                        active
                          ? "border-white/15 bg-white/16 text-white shadow-inner shadow-white/10"
                          : "border-pink-100 bg-gradient-to-br from-pink-50 to-white text-pink-500 group-hover:border-pink-200 group-hover:text-pink-600"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-black tracking-tight">{item.label}</span>
                      <span className={`mt-1 block text-[11px] font-semibold ${active ? "text-white/80" : "text-pink-400"}`}>
                        {item.helper}
                      </span>
                    </span>
                  </span>

                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-500 ${
                      active
                        ? "bg-white/16 text-white"
                        : "bg-pink-50 text-pink-300 group-hover:translate-x-0.5 group-hover:bg-pink-100 group-hover:text-pink-500"
                    }`}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h13" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="mobile-drawer-fade mt-4 rounded-[1.6rem] border border-pink-100/90 bg-white/72 p-4 shadow-[0_15px_34px_rgba(244,114,182,0.10)] backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-pink-400">Quick Access</p>
                <p className="mt-1 text-sm font-black leading-relaxed text-pink-900">
                  តាមដានការកម្មង់របស់អ្នក ឬចូលទៅកាន់ហ្គេមបានរហ័ស
                </p>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-white text-pink-500 shadow-inner shadow-white">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v18" />
                  <path d="M5 10h14" />
                </svg>
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <Link
                href="/#games"
                onClick={() => setMobileOpen(false)}
                className="group rounded-[1.35rem] border border-pink-100 bg-gradient-to-br from-pink-50 via-white to-white px-3 py-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-pink-200 hover:shadow-md hover:shadow-pink-100/80 active:scale-[0.99]"
              >
                <span className="text-xs font-extrabold uppercase tracking-[0.22em] text-pink-400">Games</span>
                <span className="mt-2 block text-sm font-black text-pink-800">ទៅកាន់ហ្គេម</span>
              </Link>
              <Link
                href="/order"
                onClick={() => setMobileOpen(false)}
                className="group rounded-[1.35rem] border border-pink-100 bg-gradient-to-br from-pink-50 via-white to-white px-3 py-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-pink-200 hover:shadow-md hover:shadow-pink-100/80 active:scale-[0.99]"
              >
                <span className="text-xs font-extrabold uppercase tracking-[0.22em] text-pink-400">Order</span>
                <span className="mt-2 block text-sm font-black text-pink-800">Track Order</span>
              </Link>
            </div>
          </div>

          <div className="mt-auto pt-4">
            <Link
              href="/order"
              onClick={() => setMobileOpen(false)}
              className="mobile-drawer-cta mobile-drawer-fade group flex items-center justify-center gap-3 rounded-[1.5rem] px-4 py-3.5 text-sm font-black text-white"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/18 shadow-inner shadow-white/10">
                <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m20 20-3.2-3.2" />
                </svg>
              </span>
              <span className="text-center leading-tight">តាមដានការបញ្ជាទិញ</span>
            </Link>

            <p className="mobile-drawer-fade mt-3 text-center text-[11px] font-bold tracking-wide text-pink-400">
              Premium mobile drawer · Super smooth animation
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

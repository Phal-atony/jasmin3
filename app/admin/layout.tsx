import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getCurrentAdmin } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

const ADMIN_COOKIE_NAME = "admin_token";
const ADMIN_LOGIN_PATH = process.env.ADMIN_LOGIN_PATH || "/admin/sophallogin";

const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/orders", label: "Orders", icon: "📦" },
  { href: "/admin/games", label: "Games", icon: "🎮" },
  { href: "/admin/products", label: "Products", icon: "💎" },
  { href: "/admin/promo-codes", label: "Promo Codes", icon: "🏷️" },
  { href: "/admin/banners", label: "Banners", icon: "🖼️" },
  { href: "/admin/faqs", label: "FAQ", icon: "❓" },
  { href: "/admin/blog", label: "Blog", icon: "📝" },
  { href: "/admin/customers", label: "Customers", icon: "👥" },
  { href: "/admin/banlist", label: "Banlist", icon: "🚫" },
  { href: "/admin/security", label: "Security", icon: "🛡️" },
  { href: "/admin/audit-logs", label: "Audit Log", icon: "📜" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
];

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    const cookieStore = await cookies();
    const hasToken = Boolean(cookieStore.get(ADMIN_COOKIE_NAME)?.value);

    if (hasToken) {
      redirect(ADMIN_LOGIN_PATH);
    }

    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-fox-bg text-fox-text">
      <aside className="flex w-60 shrink-0 flex-col border-r border-fox-border bg-fox-surface">
        <Link
          href="/admin"
          className="border-b border-fox-border p-6 transition-colors hover:bg-fox-card/60"
        >
          <div className="flex items-center gap-3">
            <Image
              src="https://i.ibb.co/ycPxxz8h/IMG-20260515-100429.png"
              alt="JASMINTOPUP Logo"
              width={40}
              height={40}
              className="h-10 w-10 rounded-lg object-contain"
              priority
            />

            <div className="min-w-0">
              <div className="truncate font-display text-sm font-bold">
                JASMIN<span className="text-fox-primary">TOPUP</span>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-fox-muted">
                Admin Panel
              </div>
            </div>
          </div>
        </Link>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {ADMIN_NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-fox-text/80 transition-colors hover:bg-fox-card hover:text-fox-primary"
            >
              <span className="w-5 text-center">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t border-fox-border p-4">
          <div className="mb-1 text-xs text-fox-muted">Signed in as</div>
          <div className="mb-3 truncate text-sm font-medium">
            {admin.email}
          </div>

          <LogoutButton />
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
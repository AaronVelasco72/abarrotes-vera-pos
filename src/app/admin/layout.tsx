"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/Logo";

type NavItem = {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
};

const HomeIcon = (active: boolean) => (
  <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
    <path
      d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8.5Z"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? "currentColor" : "none"}
      fillOpacity={active ? 0.15 : 0}
    />
  </svg>
);

const ProductIcon = (active: boolean) => (
  <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
    <path
      d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinejoin="round"
      fill={active ? "currentColor" : "none"}
      fillOpacity={active ? 0.15 : 0}
    />
    <path d="M3 7.5 12 12l9-4.5M12 12v9" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
  </svg>
);

const SalesIcon = (active: boolean) => (
  <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
    <path
      d="M6 3h10l3 3v14l-2.5-1.5L14 20l-2.5-1.5L9 20l-2.5-1.5L4 21V6a3 3 0 0 1 2-3Z"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinejoin="round"
      fill={active ? "currentColor" : "none"}
      fillOpacity={active ? 0.15 : 0}
    />
    <path d="M8 8h7M8 12h7M8 16h4" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
  </svg>
);

const SettingsIcon = (active: boolean) => (
  <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.7} fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.2 : 0} />
    <path
      d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinejoin="round"
    />
  </svg>
);

const TruckIcon = (active: boolean) => (
  <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
    <path
      d="M3 7h11v9H3z"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinejoin="round"
      fill={active ? "currentColor" : "none"}
      fillOpacity={active ? 0.15 : 0}
    />
    <path
      d="M14 10h4l3 3v3h-7z"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinejoin="round"
      fill={active ? "currentColor" : "none"}
      fillOpacity={active ? 0.15 : 0}
    />
    <circle cx="7" cy="18" r="2" stroke="currentColor" strokeWidth={1.7} />
    <circle cx="17" cy="18" r="2" stroke="currentColor" strokeWidth={1.7} />
  </svg>
);

const nav: NavItem[] = [
  { href: "/admin",           label: "Inicio",    icon: HomeIcon },
  { href: "/admin/productos", label: "Productos", icon: ProductIcon },
  { href: "/admin/pedidos",   label: "Pedidos",   icon: TruckIcon },
  { href: "/admin/ventas",    label: "Ventas",    icon: SalesIcon },
  { href: "/admin/ajustes",   label: "Ajustes",   icon: SettingsIcon },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (role && role !== "admin") router.replace("/pos");
  }, [user, role, loading, router]);

  if (loading || !user || role !== "admin") {
    return (
      <div className="min-h-screen grid place-items-center text-brand-400 text-sm">Cargando…</div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-50/40 pb-20">
      <header className="bg-white/95 backdrop-blur border-b border-brand-100 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <Logo size={36} withText />
        <button onClick={signOut} className="btn-ghost text-xs">Salir</button>
      </header>

      <main className="px-4 py-5 max-w-3xl mx-auto">{children}</main>

      {/* Bottom nav (mobile-first) */}
      <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-brand-100 grid grid-cols-5 z-30 pb-[env(safe-area-inset-bottom)]">
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-1 py-2"
            >
              <div
                className={`grid place-items-center rounded-full transition-all ${
                  active ? "bg-brand-50 text-brand-700 px-4 py-1" : "text-brand-400 px-3 py-1"
                }`}
              >
                {item.icon(active)}
              </div>
              <span
                className={`text-[11px] font-medium tracking-wide ${
                  active ? "text-brand-700" : "text-brand-400"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

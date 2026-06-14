"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

export default function Home() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (role === "admin") router.replace("/admin");
    else router.replace("/pos");
  }, [user, role, loading, router]);

  return (
    <main className="min-h-screen grid place-items-center bg-gradient-to-b from-white to-brand-50">
      <div className="text-center">
        <Logo size={96} className="mx-auto" />
        <div className="mt-4 text-brand-700 font-semibold tracking-wide">ABARROTES VERA</div>
        <div className="mt-1 text-brand-400 text-sm">Cargando…</div>
        <Link href="/login" className="sr-only">Ir a iniciar sesión</Link>
      </div>
    </main>
  );
}

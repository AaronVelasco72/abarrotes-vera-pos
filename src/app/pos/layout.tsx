"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (role === "admin") router.replace("/admin");
  }, [user, role, loading, router]);

  if (loading || !user || role === "admin") {
    return (
      <div className="min-h-screen grid place-items-center text-brand-400 text-sm">Cargando…</div>
    );
  }

  return <>{children}</>;
}

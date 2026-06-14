"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getFirebase } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const { user, role, loading, configured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    router.replace(role === "admin" ? "/admin" : "/pos");
  }, [user, role, loading, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const fb = getFirebase();
    if (!fb) {
      setError("Firebase no está configurado. Crea .env.local con tus credenciales.");
      setSubmitting(false);
      return;
    }
    try {
      await signInWithEmailAndPassword(fb.auth, email.trim(), password);
    } catch {
      setError("Correo o contraseña incorrectos.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-white">
      <section className="hidden lg:flex items-center justify-center bg-gradient-to-br from-brand-700 to-brand-900 text-white p-12">
        <div className="max-w-md">
          <div className="rounded-full bg-white/95 p-3 inline-block shadow-2xl">
            <Logo size={120} />
          </div>
          <div className="mt-6 text-sm tracking-[0.3em] text-brand-200">CDMX · NEZAHUALCÓYOTL</div>
          <h1 className="mt-2 text-5xl font-bold leading-tight">Abarrotes Vera</h1>
          <p className="mt-4 text-brand-100 text-lg">Tradición y calidad — ahora con punto de venta.</p>
          <ul className="mt-10 space-y-3 text-brand-100 text-sm">
            <li>• Cobros ágiles, sin estorbo.</li>
            <li>• Inventario y alertas en tiempo real.</li>
            <li>• Métricas del día siempre a la mano.</li>
          </ul>
        </div>
      </section>

      <section className="flex items-center justify-center p-8">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div>
            <div className="text-brand-500 text-xs tracking-[0.2em]">INICIAR SESIÓN</div>
            <h2 className="mt-1 text-2xl font-bold text-brand-900">Bienvenido</h2>
            <p className="text-brand-400 text-sm mt-1">Ingresa con tu correo de trabajo.</p>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-brand-700">Correo</span>
              <input
                type="email"
                required
                autoFocus
                className="input mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-brand-700">Contraseña</span>
              <input
                type="password"
                required
                className="input mt-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {!configured && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              Modo demo: aún no hay credenciales de Firebase. Copia <code className="font-mono">.env.local.example</code> a <code className="font-mono">.env.local</code> y llena tus claves.
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Entrando…" : "Entrar"}
          </button>

          <p className="text-xs text-brand-400 text-center">
            ¿Problemas para entrar? Pide al administrador que revise tu cuenta.
          </p>
        </form>
      </section>
    </main>
  );
}

"use client";

import { useMemo } from "react";
import { formatMXN } from "@/lib/money";
import { useProducts } from "@/lib/products";
import { useTodaySales } from "@/lib/sales";
import { CATEGORIES, type CategoryKey } from "@/lib/categories";

export default function AdminHome() {
  const { sales, loading: salesLoading } = useTodaySales();
  const { products, loading: prodLoading } = useProducts();

  const stats = useMemo(() => {
    const totalVentas = sales.reduce((s, x) => s + x.total, 0);
    const tickets = sales.length;
    const ticketPromedio = tickets > 0 ? totalVentas / tickets : 0;
    const piezas = sales.reduce((s, x) => s + x.items, 0);

    const byMethod = { efectivo: 0, tarjeta: 0, transferencia: 0 };
    sales.forEach((s) => {
      byMethod[s.method] = (byMethod[s.method] || 0) + s.total;
    });

    const byCategory = new Map<CategoryKey, { qty: number; total: number }>();
    sales.forEach((s) =>
      s.lines.forEach((l) => {
        const cur = byCategory.get(l.category) ?? { qty: 0, total: 0 };
        byCategory.set(l.category, {
          qty: cur.qty + l.qty,
          total: cur.total + l.qty * l.price,
        });
      }),
    );

    const byProduct = new Map<string, { name: string; qty: number; total: number }>();
    sales.forEach((s) =>
      s.lines.forEach((l) => {
        const cur = byProduct.get(l.productId) ?? { name: l.name, qty: 0, total: 0 };
        byProduct.set(l.productId, {
          name: l.name,
          qty: cur.qty + l.qty,
          total: cur.total + l.qty * l.price,
        });
      }),
    );

    const top = [...byProduct.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
    const catList = [...byCategory.entries()].sort((a, b) => b[1].total - a[1].total);

    return {
      totalVentas,
      tickets,
      ticketPromedio,
      piezas,
      byMethod,
      catList,
      top,
    };
  }, [sales]);

  const alertas = useMemo(
    () => products.filter((p) => p.stock <= p.minStock).sort((a, b) => a.stock - b.stock),
    [products],
  );

  const loading = salesLoading || prodLoading;
  const ahora = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-5">
      <div>
        <div className="text-brand-400 text-xs tracking-[0.2em] capitalize">{ahora}</div>
        <h1 className="text-2xl font-bold text-brand-900">Resumen del día</h1>
      </div>

      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 text-white p-5 shadow-card">
        <div className="text-brand-200 text-[11px] tracking-[0.2em]">VENTAS HOY</div>
        <div className="mt-1 text-4xl font-extrabold tabular-nums">{formatMXN(stats.totalVentas)}</div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-brand-100">
          <span>{stats.tickets} tickets</span>
          <span>{stats.piezas} piezas</span>
          <span>Promedio {formatMXN(stats.ticketPromedio)}</span>
        </div>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Efectivo" value={formatMXN(stats.byMethod.efectivo)} />
        <Stat label="Tarjeta" value={formatMXN(stats.byMethod.tarjeta)} />
        <Stat label="Transfer." value={formatMXN(stats.byMethod.transferencia)} />
      </div>

      {/* Alertas de inventario */}
      <section className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-brand-900">Alertas de inventario</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full ${alertas.length > 0 ? "text-amber-700 bg-amber-50" : "text-emerald-700 bg-emerald-50"}`}>
            {alertas.length}
          </span>
        </div>
        {alertas.length === 0 ? (
          <p className="mt-3 text-sm text-brand-400">Todo en niveles saludables.</p>
        ) : (
          <ul className="mt-3 divide-y divide-brand-50">
            {alertas.slice(0, 6).map((p) => (
              <li key={p.id} className="py-2.5 flex items-center justify-between text-sm">
                <span className="text-brand-900 truncate pr-2">{p.name}</span>
                <span className="text-amber-700 font-semibold tabular-nums whitespace-nowrap">
                  {p.stock} <span className="text-brand-400 font-normal">/ {p.minStock} mín.</span>
                </span>
              </li>
            ))}
            {alertas.length > 6 && (
              <li className="pt-2 text-[11px] text-brand-400 text-center">y {alertas.length - 6} más…</li>
            )}
          </ul>
        )}
      </section>

      {/* Por categoría */}
      <section className="card p-4">
        <h2 className="font-bold text-brand-900">Ventas por categoría</h2>
        {stats.catList.length === 0 ? (
          <p className="mt-3 text-sm text-brand-400">{loading ? "Cargando…" : "Sin ventas hoy aún."}</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {stats.catList.map(([key, val]) => {
              const c = CATEGORIES[key] ?? CATEGORIES.otros;
              const max = stats.catList[0][1].total || 1;
              const pct = Math.max(6, Math.round((val.total / max) * 100));
              return (
                <li key={key}>
                  <div className="flex items-center justify-between text-xs">
                    <span className={`inline-flex items-center gap-1 ${c.text} font-medium`}>
                      {c.icon("size-3.5")} {c.label}
                    </span>
                    <span className="tabular-nums text-brand-700 font-semibold">{formatMXN(val.total)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-brand-50 overflow-hidden">
                    <div className={`h-full ${c.bg} ring-1 ${c.ring}`} style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Top productos */}
      <section className="card p-4">
        <h2 className="font-bold text-brand-900">Más vendidos hoy</h2>
        {stats.top.length === 0 ? (
          <p className="mt-3 text-sm text-brand-400">{loading ? "Cargando…" : "Sin ventas hoy aún."}</p>
        ) : (
          <ol className="mt-3 divide-y divide-brand-50">
            {stats.top.map((p, i) => (
              <li key={p.name} className="py-2.5 flex items-center gap-3 text-sm">
                <div className="size-6 grid place-items-center rounded-full bg-brand-50 text-brand-700 text-xs font-bold">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-brand-900 truncate">{p.name}</div>
                  <div className="text-[11px] text-brand-400">{p.qty} unidades</div>
                </div>
                <div className="font-semibold text-brand-800 tabular-nums whitespace-nowrap">{formatMXN(p.total)}</div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <div className="text-[10px] tracking-wider text-brand-400 uppercase">{label}</div>
      <div className="mt-0.5 text-sm font-extrabold text-brand-900 tabular-nums truncate">{value}</div>
    </div>
  );
}

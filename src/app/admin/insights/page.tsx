"use client";

import { useMemo } from "react";
import { useProducts, productMargin } from "@/lib/products";
import { useRecentSales } from "@/lib/sales";
import { formatMXN } from "@/lib/money";
import { CATEGORIES, type CategoryKey } from "@/lib/categories";

const DAY_MS = 24 * 60 * 60 * 1000;

export default function InsightsPage() {
  const { sales, loading: salesLoading } = useRecentSales(1000);
  const { products, loading: prodLoading } = useProducts();
  const loading = salesLoading || prodLoading;

  const stats = useMemo(() => {
    const now = Date.now();
    const start7 = now - 7 * DAY_MS;
    const start30 = now - 30 * DAY_MS;

    const productMap = new Map(products.map((p) => [p.id, p]));

    const sales7  = sales.filter((s) => (s.createdAt?.toMillis?.() ?? 0) >= start7);
    const sales30 = sales.filter((s) => (s.createdAt?.toMillis?.() ?? 0) >= start30);

    const revenue7  = sales7.reduce((s, x) => s + x.total, 0);
    const revenue30 = sales30.reduce((s, x) => s + x.total, 0);

    // Top vendidos
    function topN(range: typeof sales, n = 8) {
      const acc = new Map<string, { name: string; qty: number; total: number; category: CategoryKey }>();
      range.forEach((s) =>
        s.lines.forEach((l) => {
          const cur = acc.get(l.productId) ?? { name: l.name, qty: 0, total: 0, category: l.category };
          acc.set(l.productId, {
            name: l.name,
            qty: cur.qty + l.qty,
            total: cur.total + l.qty * l.price,
            category: l.category,
          });
        }),
      );
      return [...acc.entries()]
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, n);
    }
    const top7  = topN(sales7);
    const top30 = topN(sales30);

    // Ventas por día últimos 14
    const perDay: { date: string; total: number; tickets: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * DAY_MS);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d.getTime() + DAY_MS);
      const inDay = sales.filter((s) => {
        const t = s.createdAt?.toMillis?.() ?? 0;
        return t >= d.getTime() && t < next.getTime();
      });
      perDay.push({
        date: d.toISOString().slice(5, 10),
        total: inDay.reduce((s, x) => s + x.total, 0),
        tickets: inDay.length,
      });
    }

    // Ventas por hora (últimos 30d)
    const perHour = Array.from({ length: 24 }, () => ({ total: 0, tickets: 0 }));
    sales30.forEach((s) => {
      const t = s.createdAt?.toDate?.();
      if (!t) return;
      const h = t.getHours();
      perHour[h].total += s.total;
      perHour[h].tickets += 1;
    });

    // Ventas por categoría (30d)
    const byCategory = new Map<CategoryKey, { qty: number; total: number }>();
    sales30.forEach((s) =>
      s.lines.forEach((l) => {
        const cur = byCategory.get(l.category) ?? { qty: 0, total: 0 };
        byCategory.set(l.category, { qty: cur.qty + l.qty, total: cur.total + l.qty * l.price });
      }),
    );
    const catList = [...byCategory.entries()].sort((a, b) => b[1].total - a[1].total);

    // Margen bruto estimado (30d): sum(price - costPrice) * qty, sólo donde costPrice existe
    let marginTotal = 0;
    let marginCovered = 0;
    let marginItems = 0;
    let unknownMarginItems = 0;
    sales30.forEach((s) =>
      s.lines.forEach((l) => {
        const p = productMap.get(l.productId);
        if (p && p.costPrice != null && p.costPrice > 0) {
          marginTotal += (p.price - p.costPrice) * l.qty;
          marginCovered += l.price * l.qty;
          marginItems += l.qty;
        } else {
          unknownMarginItems += l.qty;
        }
      }),
    );
    const marginCoverage = marginItems + unknownMarginItems > 0
      ? (marginItems / (marginItems + unknownMarginItems)) * 100
      : 0;

    // Ticket promedio (30d)
    const avgTicket = sales30.length > 0 ? revenue30 / sales30.length : 0;

    // Rotación por producto: días que dura el stock actual al ritmo de venta (30d)
    const rotation = products
      .map((p) => {
        const soldIn30 = sales30.reduce(
          (s, x) => s + x.lines.filter((l) => l.productId === p.id).reduce((ss, l) => ss + l.qty, 0),
          0,
        );
        const perDayRate = soldIn30 / 30;
        const daysCover = perDayRate > 0 ? p.stock / perDayRate : Infinity;
        return { product: p, soldIn30, perDayRate, daysCover };
      })
      .filter((r) => r.soldIn30 > 0);

    const slowMovers = rotation.filter((r) => r.daysCover > 60).sort((a, b) => b.daysCover - a.daysCover).slice(0, 6);
    const fastMovers = rotation.filter((r) => r.perDayRate > 0).sort((a, b) => a.daysCover - b.daysCover).slice(0, 6);

    return {
      sales7Count: sales7.length,
      sales30Count: sales30.length,
      revenue7,
      revenue30,
      avgTicket,
      top7,
      top30,
      perDay,
      perHour,
      catList,
      marginTotal,
      marginCovered,
      marginCoverage,
      slowMovers,
      fastMovers,
    };
  }, [sales, products]);

  return (
    <div className="space-y-5">
      <div>
        <div className="text-brand-400 text-xs tracking-[0.2em]">ANÁLISIS</div>
        <h1 className="text-2xl font-bold text-brand-900">Insights del negocio</h1>
        <p className="text-sm text-brand-500 mt-1">
          Todo se calcula sobre las últimas ventas registradas. Entre más vendas por el POS, más precisos son los números.
        </p>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-brand-400 text-sm">Calculando…</div>
      ) : sales.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-brand-700 font-semibold">Aún no hay ventas registradas</div>
          <div className="text-sm text-brand-500 mt-1">Haz al menos una venta desde /pos para ver los insights.</div>
        </div>
      ) : (
        <>
          {/* Hero: totales */}
          <div className="grid grid-cols-2 gap-2">
            <BigStat label="Ventas últimos 30 días" value={formatMXN(stats.revenue30)} sub={`${stats.sales30Count} tickets · ${formatMXN(stats.avgTicket)} promedio`} accent="brand" />
            <BigStat label="Ventas últimos 7 días" value={formatMXN(stats.revenue7)} sub={`${stats.sales7Count} tickets`} accent="emerald" />
          </div>

          {/* Ganancia bruta */}
          <section className="card p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-bold text-brand-900">Ganancia bruta (30d)</h2>
              <span className="text-xs text-brand-400">
                cobertura: {stats.marginCoverage.toFixed(0)}%
              </span>
            </div>
            <div className="mt-2 text-3xl font-extrabold text-emerald-600 tabular-nums">
              {formatMXN(stats.marginTotal)}
            </div>
            <p className="text-[11px] text-brand-400 mt-1">
              Suma de (precio de venta − precio de compra) × qty sobre las líneas donde ya está configurado el precio de compra. La cobertura sube conforme llenas más productos.
            </p>
            {stats.marginCoverage < 60 && (
              <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                Menos del 60 % de tus ventas tiene precio de compra configurado. Ve a Productos y completa los que quedan en rojo para que la ganancia real sea confiable.
              </div>
            )}
          </section>

          {/* Ventas por día */}
          <section className="card p-4">
            <h2 className="font-bold text-brand-900">Ventas diarias — últimos 14 días</h2>
            <BarChart data={stats.perDay.map((d) => ({ label: d.date, value: d.total }))} format={formatMXN} />
          </section>

          {/* Top vendidos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TopList title="Más vendidos (30d)" rows={stats.top30} />
            <TopList title="Más vendidos (7d)" rows={stats.top7} />
          </div>

          {/* Por categoría */}
          <section className="card p-4">
            <h2 className="font-bold text-brand-900">Ventas por categoría (30d)</h2>
            {stats.catList.length === 0 ? (
              <p className="mt-3 text-sm text-brand-400">Sin datos aún.</p>
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
                        <span className="tabular-nums text-brand-700 font-semibold">
                          {formatMXN(val.total)} · {val.qty} pzs
                        </span>
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

          {/* Horas pico */}
          <section className="card p-4">
            <h2 className="font-bold text-brand-900">Horas pico de venta (30d)</h2>
            <p className="text-xs text-brand-400 mt-1">
              Total vendido por hora del día. Útil para decidir cuándo abrir/cerrar o cuándo reabastecer.
            </p>
            <BarChart
              data={stats.perHour.map((h, i) => ({ label: String(i).padStart(2, "0"), value: h.total }))}
              format={formatMXN}
              compact
            />
          </section>

          {/* Rotación */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RotationList title="Rota más rápido" rows={stats.fastMovers} hint="Piensa en aumentar stock ideal" />
            <RotationList title="Sobrestock detectado" rows={stats.slowMovers} hint="Considera bajar el stock ideal" />
          </div>
        </>
      )}
    </div>
  );
}

function BigStat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: "brand" | "emerald";
}) {
  const cls =
    accent === "brand"
      ? "bg-gradient-to-br from-brand-700 to-brand-900 text-white border-0"
      : "bg-gradient-to-br from-emerald-600 to-emerald-800 text-white border-0";
  return (
    <div className={`rounded-2xl p-4 shadow-card ${cls}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-extrabold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] opacity-80 mt-0.5">{sub}</div>}
    </div>
  );
}

function BarChart({
  data,
  format,
  compact = false,
}: {
  data: { label: string; value: number }[];
  format: (n: number) => string;
  compact?: boolean;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={`mt-3 grid ${compact ? "grid-cols-12 sm:grid-cols-24" : "grid-cols-7 sm:grid-cols-14"} gap-1 items-end`}
      style={compact ? { gridTemplateColumns: "repeat(24, 1fr)" } : undefined}
    >
      {data.map((d, i) => {
        const h = Math.max(4, (d.value / max) * 100);
        const hasValue = d.value > 0;
        return (
          <div key={i} className="flex flex-col items-center gap-1" title={`${d.label}: ${format(d.value)}`}>
            <div
              className={`w-full rounded-t ${hasValue ? "bg-brand-500" : "bg-brand-100"}`}
              style={{ height: compact ? `${Math.max(4, h * 0.7)}px` : `${h}px`, minHeight: "4px" }}
            />
            <div className="text-[9px] text-brand-400 tabular-nums">{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function TopList({ title, rows }: { title: string; rows: { id: string; name: string; qty: number; total: number }[] }) {
  return (
    <section className="card p-4">
      <h2 className="font-bold text-brand-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-brand-400">Sin datos.</p>
      ) : (
        <ol className="mt-3 divide-y divide-brand-50">
          {rows.map((p, i) => (
            <li key={p.id} className="py-2.5 flex items-center gap-3 text-sm">
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
  );
}

function RotationList({
  title,
  rows,
  hint,
}: {
  title: string;
  rows: { product: { id: string; name: string; stock: number }; soldIn30: number; perDayRate: number; daysCover: number }[];
  hint: string;
}) {
  return (
    <section className="card p-4">
      <h2 className="font-bold text-brand-900">{title}</h2>
      <p className="text-[11px] text-brand-400 mt-0.5">{hint}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-brand-400">Sin datos suficientes.</p>
      ) : (
        <ul className="mt-3 divide-y divide-brand-50">
          {rows.map((r) => (
            <li key={r.product.id} className="py-2.5 flex items-center gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <div className="text-brand-900 truncate">{r.product.name}</div>
                <div className="text-[11px] text-brand-400">
                  Vende {r.perDayRate.toFixed(1)}/día · stock {r.product.stock}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-brand-800 tabular-nums">
                  {Number.isFinite(r.daysCover) ? `${r.daysCover.toFixed(0)}d` : "∞"}
                </div>
                <div className="text-[10px] text-brand-400">durará</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

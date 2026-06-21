"use client";

import { useMemo, useState } from "react";
import { doc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { useProducts, type Product } from "@/lib/products";
import { formatMXN } from "@/lib/money";
import { CATEGORIES, CategoryChip } from "@/lib/categories";

const SIN_PROVEEDOR = "Sin proveedor asignado";

type Row = { product: Product; idealEffective: number; toOrder: number; subtotal: number };

function effectiveIdeal(p: Product): number {
  if (p.idealStock != null) return p.idealStock;
  // fallback razonable cuando no se ha configurado idealStock
  return Math.max(p.minStock * 3, 12);
}

export default function PedidosPage() {
  const { products, loading } = useProducts();
  const [filterSupplier, setFilterSupplier] = useState<string | "all">("all");
  const [marking, setMarking] = useState<string | null>(null);

  const rows: Row[] = useMemo(
    () =>
      products
        .map((p) => {
          const idealEffective = effectiveIdeal(p);
          const toOrder = Math.max(0, idealEffective - p.stock);
          const subtotal = toOrder * p.price;
          return { product: p, idealEffective, toOrder, subtotal };
        })
        .filter((r) => r.toOrder > 0)
        .sort((a, b) => b.toOrder - a.toOrder),
    [products],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    rows.forEach((r) => {
      const key = r.product.supplier?.trim() || SIN_PROVEEDOR;
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const suppliers = useMemo(() => grouped.map(([s]) => s), [grouped]);
  const visible = filterSupplier === "all" ? grouped : grouped.filter(([s]) => s === filterSupplier);

  const totals = useMemo(() => {
    const piezas = rows.reduce((s, r) => s + r.toOrder, 0);
    const monto = rows.reduce((s, r) => s + r.subtotal, 0);
    return { skus: rows.length, piezas, monto, proveedores: grouped.length };
  }, [rows, grouped]);

  async function markGroupReceived(group: Row[]) {
    const fb = getFirebase();
    if (!fb) return;
    setMarking(group.map((r) => r.product.id).join(","));
    try {
      const batch = writeBatch(fb.db);
      group.forEach((r) => {
        const ref = doc(fb.db, "products", r.product.id);
        batch.update(ref, {
          stock: r.idealEffective,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    } catch (e) {
      alert("No se pudo marcar como recibido: " + (e as Error).message);
    } finally {
      setMarking(null);
    }
  }

  async function markRowReceived(row: Row) {
    const fb = getFirebase();
    if (!fb) return;
    setMarking(row.product.id);
    try {
      await updateDoc(doc(fb.db, "products", row.product.id), {
        stock: row.idealEffective,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      alert("No se pudo marcar como recibido: " + (e as Error).message);
    } finally {
      setMarking(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-brand-400 text-xs tracking-[0.2em]">REORDEN</div>
        <h1 className="text-2xl font-bold text-brand-900">Pedido a proveedores</h1>
        <p className="text-sm text-brand-500 mt-1">
          El sistema arma automáticamente lo que hay que pedir comparando el stock actual con el stock ideal configurado en cada producto.
        </p>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-brand-400 text-sm">Calculando…</div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-emerald-700 font-semibold">Inventario completo</div>
          <div className="text-sm text-brand-500 mt-1">No hay productos por debajo de su stock ideal. Nada que pedir por ahora.</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Productos a pedir" value={String(totals.skus)} />
            <Stat label="Piezas totales" value={String(totals.piezas)} />
            <Stat label="Monto estimado" value={formatMXN(totals.monto)} accent />
            <Stat label="Proveedores" value={String(totals.proveedores)} />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Pill active={filterSupplier === "all"} onClick={() => setFilterSupplier("all")}>
              Todos ({rows.length})
            </Pill>
            {suppliers.map((s) => {
              const count = grouped.find(([k]) => k === s)?.[1].length ?? 0;
              return (
                <Pill key={s} active={filterSupplier === s} onClick={() => setFilterSupplier(s)}>
                  {s} ({count})
                </Pill>
              );
            })}
          </div>

          <div className="space-y-4">
            {visible.map(([supplier, group]) => {
              const subtotal = group.reduce((s, r) => s + r.subtotal, 0);
              const piezas = group.reduce((s, r) => s + r.toOrder, 0);
              const isMarking = marking && marking.includes(group[0].product.id);
              return (
                <section key={supplier} className="card overflow-hidden">
                  <header className="px-4 py-3 bg-brand-50 border-b border-brand-100 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-brand-900 truncate">{supplier}</div>
                      <div className="text-[11px] text-brand-500">
                        {group.length} {group.length === 1 ? "producto" : "productos"} · {piezas} piezas
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-brand-400">Subtotal</div>
                      <div className="text-base font-extrabold text-brand-900 tabular-nums">{formatMXN(subtotal)}</div>
                    </div>
                  </header>
                  <ul className="divide-y divide-brand-50">
                    {group.map((r) => {
                      const cat = CATEGORIES[r.product.category] ?? CATEGORIES.otros;
                      return (
                        <li key={r.product.id} className="px-4 py-3 flex items-center gap-3">
                          <div
                            className={`size-10 rounded-lg ${cat.bg} ${cat.text} grid place-items-center shrink-0 overflow-hidden`}
                          >
                            {r.product.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={r.product.imageUrl}
                                alt={r.product.name}
                                className="size-full object-cover"
                              />
                            ) : (
                              cat.icon("size-5")
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-brand-900 truncate">
                              {r.product.name}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-brand-500 mt-0.5">
                              <CategoryChip category={r.product.category} />
                              <span>· Stock {r.product.stock}/{r.idealEffective}</span>
                              {r.product.quantity && <span>· {r.product.quantity}</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-extrabold text-amber-600 tabular-nums">
                              {r.toOrder}
                            </div>
                            <div className="text-[10px] text-brand-400">piezas</div>
                          </div>
                          <div className="text-right w-20 shrink-0">
                            <div className="font-semibold text-brand-700 tabular-nums">{formatMXN(r.subtotal)}</div>
                          </div>
                          <button
                            onClick={() => markRowReceived(r)}
                            disabled={!!marking}
                            className="btn-ghost text-[11px] shrink-0"
                            title="Marcar este producto como recibido (sube stock al ideal)"
                          >
                            ✓
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="px-4 py-3 bg-white border-t border-brand-50 flex items-center justify-between">
                    <div className="text-xs text-brand-400">
                      Cuando llegue el pedido completo, marca el grupo como recibido y el stock de cada producto sube a su ideal.
                    </div>
                    <button
                      onClick={() => markGroupReceived(group)}
                      disabled={!!marking}
                      className="btn-primary text-xs whitespace-nowrap"
                    >
                      {isMarking ? "Marcando…" : "Marcar pedido recibido"}
                    </button>
                  </div>
                </section>
              );
            })}
          </div>

          <p className="text-[11px] text-brand-400 text-center px-4">
            El stock ideal se configura por producto en /admin/productos. Si no está configurado, se usa un valor por defecto de  3 × stock mínimo.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`card p-3 ${accent ? "bg-gradient-to-br from-brand-700 to-brand-900 text-white border-0" : ""}`}
    >
      <div className={`text-[10px] tracking-wider ${accent ? "text-brand-100" : "text-brand-400"} uppercase`}>
        {label}
      </div>
      <div className={`mt-0.5 text-base font-extrabold tabular-nums ${accent ? "text-white" : "text-brand-900"}`}>
        {value}
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition ${
        active ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-brand-500 ring-brand-100 hover:bg-brand-50"
      }`}
    >
      {children}
    </button>
  );
}

"use client";

import { useState } from "react";
import { formatMXN } from "@/lib/money";
import { useRecentSales, type Sale } from "@/lib/sales";
import { CategoryChip } from "@/lib/categories";

export default function VentasPage() {
  const { sales, loading } = useRecentSales(100);
  const [open, setOpen] = useState<Sale | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-brand-400 text-xs tracking-[0.2em]">HISTÓRICO</div>
        <h1 className="text-2xl font-bold text-brand-900">Ventas recientes</h1>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-brand-50 animate-pulse" />
          ))}
        </div>
      ) : sales.length === 0 ? (
        <div className="card p-10 text-center text-brand-400 text-sm">
          Aún no hay ventas registradas.
        </div>
      ) : (
        <ul className="space-y-2">
          {sales.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => setOpen(s)}
                className="w-full card p-3.5 text-left hover:shadow-lg transition flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-brand-900">{formatMXN(s.total)}</span>
                    <MethodChip method={s.method} />
                  </div>
                  <div className="text-[11px] text-brand-400 mt-0.5">
                    {s.items} {s.items === 1 ? "pieza" : "piezas"} · {s.cashierEmail || "—"}
                  </div>
                </div>
                <div className="text-[11px] text-brand-500 text-right whitespace-nowrap">
                  {s.createdAt?.toDate?.()?.toLocaleString("es-MX", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }) ?? "—"}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && <SaleModal sale={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function MethodChip({ method }: { method: Sale["method"] }) {
  const map = {
    efectivo: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    tarjeta: "bg-sky-50 text-sky-700 ring-sky-100",
    transferencia: "bg-violet-50 text-violet-700 ring-violet-100",
  } as const;
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full ring-1 capitalize ${map[method]}`}>
      {method}
    </span>
  );
}

function SaleModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-brand-950/40 backdrop-blur-sm grid place-items-end sm:place-items-center p-0 sm:p-4 z-50" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-brand-50 px-5 py-3 flex items-center justify-between">
          <h3 className="font-bold text-brand-900">Detalle de venta</h3>
          <button onClick={onClose} className="text-brand-300 hover:text-brand-700">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="rounded-2xl bg-brand-50 p-4 text-center">
            <div className="text-brand-500 text-xs">Total</div>
            <div className="text-3xl font-extrabold text-brand-900 tabular-nums">{formatMXN(sale.total)}</div>
            <div className="mt-1 flex items-center justify-center gap-2 text-[11px] text-brand-500">
              <MethodChip method={sale.method} />
              {sale.method === "efectivo" && sale.received != null && (
                <span>
                  Recibido {formatMXN(sale.received)} · Cambio {formatMXN(sale.change ?? 0)}
                </span>
              )}
            </div>
          </div>

          <ul className="divide-y divide-brand-50">
            {sale.lines.map((l) => (
              <li key={l.productId} className="py-2.5 flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="text-brand-900 truncate">{l.name}</div>
                  <div className="mt-1"><CategoryChip category={l.category} /></div>
                </div>
                <div className="text-xs text-brand-500 tabular-nums">{l.qty} × {formatMXN(l.price)}</div>
                <div className="font-semibold text-brand-900 tabular-nums w-20 text-right">{formatMXN(l.qty * l.price)}</div>
              </li>
            ))}
          </ul>

          <div className="text-[11px] text-brand-400 text-center">
            Cajero: {sale.cashierEmail || "—"} · {sale.createdAt?.toDate?.()?.toLocaleString("es-MX") ?? ""}
          </div>
        </div>
      </div>
    </div>
  );
}

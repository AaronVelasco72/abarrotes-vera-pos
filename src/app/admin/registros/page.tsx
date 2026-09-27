"use client";

import { useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useProducts } from "@/lib/products";
import { useRecentReceipts, createReceipt, deleteReceipt, type Receipt } from "@/lib/receipts";
import { formatMXN } from "@/lib/money";

export default function RegistrosPage() {
  const { user } = useAuth();
  const { receipts, loading } = useRecentReceipts(100);
  const { products } = useProducts();
  const [showUpload, setShowUpload] = useState(false);
  const [viewing, setViewing] = useState<Receipt | null>(null);

  const suppliers = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.supplier && set.add(p.supplier));
    receipts.forEach((r) => r.supplier && set.add(r.supplier));
    return [...set].sort();
  }, [products, receipts]);

  const stats = useMemo(() => {
    const now = new Date();
    const start30 = new Date(now); start30.setDate(now.getDate() - 30);
    const in30 = receipts.filter((r) => new Date(r.date) >= start30);
    const total30 = in30.reduce((s, r) => s + (r.total || 0), 0);
    const total = receipts.reduce((s, r) => s + (r.total || 0), 0);
    return { count: receipts.length, count30: in30.length, total, total30 };
  }, [receipts]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-brand-400 text-xs tracking-[0.2em]">BITÁCORA</div>
          <h1 className="text-2xl font-bold text-brand-900">Registros de compra</h1>
          <p className="text-sm text-brand-500 mt-1">
            Guarda foto de cada ticket que compras al proveedor. Sirve como respaldo y para llevar cuentas claras.
          </p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn-primary whitespace-nowrap">
          + Nuevo
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Tickets totales" value={String(stats.count)} />
        <Stat label="Últimos 30 días" value={String(stats.count30)} />
        <Stat label="Gastado (30d)" value={formatMXN(stats.total30)} accent />
        <Stat label="Gastado histórico" value={formatMXN(stats.total)} />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card aspect-[3/4] animate-pulse bg-brand-50" />
          ))}
        </div>
      ) : receipts.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-brand-700 font-semibold">Aún no hay registros</div>
          <div className="text-sm text-brand-500 mt-1">Sube tu primer ticket con “+ Nuevo”.</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {receipts.map((r) => (
            <ReceiptCard key={r.id} receipt={r} onClick={() => setViewing(r)} />
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal
          suppliers={suppliers}
          onClose={() => setShowUpload(false)}
          uploaderEmail={user?.email ?? ""}
        />
      )}
      {viewing && <ViewerModal receipt={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`card p-3 ${accent ? "bg-gradient-to-br from-brand-700 to-brand-900 text-white border-0" : ""}`}>
      <div className={`text-[10px] tracking-wider uppercase ${accent ? "text-brand-100" : "text-brand-400"}`}>{label}</div>
      <div className={`mt-0.5 text-base font-extrabold tabular-nums truncate ${accent ? "text-white" : "text-brand-900"}`}>{value}</div>
    </div>
  );
}

function ReceiptCard({ receipt, onClick }: { receipt: Receipt; onClick: () => void }) {
  const dateStr = new Date(receipt.date + "T12:00:00").toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
  });
  return (
    <button
      onClick={onClick}
      className="card overflow-hidden text-left hover:shadow-lg hover:-translate-y-0.5 transition group"
    >
      <div className="relative aspect-[4/5] bg-brand-50 overflow-hidden">
        {receipt.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={receipt.imageUrl}
            alt={`Ticket ${receipt.supplier || dateStr}`}
            className="absolute inset-0 size-full object-cover group-hover:scale-105 transition"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-brand-300 text-xs">
            Subiendo imagen…
          </div>
        )}
        <div className="absolute top-2 right-2 text-[10px] font-bold bg-brand-900/80 text-white rounded-full px-2 py-0.5">
          {formatMXN(receipt.total)}
        </div>
      </div>
      <div className="p-3">
        <div className="text-sm font-semibold text-brand-900 truncate">
          {receipt.supplier || "Sin proveedor"}
        </div>
        <div className="text-[11px] text-brand-400 mt-0.5">{dateStr}</div>
        {receipt.notes && (
          <div className="text-[11px] text-brand-500 mt-1 line-clamp-2">{receipt.notes}</div>
        )}
      </div>
    </button>
  );
}

function UploadModal({
  suppliers,
  uploaderEmail,
  onClose,
}: {
  suppliers: string[];
  uploaderEmail: string;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [file, setFile] = useState<File | null>(null);
  const [supplier, setSupplier] = useState("");
  const [total, setTotal] = useState("");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [phase, setPhase] = useState<"idle" | "saving" | "uploading">("idle");
  const [err, setErr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = file ? URL.createObjectURL(file) : null;

  async function onSave() {
    setErr(null);
    if (!file) return setErr("Selecciona o toma la foto del ticket.");
    const totalN = parseFloat(total);
    if (!Number.isFinite(totalN) || totalN < 0) return setErr("Monto total inválido.");
    if (!date) return setErr("Fecha requerida.");

    setPhase("uploading");
    try {
      await createReceipt({
        file,
        supplier: supplier.trim() || undefined,
        total: totalN,
        date,
        notes: notes.trim() || undefined,
        uploaderEmail,
      });
      onClose();
    } catch (e) {
      setErr((e as Error).message);
      setPhase("idle");
    }
  }

  return (
    <div className="fixed inset-0 bg-brand-950/40 backdrop-blur-sm grid place-items-end sm:place-items-center p-0 sm:p-4 z-50" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-brand-50 px-5 py-3 flex items-center justify-between z-10">
          <h3 className="font-bold text-brand-900">Nuevo registro de compra</h3>
          <button onClick={onClose} className="text-brand-300 hover:text-brand-700">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-brand-700">Foto del ticket</span>
            <div className="mt-1 rounded-2xl bg-brand-50 aspect-[4/5] max-h-72 relative grid place-items-center overflow-hidden">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Ticket" className="absolute inset-0 size-full object-cover" />
              ) : (
                <div className="text-brand-300 text-sm text-center px-6">
                  Toma la foto del ticket con la cámara<br />o súbela desde tu galería
                </div>
              )}
              <label className="absolute bottom-2 right-2 btn bg-white text-brand-800 ring-1 ring-brand-100 cursor-pointer text-xs px-3 py-1.5">
                {preview ? "Cambiar" : "Tomar foto"}
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs font-semibold text-brand-700">Fecha del ticket</span>
              <input type="date" className="input mt-1" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-brand-700">Monto total (MXN)</span>
              <input type="number" step="0.01" min="0" className="input mt-1" value={total} onChange={(e) => setTotal(e.target.value)} />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-brand-700">Proveedor</span>
            <input className="input mt-1" placeholder="ej. Bimbo, Modelo, FEMSA" value={supplier} onChange={(e) => setSupplier(e.target.value)} list="reg-suppliers" />
            <datalist id="reg-suppliers">
              {suppliers.map((s) => <option key={s} value={s} />)}
            </datalist>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-brand-700">Notas (opcional)</span>
            <textarea rows={3} className="input mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ej. Falta traer 6 refrescos, factura pendiente, etc." />
          </label>

          {err && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{err}</div>}

          <div className="rounded-xl bg-brand-50 border border-brand-100 p-3 text-[11px] text-brand-500">
            <strong>Próxima iteración:</strong> lectura automática del ticket con OCR para detectar productos y precios; por ahora se guarda como foto + monto para tener respaldo.
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-brand-50 p-4 grid grid-cols-2 gap-2">
          <button onClick={onClose} disabled={phase !== "idle"} className="btn-outline">Cancelar</button>
          <button onClick={onSave} disabled={phase !== "idle"} className="btn-primary">
            {phase === "uploading" ? "Guardando…" : "Guardar ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewerModal({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const dateStr = new Date(receipt.date + "T12:00:00").toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  async function onDelete() {
    if (!confirm("¿Eliminar este registro? También se borra la foto.")) return;
    setBusy(true);
    try {
      await deleteReceipt(receipt);
      onClose();
    } catch (e) {
      alert("No se pudo eliminar: " + (e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-brand-950/90 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-brand-50 px-5 py-3 flex items-center justify-between z-10">
          <div className="min-w-0">
            <h3 className="font-bold text-brand-900 truncate">{receipt.supplier || "Sin proveedor"}</h3>
            <div className="text-[11px] text-brand-400 capitalize">{dateStr}</div>
          </div>
          <button onClick={onClose} className="text-brand-300 hover:text-brand-700">✕</button>
        </div>

        <div className="p-4 space-y-3">
          {receipt.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={receipt.imageUrl} alt="Ticket" className="w-full rounded-xl border border-brand-100" />
          )}
          <div className="rounded-xl bg-brand-50 p-3 flex items-center justify-between">
            <span className="text-brand-500 text-sm">Monto</span>
            <span className="text-2xl font-extrabold text-brand-900 tabular-nums">{formatMXN(receipt.total)}</span>
          </div>
          {receipt.notes && (
            <div className="rounded-xl border border-brand-100 p-3 text-sm text-brand-700 whitespace-pre-wrap">{receipt.notes}</div>
          )}
          <div className="text-[11px] text-brand-400 text-center">Subido por {receipt.uploaderEmail || "—"}</div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-brand-50 p-4 grid grid-cols-2 gap-2">
          <button onClick={onDelete} disabled={busy} className="btn-outline text-red-600 border-red-200 hover:bg-red-50">
            Eliminar
          </button>
          <button onClick={onClose} className="btn-primary">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

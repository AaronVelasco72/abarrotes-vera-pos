"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamicImport from "next/dynamic";
import { useAuth } from "@/lib/auth-context";
import { useProducts, findProductByBarcode } from "@/lib/products";
import { barcodeKey, cleanBarcode, indexByBarcode } from "@/lib/barcode";
import {
  usePendingScans, addPendingScan, updatePendingScan, setPendingPhoto, deletePendingScan, localDay,
  type PendingScan,
} from "@/lib/pending";

const BarcodeScanner = dynamicImport(
  () => import("@/components/BarcodeScanner").then((m) => m.BarcodeScanner),
  { ssr: false, loading: () => <div className="fixed inset-0 bg-brand-950/90 grid place-items-center z-[60] text-white text-sm">Cargando cámara…</div> },
);

/** La cámara reporta el mismo código varias veces por segundo mientras se apunta. */
const SAME_CODE_COOLDOWN_MS = 2500;

type LastScan = { code: string; kind: "new" | "plus" | "exists" | "err"; msg: string };

export default function PendientesPage() {
  const { user } = useAuth();
  const { items, loading } = usePendingScans();
  const { products } = useProducts();
  const [showAll, setShowAll] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [last, setLast] = useState<LastScan | null>(null);
  const [copied, setCopied] = useState(false);
  const recent = useRef(new Map<string, number>());
  const manualRef = useRef<HTMLInputElement>(null);

  const today = localDay();
  const byBarcode = useMemo(() => indexByBarcode(products), [products]);

  // Pendientes que ya se registraron por otro lado (POS, Productos) se limpian solos
  const alreadyRegistered = useMemo(
    () => items.filter((it) => byBarcode.has(barcodeKey(it.barcode))),
    [items, byBarcode],
  );
  useEffect(() => {
    alreadyRegistered.forEach((it) => { deletePendingScan(it).catch(() => {}); });
  }, [alreadyRegistered]);

  const pending = useMemo(
    () => items.filter((it) => !byBarcode.has(barcodeKey(it.barcode))),
    [items, byBarcode],
  );
  const todayItems = useMemo(() => pending.filter((it) => it.day === today), [pending, today]);
  const visible = showAll ? pending : todayItems;
  const totalPieces = visible.reduce((s, it) => s + (it.count || 0), 0);

  async function handleCode(raw: string) {
    const code = cleanBarcode(raw);
    if (!/^\d{6,14}$/.test(code)) return;
    const key = barcodeKey(code);
    const now = Date.now();
    if (now - (recent.current.get(key) ?? 0) < SAME_CODE_COOLDOWN_MS) return;
    recent.current.set(key, now);

    const existing = byBarcode.get(key) ?? (await findProductByBarcode(code).catch(() => null));
    if (existing) {
      feedback("exists");
      setLast({ code, kind: "exists", msg: `Ya registrado: ${existing.name}` });
      return;
    }
    try {
      const isNew = await addPendingScan(code, user?.email ?? undefined);
      feedback("ok");
      setLast({ code, kind: isNew ? "new" : "plus", msg: isNew ? "Guardado en pendientes" : "+1 pieza" });
    } catch (e) {
      feedback("exists");
      setLast({ code, kind: "err", msg: "No se guardó: " + (e as Error).message });
    }
  }

  function onManualKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const val = manual;
    setManual("");
    // Scanner USB: el mismo código seguido sí cuenta (cada disparo es intencional)
    recent.current.delete(barcodeKey(val));
    handleCode(val);
  }

  async function copyList() {
    const lines = visible.map((it) => `${it.barcode}\t${it.count} pz${it.note ? `\t${it.note}` : ""}`);
    const text = `Pendientes ${showAll ? "(todos)" : today}\n` + lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copia la lista:", text);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-brand-400 text-xs tracking-[0.2em]">ESCANEO RÁPIDO</div>
          <h1 className="text-2xl font-bold text-brand-900">Pendientes</h1>
          <p className="text-sm text-brand-500 mt-1">
            Escanea todo sin llenar nada. Después registras cada uno con calma.
          </p>
        </div>
        <button onClick={() => setScanning(true)} className="btn-primary whitespace-nowrap">
          ⚡ Escanear
        </button>
      </div>

      <input
        ref={manualRef}
        value={manual}
        onChange={(e) => setManual(e.target.value)}
        onKeyDown={onManualKey}
        placeholder="Scanner USB / escribe el código y Enter…"
        className="input"
        inputMode="numeric"
      />

      {last && !scanning && <LastScanBanner last={last} />}

      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-xl bg-brand-50 p-1 text-xs font-semibold">
          <button
            onClick={() => setShowAll(false)}
            className={`px-3 py-1.5 rounded-lg ${!showAll ? "bg-white text-brand-900 shadow" : "text-brand-500"}`}
          >
            Hoy ({todayItems.length})
          </button>
          <button
            onClick={() => setShowAll(true)}
            className={`px-3 py-1.5 rounded-lg ${showAll ? "bg-white text-brand-900 shadow" : "text-brand-500"}`}
          >
            Todos ({pending.length})
          </button>
        </div>
        <button onClick={copyList} disabled={visible.length === 0} className="btn-ghost text-xs">
          {copied ? "✓ Copiado" : "Copiar lista"}
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-16 animate-pulse bg-brand-50" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-brand-700 font-semibold">Nada pendiente {showAll ? "" : "hoy"}</div>
          <div className="text-sm text-brand-500 mt-1">Dale a “⚡ Escanear” y pasa los productos uno tras otro.</div>
        </div>
      ) : (
        <>
          <div className="text-xs text-brand-400">
            {visible.length} productos · {totalPieces} piezas
          </div>
          <div className="space-y-2">
            {visible.map((it) => <PendingRow key={it.id} item={it} showDay={showAll} />)}
          </div>
        </>
      )}

      {scanning && (
        <BarcodeScanner
          title="Escaneo rápido"
          hint="Pasa los productos uno tras otro. Se guardan solos."
          closeLabel="Terminar"
          onDetected={handleCode}
          onClose={() => { setScanning(false); setTimeout(() => manualRef.current?.focus(), 50); }}
        >
          <div className="px-4 pt-3">
            {last ? <LastScanBanner last={last} /> : (
              <div className="rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-500">Esperando código…</div>
            )}
            <div className="text-[11px] text-brand-400 mt-2 text-center">
              Hoy: {todayItems.length} productos pendientes
            </div>
          </div>
        </BarcodeScanner>
      )}
    </div>
  );
}

function LastScanBanner({ last }: { last: LastScan }) {
  const tone =
    last.kind === "new" ? "bg-emerald-50 text-emerald-800 border-emerald-200"
    : last.kind === "plus" ? "bg-brand-50 text-brand-800 border-brand-100"
    : last.kind === "exists" ? "bg-amber-50 text-amber-800 border-amber-200"
    : "bg-red-50 text-red-700 border-red-200";
  return (
    <div className={`rounded-xl border px-3 py-2 text-sm flex items-center justify-between gap-2 ${tone}`}>
      <span className="font-mono tabular-nums">{last.code}</span>
      <span className="font-semibold truncate">{last.msg}</span>
    </div>
  );
}

function PendingRow({ item, showDay }: { item: PendingScan; showDay: boolean }) {
  const [busy, setBusy] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState(item.note ?? "");

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); } catch (e) { alert((e as Error).message); } finally { setBusy(false); }
  }

  function setCount(n: number) {
    if (n < 1) return;
    run(() => updatePendingScan(item.id, { count: n }));
  }

  function saveNote() {
    setEditingNote(false);
    if (note.trim() !== (item.note ?? "")) run(() => updatePendingScan(item.id, { note: note.trim() }));
  }

  function onDelete() {
    if (!confirm(`¿Quitar ${item.barcode} de pendientes?`)) return;
    run(() => deletePendingScan(item));
  }

  return (
    <div className={`card p-3 flex items-center gap-3 ${busy ? "opacity-60" : ""}`}>
      <label className="relative size-14 shrink-0 rounded-xl bg-brand-50 overflow-hidden grid place-items-center cursor-pointer text-[10px] text-brand-400 text-center leading-tight">
        {item.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photoUrl} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
        ) : (
          <span>📷<br />Foto</span>
        )}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) run(() => setPendingPhoto(item, f));
            e.target.value = "";
          }}
        />
      </label>

      <div className="min-w-0 flex-1">
        <div className="font-mono text-sm font-semibold text-brand-900 tabular-nums truncate">{item.barcode}</div>
        {editingNote ? (
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={saveNote}
            onKeyDown={(e) => e.key === "Enter" && saveNote()}
            placeholder="ej. Coca 600, $22"
            className="input mt-1 py-1 text-xs"
          />
        ) : (
          <button onClick={() => setEditingNote(true)} className="text-[11px] text-brand-500 truncate block max-w-full text-left">
            {item.note || "+ nota"}{showDay && ` · ${item.day}`}
          </button>
        )}
        <div className="mt-1 inline-flex items-center gap-1 text-xs">
          <button onClick={() => setCount(item.count - 1)} disabled={busy || item.count <= 1} className="size-6 rounded-lg border border-brand-100 text-brand-700 disabled:opacity-40">−</button>
          <span className="w-10 text-center tabular-nums font-semibold text-brand-800">{item.count} pz</span>
          <button onClick={() => setCount(item.count + 1)} disabled={busy} className="size-6 rounded-lg border border-brand-100 text-brand-700">+</button>
        </div>
      </div>

      <div className="flex flex-col gap-1 shrink-0">
        <Link href={`/admin/productos?barcode=${encodeURIComponent(item.barcode)}`} className="btn-primary text-xs px-3 py-1.5">
          Registrar
        </Link>
        <button onClick={onDelete} disabled={busy} className="btn-ghost text-xs px-3 py-1 text-red-600">Quitar</button>
      </div>
    </div>
  );
}

/** Pitido corto + vibración para saber que el código entró sin mirar la pantalla. */
let audioCtx: AudioContext | null = null;
function feedback(kind: "ok" | "exists") {
  try {
    navigator.vibrate?.(kind === "ok" ? 60 : [40, 60, 40]);
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = kind === "ok" ? 1200 : 440;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + (kind === "ok" ? 0.08 : 0.2));
  } catch {
    /* sin audio */
  }
}

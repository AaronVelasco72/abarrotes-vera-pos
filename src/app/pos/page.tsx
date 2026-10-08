"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamicImport from "next/dynamic";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { formatMXN } from "@/lib/money";
import { useProducts, type Product } from "@/lib/products";
import { recordSale } from "@/lib/sales";
import {
  addToCart,
  changeQty as changeCartQty,
  removeLine as removeCartLine,
  cartTotal,
  cartItemCount,
  type CartLine,
} from "@/lib/cart";
import { calculateChange, canConfirmPayment, type PayMethod } from "@/lib/payment";
import { CATEGORIES, CATEGORY_LIST, CategoryChip, type CategoryKey } from "@/lib/categories";
import { lookupBarcode } from "@/lib/openfoodfacts";
import { Logo } from "@/components/Logo";

// Lazy-load del scanner: ZXing (~100 KB) solo se descarga cuando el usuario abre la cámara
const BarcodeScanner = dynamicImport(
  () => import("@/components/BarcodeScanner").then((m) => m.BarcodeScanner),
  { ssr: false, loading: () => <div className="fixed inset-0 bg-brand-950/90 grid place-items-center z-[60] text-white text-sm">Cargando cámara…</div> },
);

type Filter = "all" | CategoryKey;

export default function PosPage() {
  const { user, signOut } = useAuth();
  const { products, loading } = useProducts();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [showPay, setShowPay] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err" | "warn"; msg: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [quickAddBarcode, setQuickAddBarcode] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => (filter === "all" ? true : p.category === filter))
      .filter((p) =>
        !q
          ? true
          : p.name.toLowerCase().includes(q) ||
            (p.barcode || "").includes(q) ||
            (p.sku || "").toLowerCase().includes(q),
      );
  }, [products, query, filter]);

  const total = cartTotal(cart);
  const items = cartItemCount(cart);

  function addProduct(p: Product) {
    // enforceStock: false → el carrito nunca bloquea, incluso excediendo stock real.
    // La validación de stock la hace recordSale() con runTransaction al confirmar la venta.
    setCart((prev) => {
      const result = addToCart(
        prev,
        { id: p.id, name: p.name, category: p.category, price: p.price, stock: p.stock },
        { enforceStock: false },
      );
      return result.ok ? result.cart : prev;
    });
    setQuery("");
    searchRef.current?.focus();
  }

  function changeQty(id: string, delta: number) {
    setCart((prev) => {
      const stock = products.find((x) => x.id === id)?.stock ?? 0;
      const result = changeCartQty(prev, id, delta, stock, { enforceStock: false });
      return result.ok ? result.cart : prev;
    });
  }

  function removeLine(id: string) {
    setCart((prev) => removeCartLine(prev, id));
  }

  function clearCart() {
    setCart([]);
    setShowPay(false);
    searchRef.current?.focus();
  }

  function flash(kind: "ok" | "err" | "warn", msg: string) {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 2600);
  }

  function handleBarcode(code: string) {
    const existing = products.find((p) => p.barcode === code);
    if (existing) {
      flash("ok", `${existing.name} agregado`);
      addProduct(existing);
    } else {
      flash("warn", `Nuevo producto — código ${code}`);
      setQuickAddBarcode(code);
    }
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = query.trim();
      // Detección de scanner (externo o pegado): 8-14 dígitos → barcode
      if (/^\d{8,14}$/.test(val)) {
        handleBarcode(val);
        setQuery("");
        return;
      }
      if (filtered.length === 1) addProduct(filtered[0]);
      else if (cart.length > 0) setShowPay(true);
    } else if (e.key === "Escape") {
      if (showPay) setShowPay(false);
      else if (query) setQuery("");
      else clearCart();
    }
  }

  async function onConfirmPay(method: PayMethod, received?: number, change?: number) {
    if (!user) return;
    try {
      await recordSale({
        lines: cart,
        method,
        received,
        change,
        cashier: { uid: user.uid, email: user.email ?? "" },
      });
      flash("ok", "Venta registrada ✓");
      clearCart();
    } catch (e) {
      flash("err", (e as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-brand-50/40">
      {/* Header — sticky so it always shows */}
      <header className="sticky top-0 z-30 h-16 px-5 flex items-center justify-between bg-white/95 backdrop-blur border-b border-brand-100">
        <div className="flex items-center gap-3">
          <Logo size={40} withText />
          <span className="ml-1 hidden md:inline-block text-[11px] text-brand-400 border-l border-brand-100 pl-3">
            Punto de Venta
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-brand-500 hidden md:block">
            <span className="font-semibold text-brand-800">{user?.email}</span>
          </div>
          <button onClick={signOut} className="btn-ghost text-xs">Cerrar sesión</button>
        </div>
      </header>

      {/* Body: products scroll with page; cart sticks on the right */}
      <div className="grid lg:grid-cols-[1fr_420px] gap-4 p-4 items-start">
        {/* LEFT — products */}
        <section className="card p-4">
          <div className="flex gap-2">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKey}
              className="input text-lg flex-1"
              placeholder="Escanea código de barras o escribe el nombre…"
              autoFocus
            />
            <button
              onClick={() => setScanning(true)}
              className="btn-outline whitespace-nowrap"
              title="Escanear con cámara del dispositivo"
            >
              ⌗ Cámara
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Pill active={filter === "all"} onClick={() => setFilter("all")}>
              Todos
            </Pill>
            {CATEGORY_LIST.map((c) => (
              <Pill key={c.key} active={filter === c.key} onClick={() => setFilter(c.key)} color={c}>
                {c.icon("size-3.5")} {c.label}
              </Pill>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-xl bg-brand-50 animate-pulse" />
                ))
              : filtered.map((p) => <PosCard key={p.id} product={p} onClick={() => addProduct(p)} />)}
            {!loading && filtered.length === 0 && (
              <div className="col-span-full text-center text-brand-400 text-sm py-10">Sin resultados.</div>
            )}
          </div>

          <div className="mt-3 text-[11px] text-brand-400 flex flex-wrap gap-x-4 gap-y-1">
            <span><kbd className="px-1.5 py-0.5 rounded bg-brand-50 border border-brand-100 text-brand-700">Enter</kbd> Cobrar</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-brand-50 border border-brand-100 text-brand-700">Esc</kbd> Limpiar</span>
          </div>
        </section>

        {/* RIGHT — sticky cart with its own scroll */}
        <aside className="card p-4 flex flex-col lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)]">
          <div className="flex items-baseline justify-between">
            <h3 className="font-bold text-brand-900">Carrito</h3>
            <span className="text-xs text-brand-400">{items} {items === 1 ? "artículo" : "artículos"}</span>
          </div>

          <div className="mt-3 flex-1 overflow-y-auto -mx-1 px-1 min-h-[10rem]">
            {cart.length === 0 && (
              <div className="text-center text-brand-300 text-sm py-12">
                Vacío. Escanea o agrega un producto.
              </div>
            )}
            <ul className="divide-y divide-brand-50">
              {cart.map((l) => {
                const realStock = products.find((x) => x.id === l.productId)?.stock ?? 0;
                const overStock = l.qty > realStock;
                return (
                  <li key={l.productId} className="py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-brand-900 truncate">{l.name}</div>
                      <div className="text-xs text-brand-400 flex items-center gap-1.5">
                        {formatMXN(l.price)} c/u
                        {overStock && (
                          <span className="text-amber-600 font-semibold" title={`En stock: ${realStock}`}>
                            · ⚠ excede stock ({realStock})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => changeQty(l.productId, -1)} className="size-7 rounded-lg border border-brand-100 hover:bg-brand-50 text-brand-700">−</button>
                      <div className="w-8 text-center text-sm font-semibold">{l.qty}</div>
                      <button onClick={() => changeQty(l.productId, +1)} className="size-7 rounded-lg border border-brand-100 hover:bg-brand-50 text-brand-700">+</button>
                    </div>
                    <div className="w-20 text-right font-semibold text-brand-900 tabular-nums">{formatMXN(l.price * l.qty)}</div>
                    <button onClick={() => removeLine(l.productId)} className="text-brand-300 hover:text-red-500 text-xs">✕</button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="border-t border-brand-100 pt-3 mt-2">
            <div className="flex items-baseline justify-between">
              <span className="text-brand-500 text-sm">Total</span>
              <span className="text-3xl font-extrabold text-brand-900 tabular-nums">{formatMXN(total)}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button onClick={clearCart} disabled={cart.length === 0} className="btn-outline col-span-1">Cancelar</button>
              <button onClick={() => setShowPay(true)} disabled={cart.length === 0} className="btn-primary col-span-2">
                Cobrar
              </button>
            </div>
          </div>
        </aside>
      </div>

      {showPay && (
        <PayModal
          total={total}
          onClose={() => setShowPay(false)}
          onConfirm={async (method, received, change) => {
            await onConfirmPay(method, received, change);
            setShowPay(false);
          }}
        />
      )}

      {toast && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full shadow-lg text-sm font-medium z-50 ${
          toast.kind === "ok" ? "bg-emerald-600 text-white"
          : toast.kind === "warn" ? "bg-amber-500 text-white"
          : "bg-red-600 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      {scanning && (
        <BarcodeScanner
          onDetected={(code) => {
            setScanning(false);
            handleBarcode(code);
          }}
          onClose={() => setScanning(false)}
        />
      )}

      {quickAddBarcode && (
        <QuickAddModal
          barcode={quickAddBarcode}
          onCreated={(p) => {
            setQuickAddBarcode(null);
            addProduct(p);
          }}
          onClose={() => setQuickAddBarcode(null)}
        />
      )}
    </div>
  );
}

function PosCard({ product, onClick }: { product: Product; onClick: () => void }) {
  const cat = CATEGORIES[product.category] ?? CATEGORIES.otros;
  const low = product.stock <= product.minStock;
  const out = product.stock <= 0;
  return (
    <button
      onClick={onClick}
      disabled={out}
      className={`text-left rounded-xl bg-white border border-brand-100 overflow-hidden hover:border-brand-400 hover:shadow-card transition group ${out ? "opacity-50" : ""}`}
    >
      <div className={`relative w-full aspect-square ${cat.bg} grid place-items-center overflow-hidden`}>
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-contain p-2 group-hover:scale-105 transition"
          />
        ) : (
          <div className={`${cat.text} opacity-60`}>{cat.icon("size-12")}</div>
        )}
        <div className="absolute top-1.5 left-1.5">
          <CategoryChip category={product.category} />
        </div>
      </div>
      <div className="p-2.5">
        <div className="text-[13px] font-semibold text-brand-900 leading-tight line-clamp-2 min-h-[2.4em]">{product.name}</div>
        <div className="mt-1.5 flex items-end justify-between">
          <div className="text-brand-700 font-extrabold tabular-nums">{formatMXN(product.price)}</div>
          <div className={`text-[10px] ${out ? "text-red-500" : low ? "text-amber-600" : "text-brand-400"}`}>
            {out ? "Sin stock" : `Stock: ${product.stock}`}
          </div>
        </div>
      </div>
    </button>
  );
}

function Pill({
  active,
  onClick,
  children,
  color,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: { bg: string; text: string; ring: string };
}) {
  const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition";
  const activeCls = color
    ? `${color.bg} ${color.text} ${color.ring}`
    : "bg-brand-700 text-white ring-brand-700";
  const idle = "bg-white text-brand-500 ring-brand-100 hover:bg-brand-50";
  return (
    <button onClick={onClick} className={`${base} ${active ? activeCls : idle}`}>
      {children}
    </button>
  );
}

function PayModal({
  total,
  onClose,
  onConfirm,
}: {
  total: number;
  onClose: () => void;
  onConfirm: (method: PayMethod, received?: number, change?: number) => void | Promise<void>;
}) {
  const [method, setMethod] = useState<PayMethod>("efectivo");
  const [receivedStr, setReceivedStr] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const received = parseFloat(receivedStr || "0");
  const change = calculateChange(method, total, received);
  const canConfirm =
    !busy &&
    canConfirmPayment(method, total, received) &&
    (method !== "efectivo" || receivedStr.length > 0);

  async function confirm() {
    if (!canConfirm) return;
    setBusy(true);
    try {
      await onConfirm(
        method,
        method === "efectivo" ? received : undefined,
        method === "efectivo" ? change : undefined,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-brand-950/40 backdrop-blur-sm grid place-items-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-brand-900 text-lg">Cobrar</h3>
          <button onClick={onClose} className="text-brand-300 hover:text-brand-700 text-sm">✕</button>
        </div>

        <div className="mt-4 rounded-2xl bg-brand-50 p-4 text-center">
          <div className="text-brand-500 text-xs">Total</div>
          <div className="text-4xl font-extrabold text-brand-900 tabular-nums">{formatMXN(total)}</div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs">
          <span className="text-brand-400">Método:</span>
          {(["efectivo", "tarjeta", "transferencia"] as PayMethod[]).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`px-3 py-1.5 rounded-full border capitalize ${method === m ? "bg-brand-700 text-white border-brand-700" : "border-brand-100 text-brand-700 hover:bg-brand-50"}`}
            >
              {m}
            </button>
          ))}
        </div>

        {method === "efectivo" ? (
          <div className="mt-4">
            <label className="block">
              <span className="text-xs font-semibold text-brand-700">Paga con</span>
              <input
                ref={inputRef}
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={receivedStr}
                onChange={(e) => setReceivedStr(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirm()}
                className="input mt-1 text-2xl text-right tabular-nums"
                placeholder="0.00"
              />
            </label>

            <div className="mt-4 rounded-2xl border border-brand-100 p-4 text-center">
              <div className="text-brand-500 text-xs">Cambio</div>
              <div className={`text-5xl font-extrabold tabular-nums ${change > 0 ? "text-emerald-600" : "text-brand-300"}`}>
                {formatMXN(change)}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-brand-200 p-4 text-center text-sm text-brand-500">
            {method === "tarjeta"
              ? "Confirma cuando la terminal apruebe el pago."
              : "Confirma cuando recibas la transferencia."}
          </div>
        )}

        <div className="mt-5 grid grid-cols-3 gap-2">
          <button onClick={onClose} disabled={busy} className="btn-outline">Cancelar</button>
          <button onClick={confirm} disabled={!canConfirm} className="btn-primary col-span-2">
            {busy ? "Procesando…" : "Confirmar venta"}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickAddModal({
  barcode,
  onCreated,
  onClose,
}: {
  barcode: string;
  onCreated: (p: Product) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<CategoryKey>("otros");
  const [phase, setPhase] = useState<"looking-up" | "idle" | "saving">("looking-up");
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  // OFF lookup al abrir
  useEffect(() => {
    (async () => {
      try {
        const r = await lookupBarcode(barcode);
        if (r.found) {
          if (r.name) setName(r.name);
          if (r.category) setCategory(r.category);
          setInfo(`Autocompletado desde Open Food Facts${r.brand ? ` · ${r.brand}` : ""}`);
        } else {
          setInfo("No encontramos este código en línea. Llena los datos a mano.");
        }
      } catch {
        setInfo("Sin conexión a la base externa. Llena a mano.");
      }
      setPhase("idle");
      // Autofoco al primer campo vacío
      setTimeout(() => {
        if (!nameRef.current?.value) nameRef.current?.focus();
        else priceRef.current?.focus();
      }, 100);
    })();
  }, [barcode]);

  async function save() {
    setErr(null);
    if (!name.trim()) return setErr("Nombre requerido");
    const priceN = parseFloat(price);
    if (!Number.isFinite(priceN) || priceN <= 0) return setErr("Precio inválido");
    setPhase("saving");
    try {
      const fb = getFirebase();
      if (!fb) throw new Error("Firebase no inicializado");
      const payload = {
        name: name.trim(),
        barcode,
        price: priceN,
        category,
        stock: 1,
        minStock: 2,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(fb.db, "products"), payload);
      // Simulamos el objeto Product localmente para que se agregue al carrito de inmediato
      const newProduct = {
        id: docRef.id,
        name: payload.name,
        barcode: payload.barcode,
        price: payload.price,
        category: payload.category,
        stock: 1,
        minStock: 2,
      } as Product;
      onCreated(newProduct);
    } catch (e) {
      setErr((e as Error).message);
      setPhase("idle");
    }
  }

  function onFieldKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-brand-950/50 backdrop-blur-sm grid place-items-center p-4 z-[55]" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-brand-50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-brand-900">Nuevo producto</h3>
            <div className="text-[11px] text-brand-400 font-mono">Código: {barcode}</div>
          </div>
          <button onClick={onClose} className="text-brand-300 hover:text-brand-700">✕</button>
        </div>
        <div className="p-5 space-y-3">
          {phase === "looking-up" && (
            <div className="text-xs text-brand-600 bg-brand-50 border border-brand-100 rounded-xl px-3 py-2">
              Buscando en Open Food Facts…
            </div>
          )}
          {info && phase !== "looking-up" && (
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
              {info}
            </div>
          )}

          <label className="block">
            <span className="text-xs font-semibold text-brand-700">Nombre</span>
            <input
              ref={nameRef}
              className="input mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={onFieldKey}
              placeholder="ej. Coca-Cola 600 ml"
              disabled={phase === "saving"}
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-brand-700">Precio de venta (MXN)</span>
            <input
              ref={priceRef}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className="input mt-1 text-lg"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onKeyDown={onFieldKey}
              placeholder="0.00"
              disabled={phase === "saving"}
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-brand-700">Categoría</span>
            <div className="mt-1 grid grid-cols-4 gap-1.5">
              {CATEGORY_LIST.map((c) => {
                const active = category === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCategory(c.key)}
                    className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 ring-1 transition ${active ? `${c.bg} ${c.text} ${c.ring}` : "bg-white text-brand-400 ring-brand-100 hover:bg-brand-50"}`}
                  >
                    {c.icon("size-4")}
                    <span className="text-[9px] font-medium">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </label>

          <div className="text-[11px] text-brand-400">
            Se guarda con stock 1 y mínimo 2. Después puedes editar más detalles en /admin/productos.
          </div>

          {err && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{err}</div>}
        </div>
        <div className="p-4 border-t border-brand-50 grid grid-cols-2 gap-2">
          <button onClick={onClose} className="btn-outline" disabled={phase === "saving"}>
            Cancelar
          </button>
          <button onClick={save} className="btn-primary" disabled={phase !== "idle"}>
            {phase === "saving" ? "Guardando…" : phase === "looking-up" ? "Buscando…" : "Guardar y agregar"}
          </button>
        </div>
      </div>
    </div>
  );
}

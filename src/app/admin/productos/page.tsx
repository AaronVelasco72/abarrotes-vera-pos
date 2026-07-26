"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc, collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, updateDoc, where,
} from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { useProducts, isProductUninitialized, productMargin, productMarginPct, type Product } from "@/lib/products";
import { uploadProductImage } from "@/lib/upload";
import { formatMXN } from "@/lib/money";
import { CATEGORIES, CATEGORY_LIST, CategoryChip, type CategoryKey } from "@/lib/categories";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { lookupBarcode } from "@/lib/openfoodfacts";

type Filter = "all" | CategoryKey;

export default function ProductosPage() {
  const { products, loading } = useProducts();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState<{ initialBarcode?: string } | null>(null);
  const [flash, setFlashMsg] = useState<{ kind: "ok" | "err" | "warn"; msg: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  function toast(kind: "ok" | "err" | "warn", msg: string) {
    setFlashMsg({ kind, msg });
    setTimeout(() => setFlashMsg(null), 2600);
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter((p) => {
      if (filter !== "all" && p.category !== filter) return false;
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) ||
        (p.sku || "").toLowerCase().includes(needle) ||
        (p.barcode || "").includes(needle)
      );
    });
  }, [products, q, filter]);

  const totals = useMemo(() => {
    const skus = products.length;
    const piezas = products.reduce((s, p) => s + p.stock, 0);
    const valor = products.reduce((s, p) => s + p.stock * p.price, 0);
    const uninitialized = products.filter(isProductUninitialized).length;
    const alertas = products.filter((p) => p.stock <= p.minStock).length;
    return { skus, piezas, valor, uninitialized, alertas };
  }, [products]);

  const suppliers = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.supplier && set.add(p.supplier));
    return [...set].sort();
  }, [products]);

  /**
   * Detecta un escaneo externo: si el usuario (o un scanner USB emulando teclado)
   * escribe una cadena de 8+ dígitos y presiona Enter en el buscador, se trata como
   * un código de barras. Si el barcode ya existe → abre edit; si no → abre crear con OFF.
   */
  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const val = q.trim();
    if (!/^\d{8,14}$/.test(val)) return;
    e.preventDefault();
    const existing = products.find((p) => p.barcode === val);
    if (existing) {
      toast("ok", `Encontrado: ${existing.name}`);
      setEditing(existing);
    } else {
      toast("warn", `Nuevo producto — código ${val}`);
      setCreating({ initialBarcode: val });
    }
    setQ("");
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-brand-400 text-xs tracking-[0.2em]">CATÁLOGO</div>
          <h1 className="text-2xl font-bold text-brand-900">Productos</h1>
        </div>
        <button onClick={() => setCreating({})} className="btn-primary">+ Nuevo</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <MiniStat label="SKUs" value={String(totals.skus)} />
        <MiniStat label="Piezas en stock" value={String(totals.piezas)} />
        <MiniStat label="Valor inventario" value={formatMXN(totals.valor)} />
        <MiniStat label="Por completar" value={String(totals.uninitialized)} tone={totals.uninitialized > 0 ? "red" : "ok"} />
        <MiniStat label="Alertas de stock" value={String(totals.alertas)} tone={totals.alertas > 0 ? "warn" : "ok"} />
      </div>

      <input
        ref={searchRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onSearchKey}
        placeholder="Buscar por nombre / SKU · o escanea código de barras con scanner externo…"
        className="input"
        inputMode="search"
        autoFocus
      />

      <div className="flex flex-wrap gap-1.5">
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>Todos</FilterPill>
        {CATEGORY_LIST.map((c) => (
          <FilterPill key={c.key} active={filter === c.key} onClick={() => setFilter(c.key)} color={c}>
            {c.icon("size-3.5")} {c.label}
          </FilterPill>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card aspect-[3/4] animate-pulse bg-brand-50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-brand-400 text-sm">
          {products.length === 0
            ? "Aún no hay productos. Crea el primero con “+ Nuevo”."
            : "Sin resultados con ese filtro."}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} onClick={() => setEditing(p)} />
          ))}
        </div>
      )}

      {(creating || editing) && (
        <ProductModal
          product={editing}
          initialBarcode={creating?.initialBarcode}
          suppliers={suppliers}
          allProducts={products}
          onSwitchToEdit={(p) => {
            setCreating(null);
            setEditing(p);
          }}
          onClose={() => {
            setCreating(null);
            setEditing(null);
            setTimeout(() => searchRef.current?.focus(), 50);
          }}
        />
      )}

      {flash && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full shadow-lg text-sm font-medium z-50 ${
          flash.kind === "ok" ? "bg-emerald-600 text-white"
          : flash.kind === "warn" ? "bg-amber-500 text-white"
          : "bg-red-600 text-white"
        }`}>
          {flash.msg}
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "warn" | "red";
}) {
  const toneClass =
    tone === "warn"  ? "bg-amber-50 text-amber-700 ring-amber-100"
  : tone === "red"   ? "bg-red-50 text-red-700 ring-red-200"
  : tone === "ok"    ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                     : "bg-white text-brand-900 ring-brand-50";
  return (
    <div className={`rounded-2xl p-3 ring-1 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-0.5 text-base font-extrabold tabular-nums truncate">{value}</div>
    </div>
  );
}

function FilterPill({
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

function ProductCard({ product, onClick }: { product: Product; onClick: () => void }) {
  const cat = CATEGORIES[product.category] ?? CATEGORIES.otros;
  const low = product.stock <= product.minStock;
  const uninitialized = isProductUninitialized(product);
  const margin = productMargin(product);
  const marginPct = productMarginPct(product);

  const cardCls = uninitialized
    ? "rounded-2xl bg-red-50 border-2 border-red-300 shadow-card overflow-hidden text-left hover:shadow-lg hover:-translate-y-0.5 transition group"
    : "card overflow-hidden text-left hover:shadow-lg hover:-translate-y-0.5 transition group";

  return (
    <button onClick={onClick} className={cardCls}>
      <div className={`relative aspect-square ${cat.bg} grid place-items-center overflow-hidden`}>
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="absolute inset-0 size-full object-cover group-hover:scale-105 transition"
          />
        ) : (
          <div className={`${cat.text} opacity-70 scale-[2.2]`}>{cat.icon("size-10")}</div>
        )}
        <div className="absolute top-2 left-2">
          <CategoryChip category={product.category} />
        </div>
        {low && !uninitialized && (
          <div className="absolute top-2 right-2 text-[10px] font-bold bg-amber-500 text-white rounded-full px-2 py-0.5">
            BAJO
          </div>
        )}
        {uninitialized && (
          <div className="absolute top-2 right-2 text-[10px] font-bold bg-red-600 text-white rounded-full px-2 py-0.5">
            POR COMPLETAR
          </div>
        )}
      </div>
      <div className="p-3">
        <div className={`text-sm font-semibold ${uninitialized ? "text-red-900" : "text-brand-900"} line-clamp-2 leading-tight min-h-[2.4em]`}>
          {product.name}
        </div>
        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className={`text-lg font-extrabold tabular-nums ${uninitialized ? "text-red-700" : "text-brand-700"}`}>
              {formatMXN(product.price)}
            </div>
            {margin != null && marginPct != null ? (
              <div className={`text-[10px] tabular-nums ${margin > 0 ? "text-emerald-600" : "text-red-600"}`}>
                {margin > 0 ? "+" : ""}{formatMXN(margin)} · {marginPct.toFixed(0)}%
              </div>
            ) : (
              <div className="text-[10px] text-red-600 font-medium">Sin precio de compra</div>
            )}
          </div>
          <div className={`text-xs ${low ? "text-amber-600 font-semibold" : uninitialized ? "text-red-600 font-semibold" : "text-brand-400"}`}>
            Stock: {product.stock}
          </div>
        </div>
        {product.supplier && (
          <div className="mt-1 text-[10px] text-brand-400 truncate">Prov: {product.supplier}</div>
        )}
      </div>
    </button>
  );
}

function ProductModal({
  product,
  initialBarcode,
  suppliers,
  allProducts,
  onSwitchToEdit,
  onClose,
}: {
  product: Product | null;
  initialBarcode?: string;
  suppliers: string[];
  allProducts: Product[];
  onSwitchToEdit: (p: Product) => void;
  onClose: () => void;
}) {
  const isEdit = !!product;
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState<CategoryKey>(product?.category ?? "refresco");
  const [price, setPrice] = useState<string>(product ? String(product.price) : "");
  const [costPrice, setCostPrice] = useState<string>(product?.costPrice != null ? String(product.costPrice) : "");
  const [stock, setStock] = useState<string>(product ? String(product.stock) : "");
  const [minStock, setMinStock] = useState<string>(product ? String(product.minStock) : "5");
  const [idealStock, setIdealStock] = useState<string>(
    product?.idealStock != null ? String(product.idealStock) : product ? String(Math.max(product.minStock * 3, 12)) : "15",
  );
  const [supplier, setSupplier] = useState(product?.supplier ?? "");
  const [quantity, setQuantity] = useState(product?.quantity ?? "");
  const [barcode, setBarcode] = useState(product?.barcode ?? initialBarcode ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [imageUrl, setImageUrl] = useState<string | undefined>(product?.imageUrl);
  const [remoteImageUrl, setRemoteImageUrl] = useState<string | undefined>(undefined);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "saving" | "uploading" | "looking-up" | "checking">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const busy = phase !== "idle";
  const didInitialLookup = useRef(false);

  const preview = file ? URL.createObjectURL(file) : imageUrl || remoteImageUrl;

  const priceN = parseFloat(price);
  const costN = parseFloat(costPrice);
  const marginN = Number.isFinite(priceN) && Number.isFinite(costN) && costN > 0 ? priceN - costN : null;
  const marginPctN = marginN != null && costN > 0 ? (marginN / costN) * 100 : null;

  async function autofillFromBarcode(code: string) {
    setBarcode(code);
    setScanning(false);
    setErr(null);
    setInfo(null);

    // 1) Deduplicación: ¿ya existe un producto con este barcode?
    setPhase("checking");
    const conflict = allProducts.find((p) => p.barcode === code && p.id !== product?.id);
    if (conflict) {
      setPhase("idle");
      setInfo(`Este código ya existe: “${conflict.name}”. Abriendo su ficha para editar…`);
      setTimeout(() => onSwitchToEdit(conflict), 900);
      return;
    }

    // 2) Consulta Open Food Facts
    setPhase("looking-up");
    try {
      const r = await lookupBarcode(code);
      if (!r.found) {
        setInfo("Código escaneado. No encontramos información en línea, llena los datos a mano.");
      } else {
        if (r.name && !name.trim()) setName(r.name);
        if (r.quantity && !quantity.trim()) setQuantity(r.quantity);
        if (r.imageUrl && !imageUrl && !file) setRemoteImageUrl(r.imageUrl);
        if (r.category) setCategory(r.category);
        setInfo(`Auto-llenado desde Open Food Facts${r.brand ? ` (${r.brand})` : ""}. Revisa y ajusta.`);
      }
    } catch {
      setInfo("No se pudo consultar la base externa. Llena los datos a mano.");
    } finally {
      setPhase("idle");
    }
  }

  // Si el modal se abrió con un barcode inicial (scan desde el buscador), dispara autofill
  useEffect(() => {
    if (!isEdit && initialBarcode && !didInitialLookup.current) {
      didInitialLookup.current = true;
      autofillFromBarcode(initialBarcode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBarcode, isEdit]);

  function onBarcodeKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = barcode.trim();
      if (/^\d{8,14}$/.test(val)) autofillFromBarcode(val);
    }
  }

  async function onSave() {
    setErr(null);
    if (!name.trim()) return setErr("El nombre es requerido.");
    if (!Number.isFinite(priceN) || priceN <= 0) return setErr("Precio de venta inválido.");
    const costOk = costPrice.trim() === "" || (Number.isFinite(costN) && costN >= 0);
    if (!costOk) return setErr("Precio de compra inválido.");
    const stockN = parseInt(stock, 10);
    if (!Number.isFinite(stockN) || stockN < 0) return setErr("Stock inválido.");
    const minN = parseInt(minStock, 10);
    if (!Number.isFinite(minN) || minN < 0) return setErr("Mínimo inválido.");
    const idealN = parseInt(idealStock, 10);
    if (!Number.isFinite(idealN) || idealN < 0) return setErr("Stock ideal inválido.");

    // Deduplicación final antes de guardar (por si el user escribió el barcode a mano)
    if (!isEdit && barcode.trim()) {
      const fb = getFirebase();
      if (fb) {
        setPhase("checking");
        const snap = await getDocs(
          query(collection(fb.db, "products"), where("barcode", "==", barcode.trim()), limit(1)),
        );
        if (!snap.empty) {
          const first = snap.docs[0];
          setPhase("idle");
          setErr(`El código ${barcode.trim()} ya está registrado como “${first.data().name}”.`);
          return;
        }
      }
    }

    setPhase("saving");
    let savedId: string | undefined = product?.id;
    try {
      const fb = getFirebase();
      if (!fb) throw new Error("Firebase no inicializado");

      const payload: Record<string, unknown> = {
        name: name.trim(),
        category,
        price: priceN,
        costPrice: costPrice.trim() === "" ? null : costN,
        stock: stockN,
        minStock: minN,
        idealStock: idealN,
        supplier: supplier.trim() || null,
        quantity: quantity.trim() || null,
        sku: sku.trim() || null,
        barcode: barcode.trim() || null,
        updatedAt: serverTimestamp(),
      };

      if (remoteImageUrl && !file && !imageUrl) payload.imageUrl = remoteImageUrl;

      if (isEdit && savedId) {
        await updateDoc(doc(fb.db, "products", savedId), payload);
      } else {
        const created = await addDoc(collection(fb.db, "products"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        savedId = created.id;
      }
    } catch (e) {
      setErr("No se pudo guardar: " + (e as Error).message);
      setPhase("idle");
      return;
    }

    if (file && savedId) {
      setPhase("uploading");
      try {
        const fb = getFirebase();
        if (!fb) throw new Error("Firebase no inicializado");
        const url = await uploadProductImage(savedId, file);
        await updateDoc(doc(fb.db, "products", savedId), { imageUrl: url });
        setImageUrl(url);
      } catch (e) {
        setErr("Producto guardado, pero la imagen no subió: " + (e as Error).message);
        setPhase("idle");
        return;
      }
    }
    setPhase("idle");
    onClose();
  }

  async function onDelete() {
    if (!product) return;
    if (!confirm(`¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`)) return;
    setPhase("saving");
    try {
      const fb = getFirebase();
      if (!fb) throw new Error("Firebase no inicializado");
      await deleteDoc(doc(fb.db, "products", product.id));
      onClose();
    } catch (e) {
      setErr((e as Error).message);
      setPhase("idle");
    }
  }

  const marginBox = marginN != null && marginPctN != null && marginN >= 0
    ? { cls: "bg-emerald-50 text-emerald-800 ring-emerald-200", pfx: "Ganancia por pieza" }
    : marginN != null && marginN < 0
      ? { cls: "bg-red-50 text-red-800 ring-red-200", pfx: "PÉRDIDA por pieza" }
      : null;

  return (
    <>
      <div className="fixed inset-0 bg-brand-950/40 backdrop-blur-sm grid place-items-end sm:place-items-center p-0 sm:p-4 z-50" onClick={onClose}>
        <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="sticky top-0 bg-white border-b border-brand-50 px-5 py-3 flex items-center justify-between z-10">
            <h3 className="font-bold text-brand-900">{isEdit ? "Editar producto" : "Nuevo producto"}</h3>
            <button onClick={onClose} className="text-brand-300 hover:text-brand-700">✕</button>
          </div>

          <div className="p-5 space-y-4">
            {!isEdit && (
              <button
                type="button"
                onClick={() => setScanning(true)}
                className="w-full rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50 hover:bg-brand-100 transition p-4 flex items-center gap-3"
              >
                <div className="size-10 rounded-xl bg-brand-700 text-white grid place-items-center text-xl">⌗</div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-brand-900">Escanear código de barras</div>
                  <div className="text-xs text-brand-500">Auto-llena nombre, gramaje, foto desde Open Food Facts. Si el código ya existe, abre el producto para editar.</div>
                </div>
                <div className="text-brand-400 text-xl">›</div>
              </button>
            )}

            {info && (
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                {info}
              </div>
            )}
            {phase === "looking-up" && (
              <div className="text-xs text-brand-600 bg-brand-50 border border-brand-100 rounded-xl px-3 py-2">Buscando en Open Food Facts…</div>
            )}
            {phase === "checking" && (
              <div className="text-xs text-brand-600 bg-brand-50 border border-brand-100 rounded-xl px-3 py-2">Verificando duplicados…</div>
            )}

            <div>
              <span className="text-xs font-semibold text-brand-700">Imagen</span>
              <div className={`mt-1 rounded-2xl ${CATEGORIES[category].bg} aspect-square max-h-56 relative grid place-items-center overflow-hidden`}>
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
                ) : (
                  <div className={`${CATEGORIES[category].text} scale-150 opacity-60`}>
                    {CATEGORIES[category].icon("size-12")}
                  </div>
                )}
                <label className="absolute bottom-2 right-2 btn bg-white text-brand-800 ring-1 ring-brand-100 cursor-pointer text-xs px-3 py-1.5">
                  {preview ? "Cambiar" : "Subir foto"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setFile(f);
                      if (f) setRemoteImageUrl(undefined);
                    }}
                  />
                </label>
                {remoteImageUrl && !file && (
                  <div className="absolute top-2 left-2 text-[10px] font-semibold bg-emerald-500 text-white rounded-full px-2 py-0.5">Auto</div>
                )}
              </div>
            </div>

            <Field label="Nombre">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>

            <Field label="Categoría">
              <div className="grid grid-cols-4 gap-1.5">
                {CATEGORY_LIST.map((c) => {
                  const active = category === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setCategory(c.key)}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 ring-1 transition ${active ? `${c.bg} ${c.text} ${c.ring}` : "bg-white text-brand-400 ring-brand-100 hover:bg-brand-50"}`}
                    >
                      {c.icon("size-5")}
                      <span className="text-[10px] font-medium">{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Precio de compra (MXN)">
                <input type="number" step="0.01" min="0" className="input" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="Lo que te cuesta" />
              </Field>
              <Field label="Precio de venta (MXN)">
                <input type="number" step="0.01" min="0" className="input" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Lo que cobras" />
              </Field>
            </div>

            {marginBox && (
              <div className={`rounded-xl px-3 py-2 text-xs ring-1 ${marginBox.cls}`}>
                <span className="opacity-80">{marginBox.pfx}: </span>
                <strong className="tabular-nums">{formatMXN(Math.abs(marginN!))}</strong>
                <span className="opacity-80"> · Margen sobre costo: </span>
                <strong className="tabular-nums">{marginPctN!.toFixed(1)}%</strong>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Field label="Gramaje / Presentación">
                <input className="input" placeholder="ej. 600 ml" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </Field>
              <Field label="Proveedor">
                <input className="input" placeholder="ej. FEMSA, Bimbo…" value={supplier} onChange={(e) => setSupplier(e.target.value)} list="supplier-list" />
                <datalist id="supplier-list">
                  {suppliers.map((s) => <option key={s} value={s} />)}
                </datalist>
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Field label="Stock actual">
                <input type="number" min="0" className="input" value={stock} onChange={(e) => setStock(e.target.value)} />
              </Field>
              <Field label="Mín. alerta">
                <input type="number" min="0" className="input" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
              </Field>
              <Field label="Stock ideal">
                <input type="number" min="0" className="input" value={idealStock} onChange={(e) => setIdealStock(e.target.value)} />
              </Field>
            </div>
            <p className="text-[11px] text-brand-400 -mt-2">
              El <strong>stock ideal</strong> es lo que quieres mantener en piso. Si baja, entra al Pedido a proveedores.
            </p>

            <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
              <Field label="Código de barras">
                <input
                  className="input"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={onBarcodeKey}
                  placeholder="EAN-13 / UPC · Enter para lookup"
                  inputMode="numeric"
                />
              </Field>
              <button type="button" onClick={() => setScanning(true)} className="btn-outline mb-0.5 whitespace-nowrap" title="Escanear con la cámara">
                ⌗ Escanear
              </button>
            </div>

            <Field label="SKU interno (opcional)">
              <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} />
            </Field>

            {err && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{err}</div>}
          </div>

          <div className="sticky bottom-0 bg-white border-t border-brand-50 p-4 grid grid-cols-3 gap-2">
            {isEdit && (
              <button onClick={onDelete} disabled={busy} className="btn-outline text-red-600 border-red-200 hover:bg-red-50">Eliminar</button>
            )}
            <button onClick={onClose} disabled={busy} className={`btn-outline ${isEdit ? "" : "col-span-1"}`}>Cancelar</button>
            <button onClick={onSave} disabled={busy} className={`btn-primary ${isEdit ? "col-span-1" : "col-span-2"}`}>
              {phase === "saving" ? "Guardando…" : phase === "uploading" ? "Subiendo imagen…" : phase === "looking-up" ? "Buscando…" : phase === "checking" ? "Verificando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>

      {scanning && (
        <BarcodeScanner
          onDetected={autofillFromBarcode}
          onClose={() => setScanning(false)}
        />
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-brand-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

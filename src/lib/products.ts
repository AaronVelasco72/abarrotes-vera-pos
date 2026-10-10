"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { getFirebase } from "./firebase";
import { barcodeVariants } from "./barcode";
import type { CategoryKey } from "./categories";

export type Product = {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  /** Precio al que se le vende al cliente. */
  price: number;
  /** Precio al que se compra al proveedor. Se usa para calcular el margen. */
  costPrice?: number;
  stock: number;
  minStock: number;
  /** Cantidad ideal a mantener en piso. Se usa para armar pedidos a proveedores. */
  idealStock?: number;
  category: CategoryKey;
  /** Nombre del proveedor (Coca-Cola FEMSA, Modelo, etc). */
  supplier?: string;
  /** Gramaje o presentación (600 ml, 1 kg, etc). */
  quantity?: string;
  imageUrl?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

/** True cuando el producto se acaba de crear pero aún no tiene stock real ni precio de compra. */
export function isProductUninitialized(p: Product): boolean {
  return p.stock === 1 && (p.costPrice == null || p.costPrice <= 0);
}

/** Ganancia bruta por pieza. null si no hay costPrice válido. */
export function productMargin(p: Product): number | null {
  if (p.costPrice == null || p.costPrice <= 0) return null;
  return p.price - p.costPrice;
}

/** Porcentaje de margen sobre el costo. null si no hay costPrice válido. */
export function productMarginPct(p: Product): number | null {
  if (p.costPrice == null || p.costPrice <= 0) return null;
  return ((p.price - p.costPrice) / p.costPrice) * 100;
}

/**
 * Busca en Firestore (no en la caché local) un producto con ese código de barras,
 * tolerando variantes UPC/EAN con ceros a la izquierda. Sirve como última
 * verificación antes de registrar un producto nuevo.
 */
export async function findProductByBarcode(code: string, excludeId?: string): Promise<Product | null> {
  const fb = getFirebase();
  const variants = barcodeVariants(code);
  if (!fb || variants.length === 0) return null;
  const snap = await getDocs(
    query(collection(fb.db, "products"), where("barcode", "in", variants), limit(5)),
  );
  const hit = snap.docs.find((d) => d.id !== excludeId);
  return hit ? ({ id: hit.id, ...(hit.data() as Omit<Product, "id">) }) : null;
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fb = getFirebase();
    if (!fb) {
      setLoading(false);
      return;
    }
    const q = query(collection(fb.db, "products"), orderBy("name"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: Product[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Product, "id">),
        }));
        setProducts(items);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  return { products, loading };
}

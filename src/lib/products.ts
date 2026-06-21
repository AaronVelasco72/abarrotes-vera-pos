"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { getFirebase } from "./firebase";
import type { CategoryKey } from "./categories";

export type Product = {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  price: number;
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

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
  category: CategoryKey;
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

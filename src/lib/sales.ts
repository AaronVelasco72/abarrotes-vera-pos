"use client";

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { getFirebase } from "./firebase";
import type { CategoryKey } from "./categories";

export type PayMethod = "efectivo" | "tarjeta" | "transferencia";

export type SaleLine = {
  productId: string;
  name: string;
  category: CategoryKey;
  price: number;
  qty: number;
};

export type Sale = {
  id: string;
  total: number;
  items: number;
  method: PayMethod;
  received?: number;
  change?: number;
  lines: SaleLine[];
  cashierUid: string;
  cashierEmail: string;
  createdAt: Timestamp;
};

export type RecordSaleInput = {
  lines: SaleLine[];
  method: PayMethod;
  received?: number;
  change?: number;
  cashier: { uid: string; email: string };
};

export async function recordSale(input: RecordSaleInput): Promise<string> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase no inicializado");

  const total = input.lines.reduce((s, l) => s + l.price * l.qty, 0);
  const items = input.lines.reduce((s, l) => s + l.qty, 0);

  const saleId = await runTransaction(fb.db, async (tx) => {
    // Lee stocks actuales y valida
    const reads = await Promise.all(
      input.lines.map((l) => tx.get(doc(fb.db, "products", l.productId))),
    );

    reads.forEach((snap, i) => {
      const line = input.lines[i];
      if (!snap.exists()) {
        throw new Error(`Producto ${line.name} ya no existe`);
      }
      const currentStock = (snap.data().stock ?? 0) as number;
      if (currentStock < line.qty) {
        throw new Error(
          `Stock insuficiente para ${line.name} (quedan ${currentStock})`,
        );
      }
    });

    // Descuenta stock
    reads.forEach((snap, i) => {
      const line = input.lines[i];
      const currentStock = (snap.data()!.stock ?? 0) as number;
      tx.update(doc(fb.db, "products", line.productId), {
        stock: currentStock - line.qty,
        updatedAt: serverTimestamp(),
      });
    });

    // Crea documento de venta (id auto)
    const saleRef = doc(collection(fb.db, "sales"));
    tx.set(saleRef, {
      total,
      items,
      method: input.method,
      received: input.received ?? null,
      change: input.change ?? null,
      lines: input.lines,
      cashierUid: input.cashier.uid,
      cashierEmail: input.cashier.email,
      createdAt: serverTimestamp(),
    });
    return saleRef.id;
  });

  return saleId;
}

/** Real-time subscription to today's sales (00:00 local → now). */
export function useTodaySales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fb = getFirebase();
    if (!fb) {
      setLoading(false);
      return;
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const q = query(
      collection(fb.db, "sales"),
      where("createdAt", ">=", Timestamp.fromDate(start)),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSales(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Sale, "id">) })),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  return { sales, loading };
}

/** Real-time subscription to recent sales (last N, any date). */
export function useRecentSales(limitN = 50) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fb = getFirebase();
    if (!fb) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(fb.db, "sales"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSales(
          snap.docs
            .slice(0, limitN)
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Sale, "id">) })),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [limitN]);

  return { sales, loading };
}

/** Helper: add a single product doc (used by admin add flow). */
export async function createProduct(data: {
  name: string;
  category: CategoryKey;
  price: number;
  stock: number;
  minStock: number;
  sku?: string;
  barcode?: string;
  imageUrl?: string;
}): Promise<string> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase no inicializado");
  const ref = await addDoc(collection(fb.db, "products"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

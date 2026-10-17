"use client";

import { useEffect, useState } from "react";
import {
  collection, deleteDoc, doc, getDoc, increment, onSnapshot, orderBy, query, serverTimestamp, setDoc,
  Timestamp, updateDoc,
} from "firebase/firestore";
import { getFirebase } from "./firebase";
import { barcodeKey, cleanBarcode } from "./barcode";
import { uploadCompressed, deleteFromUrl } from "./upload";

/**
 * Código escaneado "a lo rápido" que todavía no se registra como producto.
 * El id del documento es la clave canónica del código, así que escanear el
 * mismo producto dos veces solo sube el contador (no se duplica).
 */
export type PendingScan = {
  id: string;
  barcode: string;
  /** Veces que se escaneó (≈ piezas que llegaron). */
  count: number;
  /** Día local YYYY-MM-DD del primer escaneo. */
  day: string;
  /** Foto opcional (etiqueta de precio, ticket, producto). */
  photoUrl?: string;
  note?: string;
  scannedBy?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

const COLLECTION = "pendingScans";

/** Fecha local (no UTC) en formato YYYY-MM-DD. */
export function localDay(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function usePendingScans() {
  const [items, setItems] = useState<PendingScan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fb = getFirebase();
    if (!fb) { setLoading(false); return; }
    const q = query(collection(fb.db, COLLECTION), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PendingScan, "id">) })));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  return { items, loading };
}

/** Guarda (o suma +1) un código pendiente. Devuelve true si era nuevo. */
export async function addPendingScan(code: string, scannedBy?: string): Promise<boolean> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase no inicializado");
  const key = barcodeKey(code);
  if (!key) throw new Error("Código inválido");
  const ref = doc(fb.db, COLLECTION, key);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { count: increment(1), updatedAt: serverTimestamp() });
    return false;
  }
  await setDoc(ref, {
    barcode: cleanBarcode(code),
    count: 1,
    day: localDay(),
    scannedBy: scannedBy ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return true;
}

export async function updatePendingScan(id: string, data: Partial<Pick<PendingScan, "count" | "note">>) {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase no inicializado");
  await updateDoc(doc(fb.db, COLLECTION, id), { ...data, updatedAt: serverTimestamp() });
}

export async function setPendingPhoto(item: PendingScan, file: File) {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase no inicializado");
  const url = await uploadCompressed(`pending/${item.id}/foto-${Date.now()}.webp`, file);
  await updateDoc(doc(fb.db, COLLECTION, item.id), { photoUrl: url, updatedAt: serverTimestamp() });
  if (item.photoUrl) await deleteFromUrl(item.photoUrl);
}

export async function deletePendingScan(item: Pick<PendingScan, "id" | "photoUrl">) {
  const fb = getFirebase();
  if (!fb) return;
  await deleteDoc(doc(fb.db, COLLECTION, item.id));
  if (item.photoUrl) await deleteFromUrl(item.photoUrl);
}

/** Al registrar un producto, quita su código de pendientes (si estaba). Best-effort. */
export async function clearPendingFor(code: string | null | undefined) {
  const fb = getFirebase();
  const key = barcodeKey(code);
  if (!fb || !key) return;
  try {
    const ref = doc(fb.db, COLLECTION, key);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    await deletePendingScan({ id: key, photoUrl: (snap.data() as PendingScan).photoUrl });
  } catch {
    /* no bloquea el guardado del producto */
  }
}

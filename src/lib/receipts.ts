"use client";

import { useEffect, useState } from "react";
import {
  addDoc, collection, deleteDoc, doc, limit as fbLimit, onSnapshot, orderBy, query, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { ref as sref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getFirebase } from "./firebase";

export type Receipt = {
  id: string;
  supplier?: string;
  total: number;
  /** ISO YYYY-MM-DD  (fecha del ticket, no del registro). */
  date: string;
  notes?: string;
  imageUrl: string;
  imagePath: string;
  uploaderEmail: string;
  createdAt: Timestamp;
};

const UPLOAD_TIMEOUT_MS = 30_000;
const withTimeout = <T>(p: Promise<T>, ms: number, msg: string) =>
  new Promise<T>((res, rej) => {
    const t = setTimeout(() => rej(new Error(msg)), ms);
    p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); });
  });

export function useRecentReceipts(limitN = 60) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fb = getFirebase();
    if (!fb) { setLoading(false); return; }
    const q = query(
      collection(fb.db, "receipts"),
      orderBy("createdAt", "desc"),
      fbLimit(limitN),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setReceipts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Receipt, "id">) })));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [limitN]);

  return { receipts, loading };
}

export async function createReceipt(input: {
  file: File;
  supplier?: string;
  total: number;
  date: string;
  notes?: string;
  uploaderEmail: string;
}): Promise<string> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase no inicializado");

  // 1) crea doc placeholder para conocer el id
  const docRef = await addDoc(collection(fb.db, "receipts"), {
    supplier: input.supplier ?? null,
    total: input.total,
    date: input.date,
    notes: input.notes ?? null,
    imageUrl: "",
    imagePath: "",
    uploaderEmail: input.uploaderEmail,
    createdAt: serverTimestamp(),
  });

  // 2) sube la imagen
  const ext = (input.file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `receipts/${docRef.id}/ticket-${Date.now()}.${ext}`;
  const r = sref(fb.storage, path);
  try {
    await withTimeout(
      uploadBytes(r, input.file, { contentType: input.file.type || "image/jpeg" }),
      UPLOAD_TIMEOUT_MS,
      "La subida de la imagen tardó demasiado. Verifica tu conexión.",
    );
    const url = await getDownloadURL(r);
    const { updateDoc } = await import("firebase/firestore");
    await updateDoc(doc(fb.db, "receipts", docRef.id), { imageUrl: url, imagePath: path });
  } catch (e) {
    // best-effort: si falla la imagen dejamos el doc para retry manual
    throw e;
  }

  return docRef.id;
}

export async function deleteReceipt(receipt: Receipt): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase no inicializado");
  // borra imagen (best-effort)
  if (receipt.imagePath) {
    try {
      await deleteObject(sref(fb.storage, receipt.imagePath));
    } catch { /* ignore */ }
  }
  await deleteDoc(doc(fb.db, "receipts", receipt.id));
}

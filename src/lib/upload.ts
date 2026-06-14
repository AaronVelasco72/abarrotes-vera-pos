"use client";

import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getFirebase } from "./firebase";

const UPLOAD_TIMEOUT_MS = 30_000;

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export async function uploadProductImage(
  productId: string,
  file: File,
): Promise<string> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase no inicializado");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `products/${productId}/main-${Date.now()}.${ext}`;
  const r = ref(fb.storage, path);
  try {
    await withTimeout(
      uploadBytes(r, file, { contentType: file.type || "image/jpeg" }),
      UPLOAD_TIMEOUT_MS,
      "La subida de la imagen tardó demasiado. Revisa que Firebase Storage esté habilitado y que las reglas permitan escribir.",
    );
    return await getDownloadURL(r);
  } catch (e) {
    const err = e as Error & { code?: string };
    if (err.code === "storage/unauthorized") {
      throw new Error(
        "Storage rechazó la subida. Pega las reglas de storage.rules en Firebase Console → Storage → Reglas.",
      );
    }
    if (err.code === "storage/unknown" || err.message?.includes("storage")) {
      throw new Error(
        "No se pudo conectar con Firebase Storage. Habilítalo en Firebase Console → Storage → Comenzar.",
      );
    }
    throw err;
  }
}

export async function deleteFromUrl(url: string): Promise<void> {
  const fb = getFirebase();
  if (!fb) return;
  try {
    const r = ref(fb.storage, url);
    await deleteObject(r);
  } catch {
    // best-effort
  }
}

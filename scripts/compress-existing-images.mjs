// Descarga cada imagen de productos, la recomprime a WebP 800px máx (~50-80 KB),
// la re-sube a Storage y actualiza el imageUrl en Firestore. Borra la vieja.
//
// One-time script para bajar el peso del catálogo cargado.
//
// Uso:  node scripts/compress-existing-images.mjs

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = resolve(__dirname, "..", "service-account.json");
if (!existsSync(keyPath)) {
  console.error("❌ Falta service-account.json en la raíz.");
  process.exit(1);
}

const svc = JSON.parse(readFileSync(keyPath, "utf8"));
if (getApps().length === 0) {
  initializeApp({
    credential: cert(svc),
    // storageBucket sale del service account json (project_id.firebasestorage.app o .appspot.com)
    storageBucket: `${svc.project_id}.firebasestorage.app`,
  });
}

const db = getFirestore();
const bucket = getStorage().bucket();

console.log(`Bucket: ${bucket.name}\n`);

const snap = await db.collection("products").get();
console.log(`Total productos: ${snap.size}\n`);

let processed = 0, saved = 0, skipped = 0, totalBefore = 0, totalAfter = 0;

for (const doc of snap.docs) {
  const p = doc.data();
  const url = p.imageUrl;
  if (!url || typeof url !== "string") { skipped++; continue; }

  // Skip URLs externas (Open Food Facts, etc): no las controlamos
  if (!url.includes("firebasestorage.googleapis.com") && !url.includes("firebasestorage.app")) {
    console.log(`↷ ${p.name}: URL externa, se deja`);
    skipped++;
    continue;
  }

  // Extract path from URL: .../o/<encoded-path>?alt=media&token=...
  const m = url.match(/\/o\/([^?]+)/);
  if (!m) { console.log(`↷ ${p.name}: URL no reconocida`); skipped++; continue; }
  const path = decodeURIComponent(m[1]);

  const file = bucket.file(path);
  const [exists] = await file.exists();
  if (!exists) { console.log(`✗ ${p.name}: archivo no encontrado en Storage`); skipped++; continue; }

  const [buffer] = await file.download();
  const before = buffer.length;

  let compressed;
  try {
    compressed = await sharp(buffer)
      .rotate() // respeta orientación EXIF
      .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toBuffer();
  } catch (e) {
    console.log(`✗ ${p.name}: sharp falló (${e.message})`);
    skipped++;
    continue;
  }

  const after = compressed.length;

  // Si el ahorro es < 15%, no vale la pena reemplazar
  if (after >= before * 0.85) {
    console.log(`= ${p.name}: ${(before/1024).toFixed(0)} KB (ya está optimizado)`);
    skipped++;
    continue;
  }

  // Sube el nuevo archivo a una ruta nueva con extensión .webp
  const newPath = path.replace(/\.[^.]+$/, "") + `-c${Date.now().toString(36)}.webp`;
  const newFile = bucket.file(newPath);
  await newFile.save(compressed, {
    metadata: {
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
    },
    resumable: false,
  });

  // Genera signed URL con expiración muy larga (year 3000)
  const [signedUrl] = await newFile.getSignedUrl({
    action: "read",
    expires: "01-01-3000",
  });

  // Actualiza Firestore
  await doc.ref.update({
    imageUrl: signedUrl,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Borra el archivo viejo (best-effort)
  try { await file.delete(); } catch { /* ignore */ }

  processed++;
  totalBefore += before;
  totalAfter += after;
  saved += before - after;
  console.log(`✔ ${p.name}: ${(before/1024).toFixed(0)} KB → ${(after/1024).toFixed(0)} KB  (−${(100 - after*100/before).toFixed(0)}%)`);
}

console.log(`\n─────────────────────────────────────────`);
console.log(`Comprimidos:  ${processed}`);
console.log(`Sin cambios:  ${skipped}`);
console.log(`Peso antes:   ${(totalBefore / 1024 / 1024).toFixed(2)} MB`);
console.log(`Peso después: ${(totalAfter / 1024 / 1024).toFixed(2)} MB`);
console.log(`Ahorro:       ${(saved / 1024 / 1024).toFixed(2)} MB  (${totalBefore ? ((saved * 100) / totalBefore).toFixed(0) : 0}%)`);
process.exit(0);

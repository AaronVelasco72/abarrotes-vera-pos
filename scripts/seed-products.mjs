// Carga el catálogo inicial de Abarrotes Vera.
// Idempotente: usa el campo `seedKey` para no duplicar al re-ejecutar.
// Uso:  node scripts/seed-products.mjs

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = resolve(__dirname, "..", "service-account.json");

if (!existsSync(keyPath)) {
  console.error("❌ Falta service-account.json en la raíz del proyecto.");
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
}
const db = getFirestore();

const products = [
  // Refrescos
  { seedKey: "red-cola-3l",       name: "Red Cola 3 LT",                  price: 36, stock: 12, minStock: 4, category: "refresco" },
  { seedKey: "red-cola-600",      name: "Red Cola 600 ml",                price: 16, stock: 18, minStock: 6, category: "refresco" },
  { seedKey: "coca-3l-ret",       name: "Coca-Cola 3 LT retornable",      price: 34, stock: 10, minStock: 4, category: "refresco" },
  { seedKey: "coca-600-des",      name: "Coca-Cola 600 ml desechable",    price: 22, stock: 20, minStock: 6, category: "refresco" },
  { seedKey: "coca-lata-600",     name: "Coca-Cola lata 600 ml",          price: 24, stock: 14, minStock: 6, category: "refresco" },
  { seedKey: "pepsi-black-600",   name: "Pepsi Black 600 ml",             price: 12, stock: 16, minStock: 6, category: "refresco" },
  { seedKey: "pepsi-1.5l",        name: "Pepsi 1.5 LT",                   price: 20, stock: 12, minStock: 4, category: "refresco" },
  { seedKey: "jarritos-2l-lim",   name: "Jarritos 2 LT — Limón",          price: 28, stock: 8,  minStock: 3, category: "refresco" },
  { seedKey: "jarritos-2l-tam",   name: "Jarritos 2 LT — Tamarindo",      price: 28, stock: 8,  minStock: 3, category: "refresco" },
  { seedKey: "jarritos-2l-uva",   name: "Jarritos 2 LT — Uva",            price: 28, stock: 8,  minStock: 3, category: "refresco" },
  { seedKey: "jarritos-2l-tor",   name: "Jarritos 2 LT — Toronja",        price: 28, stock: 8,  minStock: 3, category: "refresco" },
  { seedKey: "jarritos-2l-nar",   name: "Jarritos 2 LT — Naranja",        price: 28, stock: 8,  minStock: 3, category: "refresco" },
  { seedKey: "jarritos-2l-tut",   name: "Jarritos 2 LT — Tuti Fruti",     price: 28, stock: 8,  minStock: 3, category: "refresco" },

  // Agua
  { seedKey: "bonafont-600",      name: "Agua Bonafont 600 ml",           price: 11, stock: 30, minStock: 8, category: "agua" },

  // Alcohol
  { seedKey: "cag-corona",        name: "Caguama Corona",                 price: 47, stock: 12, minStock: 4, category: "alcohol" },
  { seedKey: "cag-victoria",      name: "Caguama Victoria",               price: 47, stock: 12, minStock: 4, category: "alcohol" },
  { seedKey: "cag-modelo-esp",    name: "Caguama Modelo Especial",        price: 52, stock: 10, minStock: 3, category: "alcohol" },
  { seedKey: "lata-corona-250",   name: "Corona lata 250 ml",             price: 28, stock: 18, minStock: 6, category: "alcohol" },
  { seedKey: "lata-victoria-250", name: "Victoria lata 250 ml",           price: 25, stock: 18, minStock: 6, category: "alcohol" },
  { seedKey: "vidrio-corona-chc", name: "Corona chica (vidrio)",          price: 20, stock: 24, minStock: 6, category: "alcohol" },
  { seedKey: "vidrio-victoria-chc", name: "Victoria chica (vidrio)",      price: 20, stock: 24, minStock: 6, category: "alcohol" },

  // Cigarros
  { seedKey: "cig-pallmall-suelto", name: "Cigarro Pall Mall (suelto)",   price: 7,  stock: 40, minStock: 10, category: "cigarros" },
  { seedKey: "cig-marlboro-suelto", name: "Cigarro Marlboro (suelto)",    price: 9,  stock: 40, minStock: 10, category: "cigarros" },

  // Alimento
  { seedKey: "huevo-1kg",         name: "Huevo 1 kg",                     price: 26, stock: 8,  minStock: 3, category: "alimento" },

  // Dulces
  { seedKey: "oreo",              name: "Galletas Oreo",                  price: 22, stock: 18, minStock: 6, category: "dulces" },
  { seedKey: "chicle-orbit",      name: "Chicle Orbit",                   price: 4,  stock: 40, minStock: 12, category: "dulces" },
];

// Index existing seeded products by seedKey for idempotency
const existingSnap = await db.collection("products").where("seedKey", "!=", null).get();
const existingBySeed = new Map();
existingSnap.forEach((d) => {
  const k = d.data().seedKey;
  if (k) existingBySeed.set(k, d.id);
});

let created = 0;
let updated = 0;
for (const p of products) {
  const existingId = existingBySeed.get(p.seedKey);
  if (existingId) {
    await db.collection("products").doc(existingId).set(
      {
        name: p.name,
        price: p.price,
        category: p.category,
        minStock: p.minStock,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    updated++;
    console.log(`↺ ${p.name}`);
  } else {
    await db.collection("products").add({
      ...p,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    created++;
    console.log(`✅ ${p.name}`);
  }
}

console.log(`\n✨ Listo. Creados: ${created} · Actualizados: ${updated}`);
process.exit(0);

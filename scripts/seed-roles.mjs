// Asigna roles en Firestore a usuarios ya existentes en Firebase Auth.
// Uso:  node scripts/seed-roles.mjs
// Requiere: service-account.json en la raíz del proyecto.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = resolve(__dirname, "..", "service-account.json");

if (!existsSync(keyPath)) {
  console.error("❌ Falta service-account.json en la raíz del proyecto.");
  console.error("   Descárgalo en: Firebase Console → ⚙️ Configuración del proyecto");
  console.error("                  → pestaña 'Cuentas de servicio' → Generar nueva clave privada");
  console.error("   Guárdalo como: service-account.json (en la raíz, junto a package.json)");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));

initializeApp({ credential: cert(serviceAccount) });

const auth = getAuth();
const db = getFirestore();

const ROLES = [
  { email: "aracelivelasco28@gmail.com",  role: "admin"   },
  { email: "velascoramirezaaron@gmail.com", role: "cashier" },
];

for (const { email, role } of ROLES) {
  try {
    const user = await auth.getUserByEmail(email);
    await db.collection("users").doc(user.uid).set(
      {
        email,
        role,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    console.log(`✅  ${email}  →  role: ${role}   (uid: ${user.uid})`);
  } catch (err) {
    console.error(`❌  ${email}: ${err.message}`);
  }
}

console.log("\nListo. Reinicia la app si está corriendo y entra con cualquier cuenta.");
process.exit(0);

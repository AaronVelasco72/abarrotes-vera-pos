// Drives the running dev server with Puppeteer to capture screenshots
// of every relevant screen for the academic doc.
//
// Pre-req: dev server on http://localhost:3000
// Run:     node scripts/capture-system.mjs

import puppeteer from "puppeteer";
import { mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = resolve(__dirname, "..", "captures");
if (!existsSync(out)) mkdirSync(out, { recursive: true });

const BASE = "http://localhost:3000";
const VIEWPORTS = {
  desktop: { width: 1440, height: 900,  deviceScaleFactor: 1 },
  mobile:  { width: 390,  height: 844,  deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const ADMIN   = { email: "aracelivelasco28@gmail.com",   password: "Chencho0504*"   };
const CASHIER = { email: "velascoramirezaaron@gmail.com", password: "Chencho050504*" };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: VIEWPORTS.desktop,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("  page error:", e.message));

async function snap(name) {
  const path = resolve(out, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log(`  📸 ${name}.png`);
  return path;
}

async function login(creds) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 });
  await page.type('input[type="email"]', creds.email, { delay: 20 });
  await page.type('input[type="password"]', creds.password, { delay: 20 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15_000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await wait(2000);
}

async function logout() {
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) => /cerrar sesión|salir/i.test(b.textContent || ""),
    );
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!clicked) console.log("  no logout button found");
  await wait(2000);
}

console.log("\n── LOGIN PAGE ─────────────────────");
await page.setViewport(VIEWPORTS.desktop);
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await wait(1500);
await snap("B01-login-desktop");

await page.setViewport(VIEWPORTS.mobile);
await page.reload({ waitUntil: "networkidle2" });
await wait(1500);
await snap("B02-login-mobile");

console.log("\n── CAJERO (POS) ───────────────────");
await page.setViewport(VIEWPORTS.desktop);
await login(CASHIER);
await snap("B03-pos-empty-desktop");

// Click first three product cards to populate cart
await page.evaluate(() => {
  const productButtons = [...document.querySelectorAll("section button")].filter((b) => {
    const txt = b.textContent || "";
    return /\$/.test(txt) && b.offsetWidth > 120;
  });
  productButtons.slice(0, 4).forEach((b) => b.click());
});
await wait(1200);
await snap("B04-pos-cart-with-items-desktop");

// Open pay modal
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find(
    (b) => b.textContent && b.textContent.trim() === "Cobrar" && !b.disabled,
  );
  if (btn) btn.click();
});
await wait(800);
await snap("B05-pos-pay-modal-empty");

// Fill received amount → see change
await page.evaluate(() => {
  const input = document.querySelector('input[type="number"]');
  if (!input) return;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, "200");
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
await wait(700);
await snap("B06-pos-pay-modal-with-change");

// Confirm sale
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find(
    (b) => b.textContent && /confirmar venta/i.test(b.textContent),
  );
  if (btn) btn.click();
});
await wait(2500);
await snap("B07-pos-after-sale");

await logout();

console.log("\n── ADMIN ──────────────────────────");
await page.setViewport(VIEWPORTS.desktop);
await login(ADMIN);
await snap("B08-admin-dashboard-desktop");

// Mobile dashboard
await page.setViewport(VIEWPORTS.mobile);
await wait(800);
await snap("B09-admin-dashboard-mobile");

// Productos desktop
await page.setViewport(VIEWPORTS.desktop);
await page.goto(`${BASE}/admin/productos`, { waitUntil: "networkidle2" });
await wait(2000);
await snap("B10-admin-productos-desktop");

// Productos mobile
await page.setViewport(VIEWPORTS.mobile);
await wait(800);
await snap("B11-admin-productos-mobile");

// Open edit modal (click a product card)
await page.setViewport(VIEWPORTS.desktop);
await page.reload({ waitUntil: "networkidle2" });
await wait(1500);
await page.evaluate(() => {
  const cards = [...document.querySelectorAll("button")].filter((b) => b.offsetWidth > 140 && b.offsetHeight > 200);
  if (cards[0]) cards[0].click();
});
await wait(1200);
await snap("B12-admin-product-edit-modal");

// Close modal
await page.keyboard.press("Escape");
await wait(500);

// Ventas
await page.goto(`${BASE}/admin/ventas`, { waitUntil: "networkidle2" });
await wait(2000);
await snap("B13-admin-ventas-desktop");

// Click first sale → detail modal
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("ul button, li button")].find((b) => b.offsetWidth > 200);
  if (btn) btn.click();
});
await wait(1200);
await snap("B14-admin-sale-detail-modal");

await page.keyboard.press("Escape");
await wait(500);

// Mobile ventas
await page.setViewport(VIEWPORTS.mobile);
await page.reload({ waitUntil: "networkidle2" });
await wait(1500);
await snap("B15-admin-ventas-mobile");

await browser.close();
console.log("\n✅  Capturas listas en captures/");

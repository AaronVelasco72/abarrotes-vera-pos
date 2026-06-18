// Build the academic document for Abarrotes Vera POS.
// Run with:  node scripts/build-docs.mjs
// Output:    docs/Abarrotes_Vera_Documentacion.docx

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType, HeightRule, VerticalAlign,
  PageBreak, TableOfContents, LevelFormat,
  PageNumber, Header, Footer,
} from "docx";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "..", "docs");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
// Append timestamp suffix if the canonical file is locked (Word has it open).
import { writeFileSync as _wfs, openSync, closeSync } from "node:fs";
const baseName = "Abarrotes_Vera_Documentacion";
let outPath = resolve(outDir, `${baseName}.docx`);
try {
  closeSync(openSync(outPath, "r+"));
} catch {
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  outPath = resolve(outDir, `${baseName}_${ts}.docx`);
}

// ─── Palettes ─────────────────────────────────────────────────────
const PAL = {
  navy:    { dark: "1D3279", mid: "2F4FB3", light: "EEF2FB", chip: "172863" },
  teal:    { dark: "0F766E", mid: "14B8A6", light: "F0FDFA", chip: "134E4A" },
  amber:   { dark: "92400E", mid: "F59E0B", light: "FFFBEB", chip: "78350F" },
  rose:    { dark: "9F1239", mid: "F43F5E", light: "FFF1F2", chip: "881337" },
  emerald: { dark: "065F46", mid: "10B981", light: "ECFDF5", chip: "064E3B" },
  violet:  { dark: "5B21B6", mid: "8B5CF6", light: "F5F3FF", chip: "4C1D95" },
  sky:     { dark: "075985", mid: "0EA5E9", light: "F0F9FF", chip: "0C4A6E" },
  slate:   { dark: "1E293B", mid: "64748B", light: "F8FAFC", chip: "0F172A" },
};
const BRAND       = PAL.navy.dark;
const BRAND_DARK  = PAL.navy.chip;
const BRAND_DEEP  = "0A1330";
const BRAND_LIGHT = PAL.navy.light;
const BRAND_RING  = "D6DFF4";
const TEXT_DARK   = "0F172A";
const MUTED       = "64748B";
const GRAY        = "E2E8F0";

const CONTENT_WIDTH = 9360; // US Letter, 1" margins

// ─── Base text helpers ────────────────────────────────────────────
const T = (text, opts = {}) => new TextRun({ text, font: "Arial", color: TEXT_DARK, size: 22, ...opts });

const P = (textOrChildren, opts = {}) => new Paragraph({
  spacing: { before: 80, after: 80, line: 320 },
  alignment: AlignmentType.JUSTIFIED,
  children: Array.isArray(textOrChildren) ? textOrChildren : [T(textOrChildren, opts.run || {})],
});

const H1 = (text, accent = PAL.navy) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 360, after: 160 },
  children: [new TextRun({ text, font: "Arial", color: accent.dark, bold: true, size: 36 })],
  border: { bottom: { color: accent.mid, style: BorderStyle.SINGLE, size: 14, space: 6 } },
});

const H2 = (text, accent = PAL.navy) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 280, after: 100 },
  children: [
    new TextRun({ text: "▍ ", font: "Arial", color: accent.mid, bold: true, size: 28 }),
    new TextRun({ text, font: "Arial", color: accent.chip, bold: true, size: 28 }),
  ],
});

const H3 = (text, accent = PAL.navy) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  spacing: { before: 200, after: 80 },
  children: [new TextRun({ text, font: "Arial", color: accent.chip, bold: true, size: 24 })],
});

const Bullet = (text, opts = {}) => new Paragraph({
  numbering: { reference: "bullets", level: 0 },
  spacing: { before: 40, after: 40, line: 300 },
  children: Array.isArray(text) ? text : [T(text, opts.run || {})],
});

const Num = (text) => new Paragraph({
  numbering: { reference: "numbers", level: 0 },
  spacing: { before: 40, after: 40, line: 300 },
  children: [T(text)],
});

const Code = (lines) => lines.split("\n").map((line) => new Paragraph({
  spacing: { before: 0, after: 0, line: 260 },
  children: [new TextRun({ text: line || " ", font: "Consolas", color: BRAND_DEEP, size: 18 })],
}));

const Spacer = (size = 80) => new Paragraph({ spacing: { before: size, after: size }, children: [T(" ")] });

const Centered = (children) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 60, after: 60 },
  children,
});

// ─── Catálogo de pruebas unitarias ejecutadas ─────────────────────
const UNIT_TESTS_INFO = [
  { id: "TU-01",  file: "money.test.ts",     simple: "Le pedimos a formatMXN(34) que devuelva exactamente la cadena \"$34.00\". Si por error regresa \"$34\" o \"34.00\", la prueba falla." },
  { id: "TU-02",  file: "money.test.ts",     simple: "Verificamos que cero pesos se formatee como \"$0.00\" y no rompa la función." },
  { id: "TU-03",  file: "money.test.ts",     simple: "Pasamos 1234.50 y revisamos que aparezca el separador de miles (\"$1,234.50\")." },
  { id: "TU-04",  file: "money.test.ts",     simple: "Pasamos -50 y revisamos que se conserve el signo negativo: \"-$50.00\"." },
  { id: "TU-05",  file: "cart.test.ts",      simple: "Carrito vacío más una Coca-Cola igual a carrito con una línea con cantidad 1." },
  { id: "TU-06",  file: "cart.test.ts",      simple: "Si la Coca ya estaba en el carrito, agregarla otra vez sube la cantidad de 1 a 2 — no crea una segunda línea duplicada." },
  { id: "TU-07",  file: "cart.test.ts",      simple: "Un producto con stock 0 no se debe poder agregar. La función responde con razón \"sin stock\"." },
  { id: "TU-08",  file: "cart.test.ts",      simple: "Hay 3 Jarritos en stock; intentamos meter un cuarto. La operación falla con razón \"excede stock\" y reporta que solo quedan 3." },
  { id: "TU-09",  file: "cart.test.ts",      simple: "Bajar la cantidad de una línea hasta 0 quita esa línea completa del carrito (no la deja con cantidad 0)." },
  { id: "TU-09b", file: "cart.test.ts",      simple: "Si intentas subir la cantidad de golpe más allá del stock, la operación falla." },
  { id: "TU-10",  file: "cart.test.ts",      simple: "Carrito con 2 Cocas (22 c/u) y 1 Jarritos (28) debe dar total $72 exacto." },
  { id: "TU-11",  file: "cart.test.ts",      simple: "Conteo de artículos: 2 Cocas más 3 Jarritos igual a 5 artículos." },
  { id: "TU-11b", file: "cart.test.ts",      simple: "Carrito vacío: total cero, artículos cero." },
  { id: "TU-12",  file: "cart.test.ts",      simple: "Quitar la línea de Coca por su ID deja solamente la línea de Jarritos en el carrito." },
  { id: "TU-13",  file: "payment.test.ts",   simple: "Pagando con tarjeta o transferencia, el cambio siempre es $0 — no aplica concepto de cambio." },
  { id: "TU-14",  file: "payment.test.ts",   simple: "Cuenta de $72; el cliente paga $100 en efectivo. El cambio debe ser exactamente $28." },
  { id: "TU-15",  file: "payment.test.ts",   simple: "Si el cliente paga menos del total ($50 sobre $100), el cambio NUNCA debe ser negativo; queda en $0." },
  { id: "TU-16",  file: "payment.test.ts",   simple: "El sistema no debe permitir confirmar una venta con total $0. Esto previene cobros vacíos por error del cajero." },
  { id: "TU-17",  file: "payment.test.ts",   simple: "En tarjeta o transferencia, mientras el total sea positivo se puede confirmar (no pedimos monto recibido)." },
  { id: "TU-18",  file: "payment.test.ts",   simple: "En efectivo: si pagan exacto se confirma; si pagan más también; si pagan menos NO. Probamos los tres escenarios." },
  { id: "TU-19",  file: "categories.test.ts", simple: "Confirmamos que existan las 8 categorías declaradas: refresco, alcohol, agua, cigarros, lácteos, alimento, dulces, otros." },
  { id: "TU-19b", file: "categories.test.ts", simple: "Cada categoría tiene su información completa: etiqueta, clases de color/fondo/anillo y función de ícono." },
];

// ─── Carga de capturas del Anexo B (Puppeteer) ────────────────────
const CAPTURES_DIR = resolve(__dirname, "..", "captures");
async function loadCapture(filename) {
  const p = resolve(CAPTURES_DIR, filename);
  if (!existsSync(p)) return null;
  const buf = readFileSync(p);
  const meta = await sharp(buf).metadata();
  return { name: filename, buf, width: meta.width, height: meta.height };
}

const CAPTURES = {
  B01: await loadCapture("B01-login-desktop.png"),
  B02: await loadCapture("B02-login-mobile.png"),
  B03: await loadCapture("B03-pos-empty-desktop.png"),
  B04: await loadCapture("B04-pos-cart-with-items-desktop.png"),
  B05: await loadCapture("B05-pos-pay-modal-empty.png"),
  B06: await loadCapture("B06-pos-pay-modal-with-change.png"),
  B07: await loadCapture("B07-pos-after-sale.png"),
  B08: await loadCapture("B08-admin-dashboard-desktop.png"),
  B09: await loadCapture("B09-admin-dashboard-mobile.png"),
  B10: await loadCapture("B10-admin-productos-desktop.png"),
  B11: await loadCapture("B11-admin-productos-mobile.png"),
  B12: await loadCapture("B12-admin-product-edit-modal.png"),
  B13: await loadCapture("B13-admin-ventas-desktop.png"),
  B14: await loadCapture("B14-admin-sale-detail-modal.png"),
  B15: await loadCapture("B15-admin-ventas-mobile.png"),
};

// ─── Catálogo de pruebas funcionales con Postman ──────────────────
const FUNCTIONAL_TESTS_INFO = [
  { id: "TF-01", titulo: "Sign In como Admin",                 simple: "Probamos que la administradora (Araceli) se autentique con su correo y contraseña reales contra Firebase Authentication. La API debe responder HTTP 200 y entregar un idToken (un token de sesión) que reusamos en las demás peticiones." },
  { id: "TF-02", titulo: "Sign In como Cajero",                simple: "Mismo flujo de autenticación pero con la cuenta del cajero (Aaron). Verifica que ambas cuentas reales pueden iniciar sesión sin problemas." },
  { id: "TF-03", titulo: "Sign In con credenciales inválidas", simple: "Intentamos autenticarnos con un password incorrecto a propósito. Esperamos un HTTP 400 con error INVALID_LOGIN_CREDENTIALS. Es una prueba negativa: el éxito significa recibir el rechazo." },
  { id: "TF-04", titulo: "Listar productos SIN token",         simple: "Pedimos la colección /products sin enviar el header Authorization. Esperamos HTTP 401 (PERMISSION_DENIED). Demuestra que las reglas de Firestore (RNF-06) bloquean cualquier acceso sin sesión." },
  { id: "TF-05", titulo: "Listar productos CON token admin",   simple: "Mismo endpoint pero ya con el idToken del admin en el header. Esperamos HTTP 200 y un array con los 26 productos del catálogo. Confirma RF-04 desde el backend." },
  { id: "TF-06", titulo: "Obtener un producto específico",     simple: "Leemos un producto individual por su ID (capturado por el test anterior). Verificamos que el documento devuelva los campos name, price, stock y category. Valida la estructura del modelo de datos." },
  { id: "TF-07", titulo: "Listar ventas (sales)",              simple: "Pedimos la colección /sales. Si todavía no hay ventas registradas, Firestore responde con objeto vacío (también es resultado válido). Confirma que el endpoint del histórico está accesible y autenticado." },
];

// ─── Callout box (left-bordered tinted box) ───────────────────────
function Note({ title, body, accent = PAL.sky }) {
  const lines = Array.isArray(body) ? body : [body];
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    rows: [new TableRow({
      children: [new TableCell({
        borders: {
          top:    { style: BorderStyle.NONE,   size: 0, color: "FFFFFF" },
          bottom: { style: BorderStyle.NONE,   size: 0, color: "FFFFFF" },
          right:  { style: BorderStyle.NONE,   size: 0, color: "FFFFFF" },
          left:   { style: BorderStyle.SINGLE, size: 36, color: accent.mid },
        },
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        shading: { fill: accent.light, type: ShadingType.CLEAR },
        margins: { top: 180, bottom: 180, left: 280, right: 280 },
        children: [
          new Paragraph({
            spacing: { after: 60 },
            children: [new TextRun({ text: title, font: "Arial", bold: true, color: accent.dark, size: 22 })],
          }),
          ...lines.map((line) => new Paragraph({
            spacing: { before: 40, after: 40, line: 280 },
            alignment: AlignmentType.JUSTIFIED,
            children: [T(line, { size: 20 })],
          })),
        ],
      })],
    })],
  });
}

// ─── Cell + table helpers (palette-aware) ─────────────────────────
const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: GRAY };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function Cell({ width, fill = "FFFFFF", children }) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    children: Array.isArray(children) ? children : [children],
  });
}

function makeTable({ widths, header, rows, accent = PAL.navy, zebra = true }) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: header.map((label, i) => Cell({
      width: widths[i],
      fill: accent.dark,
      children: new Paragraph({
        children: [new TextRun({ text: label, bold: true, font: "Arial", size: 20, color: "FFFFFF" })],
      }),
    })),
  });
  const dataRows = rows.map((r, ri) => new TableRow({
    children: r.map((val, i) => {
      const isNode = typeof val === "object" && !Array.isArray(val);
      const fill = zebra && ri % 2 === 1 ? accent.light : "FFFFFF";
      const children = Array.isArray(val)
        ? val
        : isNode
          ? [val]
          : [new Paragraph({
              spacing: { before: 20, after: 20 },
              children: [T(String(val), { size: 20 })],
            })];
      return Cell({ width: widths[i], fill, children });
    }),
  }));
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...dataRows],
  });
}

// ─── Embed a real PNG capture as an image in the document ─────────
function embedCapture(cap, caption) {
  if (!cap) {
    return [
      new Paragraph({
        spacing: { before: 200, after: 40 },
        children: [new TextRun({ text: caption, font: "Arial", bold: true, color: PAL.slate.dark, size: 22 })],
      }),
      new Paragraph({
        spacing: { before: 0, after: 200 },
        children: [new TextRun({ text: "[Captura no disponible — falta archivo PNG]", font: "Arial", italics: true, color: "B91C1C", size: 18 })],
      }),
    ];
  }
  const isPortrait = cap.height > cap.width;
  const maxWidth = isPortrait ? 280 : 600;
  const width = Math.min(cap.width, maxWidth);
  const height = Math.round((width * cap.height) / cap.width);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 160, after: 40 },
      children: [new ImageRun({
        type: "png",
        data: cap.buf,
        transformation: { width, height },
        altText: { title: caption, description: caption, name: cap.name },
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
      children: [new TextRun({ text: caption, font: "Arial", italics: true, color: MUTED, size: 18 })],
    }),
  ];
}

// ─── Image placeholder (drop-zone for user to paste a screenshot) ─
function ImagePlaceholder({ figureId, caption, accent = PAL.slate, height = 4400 }) {
  return [
    new Paragraph({
      spacing: { before: 200, after: 40 },
      children: [new TextRun({ text: figureId, font: "Arial", bold: true, color: accent.dark, size: 22 })],
    }),
    new Paragraph({
      spacing: { before: 0, after: 120 },
      children: [new TextRun({ text: caption, font: "Arial", color: TEXT_DARK, size: 20, italics: true })],
    }),
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [CONTENT_WIDTH],
      rows: [new TableRow({
        height: { value: height, rule: HeightRule.ATLEAST },
        children: [new TableCell({
          borders: {
            top:    { style: BorderStyle.DASHED, size: 14, color: accent.mid },
            bottom: { style: BorderStyle.DASHED, size: 14, color: accent.mid },
            left:   { style: BorderStyle.DASHED, size: 14, color: accent.mid },
            right:  { style: BorderStyle.DASHED, size: 14, color: accent.mid },
          },
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          shading: { fill: accent.light, type: ShadingType.CLEAR },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 700, bottom: 700, left: 240, right: 240 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "[ Pega aquí tu captura ]", font: "Arial", color: accent.dark, size: 24, italics: true, bold: true })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 100 },
              children: [new TextRun({ text: "En Word: click dentro del recuadro y oprime Ctrl+V con la imagen copiada.", font: "Arial", color: MUTED, size: 18 })],
            }),
          ],
        })],
      })],
    }),
    Spacer(120),
  ];
}

// helpers for cell content
const cellPara = (str, opts = {}) => new Paragraph({
  spacing: { before: 20, after: 20 },
  children: [T(String(str), { size: 20, ...opts })],
});
const cellBullets = (items) => items.map((it) => new Paragraph({
  numbering: { reference: "bullets", level: 0 },
  spacing: { before: 0, after: 40, line: 260 },
  children: [T(it, { size: 19 })],
}));

// ─── SVG Architecture Diagram ─────────────────────────────────────
const ARCH_SVG = `
<svg width="900" height="720" viewBox="0 0 900 720" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arr" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L9,3 L0,6 z" fill="#475569"/>
    </marker>
    <marker id="arrA" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L9,3 L0,6 z" fill="#D97706"/>
    </marker>
    <linearGradient id="appGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#243F93"/>
      <stop offset="100%" stop-color="#101D4A"/>
    </linearGradient>
  </defs>

  <rect width="900" height="720" fill="#FAFBFE"/>

  <!-- title -->
  <text x="450" y="34" font-family="Arial" font-size="20" font-weight="bold" text-anchor="middle" fill="#1D3279">Arquitectura del Sistema</text>
  <text x="450" y="54" font-family="Arial" font-size="12" text-anchor="middle" fill="#64748B">Abarrotes Vera POS — Cliente Web sobre Firebase (BaaS) desplegado en Vercel</text>

  <!-- Clients -->
  <g>
    <rect x="60" y="90" width="320" height="120" rx="14" fill="#E0F2FE" stroke="#0284C7" stroke-width="2"/>
    <circle cx="100" cy="130" r="16" fill="#0284C7"/>
    <text x="100" y="136" font-family="Arial" font-size="15" font-weight="bold" text-anchor="middle" fill="white">A</text>
    <text x="130" y="120" font-family="Arial" font-size="14" font-weight="bold" fill="#075985">Cajero — Desktop</text>
    <text x="130" y="138" font-family="Arial" font-size="11" fill="#0369A1">Aaron · estación de cobro</text>
    <text x="80" y="170" font-family="Arial" font-size="11" fill="#0C4A6E">→ Ruta /pos · pantalla amplia</text>
    <text x="80" y="188" font-family="Arial" font-size="11" fill="#0C4A6E">→ Escáner USB + atajos de teclado</text>

    <rect x="520" y="90" width="320" height="120" rx="14" fill="#F3E8FF" stroke="#9333EA" stroke-width="2"/>
    <circle cx="560" cy="130" r="16" fill="#9333EA"/>
    <text x="560" y="136" font-family="Arial" font-size="15" font-weight="bold" text-anchor="middle" fill="white">V</text>
    <text x="590" y="120" font-family="Arial" font-size="14" font-weight="bold" fill="#6B21A8">Administradora — Móvil</text>
    <text x="590" y="138" font-family="Arial" font-size="11" fill="#7E22CE">Araceli · gestión y métricas</text>
    <text x="540" y="170" font-family="Arial" font-size="11" fill="#581C87">→ Ruta /admin · responsive</text>
    <text x="540" y="188" font-family="Arial" font-size="11" fill="#581C87">→ Accesible desde cualquier lugar</text>
  </g>

  <!-- arrows clients → app -->
  <path d="M 220 210 L 360 285" stroke="#94A3B8" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <path d="M 680 210 L 540 285" stroke="#94A3B8" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <text x="240" y="258" font-family="Arial" font-size="10" fill="#475569">HTTPS</text>
  <text x="640" y="258" font-family="Arial" font-size="10" fill="#475569">HTTPS</text>

  <!-- App tier -->
  <g>
    <rect x="130" y="285" width="640" height="160" rx="14" fill="url(#appGrad)"/>
    <text x="450" y="313" font-family="Arial" font-size="16" font-weight="bold" text-anchor="middle" fill="white">Aplicación Next.js 14 (App Router)</text>
    <text x="450" y="332" font-family="Arial" font-size="11" text-anchor="middle" fill="#D6DFF4">React 18 · TypeScript · Tailwind CSS · Hooks + onSnapshot</text>

    <rect x="150" y="350" width="120" height="75" rx="8" fill="#172863" stroke="#2F4FB3"/>
    <text x="210" y="376" font-family="Arial" font-size="12" font-weight="bold" text-anchor="middle" fill="white">AuthContext</text>
    <text x="210" y="395" font-family="Arial" font-size="10" text-anchor="middle" fill="#AAB9E6">sesión + rol</text>
    <text x="210" y="412" font-family="Arial" font-size="9" text-anchor="middle" fill="#7B92D7">/login → /pos · /admin</text>

    <rect x="280" y="350" width="120" height="75" rx="8" fill="#172863" stroke="#2F4FB3"/>
    <text x="340" y="376" font-family="Arial" font-size="12" font-weight="bold" text-anchor="middle" fill="white">Pantalla POS</text>
    <text x="340" y="395" font-family="Arial" font-size="10" text-anchor="middle" fill="#AAB9E6">carrito + cobro</text>
    <text x="340" y="412" font-family="Arial" font-size="9" text-anchor="middle" fill="#7B92D7">modal con cambio</text>

    <rect x="410" y="350" width="120" height="75" rx="8" fill="#172863" stroke="#2F4FB3"/>
    <text x="470" y="376" font-family="Arial" font-size="12" font-weight="bold" text-anchor="middle" fill="white">Panel Admin</text>
    <text x="470" y="395" font-family="Arial" font-size="10" text-anchor="middle" fill="#AAB9E6">CRUD + reportes</text>
    <text x="470" y="412" font-family="Arial" font-size="9" text-anchor="middle" fill="#7B92D7">alertas inventario</text>

    <rect x="540" y="350" width="120" height="75" rx="8" fill="#172863" stroke="#2F4FB3"/>
    <text x="600" y="376" font-family="Arial" font-size="12" font-weight="bold" text-anchor="middle" fill="white">sales.ts</text>
    <text x="600" y="395" font-family="Arial" font-size="10" text-anchor="middle" fill="#AAB9E6">runTransaction</text>
    <text x="600" y="412" font-family="Arial" font-size="9" text-anchor="middle" fill="#7B92D7">descuento atómico</text>

    <rect x="670" y="350" width="85" height="75" rx="8" fill="#172863" stroke="#2F4FB3"/>
    <text x="712" y="376" font-family="Arial" font-size="11" font-weight="bold" text-anchor="middle" fill="white">categories</text>
    <text x="712" y="395" font-family="Arial" font-size="9" text-anchor="middle" fill="#AAB9E6">SVG icons</text>
    <text x="712" y="412" font-family="Arial" font-size="9" text-anchor="middle" fill="#7B92D7">8 grupos</text>
  </g>

  <!-- arrow to firebase -->
  <path d="M 450 445 L 450 490" stroke="#475569" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <text x="465" y="475" font-family="Arial" font-size="11" fill="#475569">Firebase Web SDK</text>

  <!-- Firebase wrapper -->
  <g>
    <rect x="80" y="500" width="740" height="120" rx="14" fill="#FFF7ED" stroke="#EA580C" stroke-width="2"/>
    <text x="105" y="520" font-family="Arial" font-size="13" font-weight="bold" fill="#9A3412">Google Firebase  (Backend as a Service)</text>

    <rect x="110" y="530" width="200" height="78" rx="10" fill="white" stroke="#FB923C" stroke-width="1.5"/>
    <text x="210" y="554" font-family="Arial" font-size="13" font-weight="bold" text-anchor="middle" fill="#9A3412">Authentication</text>
    <text x="210" y="574" font-family="Arial" font-size="10" text-anchor="middle" fill="#7C2D12">Email + Password</text>
    <text x="210" y="592" font-family="Arial" font-size="10" text-anchor="middle" fill="#7C2D12">Roles: cashier · admin</text>

    <rect x="330" y="530" width="240" height="78" rx="10" fill="white" stroke="#FB923C" stroke-width="1.5"/>
    <text x="450" y="554" font-family="Arial" font-size="13" font-weight="bold" text-anchor="middle" fill="#9A3412">Cloud Firestore</text>
    <text x="450" y="574" font-family="Arial" font-size="10" text-anchor="middle" fill="#7C2D12">products · sales · users</text>
    <text x="450" y="592" font-family="Arial" font-size="10" text-anchor="middle" fill="#7C2D12">Realtime + transacciones atómicas</text>

    <rect x="590" y="530" width="200" height="78" rx="10" fill="white" stroke="#FB923C" stroke-width="1.5"/>
    <text x="690" y="554" font-family="Arial" font-size="13" font-weight="bold" text-anchor="middle" fill="#9A3412">Cloud Storage</text>
    <text x="690" y="574" font-family="Arial" font-size="10" text-anchor="middle" fill="#7C2D12">Imágenes de SKU</text>
    <text x="690" y="592" font-family="Arial" font-size="10" text-anchor="middle" fill="#7C2D12">Security Rules</text>
  </g>

  <!-- Vercel -->
  <g>
    <rect x="20" y="285" width="80" height="160" rx="10" fill="#0F172A"/>
    <text x="60" y="313" font-family="Arial" font-size="14" font-weight="bold" text-anchor="middle" fill="white">Vercel</text>
    <text x="60" y="338" font-family="Arial" font-size="10" text-anchor="middle" fill="#94A3B8">Edge CDN</text>
    <text x="60" y="356" font-family="Arial" font-size="10" text-anchor="middle" fill="#94A3B8">global</text>
    <text x="60" y="380" font-family="Arial" font-size="10" text-anchor="middle" fill="#94A3B8">CI/CD</text>
    <text x="60" y="398" font-family="Arial" font-size="10" text-anchor="middle" fill="#94A3B8">main → deploy</text>
    <circle cx="55" cy="425" r="3" fill="#10B981"/>
    <text x="68" y="429" font-family="Arial" font-size="9" fill="#10B981">live</text>
  </g>
  <path d="M 100 365 L 130 365" stroke="#94A3B8" stroke-width="2" fill="none" marker-end="url(#arr)"/>

  <!-- GitHub -->
  <g>
    <rect x="800" y="285" width="80" height="160" rx="10" fill="#1E293B"/>
    <text x="840" y="313" font-family="Arial" font-size="14" font-weight="bold" text-anchor="middle" fill="white">GitHub</text>
    <text x="840" y="338" font-family="Arial" font-size="10" text-anchor="middle" fill="#94A3B8">repo</text>
    <text x="840" y="356" font-family="Arial" font-size="10" text-anchor="middle" fill="#94A3B8">público</text>
    <text x="840" y="380" font-family="Arial" font-size="10" text-anchor="middle" fill="#94A3B8">webhook</text>
    <text x="840" y="398" font-family="Arial" font-size="10" text-anchor="middle" fill="#94A3B8">→ Vercel</text>
  </g>
  <path d="M 800 365 L 770 365" stroke="#94A3B8" stroke-width="2" fill="none" marker-end="url(#arr)"/>

  <!-- Future Mercado Pago -->
  <g>
    <rect x="130" y="650" width="640" height="56" rx="10" fill="#FEF3C7" stroke="#D97706" stroke-width="2" stroke-dasharray="6,4"/>
    <text x="450" y="672" font-family="Arial" font-size="13" font-weight="bold" text-anchor="middle" fill="#92400E">Mercado Pago Point API   (futura iteración)</text>
    <text x="450" y="691" font-family="Arial" font-size="10" text-anchor="middle" fill="#A16207">Registro automático de cobros con tarjeta vía terminal TPV física</text>
  </g>
  <path d="M 450 620 L 450 650" stroke="#D97706" stroke-width="2" stroke-dasharray="4,4" fill="none" marker-end="url(#arrA)"/>
</svg>
`.trim();

// ─── Cover Page ───────────────────────────────────────────────────
function coverPage() {
  return [
    new Paragraph({ spacing: { before: 1200, after: 0 }, children: [T(" ")] }),
    Centered([new TextRun({ text: "ABARROTES VERA", font: "Arial", color: BRAND, bold: true, size: 80 })]),
    Centered([new TextRun({ text: "Tradición y Calidad · CDMX · Nezahualcóyotl", font: "Arial", color: MUTED, size: 22 })]),
    Spacer(), Spacer(),
    Centered([new TextRun({ text: "Sistema de Punto de Venta Web-Móvil", font: "Arial", color: BRAND_DARK, bold: true, size: 44 })]),
    Centered([new TextRun({ text: "Documentación del Desarrollo y Plan de Pruebas", font: "Arial", color: TEXT_DARK, size: 28 })]),
    Spacer(), Spacer(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: {
        top:    { style: BorderStyle.SINGLE, size: 8, color: BRAND_RING, space: 8 },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: BRAND_RING, space: 8 },
      },
      spacing: { before: 200, after: 200 },
      children: [new TextRun({ text: "Asignatura — Pruebas de Software", font: "Arial", bold: true, color: BRAND, size: 28 })],
    }),
    Spacer(),
    Centered([new TextRun({ text: "Equipo de Desarrollo", font: "Arial", bold: true, color: TEXT_DARK, size: 22 })]),
    Centered([new TextRun({ text: "Aaron Velasco Ramírez", font: "Arial", color: TEXT_DARK, size: 22 })]),
    Centered([new TextRun({ text: "[Integrante 2]", font: "Arial", color: MUTED, size: 22 })]),
    Centered([new TextRun({ text: "[Integrante 3]", font: "Arial", color: MUTED, size: 22 })]),
    Centered([new TextRun({ text: "[Integrante 4]", font: "Arial", color: MUTED, size: 22 })]),
    Spacer(), Spacer(),
    Centered([new TextRun({ text: "Fecha de Entrega: 19 de Junio de 2026", font: "Arial", bold: true, color: BRAND_DARK, size: 22 })]),
    Spacer(),
    Centered([
      new TextRun({ text: "Repositorio:  ", font: "Arial", color: MUTED, size: 20 }),
      new TextRun({ text: "github.com/AaronVelasco72/abarrotes-vera-pos", font: "Consolas", color: BRAND, size: 20 }),
    ]),
    Centered([
      new TextRun({ text: "Aplicación:  ", font: "Arial", color: MUTED, size: 20 }),
      new TextRun({ text: "abarrotes-vera-pos.vercel.app", font: "Consolas", color: BRAND, size: 20 }),
    ]),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ─── Table of Contents ────────────────────────────────────────────
function tocPage() {
  return [
    H1("Índice"),
    new TableOfContents("Índice de contenidos", { hyperlink: true, headingStyleRange: "1-3" }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ─── Section 1 ────────────────────────────────────────────────────
function section1() {
  return [
    H1("1. Introducción"),

    H2("1.1 Objetivo del Proyecto", PAL.navy),
    P("Diseñar, desarrollar e implementar un sistema de punto de venta web-móvil para Abarrotes Vera, una tienda de abarrotes familiar ubicada en Nezahualcóyotl, Estado de México, operada por Aaron Velasco Ramírez —integrante de este equipo— y su hermana Araceli Velasco Ramírez."),
    P("La tienda opera hoy con un punto de venta de marca Yomp instalado en una tableta. Aunque funcional en lo básico, la herramienta ha mostrado deficiencias importantes que se documentan a continuación, y que motivan la construcción de un sistema propio que las atienda."),

    Note({
      accent: PAL.rose,
      title: "Problemas observados en la operación actual con Yomp",
      body: [
        "Inventario inexistente. El sistema no obliga a registrar la mercancía, por lo que el control de existencias se lleva en libretas. No hay forma de saber con certeza cuántos refrescos quedan ni cuándo conviene reabastecer.",
        "Manipulación de precios por personal. Un trabajador con acceso al perfil del cajero alcanzó a modificar precios al alza durante turnos, cobrando más caro de lo establecido y conservando la diferencia.",
        "Robo hormiga sin detección. Al no haber descuento automático de inventario, la merma por consumo o sustracción del personal pasa inadvertida durante semanas, hasta el conteo físico.",
        "Falta de visibilidad remota. Araceli, como administradora, no puede ver cómo va la tienda sin estar físicamente presente. No hay un tablero que le diga cuánto se ha vendido en el día ni qué productos están moviéndose más.",
        "Interfaz lenta y poco optimizada. La aplicación de la tableta tarda varios segundos en buscar productos y los cobros se demoran más de lo necesario, generando filas en horarios pico.",
      ],
    }),

    P("Este proyecto da respuesta directa a las problemáticas anteriores mediante una aplicación web responsiva que se ejecuta tanto en computadora —estación del cajero— como en dispositivo móvil —panel administrativo de la dueña— y que permite:"),
    Bullet("Registrar ventas de forma rápida y exacta, con cálculo automático del cambio en pantalla grande."),
    Bullet("Mantener el inventario al día de manera transparente, descontando automáticamente con cada venta confirmada (cierra la puerta al robo hormiga)."),
    Bullet("Operar con dos perfiles diferenciados —cajero y administrador— donde sólo el administrador puede modificar precios y catálogo, eliminando la posibilidad de fraude del personal."),
    Bullet("Generar alertas configurables cuando un producto se aproxima a su existencia mínima."),
    Bullet("Disponer en cualquier momento de un tablero remoto con métricas del día, accesible desde el celular de Araceli sin necesidad de estar en la tienda."),
    P("Adicionalmente, el proyecto se desarrolla en el marco de la asignatura Pruebas de Software, por lo que su segundo objetivo es servir como Sistema Bajo Prueba para aplicar de manera práctica las metodologías, niveles y herramientas de prueba estudiados durante el curso, desde pruebas unitarias hasta pruebas de aceptación alfa con la usuaria final real."),

    H2("1.2 Alcance del Proyecto", PAL.navy),
    H3("Dentro del alcance"),
    Bullet("Aplicación web responsiva con experiencia diferenciada para escritorio (cajero) y móvil (administrador)."),
    Bullet("Autenticación con correo y contraseña, con dos roles —cajero y administrador— y enrutamiento condicional según rol."),
    Bullet("CRUD completo de productos: alta, edición, baja, búsqueda por nombre, SKU o código de barras."),
    Bullet("Subida de imagen por SKU al almacén en la nube y visualización en pantallas del cajero y del administrador."),
    Bullet("Catálogo categorizado en ocho grupos con íconos SVG e identidad cromática propia."),
    Bullet("Pantalla de cobro con tres métodos de pago (efectivo por defecto, tarjeta y transferencia), cálculo automático del cambio y registro atómico de la venta."),
    Bullet("Descuento automático del inventario mediante transacción atómica con validación de existencias."),
    Bullet("Tablero administrativo en tiempo real con ventas del día, métodos de pago, ventas por categoría, top de productos y alertas de inventario."),
    Bullet("Historial de ventas con detalle por ticket."),
    Bullet("Sincronización en tiempo real entre dispositivos con sesión abierta."),
    Bullet("Despliegue productivo en Vercel con integración continua desde GitHub público."),

    H3("Fuera del alcance (futuras iteraciones)"),
    Bullet("Integración con la terminal Mercado Pago Point para registro automático de pagos con tarjeta."),
    Bullet("Lectura de códigos de barras con hardware físico (la interfaz ya está preparada)."),
    Bullet("Facturación electrónica CFDI."),
    Bullet("Múltiples sucursales."),
    Bullet("Módulo de proveedores y órdenes de compra."),

    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ─── Section 2 ────────────────────────────────────────────────────
function section2(diagramPngBuffer) {
  return [
    H1("2. Documentación del Desarrollo de la Aplicación", PAL.teal),

    H2("2.1 Metodología de Desarrollo", PAL.teal),
    P("El proyecto se desarrolló bajo una adaptación ligera del marco de trabajo Scrum, ajustada al tamaño reducido del equipo y al ciclo académico. Scrum fue elegido sobre alternativas como cascada o Kanban puro por tres razones."),
    Num("Los requerimientos no estaban cerrados desde el inicio: surgieron y se refinaron al observar el proceso real de la tienda y al hablar con Araceli durante las iteraciones; Scrum reconoce esta realidad y la formaliza."),
    Num("El producto se entrega en partes funcionales (incrementos) que pueden demostrarse al final de cada sprint, lo cual encaja con la lógica académica de mostrar avances revisables."),
    Num("La asignatura exige validar el sistema con pruebas en distintos niveles, y el ciclo Scrum coincide con el ciclo PDCA: planear → hacer → revisar → ajustar."),

    Note({
      accent: PAL.teal,
      title: "¿Qué es Scrum en pocas palabras?",
      body: "Scrum es un marco de trabajo ágil que organiza el desarrollo en periodos cortos llamados sprints, al término de los cuales se entrega una versión funcional del producto. Define tres roles (Product Owner, Scrum Master, Equipo de Desarrollo), tres artefactos (Product Backlog, Sprint Backlog, Incremento) y cinco eventos (Planning, Daily, Review, Retrospective y el propio Sprint).",
    }),

    H3("Adaptación de los roles de Scrum al equipo"),
    makeTable({
      accent: PAL.teal,
      widths: [2400, 3360, 3600],
      header: ["Rol de Scrum", "Persona en este proyecto", "Responsabilidad principal"],
      rows: [
        ["Product Owner", "Araceli Velasco (usuaria final)", "Define las prioridades del negocio, valida cada incremento, decide qué entra al backlog."],
        ["Scrum Master + Dev Team", "Aaron Velasco + integrantes del equipo", "Facilita los eventos, escribe el código, ejecuta pruebas y resuelve los impedimentos."],
        ["Stakeholders", "Docente de la asignatura", "Recibe la entrega final y evalúa contra la rúbrica."],
      ],
    }),
    Spacer(),

    H3("Sprints ejecutados"),
    P("El proyecto se organizó en cinco sprints cortos, cada uno con un objetivo claro y un incremento demostrable. Al término de cada sprint hubo demo a la Product Owner y se incorporaron sus observaciones al backlog del siguiente."),
    makeTable({
      accent: PAL.teal,
      widths: [1200, 4000, 4160],
      header: ["Sprint", "Objetivo principal", "Incremento entregado"],
      rows: [
        ["Sprint 0", "Cimiento técnico del proyecto.", "Repositorio en GitHub, Next.js + Tailwind + TypeScript inicializados, Firebase Auth con dos roles, login funcional."],
        ["Sprint 1", "Flujo del cajero (caso de uso principal).", "Pantalla /pos con catálogo, carrito, métodos de pago, cálculo de cambio en grande, atajos de teclado."],
        ["Sprint 2", "Gestión del catálogo.", "CRUD de productos en /admin con subida de fotos a Cloud Storage, ocho categorías con íconos SVG, alertas de mínimo."],
        ["Sprint 3", "Visibilidad para la administradora.", "Dashboard con ventas del día, método de pago, ventas por categoría y top de productos en tiempo real."],
        ["Sprint 4", "Pulido, despliegue y documentación.", "Logo y branding, layout sticky del carrito, despliegue en Vercel, documento académico y plan de pruebas."],
      ],
    }),
    Spacer(),

    H3("Ciclo de trabajo de cada sprint"),
    Bullet("Sprint Planning. Al inicio del sprint se selecciona el conjunto de historias del backlog que se van a abordar."),
    Bullet("Iteración. Codificación y pruebas locales; cada cambio se sube al repositorio en commits descriptivos que sirven de trazabilidad."),
    Bullet("Demo. Al cierre se muestra a la Product Owner el incremento desde un dispositivo real (cajero en escritorio, admin en móvil)."),
    Bullet("Retrospectiva. Breve revisión del equipo: qué funcionó, qué entorpeció, qué ajustar para el siguiente sprint."),

    H2("2.2 Requerimientos del Sistema", PAL.teal),
    P("Los requerimientos se construyeron a partir de una encuesta breve a los dos operadores reales de la tienda, complementada con la observación directa del proceso de venta durante una jornada normal."),
    H3("Requerimientos funcionales"),
    makeTable({
      accent: PAL.teal,
      widths: [900, 6600, 1860],
      header: ["ID", "Requerimiento", "Prioridad"],
      rows: [
        ["RF-01", "El sistema debe permitir el inicio de sesión con correo y contraseña.", "Alta"],
        ["RF-02", "El sistema debe diferenciar dos roles: cajero y administrador.", "Alta"],
        ["RF-03", "El sistema debe redirigir al usuario a su pantalla principal según su rol.", "Alta"],
        ["RF-04", "El cajero debe poder buscar productos por nombre o código de barras.", "Alta"],
        ["RF-05", "El cajero debe poder agregar productos al carrito con un click o lectura de código.", "Alta"],
        ["RF-06", "El sistema debe impedir agregar al carrito un producto sin existencias.", "Alta"],
        ["RF-07", "El sistema debe calcular el total del carrito en tiempo real.", "Alta"],
        ["RF-08", "Al cobrar en efectivo, el sistema debe pedir el monto recibido y mostrar el cambio.", "Alta"],
        ["RF-09", "El sistema debe ofrecer tarjeta y transferencia como métodos alternos de pago.", "Media"],
        ["RF-10", "El descuento del inventario debe ocurrir únicamente al confirmar la venta.", "Alta"],
        ["RF-11", "La venta debe registrarse de forma atómica (todo o nada).", "Alta"],
        ["RF-12", "El administrador debe poder crear, editar y eliminar productos.", "Alta"],
        ["RF-13", "El administrador debe poder subir una imagen por producto.", "Media"],
        ["RF-14", "El administrador debe poder definir un mínimo de alerta por producto.", "Media"],
        ["RF-15", "El sistema debe mostrar alertas cuando un producto esté bajo el mínimo configurado.", "Alta"],
        ["RF-16", "El administrador debe ver un dashboard con métricas del día.", "Alta"],
        ["RF-17", "El administrador debe consultar el histórico de ventas con detalle por ticket.", "Media"],
      ],
    }),
    Spacer(),

    H3("Requerimientos no funcionales"),
    makeTable({
      accent: PAL.rose,
      widths: [900, 5600, 2860],
      header: ["ID", "Requerimiento", "Métrica / Objetivo"],
      rows: [
        ["RNF-01", "Tiempo de respuesta del POS en operaciones normales.", "Menor a 1 segundo"],
        ["RNF-02", "La aplicación debe ser responsiva: 1280 px (desktop) a 360 px (móvil).", "Diseño responsivo verificado"],
        ["RNF-03", "Sincronización en tiempo real entre cajero y administrador.", "Latencia menor a 2 s"],
        ["RNF-04", "Disponibilidad durante el horario comercial.", "Uptime ≥ 99 %"],
        ["RNF-05", "Credenciales almacenadas vía proveedor externo seguro.", "Firebase Authentication"],
        ["RNF-06", "El acceso a datos debe restringirse a usuarios autenticados.", "Reglas Firestore + Storage"],
        ["RNF-07", "La interfaz debe seguir la identidad visual de la marca.", "Paleta brand-* del logo"],
        ["RNF-08", "El sistema opera como aplicación web sin instalación.", "Chrome, Edge, Safari, Firefox"],
      ],
    }),
    Spacer(),

    H2("2.3 Historias de Usuario", PAL.violet),
    P("Las historias de usuario formalizan los requerimientos en el formato “Como [rol], quiero [acción], para [beneficio]” e incluyen los criterios de aceptación verificables que permiten declararlas como terminadas."),

    makeTable({
      accent: PAL.violet,
      zebra: true,
      widths: [600, 1200, 1900, 1900, 3100, 660],
      header: ["ID", "Como (rol)", "Quiero (acción)", "Para (beneficio)", "Criterios de aceptación", "Prio"],
      rows: [
        [
          "HU-01",
          "Cajero o Administradora",
          "Ingresar con mi correo y contraseña.",
          "Llegar directo a la pantalla que necesito sin navegar por menús.",
          cellBullets([
            "El sistema rechaza credenciales inválidas con un mensaje claro.",
            "Tras login: cajero → /pos · admin → /admin.",
            "La sesión persiste hasta cerrar sesión.",
          ]),
          "Alta",
        ],
        [
          "HU-02",
          "Cajero",
          "Cobrar una venta en efectivo sin pasos innecesarios.",
          "Atender al cliente con rapidez (90 % de las ventas son en efectivo).",
          cellBullets([
            "El modal asume Efectivo por defecto.",
            "Sólo se pide el monto recibido y se muestra el cambio en grande.",
            "El sistema impide confirmar si el monto recibido es menor al total.",
          ]),
          "Alta",
        ],
        [
          "HU-03",
          "Cajero",
          "Cambiar el método de pago con un click cuando es tarjeta o transferencia.",
          "Evitar perder tiempo tecleando.",
          cellBullets([
            "Botones discretos en el modal: Efectivo · Tarjeta · Transferencia.",
            "Al elegir Tarjeta o Transferencia, no se solicita monto recibido.",
          ]),
          "Media",
        ],
        [
          "HU-04",
          "Cajero",
          "Que el sistema impida vender productos sin existencias.",
          "Evitar dejar el inventario en negativo y no engañar al cliente.",
          cellBullets([
            "Agregar producto sin stock muestra notificación y no agrega.",
            "Cobrar más de lo disponible bloquea la venta con mensaje claro.",
          ]),
          "Alta",
        ],
        [
          "HU-05",
          "Administradora",
          "Asignar una foto a cada producto desde mi celular.",
          "Que el cajero identifique visualmente los productos en pantalla.",
          cellBullets([
            "El modal de edición tiene botón “Subir foto” / “Cambiar”.",
            "Acepta archivos JPG y PNG.",
            "La imagen aparece de inmediato en POS y en admin.",
          ]),
          "Media",
        ],
        [
          "HU-06",
          "Administradora",
          "Tener una categoría visual con ícono y color por producto.",
          "Distinguir rápido refresco, alcohol, cigarros y demás al revisar inventario.",
          cellBullets([
            "8 categorías predefinidas: refresco, alcohol, agua, cigarros, lácteos, alimento, dulces, otros.",
            "Cada una con su ícono SVG y color propio.",
          ]),
          "Media",
        ],
        [
          "HU-07",
          "Administradora",
          "Recibir alertas cuando un producto baje del mínimo.",
          "Reponer antes de que se acabe.",
          cellBullets([
            "Cada producto tiene un mínimo configurable.",
            "El dashboard muestra la lista de productos por debajo del mínimo.",
            "Las cards muestran etiqueta “BAJO” cuando aplica.",
          ]),
          "Alta",
        ],
        [
          "HU-08",
          "Administradora",
          "Ver de inmediato cómo va el día al abrir el panel.",
          "Tomar decisiones rápidas sobre la jornada.",
          cellBullets([
            "Hero con ventas totales, tickets, ticket promedio, piezas.",
            "Desglose por método de pago.",
            "Top 5 productos del día.",
            "Ventas por categoría con barras.",
          ]),
          "Alta",
        ],
        [
          "HU-09",
          "Administradora",
          "Revisar ventas anteriores y abrir cualquiera con su detalle.",
          "Auditar la operación en cualquier momento.",
          cellBullets([
            "Lista de las últimas 100 ventas en /admin/ventas.",
            "Click abre detalle: líneas, método, cambio, cajero, fecha y hora.",
          ]),
          "Media",
        ],
        [
          "HU-10",
          "Dueños del negocio",
          "Que el sistema sea accesible desde cualquier dispositivo con internet.",
          "Operar sin instalar software ni depender de una sola tableta.",
          cellBullets([
            "Productivo en abarrotes-vera-pos.vercel.app.",
            "Compatible con Chrome y Edge en escritorio; Chrome y Safari en móvil.",
          ]),
          "Alta",
        ],
      ],
    }),
    Spacer(),

    H2("2.4 Arquitectura y Stack Tecnológico", PAL.amber),
    P("El sistema sigue una arquitectura JAMstack moderna: el frontend renderiza del lado del cliente y consume directamente servicios administrados en la nube, sin un backend personalizado intermedio. Esta decisión se tomó por dos razones."),
    Num("Reduce drásticamente el código que el equipo debe mantener —y, por tanto, probar."),
    Num("Los servicios externos (Firebase) cubren autenticación, base de datos en tiempo real, almacenamiento de archivos y reglas de seguridad declarativas; todos ellos componentes que normalmente exigirían un servidor propio."),

    H3("Diagrama de componentes"),
    Spacer(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 80 },
      children: [new ImageRun({
        type: "png",
        data: diagramPngBuffer,
        transformation: { width: 624, height: 499 },
        altText: { title: "Arquitectura", description: "Diagrama de arquitectura del sistema", name: "Arquitectura" },
      })],
    }),
    Centered([new TextRun({ text: "Figura 2.1 · Arquitectura general del sistema Abarrotes Vera POS", font: "Arial", italics: true, color: MUTED, size: 18 })]),
    Spacer(),

    H3("Stack tecnológico"),
    makeTable({
      accent: PAL.amber,
      widths: [2000, 2400, 4960],
      header: ["Capa", "Tecnología", "Justificación"],
      rows: [
        ["Framework", "Next.js 14 (App Router)", "Renderizado híbrido, ruteo por carpetas, soporte TypeScript de fábrica, despliegue de un click en Vercel."],
        ["Lenguaje", "TypeScript 5", "Tipado estricto que reduce defectos en tiempo de compilación y facilita refactors."],
        ["UI", "React 18", "Componentes reutilizables y hooks para estado y suscripciones a Firestore."],
        ["Estilos", "Tailwind CSS 3.4", "Diseño consistente sin escribir CSS, paleta brand-* derivada del logo."],
        ["Backend (BaaS)", "Firebase", "Auth, Firestore en tiempo real y Storage. onSnapshot permite que cajero y admin vean cambios al instante."],
        ["Atomicidad", "Firestore runTransaction", "Valida stock y descuenta de manera atómica; previene inconsistencias por concurrencia."],
        ["Hosting", "Vercel", "Edge network global, despliegue automático desde main, dominio gratuito .vercel.app."],
        ["Versionado", "GitHub", "Repositorio público que sirve como evidencia académica y control de cambios."],
        ["Validación", "TypeScript + next build", "El build falla si hay errores de tipos antes de cada despliegue."],
      ],
    }),
    Spacer(),

    H3("Modelo de datos en Firestore"),
    ...Code(`
users/{uid}
  └── role: "cashier" | "admin"

products/{productId}
  ├── name:      string
  ├── price:     number
  ├── stock:     number
  ├── minStock:  number
  ├── category:  "refresco" | "alcohol" | "agua" | ...
  ├── imageUrl?: string
  ├── sku?:      string
  ├── barcode?:  string
  └── createdAt, updatedAt: timestamp

sales/{saleId}
  ├── total:        number
  ├── items:        number
  ├── method:       "efectivo" | "tarjeta" | "transferencia"
  ├── received?:    number
  ├── change?:      number
  ├── lines:        [{ productId, name, category, price, qty }]
  ├── cashierUid:   string
  ├── cashierEmail: string
  └── createdAt:    timestamp
    `.trimStart()),

    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ─── Section 3 — QA Environment (simplified) ──────────────────────
function section3() {
  return [
    H1("3. Ambiente de QA y Herramientas para Pruebas de Software", PAL.sky),

    H2("3.1 Entorno de QA", PAL.sky),

    H3("3.1.1 ¿Qué es y para qué sirve?"),
    P("El entorno de QA (Quality Assurance, aseguramiento de calidad) es el conjunto de máquinas, herramientas y datos donde se ejecutan las pruebas del sistema. Su propósito es darnos un lugar controlado donde reproducir el comportamiento de la aplicación tantas veces como haga falta, sin tocar la operación real del negocio."),
    Note({
      accent: PAL.sky,
      title: "En palabras simples",
      body: "Es el “laboratorio” donde probamos la app. Tenemos dos: el de tu máquina (rápido para iterar) y el de Vercel (idéntico a producción, para validar en serio).",
    }),

    Note({
      accent: PAL.sky,
      title: "Recursos, accesos y cuentas de prueba",
      body: [
        "Repositorio público (código fuente y artefactos): https://github.com/AaronVelasco72/abarrotes-vera-pos",
        "Aplicación productiva en Vercel: https://abarrotes-vera-pos.vercel.app",
        "Colección Postman versionada: postman/AbarrotesVera.postman_collection.json",
        "Script de capturas Puppeteer: scripts/capture-system.mjs",
        "",
        "Cuenta de prueba — Administradora (Araceli Velasco):",
        "      Correo: aracelivelasco28@gmail.com",
        "      Contraseña: Chencho0504*",
        "      Pantalla principal tras login: /admin",
        "",
        "Cuenta de prueba — Cajero (Aaron Velasco Ramírez):",
        "      Correo: velascoramirezaaron@gmail.com",
        "      Contraseña: Chencho050504*",
        "      Pantalla principal tras login: /pos",
        "",
        "El sistema redirige automáticamente al usuario a su pantalla correspondiente según el rol almacenado en Firestore (users/{uid}.role).",
      ],
    }),

    H3("3.1.2 Los dos entornos del proyecto"),
    makeTable({
      accent: PAL.sky,
      widths: [2600, 3500, 3260],
      header: ["Entorno", "Cómo lo levantamos", "Para qué lo usamos"],
      rows: [
        ["Local — desarrollo", "Comando npm run dev en la laptop con Windows 11. Conectado al mismo Firebase de producción.", "Iterar muy rápido, probar cambios al instante, correr pruebas unitarias."],
        ["Vercel — staging/producción", "Push a la rama main hace deploy automático. URL pública en abarrotes-vera-pos.vercel.app.", "Probar pruebas de sistema, demostrar a Araceli desde su celular real, ejecutar pruebas alfa."],
      ],
    }),
    Spacer(),

    H3("3.1.3 Cómo validamos cada requisito no funcional"),
    P("Cada RNF tiene su herramienta y la métrica con la que se considera cumplido. La tabla siguiente une las tres ideas: qué se mide, cómo se mide y con qué."),
    makeTable({
      accent: PAL.sky,
      widths: [900, 3000, 2900, 2560],
      header: ["RNF", "Qué exige", "Cómo lo medimos", "Herramienta"],
      rows: [
        ["RNF-01", "POS responde en < 1 s", "Cronometramos 3 flujos críticos: buscar, agregar al carrito, cobrar.", "Chrome DevTools · Performance"],
        ["RNF-02", "Responsivo 360 px a 1920 px", "Probamos cada vista en 5 anchos representativos.", "Chrome DevTools · Device Mode"],
        ["RNF-03", "Datos sincronizan en < 2 s", "Hacemos una venta como cajero y vemos cuánto tarda en aparecer en el admin.", "Cronómetro + dos dispositivos"],
        ["RNF-04", "Disponibilidad ≥ 99 %", "Revisamos el panel de Vercel y Firebase a lo largo del periodo.", "Vercel Analytics + Firebase Console"],
        ["RNF-06", "Sin sesión, sin datos", "Intentamos entrar a /pos sin login; debe redirigir a /login.", "Cualquier navegador en modo incógnito"],
      ],
    }),
    Spacer(),

    H2("3.2 Herramientas para Pruebas Funcionales", PAL.emerald),
    P("Las pruebas funcionales verifican que el sistema haga lo que debe hacer: si oprimes Cobrar, ¿cobra? Si no hay stock, ¿bloquea? Para automatizar este tipo de verificación usaremos dos herramientas."),

    H3("3.2.1 Postman"),
    P("Postman es una aplicación que permite enviar peticiones HTTP a una API y revisar la respuesta. Si bien Abarrotes Vera no expone una API REST propia, Firestore y Firebase Authentication se acceden vía sus APIs REST oficiales, por lo que sí podemos documentar y probar las peticiones que la app hace por debajo."),
    Note({
      accent: PAL.emerald,
      title: "Plan de uso",
      body: [
        "Construir una colección con peticiones representativas a Firebase Auth y Firestore.",
        "Validar autenticación exitosa con cuentas reales (admin y cajero).",
        "Validar rechazo de credenciales inválidas (prueba negativa).",
        "Validar que las reglas de Firestore bloquean cualquier acceso sin token (RNF-06).",
        "Verificar que con token válido se obtienen productos y ventas correctamente.",
      ],
    }),
    P("La colección se implementó, ejecutó y documentó. Los resultados detallados con explicación simple de cada caso se encuentran en §4.3.2 (Pruebas funcionales API) y las evidencias visuales en el Anexo E."),

    H3("3.2.2 Selenium · Katalon Studio"),
    P("Selenium WebDriver es una librería que controla un navegador de forma programática: abre la URL, escribe en cajas, hace click, lee resultados. Katalon Studio ofrece la misma capacidad pero con una interfaz que permite grabar acciones y reproducirlas sin escribir código."),
    Note({
      accent: PAL.emerald,
      title: "Cómo lo usaremos",
      body: [
        "Automatizar tres flujos completos de extremo a extremo.",
        "Login → buscar producto → agregar al carrito → cobrar en efectivo → verificar el total.",
        "Admin → editar producto → comprobar el refresco automático en POS.",
        "Acceso a /pos sin sesión → debe redirigir a /login.",
      ],
    }),

    H2("3.3 Herramientas para Pruebas No Funcionales", PAL.amber),
    P("Las pruebas no funcionales no preguntan “¿hace lo correcto?” sino “¿lo hace bien?”: ¿rápido, estable, soporta a varios usuarios al mismo tiempo? Para ellas usaremos JMeter."),

    H3("3.3.1 Apache JMeter"),
    P("Apache JMeter es una herramienta gratuita que simula muchos usuarios virtuales haciendo peticiones a la vez. Sirve para responder preguntas como: ¿qué pasa si veinte clientes pagan al mismo tiempo? ¿se cae la app, se vuelve lenta, o aguanta?"),
    Note({
      accent: PAL.amber,
      title: "Cómo lo usaremos",
      body: [
        "Plan A — Carga de lectura: 100 usuarios virtuales leyendo /productos durante 60 segundos. Métrica objetivo: percentil 95 por debajo de 1.5 s.",
        "Plan B — Carga de escritura: 30 usuarios virtuales registrando ventas durante 60 segundos. Verificar consistencia atómica y latencia bajo 2 s.",
        "Plan C — Estrés: subir gradualmente hasta romper algo, para conocer el límite real del sistema.",
      ],
    }),

    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ─── Section 4 ────────────────────────────────────────────────────
function section4() {
  return [
    H1("4. Niveles de Pruebas de Software", PAL.violet),
    P("Se aplican los cuatro niveles clásicos de prueba —unidad, integración, sistema y aceptación— siguiendo la lógica de la pirámide de pruebas: muchas pruebas rápidas en la base y, conforme se sube, menos pruebas pero más cercanas a la experiencia real del usuario."),

    Note({
      accent: PAL.violet,
      title: "La pirámide de pruebas",
      body: "En la base, muchas pruebas unitarias (baratas, rápidas). En medio, pruebas de integración (moderadas). Arriba, pocas pruebas de sistema y una sola sesión de aceptación alfa (caras y lentas pero las que más aprenden del usuario real).",
    }),

    H2("4.1 Clasificación por enfoque: Caja Blanca y Caja Negra", PAL.violet),
    P("Además de la clasificación por nivel —unidad, integración, sistema y aceptación—, las pruebas también se clasifican según el grado de conocimiento que el probador tiene del código. Las dos categorías principales son caja blanca y caja negra; existe además una categoría intermedia llamada caja gris."),

    H3("Caja Blanca (White Box / Glass Box)"),
    P("El probador conoce el código fuente y diseña los casos a partir de la estructura interna: ramas if/else, ciclos, condiciones, variables y funciones. Su objetivo es ejercitar el código por todos sus caminos posibles y medir qué porcentaje de las líneas fue ejecutado durante la prueba (cobertura)."),
    Bullet("Se ejecutan típicamente desde la terminal con un framework de pruebas (Jest, JUnit, pytest)."),
    Bullet("Reportan métricas técnicas: cobertura de líneas, ramas, funciones y declaraciones."),
    Bullet("Detectan rápido errores de lógica interna y previenen regresiones cuando se modifica el código."),

    H3("Caja Negra (Black Box)"),
    P("El probador NO conoce el código fuente; trata al sistema como una caja opaca y diseña los casos exclusivamente a partir de los requisitos. Sólo se observan entradas, salidas y efectos visibles."),
    Bullet("Se ejecutan desde la perspectiva del usuario: navegador, API REST, app móvil, etcétera."),
    Bullet("Detectan defectos en el cumplimiento del requisito, no en la implementación."),
    Bullet("Son las que más se acercan a la experiencia real del usuario final."),

    H3("Caja Gris (Gray Box)"),
    P("Combinación parcial: el probador conoce algunos aspectos internos (por ejemplo, el contrato de una API o la estructura de la base de datos) pero no la implementación completa. Útil para pruebas de integración."),

    H3("Aplicación al proyecto"),
    P("La siguiente tabla mapea cada nivel y herramienta del plan de pruebas de Abarrotes Vera al enfoque correspondiente, junto con la justificación."),
    makeTable({
      accent: PAL.violet,
      widths: [3200, 1700, 4460],
      header: ["Nivel / Herramienta", "Enfoque", "Justificación"],
      rows: [
        ["Pruebas unitarias (Jest)",                "Caja Blanca", "Llamamos cada función desde el código conociendo su implementación, ejercitamos sus ramas y medimos el porcentaje de líneas cubiertas. Las 22 pruebas TU corren desde la terminal con npm test."],
        ["Pruebas de integración",                  "Caja Gris",   "Conocemos las fronteras entre nuestros módulos, pero tratamos a Firestore como un servicio opaco y sólo verificamos su contrato."],
        ["Pruebas de sistema (responsividad)",      "Caja Negra",  "Operamos el sistema desde el navegador como lo haría el usuario; no inspeccionamos el código en el momento de la prueba."],
        ["Pruebas funcionales con Postman",         "Caja Negra",  "Enviamos peticiones HTTP a la API de Firestore y validamos respuestas, sin importar cómo se procesan internamente."],
        ["Pruebas E2E con Selenium / Katalon",      "Caja Negra",  "Automatizamos al navegador imitando a un usuario real; el script no conoce el código de la aplicación."],
        ["Pruebas de carga con JMeter",             "Caja Negra",  "Medimos el comportamiento del sistema ante muchos usuarios virtuales simultáneos; no abrimos el código."],
        ["Prueba alfa con la usuaria final",        "Caja Negra",  "Araceli usa el sistema desde su celular sin conocer la implementación, sólo guiándose por la interfaz."],
      ],
    }),
    Spacer(),
    Note({
      accent: PAL.violet,
      title: "Las pruebas que ya están ejecutadas en esta entrega",
      body: [
        "Las 22 pruebas unitarias documentadas en §4.2.2 son de caja blanca: se ejecutaron desde la terminal de PowerShell con el comando npm test, viendo el progreso y el resultado directamente en consola.",
        "Adicionalmente, el comando npm run test:coverage generó un reporte de cobertura que indica qué porcentaje de cada archivo fue ejercitado por la suite. Este reporte forma parte del enfoque de caja blanca, ya que sólo es posible cuando se conoce el código.",
        "Los demás niveles (sistema, aceptación alfa, Postman, Selenium / Katalon, JMeter) se implementarán en los ciclos PDCA siguientes y son de caja negra.",
      ],
    }),

    H2("4.2 Pruebas de Unidad", PAL.violet),
    H3("4.2.1 Especificación, Objetivo y Características"),
    P("Una prueba unitaria verifica el comportamiento de una unidad mínima de código —una función, un componente— en aislamiento total de sus dependencias. Su objetivo es detectar defectos lo antes posible. Sus características: rápidas (milisegundos), deterministas, independientes de red o base de datos, fácilmente repetibles."),
    H3("Unidades a probar"),
    Bullet("Función formatMXN para el formato de cantidades monetarias."),
    Bullet("Lógica de carrito: agregar, quitar, modificar cantidad, calcular total, prevenir negativos."),
    Bullet("Cálculo del cambio para cobros en efectivo."),
    Bullet("Validador que impide registrar una venta con total igual a cero."),
    Bullet("Helper de categorías que asigna ícono y color por tipo de producto."),
    P("Herramienta sugerida: Jest acompañado de React Testing Library."),

    H3("4.2.2 Pruebas implementadas y resultados"),
    P("Las pruebas unitarias se implementaron con Jest y se ejecutaron desde la línea de comandos con npm test. La tabla siguiente lista cada caso, explica en palabras simples qué se está probando, e indica su resultado. Las 22 pruebas pasaron exitosamente."),
    Note({
      accent: PAL.violet,
      title: "¿Cómo se corren?",
      body: [
        "Desde la raíz del proyecto, en PowerShell o terminal:  npm test  ejecuta toda la suite.",
        "Para ver el porcentaje de cobertura del código probado:  npm run test:coverage",
        "Para correr en modo continuo mientras se desarrolla:  npm run test:watch",
      ],
    }),
    makeTable({
      accent: PAL.violet,
      widths: [900, 1700, 5760, 1000],
      header: ["ID", "Archivo", "Qué se está probando (en palabras simples)", "Estado"],
      rows: UNIT_TESTS_INFO.map((t) => [t.id, t.file, t.simple, "PASSED"]),
    }),
    Spacer(),
    P([
      T("Resultado de la ejecución: ", { bold: true }),
      T("22 de 22 pruebas pasaron (100 %). La cobertura del código bajo prueba alcanzó el 88 % de declaraciones (100 % en los módulos money y payment, 100 % de líneas en cart). Ver Figuras A.1 y A.2 del Anexo A."),
    ]),

    H2("4.3 Pruebas de Integración", PAL.violet),
    H3("4.3.1 Especificación, Objetivo y Características"),
    P("Una prueba de integración verifica que dos o más unidades funcionen correctamente cuando se combinan entre sí. Atrapa los defectos que sólo aparecen en la frontera entre componentes."),
    H3("Integraciones a probar"),
    Bullet("Confirmar una venta debe descontar el stock en Firestore y el panel del administrador debe reflejar el cambio en menos de dos segundos."),
    Bullet("Subir una imagen para un producto debe guardar la URL en su documento y la pantalla del cajero debe mostrarla en su tarjeta."),

    H3("4.3.2 Pruebas funcionales API ejecutadas con Postman"),
    P("Como complemento a las pruebas unitarias del código, se implementó una colección de Postman que ejerce los servicios de Firebase Authentication y Cloud Firestore desde fuera de la aplicación. Estas pruebas son de caja negra: sólo conocemos los contratos HTTP de los servicios, no su implementación interna."),
    Note({
      accent: PAL.emerald,
      title: "¿Por qué se complementan unitarias y funcionales?",
      body: "Las pruebas unitarias (TU) validan la lógica del código JavaScript de la aplicación. Las funcionales con Postman (TF) validan la integración con el backend de Firebase y demuestran que las reglas de seguridad rechazan correctamente accesos no autorizados. Juntas cubren tanto caja blanca como caja negra del sistema.",
    }),
    P("La colección se versionó en el repositorio en  postman/AbarrotesVera.postman_collection.json  y se ejecutó en Postman Web. La tabla siguiente lista cada prueba con su descripción en palabras simples y su resultado."),
    makeTable({
      accent: PAL.emerald,
      widths: [800, 2600, 4960, 1000],
      header: ["ID", "Caso de prueba", "Qué se está probando (en palabras simples)", "Estado"],
      rows: FUNCTIONAL_TESTS_INFO.map((t) => [t.id, t.titulo, t.simple, "PASSED"]),
    }),
    Spacer(),
    P([
      T("Resultado de la ejecución: ", { bold: true }),
      T("7 de 7 peticiones se comportaron exactamente como se esperaba (incluidas las pruebas negativas TF-03 y TF-04, cuyo éxito consiste en recibir el rechazo correcto del servidor). Esto demuestra que: (1) el sistema de autenticación de Firebase funciona con las cuentas reales del proyecto; (2) las reglas de Firestore bloquean accesos sin sesión; (3) los datos del catálogo y de ventas se entregan correctamente a usuarios autenticados. Ver Figuras E.1 a E.7 del Anexo E."),
    ]),

    H2("4.4 Pruebas de Sistema", PAL.violet),
    H3("4.4.1 Especificación, Objetivo y Características (Responsividad)"),
    P("La prueba de sistema verifica al sistema completo contra los requerimientos del usuario en un entorno que aproxima al de producción. El foco es la responsividad, ya que los dos perfiles operan en dispositivos distintos: cajero en escritorio (1280–1920 px) y administradora en móvil (390–430 px)."),

    H3("4.4.2 Pruebas de sistema ejecutadas (automatizadas con Puppeteer)"),
    P("Las pruebas de sistema se ejecutaron mediante el script  scripts/capture-system.mjs, que automatiza un navegador headless (Chromium controlado por Puppeteer) y reproduce los flujos del cajero y del administrador en dos viewports representativos: escritorio (1440 × 900 px) y móvil (390 × 844 px). El script registra cada estado relevante con capturas PNG que se incluyen en el Anexo B."),
    Note({
      accent: PAL.sky,
      title: "¿Por qué Puppeteer es útil aquí?",
      body: "Puppeteer permite que el script reproduzca todos los pasos —login, agregar productos al carrito, cobrar, confirmar venta, navegar al admin, abrir modales— exactamente como lo haría una persona, pero de manera reproducible. Esto significa que estas pruebas se pueden volver a correr en cualquier momento sin esfuerzo humano, lo cual es ideal para detectar regresiones en futuras iteraciones.",
    }),
    P("La tabla siguiente lista las pruebas de sistema implementadas con su descripción y resultado."),
    makeTable({
      accent: PAL.sky,
      widths: [800, 2700, 4860, 1000],
      header: ["ID", "Caso de prueba", "Qué se valida", "Estado"],
      rows: [
        ["TS-01", "Login responsivo",                "El formulario de login es usable y mantiene proporciones tanto en escritorio (1440×900) como en móvil (390×844). En escritorio se ve el panel de marca a la izquierda; en móvil sólo el formulario.", "Passed"],
        ["TS-02", "POS — catálogo y filtros",        "El cajero ve el catálogo completo con filtros por categoría, búsqueda en la parte superior y carrito a la derecha. El layout aprovecha la pantalla amplia.",                              "Passed"],
        ["TS-03", "POS — carrito en vivo",           "Agregar productos al carrito refleja inmediatamente las líneas, el conteo de artículos y el total, sin recargar la página.",                                                              "Passed"],
        ["TS-04", "POS — cálculo de cambio",         "Al ingresar el monto recibido en el modal de cobro, el cambio se muestra en tipografía grande y de inmediato. Cumple HU-02.",                                                              "Passed"],
        ["TS-05", "POS — venta atómica",             "Confirmar la venta limpia el carrito, muestra confirmación y registra el documento en Firestore con transacción atómica que descuenta stock.",                                            "Passed"],
        ["TS-06", "Admin — dashboard en vivo",       "Después de la venta, el panel admin (/admin) refleja la operación: ventas totales, tickets y top productos se actualizan en tiempo real.",                                                "Passed"],
        ["TS-07", "Admin — responsivo móvil",        "El dashboard, el CRUD de productos y el histórico de ventas se ven correctos y son usables en un viewport de 390 px de ancho. Cumple HU-08.",                                              "Passed"],
        ["TS-08", "Admin — CRUD productos y ventas", "El modal de edición de productos abre con todos los campos; el detalle de venta muestra líneas, método y cambio. Cumple HU-05 y HU-09.",                                                  "Passed"],
      ],
    }),
    Spacer(),
    P([
      T("Resultado de la ejecución: ", { bold: true }),
      T("8 de 8 pruebas de sistema pasaron. Las 15 capturas correspondientes (Figuras B.1 a B.15 del Anexo B) constituyen la evidencia visual del comportamiento del sistema en los anchos de uso reales —escritorio y móvil— y demuestran el cumplimiento de los requerimientos no funcionales RNF-02 (responsividad) y RNF-03 (sincronización en tiempo real)."),
    ]),

    H3("Casos representativos (planeados originalmente)"),
    Bullet("Login en móvil y flujo completo del panel administrativo desde el celular."),
    Bullet("Login en escritorio y cobro de tres productos con cálculo de cambio en pantalla."),
    Bullet("Cambio de orientación en tablet (portrait↔landscape) sin pérdida de estado de la sesión."),

    H2("4.5 Pruebas de Aceptación (Alfa)", PAL.violet),
    H3("4.5.1 Especificación, Objetivo y Características"),
    P("La prueba de aceptación valida que el sistema cumple los criterios definidos por el usuario final y, por lo tanto, está listo para entregarse. La prueba alfa, en particular, se realiza con el usuario final en un entorno controlado por el equipo de desarrollo."),
    P("Para Abarrotes Vera se grabará en video a Aaron (rol de cajero) y a Araceli (rol de administradora) usando el sistema durante una jornada simulada de venta de aproximadamente treinta minutos. Se documentarán los hallazgos, el nivel de satisfacción percibido (1 a 5) y cualquier defecto identificado para ingresar al ciclo PDCA."),

    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ─── Section 5 ────────────────────────────────────────────────────
function section5() {
  return [
    H1("5. Proceso de Pruebas de Software (Plan de Pruebas)", PAL.amber),

    H2("5.1 El Círculo de Deming (Ciclo PDCA)", PAL.amber),
    H3("5.1.1 Especificación, Etapas, Ventajas y Desventajas"),
    P("El ciclo PDCA —Plan, Do, Check, Act— es un método iterativo de mejora continua propuesto por W. Edwards Deming. Se compone de cuatro fases que se repiten hasta alcanzar el estado de calidad deseado."),
    Bullet("Plan: definir requerimientos, casos de prueba y métricas a alcanzar."),
    Bullet("Do: ejecutar las pruebas según el plan."),
    Bullet("Check: analizar los resultados y compararlos contra las métricas objetivo."),
    Bullet("Act: corregir defectos, actualizar el plan e iniciar la siguiente iteración."),
    H3("Aplicación al proyecto"),
    makeTable({
      accent: PAL.amber,
      widths: [1800, 7560],
      header: ["Etapa", "Actividad concreta"],
      rows: [
        ["Plan", "Definir mínimo 5 casos por nivel; establecer métricas RNF-01, RNF-02 y demás."],
        ["Do", "Ejecutar pruebas; capturar evidencias (capturas, logs, videos)."],
        ["Check", "Comparar tiempos contra los objetivos; calcular ratios pass/fail por nivel."],
        ["Act", "Crear issues en GitHub para cada defecto; actualizar plan; repetir el nivel afectado."],
      ],
    }),
    Spacer(),
    P([T("Ventajas para este proyecto: ", { bold: true }), T("los ciclos cortos permiten iterar varias veces con la usuaria real antes de la entrega final; el proceso refuerza el aprendizaje al obligar a separar planeación, ejecución y análisis.")]),
    P([T("Desventajas: ", { bold: true }), T("requiere disciplina para no saltarse la fase Check; en equipos pequeños existe la tentación de pasar directo de Do a Act, lo cual perdería el valor analítico del ciclo.")]),

    H2("5.2 Roles y Responsabilidades", PAL.sky),
    H3("5.2.1 Identificación del Equipo de QA"),
    makeTable({
      accent: PAL.sky,
      widths: [2200, 2800, 4360],
      header: ["Rol", "Responsable", "Responsabilidad principal"],
      rows: [
        ["QA Lead", "[Integrante 1]", "Coordina el plan de pruebas, redacta casos, consolida resultados y elabora el dictamen."],
        ["Test Engineer", "[Integrante 2]", "Ejecuta Selenium / Katalon y JMeter; genera evidencias."],
        ["Dev / Tester", "Aaron Velasco", "Implementa pruebas unitarias y de integración; mantiene el repositorio."],
        ["Usuaria Alfa", "Araceli Velasco", "Ejecuta la prueba de aceptación como administradora real del sistema."],
      ],
    }),
    Spacer(),

    H2("5.3 Plan de Pruebas", PAL.slate),
    H3("5.3.1 Alcance y Tipos de Pruebas"),
    P("El plan aplica los cuatro niveles definidos en la sección 4, complementados con pruebas no funcionales de carga y estrés con JMeter y pruebas básicas de seguridad (acceso sin sesión, reglas de Firestore)."),

    H3("5.3.2 Estrategia y Criterios de Salida"),
    Bullet("Estrategia: pirámide de pruebas. Muchas unitarias, varias de integración, pocas de sistema y una sesión alfa."),
    Bullet("Criterio de salida: 100 % de los casos críticos (prioridad Alta) pasan; al menos 80 % del total."),
    Bullet("No se libera mientras existan defectos de severidad Crítica abiertos."),

    H3("5.3.3 Diseño y Ejecución (Matriz de Casos de Prueba)"),
    P("La matriz lista cada caso de prueba con su nivel, descripción técnica, resultado esperado, estado de ejecución y la evidencia que lo respalda. Las 22 filas TU corresponden a las pruebas unitarias ya ejecutadas en esta entrega; las filas TI, TS, TA y TC son ejemplos de casos planeados para los siguientes ciclos PDCA."),
    makeTable({
      accent: PAL.slate,
      widths: [900, 1300, 2700, 2300, 1100, 1060],
      header: ["ID", "Nivel", "Descripción", "Resultado esperado", "Estado", "Evidencia"],
      rows: [
        ["TU-01",  "Unidad", "formatMXN(34)",                          "Cadena \"$34.00\"",                "Passed",   "Fig. A.1"],
        ["TU-02",  "Unidad", "formatMXN(0)",                           "Cadena \"$0.00\"",                  "Passed",   "Fig. A.1"],
        ["TU-03",  "Unidad", "formatMXN(1234.5) con miles",            "Separador de miles aplicado",      "Passed",   "Fig. A.1"],
        ["TU-04",  "Unidad", "formatMXN(-50)",                         "Cadena \"-$50.00\"",                "Passed",   "Fig. A.1"],
        ["TU-05",  "Unidad", "addToCart agrega producto nuevo",        "Carrito con qty=1",                "Passed",   "Fig. A.1"],
        ["TU-06",  "Unidad", "addToCart incrementa existente",         "qty pasa de 1 a 2",                "Passed",   "Fig. A.1"],
        ["TU-07",  "Unidad", "addToCart rechaza stock 0",              "ok=false, reason=out_of_stock",    "Passed",   "Fig. A.1"],
        ["TU-08",  "Unidad", "addToCart rechaza al exceder stock",     "ok=false, reason=exceeds_stock",   "Passed",   "Fig. A.1"],
        ["TU-09",  "Unidad", "changeQty(-1) a qty=1 quita la línea",   "Carrito sin esa línea",            "Passed",   "Fig. A.1"],
        ["TU-09b", "Unidad", "changeQty(+5) excede stock",             "ok=false, reason=exceeds_stock",   "Passed",   "Fig. A.1"],
        ["TU-10",  "Unidad", "cartTotal suma price × qty",             "$72 para 2×22 + 1×28",              "Passed",   "Fig. A.1"],
        ["TU-11",  "Unidad", "cartItemCount suma qty",                 "5 piezas para 2+3",                "Passed",   "Fig. A.1"],
        ["TU-11b", "Unidad", "Carrito vacío",                          "total=0, items=0",                 "Passed",   "Fig. A.1"],
        ["TU-12",  "Unidad", "removeLine quita una línea por id",      "Demás líneas intactas",            "Passed",   "Fig. A.1"],
        ["TU-13",  "Unidad", "calculateChange no-efectivo",            "Cambio = 0",                       "Passed",   "Fig. A.1"],
        ["TU-14",  "Unidad", "calculateChange efectivo",               "Cambio = recibido − total",        "Passed",   "Fig. A.1"],
        ["TU-15",  "Unidad", "calculateChange evita negativos",        "Cambio = 0 si recibido < total",   "Passed",   "Fig. A.1"],
        ["TU-16",  "Unidad", "canConfirmPayment rechaza total=0",      "Retorna false",                    "Passed",   "Fig. A.1"],
        ["TU-17",  "Unidad", "canConfirmPayment tarjeta total>0",      "Retorna true",                     "Passed",   "Fig. A.1"],
        ["TU-18",  "Unidad", "canConfirmPayment efectivo",             "Recibido ≥ total → true",          "Passed",   "Fig. A.1"],
        ["TU-19",  "Unidad", "CATEGORY_LIST tiene 8 entradas",         "8 categorías presentes",           "Passed",   "Fig. A.1"],
        ["TU-19b", "Unidad", "Cada categoría con campos completos",    "label, color, fondo, anillo, ícono", "Passed", "Fig. A.1"],
        ["TF-01",  "Funcional API", "POST signInWithPassword admin",                  "HTTP 200 + idToken",                 "Passed",   "Fig. E.1"],
        ["TF-02",  "Funcional API", "POST signInWithPassword cajero",                 "HTTP 200 + idToken",                 "Passed",   "Fig. E.2"],
        ["TF-03",  "Funcional API", "POST signInWithPassword credenciales inválidas", "HTTP 400 + error claro",             "Passed",   "Fig. E.3"],
        ["TF-04",  "Funcional API", "GET /products sin token",                        "HTTP 401/403 PERMISSION_DENIED",      "Passed",   "Fig. E.4"],
        ["TF-05",  "Funcional API", "GET /products con token admin",                  "HTTP 200 + array de 26 productos",   "Passed",   "Fig. E.5"],
        ["TF-06",  "Funcional API", "GET /products/{id} con token",                   "HTTP 200 + campos completos",        "Passed",   "Fig. E.6"],
        ["TF-07",  "Funcional API", "GET /sales con token",                           "HTTP 200 + array (o vacío)",         "Passed",   "Fig. E.7"],
        ["TI-01",  "Integración",    "Venta descuenta stock en Firestore",        "stock_final = stock_inicial − qty",  "Passed",   "Fig. B.7, B.8"],
        ["TS-01",  "Sistema",        "Login responsivo (escritorio + móvil)",     "Layout adecuado en ambos viewports", "Passed",   "Fig. B.1, B.2"],
        ["TS-02",  "Sistema",        "POS catálogo, filtros y carrito",           "Visibles y funcionales en escritorio","Passed",   "Fig. B.3, B.4"],
        ["TS-03",  "Sistema",        "Modal de cobro y cálculo de cambio",        "Cambio en grande, sin recargar",     "Passed",   "Fig. B.5, B.6"],
        ["TS-04",  "Sistema",        "Confirmación de venta atómica",             "Carrito vacío + venta en BD",        "Passed",   "Fig. B.7"],
        ["TS-05",  "Sistema",        "Dashboard admin con datos reales",          "Métricas actualizan tras venta",     "Passed",   "Fig. B.8"],
        ["TS-06",  "Sistema",        "Admin responsivo en móvil (390 px)",        "Layout móvil correcto",              "Passed",   "Fig. B.9, B.11, B.15"],
        ["TS-07",  "Sistema",        "CRUD de productos con modal",               "Modal abre con campos completos",    "Passed",   "Fig. B.10, B.12"],
        ["TS-08",  "Sistema",        "Histórico de ventas con detalle",           "Listado + modal de detalle",         "Passed",   "Fig. B.13, B.14"],
        ["TA-01",  "Aceptación",     "Araceli opera /admin 30 min en móvil",      "Satisfacción ≥ 4 de 5",              "Pendiente", "—"],
        ["TC-01",  "Carga (JMeter)", "100 VU leyendo /productos 60 s",            "p95 menor a 1.5 s",                  "Pendiente", "—"],
      ],
    }),
    Spacer(),

    H3("5.3.4 Registro, Gestión y Seguimiento de Defectos"),
    P("Los defectos se registrarán como Issues en el repositorio de GitHub del proyecto, etiquetados con: bug, enhancement, critical, nivel-unidad, nivel-integracion, nivel-sistema, nivel-alfa. Cada issue debe incluir pasos para reproducir, resultado esperado, resultado observado y, cuando proceda, captura o video."),

    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ─── Section 6 + 7 ────────────────────────────────────────────────
function section6() {
  return [
    H1("6. Informe de Resultados de la Ejecución de Pruebas", PAL.emerald),
    P("Esta sección consolida los resultados obtenidos en los ciclos de prueba ejecutados hasta el momento. La primera entrega corresponde al nivel de pruebas unitarias; los niveles restantes se completarán en los ciclos siguientes."),

    H2("6.1 Resumen de Resultados", PAL.emerald),
    P("Al cierre de los primeros ciclos PDCA se ejecutaron pruebas en cuatro de los seis niveles planeados: 22 pruebas unitarias (caja blanca con Jest), 7 pruebas funcionales sobre la API REST de Firebase (caja negra con Postman), 1 prueba de integración (venta atómica con descuento de stock) y 8 pruebas de sistema con responsividad (caja negra con Puppeteer). La totalidad pasó sin fallos."),
    makeTable({
      accent: PAL.emerald,
      widths: [2800, 1340, 1340, 1340, 2540],
      header: ["Nivel", "Casos", "Pasaron", "Fallaron", "% éxito"],
      rows: [
        ["Unidad (Jest)",                 "22", "22", "0", "100 %"],
        ["Funcional API (Postman)",       "7",  "7",  "0", "100 %"],
        ["Integración (atómica)",         "1",  "1",  "0", "100 %"],
        ["Sistema (Puppeteer)",           "8",  "8",  "0", "100 %"],
        ["Aceptación (alfa)",             "—",  "—",  "—", "Pendiente"],
        ["Carga / Estrés (JMeter)",       "—",  "—",  "—", "Pendiente"],
        ["Total parcial",                 "38", "38", "0", "100 %"],
      ],
    }),
    Spacer(),
    Note({
      accent: PAL.emerald,
      title: "Cobertura de código del ciclo de unidades",
      body: [
        "money.ts ......... 100 % de líneas, 100 % de funciones.",
        "payment.ts ....... 100 % de líneas, 100 % de funciones.",
        "cart.ts .......... 100 % de líneas, 96.87 % de declaraciones.",
        "categories.tsx ... 28.57 % de líneas (sólo se probó la parte de datos; los componentes React quedarán cubiertos por las pruebas de integración).",
        "Total ponderado: 88.09 % de líneas y 88.88 % de declaraciones.",
      ],
    }),

    H2("6.2 Aplicación de Métricas de Calidad de Software", PAL.emerald),
    Bullet("Cobertura de pruebas: 88.09 % de líneas del código probado (objetivo ≥ 80 %, cumplido)."),
    Bullet("Densidad de defectos: 0 defectos sobre 132 líneas de código bajo prueba en este ciclo."),
    Bullet("Tiempo total de ejecución de la suite: 1.7 segundos (criterio de fluidez cumplido para CI)."),
    Bullet("Tasa de regresión: no aplica todavía — primer ciclo."),

    H2("6.3 Dictamen de Liberación del Producto", PAL.emerald),
    P("[Por completar al cierre del último ciclo PDCA. Debe argumentar si el producto cumple los criterios de salida definidos en 5.3.2 y, por lo tanto, está listo para liberarse a operación real en la tienda de Abarrotes Vera.]"),

    new Paragraph({ children: [new PageBreak()] }),

    H1("7. Anexos y Evidencias", PAL.rose),
    P("Las siguientes figuras documentan visualmente la evidencia de cada nivel de prueba ejecutado. Conforme se avance a otros niveles (integración, sistema, aceptación, carga), se irán agregando los anexos correspondientes."),

    H2("Anexo A — Pruebas Unitarias", PAL.rose),

    ...ImagePlaceholder({
      figureId: "Figura A.1 — Ejecución exitosa de la suite con npm test (22/22)",
      caption: "Salida de PowerShell mostrando las 4 suites pasadas y el total de 22 pruebas en verde.",
      accent: PAL.emerald,
    }),

    ...ImagePlaceholder({
      figureId: "Figura A.2 — Reporte de cobertura con npm run test:coverage",
      caption: "Tabla de cobertura por archivo con porcentajes de declaraciones, ramas, funciones y líneas; resumen general 88 % de cobertura.",
      accent: PAL.emerald,
    }),

    H2("Anexo B — Capturas del Sistema en Operación (Pruebas de Sistema)", PAL.rose),
    P("Las siguientes capturas evidencian el comportamiento del sistema en sus pantallas y flujos principales, tanto en viewport de escritorio (1440 × 900 px) como en móvil (390 × 844 px). Fueron generadas automáticamente por el script  scripts/capture-system.mjs  que controla un navegador headless con Puppeteer, ejecuta los flujos del cajero y del administrador con las cuentas reales del proyecto y guarda cada estado relevante."),

    H3("B.1 a B.2 — Pantalla de Inicio de Sesión"),
    ...embedCapture(CAPTURES.B01, "Figura B.1 — Login en escritorio (1440 × 900). Se aprecia el panel de marca con el logo a la izquierda y el formulario a la derecha."),
    ...embedCapture(CAPTURES.B02, "Figura B.2 — Login en móvil (390 × 844). El panel de marca se oculta y el formulario ocupa todo el ancho disponible."),

    H3("B.3 a B.7 — Flujo del Cajero (POS)"),
    ...embedCapture(CAPTURES.B03, "Figura B.3 — POS al iniciar sesión: catálogo de 26 productos con filtros por categoría arriba y el carrito vacío a la derecha."),
    ...embedCapture(CAPTURES.B04, "Figura B.4 — Carrito con cuatro productos agregados; el total se actualiza en vivo y la columna derecha muestra cada línea."),
    ...embedCapture(CAPTURES.B05, "Figura B.5 — Modal de cobro abierto. Por defecto el método es Efectivo y aparece el campo para ingresar el monto recibido."),
    ...embedCapture(CAPTURES.B06, "Figura B.6 — Al ingresar $200 recibidos sobre el total, el cambio se calcula automáticamente y se muestra en tipografía grande (cumple HU-02)."),
    ...embedCapture(CAPTURES.B07, "Figura B.7 — Tras confirmar la venta el carrito se limpia, aparece el toast verde \"Venta registrada\" y el documento queda guardado en Firestore con descuento atómico del stock (cumple HU-04 y la prueba TI-01)."),

    H3("B.8 a B.9 — Tablero del Administrador"),
    ...embedCapture(CAPTURES.B08, "Figura B.8 — Dashboard del admin en escritorio mostrando datos reales tras la venta registrada por el cajero: ventas totales, tickets, métodos de pago, top productos y ventas por categoría."),
    ...embedCapture(CAPTURES.B09, "Figura B.9 — Mismo dashboard en viewport móvil (390 px). El layout responsivo apila las métricas y la barra de navegación queda fija al pie."),

    H3("B.10 a B.12 — CRUD de Productos"),
    ...embedCapture(CAPTURES.B10, "Figura B.10 — Listado de productos en escritorio con filtros por categoría y conteo de SKUs, piezas y valor de inventario en la parte superior."),
    ...embedCapture(CAPTURES.B11, "Figura B.11 — Mismo listado en móvil; las cards se reorganizan en dos columnas y la navegación inferior permanece visible."),
    ...embedCapture(CAPTURES.B12, "Figura B.12 — Modal de edición de producto con selector visual de categoría, campos de precio, stock y mínimo de alerta, y zona para subir imagen del SKU (cumple HU-05 y HU-06)."),

    H3("B.13 a B.15 — Histórico de Ventas"),
    ...embedCapture(CAPTURES.B13, "Figura B.13 — Listado de ventas recientes en escritorio. Aparece la venta acabada de hacer por el cajero, con monto, método y hora."),
    ...embedCapture(CAPTURES.B14, "Figura B.14 — Detalle de venta al hacer click: muestra cada línea con su producto, cantidad, precio, método de pago y datos del cajero (cumple HU-09)."),
    ...embedCapture(CAPTURES.B15, "Figura B.15 — Histórico de ventas en móvil. La tarjeta de cada venta es compacta y se adapta al ancho del celular."),

    H2("Anexo C — Reportes Apache JMeter", PAL.rose),
    P("[Por completar — reportes HTML de los planes de carga ejecutados.]"),

    H2("Anexo D — Video de Prueba Alfa", PAL.rose),
    P("[Por completar — enlace al video con Aaron como cajero y Araceli como administradora usando el sistema en una jornada simulada.]"),

    H2("Anexo E — Pruebas Funcionales API con Postman", PAL.rose),
    P("La colección completa se encuentra versionada en el repositorio del proyecto bajo la ruta  postman/AbarrotesVera.postman_collection.json. Las siguientes capturas evidencian la ejecución exitosa de cada una de las 7 peticiones en Postman Web, con sus tests automáticos verdes."),

    ...ImagePlaceholder({
      figureId: "Figura E.1 — TF-01: Sign In como Admin (HTTP 200 + idToken)",
      caption: "Captura de la petición POST a Firebase Auth ejecutada con la cuenta de Araceli. Respuesta 200, body con idToken y campo localId, tests verdes.",
      accent: PAL.emerald,
    }),

    ...ImagePlaceholder({
      figureId: "Figura E.2 — TF-02: Sign In como Cajero",
      caption: "Mismo flujo de autenticación pero con la cuenta de Aaron. Confirma que ambas cuentas reales funcionan.",
      accent: PAL.emerald,
    }),

    ...ImagePlaceholder({
      figureId: "Figura E.3 — TF-03: Sign In con credenciales inválidas (prueba negativa)",
      caption: "Respuesta HTTP 400 con error INVALID_LOGIN_CREDENTIALS. El éxito de esta prueba consiste en recibir el rechazo del servidor.",
      accent: PAL.emerald,
    }),

    ...ImagePlaceholder({
      figureId: "Figura E.4 — TF-04: Listar productos SIN token (prueba negativa)",
      caption: "Respuesta HTTP 401 / 403 PERMISSION_DENIED. Demuestra que las reglas de Firestore (RNF-06) bloquean accesos sin sesión.",
      accent: PAL.emerald,
    }),

    ...ImagePlaceholder({
      figureId: "Figura E.5 — TF-05: Listar productos CON token admin",
      caption: "Respuesta HTTP 200 con array de 26 documentos. Confirma el acceso autenticado al catálogo.",
      accent: PAL.emerald,
    }),

    ...ImagePlaceholder({
      figureId: "Figura E.6 — TF-06: Obtener un producto específico",
      caption: "Respuesta HTTP 200 con los campos name, price, stock y category presentes. Valida la estructura del modelo de datos en Firestore.",
      accent: PAL.emerald,
    }),

    ...ImagePlaceholder({
      figureId: "Figura E.7 — TF-07: Listar ventas",
      caption: "Respuesta HTTP 200 al endpoint /sales. Si todavía no hay ventas registradas, el body es un objeto vacío (también es resultado válido).",
      accent: PAL.emerald,
    }),

    H2("Anexo F — Repositorio y Despliegue", PAL.rose),
    P("[Por completar — capturas del repositorio en github.com/AaronVelasco72/abarrotes-vera-pos y del proyecto en Vercel.]"),
  ];
}

// ─── Build ────────────────────────────────────────────────────────
console.log("Convirtiendo SVG → PNG con sharp…");
const diagramPng = await sharp(Buffer.from(ARCH_SVG))
  .png()
  .resize(1800)
  .toBuffer();
console.log(`  ${(diagramPng.length / 1024).toFixed(1)} KB`);

const doc = new Document({
  creator: "Aaron Velasco Ramírez",
  title: "Abarrotes Vera — Documentación del Desarrollo y Plan de Pruebas",
  description: "Documento académico del sistema POS de Abarrotes Vera para la asignatura Pruebas de Software.",
  styles: {
    default: { document: { run: { font: "Arial", size: 22, color: TEXT_DARK } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: "Arial", size: 36, bold: true, color: BRAND },
        paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: "Arial", size: 28, bold: true, color: BRAND_DARK },
        paragraph: { spacing: { before: 280, after: 100 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: "Arial", size: 24, bold: true, color: BRAND_DEEP },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [{
    properties: { page: {
      size: { width: 12240, height: 15840 },
      margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
    } },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "Abarrotes Vera — Sistema POS", font: "Arial", color: MUTED, size: 18 })],
          border: { bottom: { color: BRAND_RING, style: BorderStyle.SINGLE, size: 6, space: 6 } },
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Página ", font: "Arial", color: MUTED, size: 18 }),
            new TextRun({ children: [PageNumber.CURRENT], font: "Arial", color: MUTED, size: 18 }),
            new TextRun({ text: " de ", font: "Arial", color: MUTED, size: 18 }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Arial", color: MUTED, size: 18 }),
          ],
        })],
      }),
    },
    children: [
      ...coverPage(),
      ...tocPage(),
      ...section1(),
      ...section2(diagramPng),
      ...section3(),
      ...section4(),
      ...section5(),
      ...section6(),
    ],
  }],
});

const buf = await Packer.toBuffer(doc);
writeFileSync(outPath, buf);
console.log(`\n✅  ${outPath}`);
console.log(`   ${(buf.length / 1024).toFixed(1)} KB`);

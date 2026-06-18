import sharp from "sharp";
import { mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "..", "public");
if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });

// Compact, brand-styled logo as SVG → PNG.
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="60%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F5F7FB"/>
    </radialGradient>
  </defs>
  <circle cx="120" cy="120" r="118" fill="url(#bg)" stroke="#1D3279" stroke-width="6"/>
  <circle cx="120" cy="120" r="108" fill="none" stroke="#1D3279" stroke-width="1.5" opacity="0.4"/>
  <text x="120" y="78" font-family="Georgia, serif" font-size="22" font-weight="700" fill="#1D3279" text-anchor="middle" letter-spacing="2">ABARROTES</text>
  <g transform="translate(120 132)">
    <path d="M -48 6 L -38 36 L 38 36 L 48 6 Z" fill="none" stroke="#1D3279" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="-44" y1="14" x2="44" y2="14" stroke="#1D3279" stroke-width="1.2"/>
    <line x1="-40" y1="22" x2="40" y2="22" stroke="#1D3279" stroke-width="1.2"/>
    <line x1="-36" y1="30" x2="36" y2="30" stroke="#1D3279" stroke-width="1.2"/>
    <line x1="-32" y1="36" x2="-30" y2="6" stroke="#1D3279" stroke-width="1.2"/>
    <line x1="-12" y1="36" x2="-10" y2="6" stroke="#1D3279" stroke-width="1.2"/>
    <line x1="10" y1="36" x2="12" y2="6" stroke="#1D3279" stroke-width="1.2"/>
    <line x1="30" y1="36" x2="32" y2="6" stroke="#1D3279" stroke-width="1.2"/>
    <g transform="translate(0 -8)">
      <ellipse cx="-22" cy="-2" rx="10" ry="14" fill="#1D3279"/>
      <ellipse cx="-6" cy="-6" rx="8" ry="12" fill="#1D3279"/>
      <ellipse cx="10" cy="-4" rx="9" ry="13" fill="#1D3279"/>
      <ellipse cx="24" cy="-2" rx="8" ry="11" fill="#1D3279"/>
    </g>
  </g>
  <text x="120" y="186" font-family="Georgia, serif" font-size="36" font-weight="800" fill="#1D3279" text-anchor="middle" letter-spacing="4">VERA</text>
  <text x="120" y="208" font-family="Arial, sans-serif" font-size="9" font-weight="600" fill="#1D3279" text-anchor="middle" letter-spacing="2">CDMX · NEZAHUALCÓYOTL</text>
  <text x="120" y="222" font-family="Arial, sans-serif" font-size="8" font-style="italic" fill="#1D3279" text-anchor="middle" letter-spacing="1.5">tradición y calidad</text>
</svg>
`.trim();

const png = await sharp(Buffer.from(svg)).resize(512).png().toBuffer();
const path = resolve(publicDir, "logo.png");
const { writeFileSync } = await import("node:fs");
writeFileSync(path, png);
console.log(`✅  ${path}  (${(png.length / 1024).toFixed(1)} KB)`);

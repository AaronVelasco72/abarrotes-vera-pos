/**
 * Utilidades de código de barras.
 *
 * Un mismo producto puede leerse como UPC-A (12 dígitos), EAN-13 (13, con un 0
 * al inicio) o GTIN-14 (14, con ceros al inicio) según el scanner o la cámara.
 * Para detectar duplicados comparamos una "clave" sin ceros a la izquierda.
 */

/** Deja solo dígitos (los scanners a veces mandan espacios o saltos de línea). */
export function cleanBarcode(code: string | null | undefined): string {
  return (code ?? "").replace(/\D/g, "");
}

/** Clave canónica para comparar: solo dígitos y sin ceros a la izquierda. */
export function barcodeKey(code: string | null | undefined): string {
  return cleanBarcode(code).replace(/^0+/, "");
}

/** True si dos códigos representan el mismo producto. */
export function sameBarcode(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = barcodeKey(a);
  return ka !== "" && ka === barcodeKey(b);
}

/**
 * Todas las formas en que el código pudo haberse guardado en la base
 * (para consultas `where("barcode", "in", …)`). Máximo 6 valores.
 */
export function barcodeVariants(code: string | null | undefined): string[] {
  const raw = (code ?? "").trim();
  const key = barcodeKey(code);
  if (!key) return raw ? [raw] : [];
  const set = new Set<string>([raw, key]);
  for (const len of [8, 12, 13, 14]) {
    if (key.length <= len) set.add(key.padStart(len, "0"));
  }
  set.delete("");
  return [...set];
}

/** Índice clave→item para búsquedas O(1) al escanear. */
export function indexByBarcode<T extends { barcode?: string | null }>(items: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const it of items) {
    const k = barcodeKey(it.barcode);
    if (k && !map.has(k)) map.set(k, it);
  }
  return map;
}

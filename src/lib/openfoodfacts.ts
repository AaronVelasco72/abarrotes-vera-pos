"use client";

import type { CategoryKey } from "./categories";

export type BarcodeLookupResult = {
  found: boolean;
  name?: string;
  brand?: string;
  quantity?: string;
  imageUrl?: string;
  category?: CategoryKey;
  rawCategories?: string;
};

/**
 * Mapea categorías de Open Food Facts (en inglés/español) a nuestras 8 keys.
 * Best-effort: si no encaja con ninguna, devuelve "otros".
 */
function guessCategory(text: string): CategoryKey {
  const t = text.toLowerCase();
  if (/(soda|refresco|carbonated|cola|jarritos|pepsi|coca)/.test(t)) return "refresco";
  if (/(beer|cerveza|alcohol|wine|vino|tequila|caguama|corona|modelo|victoria)/.test(t)) return "alcohol";
  if (/(water|agua|bonafont|ciel)/.test(t)) return "agua";
  if (/(cigarette|cigarro|tobacco|tabaco|marlboro|pall mall)/.test(t)) return "cigarros";
  if (/(milk|leche|cheese|queso|yogur|yogurt|cream|crema|dairy|láctea|lácteo)/.test(t)) return "lacteos";
  if (/(candy|chocolate|cookie|galleta|dulce|gum|chicle|snack|bar)/.test(t)) return "dulces";
  if (/(bread|pan|egg|huevo|meat|carne|rice|arroz|pasta|beans|frijol|cereal|grain|flour|harina|aceite|oil|food)/.test(t)) return "alimento";
  return "otros";
}

/**
 * Consulta el barcode contra Open Food Facts.
 * Devuelve los campos que se pueden autollenar (name, gramaje, imagen, marca).
 * No falla si no encuentra; sólo regresa found: false.
 */
export async function lookupBarcode(barcode: string): Promise<BarcodeLookupResult> {
  const code = barcode.trim();
  if (!code) return { found: false };

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`,
      { cache: "no-store" },
    );
    if (!res.ok) return { found: false };
    const json = await res.json();
    if (json.status !== 1 || !json.product) return { found: false };

    const p = json.product;
    // Prefer Spanish names if available
    const name =
      p.product_name_es ||
      p.product_name_mx ||
      p.product_name ||
      p.generic_name_es ||
      p.generic_name ||
      "";
    const brand = (p.brands || "").split(",")[0].trim();
    const quantity = (p.quantity || "").trim();
    const imageUrl = p.image_front_url || p.image_url || "";
    const rawCategories = (p.categories || "").trim();
    const haystack = [name, brand, rawCategories].filter(Boolean).join(" ");
    const category = guessCategory(haystack);

    return {
      found: true,
      name: brand && !name.toLowerCase().includes(brand.toLowerCase())
        ? `${brand} ${name}`.trim()
        : name,
      brand,
      quantity,
      imageUrl,
      rawCategories,
      category,
    };
  } catch {
    return { found: false };
  }
}

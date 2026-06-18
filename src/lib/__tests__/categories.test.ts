import { CATEGORIES, CATEGORY_LIST, type CategoryKey } from "@/lib/categories";

describe("CATEGORIES — catálogo de categorías de producto", () => {
  test("TU-19 — existen exactamente 8 categorías predefinidas", () => {
    const expected: CategoryKey[] = [
      "refresco",
      "alcohol",
      "agua",
      "cigarros",
      "lacteos",
      "alimento",
      "dulces",
      "otros",
    ];
    expect(CATEGORY_LIST).toHaveLength(8);
    expected.forEach((k) => {
      expect(CATEGORIES[k]).toBeDefined();
    });
  });

  test("TU-19b — cada categoría tiene label, color, fondo, anillo e ícono", () => {
    CATEGORY_LIST.forEach((c) => {
      expect(c.label).toBeTruthy();
      expect(c.text).toMatch(/^text-/);
      expect(c.bg).toMatch(/^bg-/);
      expect(c.ring).toMatch(/^ring-/);
      expect(typeof c.icon).toBe("function");
    });
  });
});

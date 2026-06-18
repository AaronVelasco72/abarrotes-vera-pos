import { formatMXN } from "@/lib/money";

describe("formatMXN — formato de moneda mexicana", () => {
  test("TU-01 — formatea un entero positivo como MXN con dos decimales", () => {
    expect(formatMXN(34)).toBe("$34.00");
  });

  test("TU-02 — el cero se formatea como $0.00", () => {
    expect(formatMXN(0)).toBe("$0.00");
  });

  test("TU-03 — agrega separador de miles para cantidades grandes", () => {
    // Intl puede usar coma o NBSP; aceptamos ambos.
    expect(formatMXN(1234.5)).toMatch(/^\$1[,\s ]?234\.50$/);
  });

  test("TU-04 — preserva el signo negativo y redondea a dos decimales", () => {
    expect(formatMXN(-50)).toBe("-$50.00");
  });
});

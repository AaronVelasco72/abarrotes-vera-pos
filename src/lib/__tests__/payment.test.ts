import { calculateChange, canConfirmPayment } from "@/lib/payment";

describe("calculateChange — cálculo del cambio que entrega el cajero", () => {
  test("TU-13 — para tarjeta/transferencia el cambio siempre es cero", () => {
    expect(calculateChange("tarjeta", 100, 200)).toBe(0);
    expect(calculateChange("transferencia", 100, 200)).toBe(0);
  });

  test("TU-14 — en efectivo el cambio = recibido − total", () => {
    expect(calculateChange("efectivo", 72, 100)).toBe(28);
    expect(calculateChange("efectivo", 50, 50)).toBe(0);
  });

  test("TU-15 — el cambio nunca es negativo (si paga menos del total)", () => {
    expect(calculateChange("efectivo", 100, 50)).toBe(0);
  });
});

describe("canConfirmPayment — validación previa al cobro", () => {
  test("TU-16 — no se puede confirmar una venta con total cero (RF-06)", () => {
    expect(canConfirmPayment("efectivo", 0, 0)).toBe(false);
    expect(canConfirmPayment("tarjeta", 0, 0)).toBe(false);
  });

  test("TU-17 — en tarjeta/transferencia basta con que el total sea positivo", () => {
    expect(canConfirmPayment("tarjeta", 100, 0)).toBe(true);
    expect(canConfirmPayment("transferencia", 50, 0)).toBe(true);
  });

  test("TU-18 — en efectivo se requiere recibido ≥ total", () => {
    expect(canConfirmPayment("efectivo", 100, 99.99)).toBe(false);
    expect(canConfirmPayment("efectivo", 100, 100)).toBe(true);
    expect(canConfirmPayment("efectivo", 100, 200)).toBe(true);
  });
});

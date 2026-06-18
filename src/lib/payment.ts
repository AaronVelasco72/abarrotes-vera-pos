export type PayMethod = "efectivo" | "tarjeta" | "transferencia";

/**
 * Cambio que el cajero debe entregar al cliente.
 * Sólo aplica a efectivo; en otros métodos el cambio siempre es 0.
 * Nunca regresa un valor negativo (si el cliente pagó menos del total,
 * el cobro no se puede confirmar y el cambio queda en 0).
 */
export function calculateChange(
  method: PayMethod,
  total: number,
  received: number,
): number {
  if (method !== "efectivo") return 0;
  return Math.max(0, received - total);
}

/**
 * Indica si el cobro puede confirmarse con los datos actuales.
 *  - No se permite confirmar una venta con total cero (RF-06 implícito).
 *  - En efectivo: el monto recibido debe cubrir al menos el total.
 *  - En tarjeta o transferencia: basta con que el total sea positivo.
 */
export function canConfirmPayment(
  method: PayMethod,
  total: number,
  received: number,
): boolean {
  if (total <= 0) return false;
  if (method !== "efectivo") return true;
  return received >= total;
}
